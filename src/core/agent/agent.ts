import { generateText, stepCountIs, type ModelMessage, type StepResult, type ToolSet } from "ai";
import { logger } from "../logger";
import { route, BudgetLedger, type TaskDescriptor } from "../models/model-router";
import { getModel } from "../models/providers";
import { usableChain } from "../models/usable";
import type { ToolRegistry } from "./tool";

/**
 * A single autonomous agent: instructions + tools + a routed model, run inside a
 * bounded agentic loop (plan → call tools → observe → repeat → stop).
 *
 * Why hand-rolled instead of a framework: you should be able to explain every
 * line of an agent loop in an interview. The SDK gives us the multi-step plumbing
 * (`stopWhen`, auto tool-execution); we own the policy — model choice, step/budget
 * caps, tracing, escalation. That division is exactly how production agents are built.
 */
export interface AgentConfig {
  name: string;
  instructions: string;
  registry?: ToolRegistry;
  /** Routing hint: how hard is this agent's job? */
  task: TaskDescriptor;
  maxSteps?: number;
  temperature?: number;
}

export interface AgentRunResult {
  text: string;
  steps: StepResult<ToolSet>[];
  resolvedModel: string;
  ledger: BudgetLedger;
}

export class Agent {
  constructor(private readonly config: AgentConfig) {}

  async run(
    input: string | ModelMessage[],
    ctx: { ledger?: BudgetLedger } = {},
  ): Promise<AgentRunResult> {
    const ledger = ctx.ledger ?? new BudgetLedger();
    const decision = route(this.config.task);
    const chain = usableChain([decision.primary, ...decision.fallbacks]);
    if (chain.length === 0) throw new Error("No usable model tier (check API keys).");

    const tools = this.config.registry?.toolSet();
    const messages: ModelMessage[] =
      typeof input === "string" ? [{ role: "user", content: input }] : input;

    let lastErr: unknown;
    // Whole-run escalation: if a tier errors, retry the run on the next tier.
    for (const spec of chain) {
      try {
        const result = await generateText({
          model: getModel(spec),
          system: this.config.instructions,
          messages,
          tools,
          temperature: this.config.temperature,
          stopWhen: stepCountIs(this.config.maxSteps ?? 8),
          onStepFinish: (step) => {
            ledger.record(spec, step.usage.inputTokens ?? 0, step.usage.outputTokens ?? 0);
            ledger.assertWithinBudget();
            logger.debug(
              { agent: this.config.name, tier: spec.tier, tools: step.toolCalls.map((c) => c.toolName) },
              "agent.step",
            );
          },
        });
        return {
          text: result.text,
          steps: result.steps,
          resolvedModel: spec.id,
          ledger,
        };
      } catch (err) {
        lastErr = err;
        logger.warn({ agent: this.config.name, model: spec.id, err: String(err) }, "agent.escalate");
      }
    }
    throw new Error(`Agent ${this.config.name} failed on all tiers: ${String(lastErr)}`);
  }
}
