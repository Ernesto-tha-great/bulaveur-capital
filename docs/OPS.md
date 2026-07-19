# Operations Runbook — Bulaveur Capital

How to deploy and run the desk in production, and keep it healthy + within budget.

## Deploy (VPS, single command)
```bash
# on an Ubuntu VPS with Docker + Caddy installed
git clone <repo> && cd bulaveur-capital
cp .env.example .env            # fill: OPENROUTER_API_KEY, ANTHROPIC_API_KEY, FRED_API_KEY,
                               #       X_ACCESS_TOKEN, TELEGRAM_*, RESEND_* (optional)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app pnpm db:deploy   # applies prisma/migrations
docker compose -f docker-compose.prod.yml exec app pnpm seed:watchlist
```
TLS in front:
```bash
# edit Caddyfile → your domain, DNS A record → VPS IP
caddy run    # or run caddy as a systemd service
```
Verify: `curl https://<domain>/health` → `{ ok: true }`.

## First live run (before trusting the schedule)
```bash
docker compose -f docker-compose.prod.yml exec app pnpm sync:data      # pull real market data
docker compose -f docker-compose.prod.yml exec app pnpm mission morning-brief
# → creates an ApprovalItem; you get a Telegram tap-to-approve link.
# Approve → the thread posts. TEST WITH A THROWAWAY X ACCOUNT FIRST.
```

## The autonomy loop (what runs unattended)
| Mission | Cron (UTC) | Publishes |
|---------|-----------|-----------|
| `morning-brief` | Mon–Fri 11:30 | X thread |
| `opportunity-scan` | Mon–Fri 13/15/17/19:00 | X thread |
| `weekly-credit-note` | Wed 14:00 | Newsletter (+ note stored) |

Every artifact passes **compliance** (disclaimer + banned phrases) + the **fabrication guardrail** (numbers must trace to stored data) + the **CriticAgent** before it can be approved. Approval is human, one-tap, via Telegram.

## DST note
Crons are UTC. `11:30 UTC` ≈ `06:30 ET` in summer (EDT) and `06:30 ET` becomes `11:30 UTC` in winter only if you shift to `12:30`. If pre-open timing matters, adjust the cron seasonally or add a TZ-aware scheduler (BullMQ supports `tz` in repeat opts — a small enhancement).

## Observability
- Every mission run is an `AgentRun` row (status, cost, timing) and a Langfuse trace.
- Set `LANGFUSE_*` (cloud free tier) → dashboards for cost/run, tier mix, error rate.
- Quick cost check: `SELECT mission, count(*), sum("costUsd") FROM "AgentRun" GROUP BY 1;`

## Cost control (stay < $50/mo)
- Default routing is local→open→frontier; only the weekly note + judging hit frontier.
- Watch `AgentRun.costUsd`; if a mission drifts up, inspect its Langfuse trace and downgrade the tier in the agent's `TaskDescriptor`.
- OpenRouter dashboard: set a hard monthly spend cap.

## Backups
```bash
# nightly pg_dump to object storage (cron on the VPS)
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U bulaveur bulaveur | gzip > backup-$(date +%F).sql.gz
```

## Alerts (recommended)
- Langfuse: alert on cost spike / error-rate.
- Uptime check on `/health`.
- Telegram already surfaces every pending approval; add a daily "nothing published in 24h" heartbeat if desired.

## Runbook: something went wrong
- **Nothing published:** check `ApprovalItem` rows with `status=pending` — likely awaiting your approval. Check Telegram config.
- **Publish failed (502):** X token expired / rate-limited — see `Publication` gaps + logs `approval.publish.fail`.
- **Fabrication flags on every run:** market data stale — run `pnpm sync:data`; the guardrail flags numbers with no matching observation.
- **Budget spike:** inspect `AgentRun` + Langfuse; a mission may be escalating to frontier on repeated validation failures.
