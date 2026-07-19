# Model Routing — the 3-tier hybrid strategy

The single most important "senior AI engineer" skill in a lean budget: **send each task to the cheapest model that can do it well.** The `ModelRouter` in `src/core/models/` encodes this.

## Tiers

| Tier | Provider | Models | When the router picks it |
|------|----------|--------|--------------------------|
| **T0 — Local** | Ollama (your M2, 16GB) | `qwen2.5:7b`, `llama3.2:3b`, `nomic-embed-text` | Bulk/high-volume, private data that must not leave the machine, classification, extraction, embeddings, first drafts. **~$0.** |
| **T1 — Cheap cloud-open** | OpenRouter | `z-ai/glm-4.6`, `moonshotai/kimi-k2`, `deepseek/deepseek-chat`, `mistralai/mistral-small` | Real reasoning, long context, agentic tool loops, anything T0 fumbles. Pennies per call. |
| **T2 — Frontier** | Anthropic (direct) | `claude-sonnet-4-6`, `claude-opus-4-8` | Hard multi-step reasoning, final client-facing drafts, **LLM-as-judge** evals, anything correctness-critical. |

> Embeddings: `nomic-embed-text` (local, free) by default; fall back to a hosted embed model only if quality demands it.

## How the router decides

The router takes a **task descriptor**, not just a prompt:

```ts
route({
  capability: "reasoning" | "extraction" | "draft" | "judge" | "embed" | "vision",
  complexity: "low" | "medium" | "high",
  privacy:    "public" | "private",      // private ⇒ never leave local unless forced
  maxLatencyMs?: number,
  budgetCents?: number,                  // hard cap; refuse/fallback if exceeded
})
```

Decision order (see `model-router.ts`):

1. **privacy = private** → force **T0 local** (or a self-hosted T1 if configured). Never send to a third party.
2. **capability = embed** → local embed model.
3. **capability = judge** or **complexity = high** → **T2 frontier**.
4. **complexity = medium** → **T1** (GLM-4.6 / Kimi K2), fall back T2 on failure.
5. else → **T0 local**, fall back T1 on low-confidence/validation failure.

Every decision is logged to Langfuse with the resolved model, token cost, and latency, so you can **audit and tune routing from real data** — that's the loop that makes you good at this.

## Cost discipline (staying under ~$50/mo)

- **Default to T0.** A 7-8B local model handles a surprising amount: extraction, tagging, summarizing, query rewriting, first drafts.
- **Cache aggressively.** Exact-match + semantic cache (`src/core/models/cache.ts`). Anthropic **prompt caching** for long, stable system prompts.
- **Batch + queue.** Bulk jobs run on BullMQ at off-peak, on T0/T1.
- **Escalate, don't start high.** Try T0 → validate → escalate to T1 → T2 only if needed. The validator (Zod schema + confidence heuristics) gates escalation.
- **Distill.** Once a task is stable on T2, capture traces and distill into a local model. Cost → ~$0 thereafter.

## Provider wiring (AI SDK v6)

```ts
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ai-sdk-ollama";

export const anthropic  = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
export const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
export const ollama     = createOllama({ baseURL: env.OLLAMA_BASE_URL });
```

All three return AI-SDK `LanguageModel`s, so `generateText` / `generateObject` / `streamText` work identically regardless of tier. **Swapping models is a one-line change** — that portability is the whole point of routing.

## Model catalog & current ids

Pin the catalog in `src/core/models/catalog.ts`. Update ids as models evolve (use `/claude-api` skill or OpenRouter's model list). As of mid-2026 the defaults are:

- Frontier: `claude-opus-4-8` (hard), `claude-sonnet-4-6` (default frontier).
- Open via OpenRouter: `z-ai/glm-4.6`, `moonshotai/kimi-k2`, `deepseek/deepseek-chat`, `mistralai/mistral-small-latest`.
- Local via Ollama: `qwen2.5:7b` (default), `llama3.2:3b` (fast), `nomic-embed-text` (embed).
