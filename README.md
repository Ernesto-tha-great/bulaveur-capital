# Bulaveur Capital

[![CI](https://github.com/Ernesto-tha-great/bulaveur-capital/actions/workflows/ci.yml/badge.svg)](https://github.com/Ernesto-tha-great/bulaveur-capital/actions/workflows/ci.yml)

**An autonomous fixed-income research firm.** It wakes on a schedule, ingests
rates / credit / macro market data, runs a team of specialist research agents,
and publishes analyst-grade briefs, trade ideas, and a weekly credit note to X
and email — with **every artifact gated by a compliance check and a human
approval** before it goes out.

Think of it as a small research desk that runs itself: data in, research done,
compliance cleared, you tap *approve*, it publishes. The whole loop is traced
for cost and quality.

```
schedule → ingest data → multi-agent research → compliance + fabrication guard
        → human approval → publish (X / newsletter) → trace cost & quality
```

> **Not investment advice.** Everything this system produces is informational
> market commentary and carries that disclaimer. See [Compliance](#-compliance).

---

## Why it's interesting

A production agentic system built the way a senior AI engineer would, not a demo:

- **Multi-agent research** — a supervisor fans out to specialist workers (macro,
  credit, relative-value) in parallel, then a synthesis + **critic** pass grades
  the result before anything leaves the building.
- **Grounded, not hallucinated** — research agents reason over ingested market
  data and SEC filings (RAG with hybrid search + reranking). A **deterministic
  fabrication guard** hard-fails any number in a draft that can't be traced back
  to the underlying data.
- **Cost-routed models** — a 3-tier router sends each task to the cheapest model
  that can do it well: local (Ollama) for extraction/first drafts → open models
  via OpenRouter for reasoning → frontier (Claude) for final notes and judging.
- **Human-in-the-loop autonomy** — it runs unattended on a cron schedule, but
  financial content never publishes without a compliance pass **and** a one-tap
  human approval (delivered to Telegram).
- **Observable** — every mission run is recorded (status, cost, tokens) and
  traced to Langfuse, so routing and quality can be tuned from real data.

## Architecture at a glance

```
┌────────────────────────────────────────────────────────────┐
│ Autonomy      BullMQ cron missions (morning brief, scans,   │
│               weekly note) — the system runs itself         │
├────────────────────────────────────────────────────────────┤
│ Research      Supervisor → macro / credit / RV workers →    │
│               synthesis → CriticAgent quality gate          │
├────────────────────────────────────────────────────────────┤
│ Grounding     RAG over FRED data + SEC filings (pgvector,   │
│               hybrid search + rerank) + fabrication guard   │
├────────────────────────────────────────────────────────────┤
│ Models        3-tier router: local → open (OpenRouter) →    │
│               frontier (Claude); budget-capped per run      │
├────────────────────────────────────────────────────────────┤
│ Safety        complianceCheck → human approval (Telegram)   │
│               before any publish                            │
├────────────────────────────────────────────────────────────┤
│ Distribution  X threads · Resend newsletter (pluggable)     │
├────────────────────────────────────────────────────────────┤
│ Platform      Hono API · Postgres+pgvector · Redis · tsx ·  │
│               Langfuse traces                               │
└────────────────────────────────────────────────────────────┘
```

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
[docs/DOMAIN.md](docs/DOMAIN.md) · [docs/MODEL-ROUTING.md](docs/MODEL-ROUTING.md).

## The missions (what it does, on a schedule)

| Mission | Cadence (UTC) | Pipeline |
|---------|---------------|----------|
| `morning-brief` | Weekdays 11:30 | FRED sync → **MacroAgent** regime read → X-thread brief → compliance + fabrication guard → approval → **X thread** |
| `opportunity-scan` | Every 2h, US session | **RVAgent** screen → opportunity note → guards → approval → **X thread** |
| `weekly-credit-note` | Wed 14:00 | EDGAR→RAG + macro/credit/RV workers → synthesis → **CriticAgent** → recommendations → approval → **newsletter** |

## Emerging-markets desks

Fixed-income coverage is going **global with an EM focus**, split into **one desk
per market** so nothing slips. Each desk covers the full local FI stack — govvies
/ curve, T-bills, commercial paper, hard-currency credit, FX — grounded only in
that market's data, and self-scores every idea on **actionability × shareability**
so the desk output can be ranked into what's worth publishing.

- Markets are pure config in [src/markets/registry.ts](src/markets/registry.ts)
  (LatAm · EM Europe · MENA · Africa · EM Asia).
- Data is free-first (see [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md)): FRED EM
  aggregate spreads + World Bank fundamentals for every market, upgraded to a
  central bank's own curve where a free API exists (Brazil BCB, Mexico Banxico).
- Run one on demand: `pnpm desk BR` → a grounded, ranked market note.

## Tech stack

TypeScript (ESM) · Node 22 · **tsx** (run TS directly, no build step) ·
Vercel **AI SDK v6** · **Prisma 6** + Postgres/**pgvector** · **BullMQ** + Redis ·
**Hono** · **Langfuse** · Docker Compose + Caddy for deploy.

---

## Quick start (local)

**Prerequisites:** Node 22 + `corepack enable`, Docker (Postgres + Redis), and at
least one model tier configured — either [Ollama](https://ollama.com) running
locally (free) or an OpenRouter / Anthropic key.

```bash
git clone https://github.com/Ernesto-tha-great/bulaveur-capital.git
cd bulaveur-capital
cp .env.example .env          # fill in model keys + FRED_API_KEY

pnpm install
docker compose up -d          # postgres + pgvector, redis
pnpm db:migrate               # create the schema
pnpm verify                   # health-check the model tiers

# run the full loop by hand
pnpm sync:data                # pull FRED market data (needs FRED_API_KEY)
pnpm seed:watchlist           # seed issuers for the weekly note
pnpm ingest                   # pull SEC filings into RAG (needs SEC_USER_AGENT)
pnpm mission morning-brief    # draft → guards → queues an approval item

# approve it → the X thread posts:
curl -X POST localhost:8080/approvals/<id>/approved

pnpm dev                      # or: run the API + scheduler + worker always-on
```

### The accounts you need

| For | Service | Cost | Env var |
|-----|---------|------|---------|
| Rates / macro data | [FRED](https://fred.stlouisfed.org/docs/api/api_key.html) | Free | `FRED_API_KEY` |
| Credit filings | SEC EDGAR | Free, no key | `SEC_USER_AGENT` (`"Name email"`) |
| Reasoning (T1) | [OpenRouter](https://openrouter.ai) | ¢ per call | `OPENROUTER_API_KEY` |
| Final notes / judging (T2) | [Anthropic](https://console.anthropic.com) | $ per call | `ANTHROPIC_API_KEY` |
| Local models (T0) | [Ollama](https://ollama.com) | Free | `OLLAMA_BASE_URL` |
| Publish to X | [X developer](https://developer.x.com) OAuth2 (`tweet.write`) | Free tier | `X_ACCESS_TOKEN` |
| Newsletter | [Resend](https://resend.com) | Free tier | `RESEND_API_KEY` |
| Approvals to phone | Telegram bot (`@BotFather`) | Free | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Traces | [Langfuse](https://cloud.langfuse.com) | Free tier | `LANGFUSE_*` |

You can start with just **FRED + one model tier** — that's enough to produce and
review a morning brief. Wire the rest as you go.

## ⚖️ Compliance

Compliance is non-negotiable and built into the publish path, not bolted on:

- Every published artifact carries the disclaimer *"Not investment advice.
  Informational only. Do your own research."*
- Banned hype phrases (`guaranteed return`, `risk-free`, `can't lose`) **hard-fail**
  the check.
- Financial content defaults to `autoApprove: false` — nothing publishes without a
  human tapping approve.
- The **fabrication guard** flags any figure in a draft that doesn't trace to
  ingested data, so the reviewer sees it before it's posted.

> **You are responsible for your own regulatory posture.** Treat the output as
> published market commentary and consult counsel before operating a public
> account in your jurisdiction (e.g. rules on personalized advice / registration).

## Commands

| Command | What it does |
|---------|--------------|
| `pnpm dev` | API + scheduler + mission worker (watch mode) |
| `pnpm start` | Same, production mode (single process) |
| `pnpm worker` | Scheduler + mission worker only (split-deploy) |
| `pnpm verify` | Health-check the model tiers |
| `pnpm sync:data` | Pull FRED market data → `MarketObservation` |
| `pnpm seed:watchlist` | Seed the issuer watchlist |
| `pnpm ingest [ticker]` | Ingest SEC filings into RAG |
| `pnpm mission <name>` | Run one mission on demand |
| `pnpm desk <market>` | Run one EM market desk (e.g. `BR`, `MX`) → ranked note |
| `pnpm test` / `pnpm eval` | Fabrication guard (offline) + LLM-as-judge eval |
| `pnpm typecheck` | `tsc --noEmit` — the CI gate |
| `pnpm db:migrate` / `db:deploy` | Prisma migrate (dev / prod) |

## Deploy

Runs always-on from a single container on a small VPS (Hetzner CX22 ~€4/mo):
Docker Compose brings up the app + Postgres + Redis, Caddy terminates TLS and
serves the approval/webhook URLs. Full runbook — deploy, backups, alerts, cost
control — in [docs/OPS.md](docs/OPS.md).

## Status

**Feature-complete (Phases 0–4)** and typechecking, with the fabrication
guardrail unit-tested offline. Wiring it to a live account is operational: add
the keys above, point it at a Postgres, and deploy. Roadmap and phase detail:
[docs/ROADMAP.md](docs/ROADMAP.md).

## License

[MIT](LICENSE) © Ernest Nnamdi
