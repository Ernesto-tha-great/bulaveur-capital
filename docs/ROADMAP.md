# Roadmap — Bulaveur Capital

**Status: feature-complete (Phases 0–4 built + typechecking).** What remains is
*operational*: add live keys, run `pnpm mission …`, and deploy. Items below are
checked as built; the ▶ note says what's needed to exercise each live.

## Phase 0 — Data + first published brief ✅
- [x] **FRED tool** (`src/tools/data/fred.ts`) — UST 2/5/10/30Y, 2s10s, IG/HY OAS → `MarketObservation`.
- [x] **MacroAgent** (`src/agents/macro.ts`) — structured regime read → X-thread brief.
- [x] **morning-brief mission (real)** — sync → draft → compliance → approval.
- [x] **X publisher** — posts the thread on approval. ▶ needs `X_ACCESS_TOKEN`.

## Phase 1 — Credit + opportunities ✅
- [x] **EDGAR ingestion → RAG** (`src/tools/data/edgar.ts`) + **CreditAgent** with citations (`src/agents/credit.ts`).
- [x] **RVAgent** screen + real `opportunity-scan` mission (`src/agents/rv.ts`).
- [x] **Hybrid retrieval + rerank** over filings (`src/core/rag/retrieve.ts` → `hybridRetrieve`).

## Phase 2 — Multi-agent weekly note ✅
- [x] **StrategistSupervisor** (macro+credit+RV in parallel → synthesis) + **CriticAgent**.
- [x] `weekly-credit-note` → note → **newsletter (Resend)** on approval. ▶ needs `RESEND_API_KEY`.
- [x] **Recommendation** extraction + storage (`src/agents/recommendations.ts`). Mark-to-market vs `MarketObservation` = future.

## Phase 3 — Reliability, compliance, ops ✅
- [x] **Fabrication guardrail** — numbers must trace to stored data; hard-fail (`src/agents/fabrication.ts`) + unit test.
- [x] **Eval suite** — deterministic fabrication test (runs offline) + LLM-as-judge brief eval (`tests/eval/`).
- [x] **Telegram approvals** — one-tap approve/reject to phone (`src/tools/notify/telegram.ts`). ▶ needs `TELEGRAM_*`.
- [x] **Observability** — every run recorded as `AgentRun` (cost/status) + Langfuse trace (`src/lib/run.ts`).

## Phase 4 — Deploy ✅
- [x] **Prod compose** (`docker-compose.prod.yml`: app+pg+redis) + **initial migration** (`prisma/migrations/0_init`).
- [x] **OPS runbook** — deploy, backups (pg_dump), alerts, cost control (`docs/OPS.md`).
- [x] DST note + TZ-aware-cron path documented (OPS.md).

## Future (beyond "complete")
- Mark-to-market recommendation tracking vs live observations; performance attribution.
- Corporate-bond instrument-level pricing/OAS vendor; issuer-level spread series.
- Inline Telegram buttons (callback webhooks) instead of tap-links.

## Deploy runbook (VPS)
1. Ubuntu VPS, Docker + Caddy. 2. `git clone`; `.env` (model keys, `FRED_API_KEY`, `X_ACCESS_TOKEN`, `DATABASE_URL`, `REDIS_URL`).
3. `docker compose up -d`; `pnpm db:deploy`. 4. `docker build -t bulaveur-capital . && docker run -d --env-file .env -p 8080:8080 bulaveur-capital`.
5. Edit `Caddyfile` domain; `caddy run`; point DNS. 6. Verify `/health`; confirm missions scheduled; **test publish to a throwaway X account before the real handle.**
