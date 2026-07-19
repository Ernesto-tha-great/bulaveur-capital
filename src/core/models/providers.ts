import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { EmbeddingModel, LanguageModel } from "ai";
import { env } from "../config/env";
import { CATALOG, type ModelSpec } from "./catalog";

/**
 * Provider wiring. All three tiers return AI-SDK models with the SAME interface,
 * so the rest of the app never knows or cares which tier it's talking to.
 * Swapping a model is a one-line change in the catalog — that portability is
 * the entire reason we route instead of hardcoding a provider.
 */

// T2 — Claude, direct
const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY ?? "" });

// T1 — OpenRouter gateway to GLM / Kimi / DeepSeek / Mistral
const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY ?? "" });

// T0 — Ollama via its OpenAI-compatible endpoint (rock-solid, version-stable)
const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: env.OLLAMA_BASE_URL,
});

/** Build a chat/completion model for a catalog spec. */
export function getModel(spec: ModelSpec): LanguageModel {
  switch (spec.provider) {
    case "anthropic":
      return anthropic(spec.id);
    case "openrouter":
      return openrouter(spec.id);
    case "ollama":
      return ollama.chatModel(spec.id);
    default:
      throw new Error(`Unknown provider for model ${spec.id}`);
  }
}

/** The local embedding model (free, private). */
export function getEmbeddingModel(): EmbeddingModel {
  return ollama.textEmbeddingModel(CATALOG.embed.id);
}
