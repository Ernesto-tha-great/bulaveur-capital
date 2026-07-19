import { generateObject, generateText, type ModelMessage, type ToolSet } from "ai";
import type { z } from "zod";
import { env } from "../config/env";
import { logger } from "../logger";
import { CATALOG, type Capability, type ModelSpec, estimateCostUsd } from "./catalog";
import { usableChain } from "./usable";

/**
 * Describe the TASK, not the model. The router maps task → cheapest model that
 * can do it well, then escalates on failure. This is the single highest-leverage
 * cost lever in the whole system.
 */
export interface TaskDescriptor {
  capability: Capability;
  complexity?: "low" | "medium" | "high";
  /** `private` data never leaves the local machine. */
  privacy?: "public" | "private";
  /** Needs a very large context window (routes to long-context models). */
  longContext?: boolean;
  /** Hard cap for this call; falls back/refuses if exceeded. */
  budgetCents?: number;
  /** Free-text label for tracing/Langfuse. */
  label?: string;
}

export interface RouteDecision {
  primary: ModelSpec;
  /** Ordered escalation chain tried if the primary fails validation. */
  fallbacks: ModelSpec[];
  reason: string;
}

/** Pure, testable model selection. Audit this against real traces to tune it. */
export function route(task: TaskDescriptor): RouteDecision {
  const complexity = task.complexity ?? "low";

  // 1. Embeddings are always local + free.
  if (task.capability === "embed") {
    return { primary: CATALOG.embed, fallbacks: [], reason: "embedding → local" };
  }

  // 2. Privacy wins over everything: private data stays on-device.
  if (task.privacy === "private") {
    const primary = complexity === "low" ? CATALOG.localFast : CATALOG.local;
    return { primary, fallbacks: [CATALOG.local], reason: "private → local only" };
  }

  // 3. Judging and hard reasoning demand the frontier.
  if (task.capability === "judge" || complexity === "high") {
    const primary = complexity === "high" ? CATALOG.frontierHard : CATALOG.frontier;
    return {
      primary,
      fallbacks: [CATALOG.frontier, CATALOG.open],
      reason: `${task.capability}/${complexity} → frontier`,
    };
  }

  // 4. Medium complexity → cheap cloud-open, escalate to frontier.
  if (complexity === "medium") {
    const primary = task.longContext ? CATALOG.openLong : CATALOG.open;
    return { primary, fallbacks: [CATALOG.open, CATALOG.frontier], reason: "medium → open(T1)" };
  }

  // 5. Everything else: try local first, escalate to open then frontier.
  return {
    primary: CATALOG.local,
    fallbacks: [CATALOG.open, CATALOG.frontier],
    reason: "low → local(T0), escalate on failure",
  };
}

export interface RunCost {
  model: string;
  tier: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** A simple budget ledger you thread through an agent run. */
export class BudgetLedger {
  private spentUsd = 0;
  readonly costs: RunCost[] = [];
  constructor(private readonly capUsd = env.MAX_RUN_BUDGET_CENTS / 100) {}

  record(spec: ModelSpec, inputTokens: number, outputTokens: number): void {
    const costUsd = estimateCostUsd(spec, inputTokens, outputTokens);
    this.spentUsd += costUsd;
    this.costs.push({ model: spec.id, tier: spec.tier, inputTokens, outputTokens, costUsd });
  }
  get totalUsd(): number {
    return this.spentUsd;
  }
  remainingUsd(): number {
    return this.capUsd - this.spentUsd;
  }
  assertWithinBudget(): void {
    if (this.spentUsd > this.capUsd) {
      throw new Error(`Run budget exceeded: $${this.spentUsd.toFixed(4)} > $${this.capUsd.toFixed(2)}`);
    }
  }
}

import { getModel } from "./providers";

export interface RoutedTextOptions {
  task: TaskDescriptor;
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  tools?: ToolSet;
  temperature?: number;
  maxOutputTokens?: number;
  ledger?: BudgetLedger;
}

/**
 * Routed text generation with automatic tier escalation on failure.
 * Tries primary → fallbacks in order, records cost, returns the AI-SDK result
 * plus which model actually answered.
 */
export async function routedGenerateText(opts: RoutedTextOptions) {
  const decision = route(opts.task);
  const chain = usableChain([decision.primary, ...decision.fallbacks]);
  if (chain.length === 0) throw new Error("No usable model tier for task (check API keys).");

  let lastErr: unknown;
  for (const spec of chain) {
    try {
      const result = await generateText({
        model: getModel(spec),
        system: opts.system,
        tools: opts.tools,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
        // AI SDK's prompt is a union of {prompt} | {messages}; supply exactly one.
        ...(opts.messages ? { messages: opts.messages } : { prompt: opts.prompt ?? "" }),
      });
      opts.ledger?.record(spec, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0);
      logger.debug(
        { model: spec.id, tier: spec.tier, reason: decision.reason, label: opts.task.label },
        "routed.text",
      );
      return Object.assign(result, { resolvedModel: spec });
    } catch (err) {
      lastErr = err;
      logger.warn({ model: spec.id, err: String(err) }, "routed.text.fallback");
    }
  }
  throw new Error(`All model tiers failed: ${String(lastErr)}`);
}

export interface RoutedObjectOptions<T> {
  task: TaskDescriptor;
  schema: z.ZodType<T>;
  system?: string;
  prompt: string;
  temperature?: number;
  ledger?: BudgetLedger;
}

/**
 * Routed STRUCTURED generation. Never parse free text for machine-consumed
 * results — get a validated object or escalate. Zod validation is the gate that
 * decides whether a cheap model's answer is good enough or we escalate a tier.
 */
export async function routedGenerateObject<T>(opts: RoutedObjectOptions<T>): Promise<{ object: T; resolvedModel: ModelSpec }> {
  const decision = route(opts.task);
  const chain = usableChain([decision.primary, ...decision.fallbacks]);
  if (chain.length === 0) throw new Error("No usable model tier for task (check API keys).");

  let lastErr: unknown;
  for (const spec of chain) {
    try {
      const result = await generateObject({
        model: getModel(spec),
        schema: opts.schema,
        system: opts.system,
        prompt: opts.prompt,
        temperature: opts.temperature,
      });
      opts.ledger?.record(spec, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0);
      logger.debug({ model: spec.id, tier: spec.tier, label: opts.task.label }, "routed.object");
      return { object: result.object, resolvedModel: spec };
    } catch (err) {
      lastErr = err;
      logger.warn({ model: spec.id, err: String(err) }, "routed.object.fallback");
    }
  }
  throw new Error(`All model tiers failed for structured gen: ${String(lastErr)}`);
}
