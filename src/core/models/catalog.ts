import { env } from "../config/env";

/**
 * The model catalog: the menu the router chooses from.
 *
 * Tiers (cheapest → most capable):
 *   T0 local    — runs on your Mac via Ollama. ~$0. Private by construction.
 *   T1 open     — cheap cloud-open models via OpenRouter (GLM, Kimi, DeepSeek, Mistral).
 *   T2 frontier — Claude, direct. Reserve for hard reasoning / judging / final drafts.
 *
 * Costs are USD per 1M tokens, used by the router's budget accounting. Keep them
 * roughly current; exact numbers matter less than relative ordering.
 */
export type Tier = "local" | "open" | "frontier";

export type Capability = "reasoning" | "extraction" | "draft" | "judge" | "embed" | "vision";

export interface ModelSpec {
  id: string;
  tier: Tier;
  /** Provider key used by providers.ts to build the AI-SDK model. */
  provider: "ollama" | "openrouter" | "anthropic";
  /** USD per 1M input / output tokens. local = 0. */
  costInPer1M: number;
  costOutPer1M: number;
  contextWindow: number;
  capabilities: Capability[];
  /** Lower = preferred when several models satisfy a request. */
  preference: number;
}

// `satisfies` keeps the literal keys (CATALOG.local etc.) strongly typed and
// non-optional under noUncheckedIndexedAccess, while still checking each entry.
export const CATALOG = {
  // ── T0 local (Ollama) ───────────────────────────────────────────────
  local: {
    id: env.MODEL_LOCAL,
    tier: "local",
    provider: "ollama",
    costInPer1M: 0,
    costOutPer1M: 0,
    contextWindow: 32_768,
    capabilities: ["extraction", "draft", "reasoning"],
    preference: 0,
  },
  localFast: {
    id: env.MODEL_LOCAL_FAST,
    tier: "local",
    provider: "ollama",
    costInPer1M: 0,
    costOutPer1M: 0,
    contextWindow: 8_192,
    capabilities: ["extraction", "draft"],
    preference: 0,
  },
  embed: {
    id: env.MODEL_EMBED,
    tier: "local",
    provider: "ollama",
    costInPer1M: 0,
    costOutPer1M: 0,
    contextWindow: 8_192,
    capabilities: ["embed"],
    preference: 0,
  },

  // ── T1 open (OpenRouter) ────────────────────────────────────────────
  open: {
    id: env.MODEL_OPEN, // z-ai/glm-4.6
    tier: "open",
    provider: "openrouter",
    costInPer1M: 0.4,
    costOutPer1M: 1.75,
    contextWindow: 200_000,
    capabilities: ["reasoning", "extraction", "draft"],
    preference: 1,
  },
  openLong: {
    id: "moonshotai/kimi-k2",
    tier: "open",
    provider: "openrouter",
    costInPer1M: 0.5,
    costOutPer1M: 2.0,
    contextWindow: 256_000,
    capabilities: ["reasoning", "extraction", "draft"],
    preference: 2,
  },

  // ── T2 frontier (Anthropic) ─────────────────────────────────────────
  frontier: {
    id: env.MODEL_FRONTIER, // claude-sonnet-4-6
    tier: "frontier",
    provider: "anthropic",
    costInPer1M: 3.0,
    costOutPer1M: 15.0,
    contextWindow: 200_000,
    capabilities: ["reasoning", "extraction", "draft", "judge", "vision"],
    preference: 3,
  },
  frontierHard: {
    id: env.MODEL_FRONTIER_HARD, // claude-opus-4-8
    tier: "frontier",
    provider: "anthropic",
    costInPer1M: 15.0,
    costOutPer1M: 75.0,
    contextWindow: 200_000,
    capabilities: ["reasoning", "draft", "judge", "vision"],
    preference: 4,
  },
} satisfies Record<string, ModelSpec>;

export type CatalogKey = keyof typeof CATALOG;

/** Estimate USD cost of a call given token counts. */
export function estimateCostUsd(spec: ModelSpec, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1e6) * spec.costInPer1M + (outputTokens / 1e6) * spec.costOutPer1M;
}
