# Domain — Fixed-Income Research

## What a fixed-income research firm does
Tracks rates, credit, and macro; forms views; publishes research and trade ideas.
Bulaveur automates the daily cadence of a strategist + credit analyst desk.

## What we publish
- **Morning brief** — pre-open read on rates (UST curve), credit (IG/HY spreads), and the day's catalysts; one actionable idea.
- **Opportunity notes** — relative-value or credit dislocations spotted intraday.
- **Weekly credit note** — a deeper single-issuer/sector dive with a recommendation.

## Core concepts (so the agents reason correctly)
- **Yield curve** — UST yields across maturities (2s, 5s, 10s, 30s); slope (2s10s) signals growth/inflation regime.
- **Credit spread / OAS** — extra yield over the risk-free curve; widening = risk-off, tightening = risk-on. IG vs HY.
- **Duration** — price sensitivity to rate moves; key risk measure.
- **Carry & roll-down** — return from holding + curve roll; the bread and butter of RV ideas.
- **Catalysts** — CPI, NFP, FOMC, auctions, issuance, earnings (for credit).

## Data model (prisma/schema.prisma)
- **Issuer** → **Instrument** (bond) → **MarketObservation** (yield/spread/price over time).
- **ResearchNote** (kind: morning_brief | credit_note | opportunity | macro) → **Recommendation** (buy/sell/hold/watch + rationale + conviction + horizon).

## Data sources (wire in `src/tools/data/`)
- **FRED** — DGS2/DGS10/etc (UST yields), BAMLH0A0HYM2 (HY OAS), BAMLC0A0CM (IG OAS), CPI, unemployment. Free API key.
- **US Treasury** par yield curve — daily, no key.
- **SEC EDGAR** — issuer filings (10-K/10-Q) for credit fundamentals; ingest into RAG.
- (later) a corporate-bond pricing vendor for instrument-level OAS.

## Agent design (multi-agent)
- **MacroAgent** — summarizes rates + econ calendar → regime read. T1.
- **CreditAgent** — IG/HY spread moves + issuer news → credit view. T1, RAG over filings.
- **RVAgent** — screens for relative-value (carry/roll, curve, cross-issuer) → idea candidates. T1/T2.
- **StrategistSupervisor** — synthesizes a brief/note from the above (supervisor/worker).
- **CriticAgent** — checks for unsupported claims, fabricated numbers, hype; gates publication. T2.

## Quality bar (evals)
- **Zero fabricated figures** — hard fail (every number must trace to a `MarketObservation` or source).
- Briefs judged on: data accuracy, specificity, actionability, no hype (rubric ≥ 0.8).
- Recommendations must state rationale + risk + horizon.

## Compliance
- Disclaimer on every post; banned hype phrases; human approval for recommendations.
- Frame as **market commentary**, not personalized advice. See README → Compliance.
