# Reference Architecture

Every project copies this shape into `src/`. Learn it once; reuse it four times. This is the "what a senior AI engineer reaches for" stack.

## Layered view

> **These are production products that run themselves daily** — not demos. The
> top and bottom layers below (Autonomy + Distribution) are what make that real:
> the system wakes on a schedule, does work, gets it approved, and publishes.

```
┌─────────────────────────────────────────────────────────────┐
│  Autonomy          Scheduler (cron/BullMQ repeatable) →      │
│                    "missions" run daily / at intervals       │
├─────────────────────────────────────────────────────────────┤
│  Interface         Hono HTTP API  ·  CLI  ·  (optional Next) │
├─────────────────────────────────────────────────────────────┤
│  Orchestration     Supervisor → Worker agents · Workflows    │
│                    (plan → act → observe → reflect loop)     │
├─────────────────────────────────────────────────────────────┤
│  Agent core        Agent base · Tool registry · Memory       │
│                    Guardrails · Structured output (Zod)      │
├─────────────────────────────────────────────────────────────┤
│  Model layer       ModelRouter (T0 local→T1 open→T2 frontier)│
│                    Semantic cache · prompt cache · fallback  │
├─────────────────────────────────────────────────────────────┤
│  Knowledge         RAG: ingest → chunk → embed → pgvector    │
│                    hybrid search + rerank + contextual chunks│
├─────────────────────────────────────────────────────────────┤
│  Approval +        Compliance check → review gate (approve/  │
│  Compliance        reject via Telegram/web) before publish   │
├─────────────────────────────────────────────────────────────┤
│  Distribution      Publisher interface → X/Twitter · LinkedIn│
│                    newsletter (Resend) · web feed · video    │
├─────────────────────────────────────────────────────────────┤
│  Platform          Postgres+pgvector · Redis/BullMQ ·        │
│                    Langfuse traces+evals · OpenTelemetry     │
└─────────────────────────────────────────────────────────────┘
```

### The production loop (every project, every day)

```
schedule fires → ingest fresh data → agents research/draft →
compliance check → approval gate (if required) → publish to channels →
trace cost+quality to Langfuse → store + learn
```

## Directory layout (per project)

```
<project>/
├── README.md
├── docs/
│   ├── DOMAIN.md             # domain knowledge (grants/jobs/content/fixed-income)
│   ├── ROADMAP.md            # phased build plan + acceptance criteria
│   └── DECISIONS.md          # architecture decision records (ADRs)
├── prisma/
│   └── schema.prisma         # state + pgvector store
├── src/
│   ├── core/                 # ← shared foundation (copied from _blueprint)
│   │   ├── models/           # ModelRouter, providers, cache, model catalog
│   │   ├── agent/            # Agent base, tool registry, loop, guardrails, memory
│   │   ├── rag/              # ingest, chunk, embed, retrieve, rerank
│   │   ├── schedule/         # mission scheduler (BullMQ repeatable / cron)
│   │   ├── publish/          # Publisher interface + channels (X, LinkedIn, email)
│   │   ├── approval/         # compliance check + human review gate (HITL)
│   │   ├── eval/             # eval harness, LLM-as-judge, datasets
│   │   ├── obs/              # Langfuse + OTel tracing helpers
│   │   ├── queue/            # BullMQ setup, workers
│   │   └── config/           # Zod-validated env
│   ├── agents/               # domain agents (supervisor + workers)
│   ├── tools/                # domain tools (scrapers, APIs, calculators)
│   ├── missions/             # scheduled jobs (e.g. dailyMorningBrief, oppScan)
│   ├── workflows/            # multi-step pipelines
│   ├── server/               # Hono routes (health, webhooks, approval callbacks)
│   └── index.ts
├── tests/                    # vitest unit + eval suites
├── docker-compose.yml        # postgres+pgvector, redis, langfuse
├── Dockerfile
└── Caddyfile                 # TLS reverse proxy for VPS
```

## Agent patterns implemented (the "masterful" checklist)

These appear across the four projects. Each is a learning objective (see [CURRICULUM.md](./CURRICULUM.md)).

- **Agentic loop** — `plan → act (tools) → observe → reflect → stop`, with max-steps + budget guards.
- **Supervisor / worker (multi-agent)** — a planner delegates to specialized sub-agents and merges results.
- **Tool use / function calling** — typed tools (Zod schemas) with a registry; the model picks tools.
- **Structured output** — `generateObject` + Zod for every machine-consumed result; never parse free text.
- **RAG, done well** — semantic + keyword **hybrid search**, **reranking**, **contextual retrieval** (prepend doc context to chunks before embedding), citations.
- **Memory** — short-term (conversation), long-term (vector + summary), per-entity profiles.
- **Hybrid model routing** — choose tier by complexity / privacy / latency / cost (see MODEL-ROUTING.md).
- **Caching** — exact + **semantic cache** for repeated queries; Anthropic prompt caching for long system prompts.
- **Guardrails** — input validation, output schema validation, PII checks, refusal handling, retry-with-repair.
- **Evals** — golden datasets, **LLM-as-judge**, regression gates in CI; trace every run to Langfuse.
- **Observability** — every model call + tool call + agent step is a span; cost + tokens + latency tracked.
- **Durable execution** — long tasks run as BullMQ jobs; resumable, retryable, scheduled.
- **MCP** — expose/consume tools via Model Context Protocol where it adds reach.
- **Distillation path** — capture frontier-model traces → fine-tune/distill into a local 7-8B for cheap repeat tasks.

## Why custom core over a framework

You learn the internals (the point of this exercise), keep the dependency surface small, and stay portable across providers. The core is ~1.5k LOC and is the same in all four repos. When a project outgrows it, the migration target is **Mastra** (batteries-included TS agents) or **LangGraph.js** (graph control flow) — both documented in each project's `docs/DECISIONS.md`.
