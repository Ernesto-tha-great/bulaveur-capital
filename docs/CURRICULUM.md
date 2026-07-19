# The Senior AI Engineer Curriculum

The point isn't to ship four apps — it's that **you can build any agentic system from scratch and reason about every tradeoff.** Each skill below maps to concrete features you'll implement. Build in order; each project deepens the previous.

## Phase 0 — Foundations (Grantsmith)
- [ ] **Provider-agnostic LLM calls** — AI SDK `generateText` / `streamText` / `generateObject` across Ollama, OpenRouter, Claude.
- [ ] **Structured output** — Zod schemas for every machine-read result; understand JSON-mode vs tool-calling vs grammar.
- [ ] **Tool use** — typed tools, the model-picks-tool loop, error handling.
- [ ] **The agentic loop** — plan→act→observe→reflect, step/budget guards. Build it by hand once.
- [ ] **Model routing** — the 3-tier router; measure cost/latency/quality per tier on a real task.
- **Deliverable:** Grantsmith finds + scores + drafts one grant end-to-end, deployed.

## Phase 1 — Knowledge & retrieval (Grantsmith → Bulaveur)
- [ ] **Embeddings & vector search** — pgvector, cosine vs L2, index tuning (HNSW).
- [ ] **Chunking** that doesn't suck — structural chunking, overlap, metadata.
- [ ] **Hybrid search** — BM25/keyword + vector, fusion (RRF).
- [ ] **Reranking** — cross-encoder / LLM rerank of top-k.
- [ ] **Contextual retrieval** — prepend doc-level context to chunks before embedding (cuts retrieval errors hard).
- [ ] **Citations & grounding** — every claim traces to a source span.
- **Deliverable:** Bulaveur answers "what's our view on issuer X" with cited evidence.

## Phase 2 — Multi-agent orchestration (Bulaveur, Piron Studio)
- [ ] **Supervisor/worker** — planner delegates to specialists, merges results.
- [ ] **Handoffs & shared scratchpad** — agents passing state.
- [ ] **Reflection / self-critique** — a critic agent gates output quality.
- [ ] **Workflows vs autonomous agents** — when to hardcode the graph vs let the model drive.
- [ ] **Human-in-the-loop** — approval gates for high-stakes actions (publish, submit).
- **Deliverable:** Bulaveur produces a multi-section research note via specialist agents + critic.

## Phase 3 — Evaluation & reliability (all projects)
- [ ] **Eval datasets** — golden sets, edge cases, adversarial inputs.
- [ ] **LLM-as-judge** — rubric prompts, bias controls, pairwise comparison.
- [ ] **Regression gates** — evals run in CI; a PR that drops quality fails.
- [ ] **Guardrails** — input/output validation, PII, prompt-injection defenses, refusal repair.
- [ ] **Tracing & cost** — Langfuse spans for every call; dashboards for cost/quality drift.
- **Deliverable:** each project has a passing eval suite wired into CI.

## Phase 4 — Production & optimization (all projects)
- [ ] **Durable execution** — BullMQ jobs, retries, idempotency, scheduling.
- [ ] **Caching** — exact + semantic + provider prompt caching; measure hit rate + savings.
- [ ] **Deployment** — Docker Compose to VPS, Caddy TLS, secrets, health checks, backups.
- [ ] **Observability in prod** — alerts on cost spikes, error rates, latency.
- [ ] **Distillation / fine-tuning** — capture T2 traces → fine-tune a local model → route to it.
- [ ] **MCP** — expose tools as an MCP server; consume external MCP tools.
- **Deliverable:** all four live on the VPS, scheduled, traced, within budget.

## How to use this
Treat each `[ ]` as a PR. Open `docs/ROADMAP.md` in a project, pick the next item, and build it. Write down what you learned in `docs/DECISIONS.md`. That written reasoning is what turns "I used a library" into "I'm a senior engineer."
