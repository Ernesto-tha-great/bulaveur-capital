# Global / Emerging-Markets Fixed-Income Data Sources

A living catalogue of where the fixed-income desk gets its data as it goes global
(with an emphasis on emerging markets). Free-first: we prototype every region on
open data, and only pay for a feed where it clearly earns its cost.

> **How to add a source:** paste a URL or a name and it gets evaluated with the
> [template in §6](#6-paste-a-resource-evaluation-template), then added to the
> tables below. Each accepted source becomes a thin adapter in
> `src/tools/data/` that writes `MarketObservation` rows tagged by `region`.

---

## 1. What the desk needs (data taxonomy)

For **each country** in a region, a complete fixed-income read wants:

| Signal | Why it matters | Metric in our schema |
|--------|----------------|----------------------|
| Local-currency sovereign yield curve | The core rates view (2y/5y/10y…) | `yield` |
| Hard-currency (USD/EUR) sovereign spread | External risk premium — EMBI-style | `spread` |
| Policy rate | Central-bank stance / carry | `yield` |
| Inflation (CPI YoY) | Real-rate + policy trajectory | `price`/series |
| FX spot + reserves | Currency risk, the alpha in the peso example | `price` |
| Sovereign credit rating + outlook | Rating-migration / index-eligibility risk | on `Issuer` |
| External debt / balance of payments | Solvency & rollover risk | context (series) |
| Issuance / auction calendar | Supply, near-term catalysts | context |
| News & central-bank communications | Catalysts, tone, surprises | signal (news) |
| EM corporate spreads (by sector/rating) | Credit desk read-through | `spread` |

## 2. Free / open sources — the backbone (verified July 2026)

| Source | Gives us | Coverage | Access | Auth | Cost |
|--------|----------|----------|--------|------|------|
| **FRED** (St. Louis Fed) | US curve **+ ICE BofA EM OAS** (corp, HY, B-&-lower, EUR-EM) + many intl series | US + EM aggregates | REST JSON | free key | $0 |
| **World Bank Indicators / IDS** | External debt, reserves, GDP, CPI, current account | ~200 countries | REST `api.worldbank.org/v2` | **none** | $0 |
| **IMF Data API** (SDMX 3.0) | IFS (rates/FX/reserves), WEO forecasts, COFER, DOTS | global | SDMX REST `api.imf.org/external/sdmx/3.0` | none (fair use) | $0 |
| **BIS Data Portal** (SDMX v2.1) | Policy rates, debt-securities outstanding, effective exchange rates | global incl. EM | SDMX REST `stats.bis.org/api` | none | $0 |
| **Banxico SIE** | Mexico curve, TIIE, FX, CPI | 🇲🇽 Mexico | REST JSON | free token (`Bmx-Token` header) | $0 |
| **Banco Central do Brasil — SGS** | Selic, DI curve, BRL, IPCA | 🇧🇷 Brazil | REST JSON `api.bcb.gov.br/dados/serie/...` | **none** | $0 |
| **iShares EMB / VanEck EMLC** holdings + fund yield | EM hard-ccy (EMBI) & local-ccy (GBI-EM) **proxy** — daily holdings CSV + SEC/effective yield | EM sovereign aggregate | daily CSV download | none | $0 |
| **countryeconomy.com / Wikipedia / TheGlobalEconomy** | Sovereign ratings (S&P/Moody's/Fitch) + outlook | global | HTML table (scrape) | none | $0 |
| **GDELT** | Global news volume + tone, 100+ languages | global incl. EM | API (free account) | free key | $0 |
| **World Government Bonds** | Local-ccy benchmark yields + sovereign CDS, many EM | broad | HTML (scrape — check ToS) | none | $0 |

**Biggest immediate win:** the EM OAS series live on **FRED**, which this repo
already integrates (`src/tools/data/fred.ts`). Going from "US only" to "EM
aggregate spreads" is mostly **adding series IDs** to `src/tools/data/series.ts`.

Confirmed EM series on FRED:
- `BAMLEMCBPIOAS` — EM Corporate Plus OAS (USD + EUR)
- `BAMLEMHBHYCRPIOAS` — EM **High-Yield** Corporate Plus OAS
- `BAMLEM4BRRBLCRPIOAS` — EM **B & lower** Corporate Plus OAS
- `BAMLEMEBCRPIEOAS` — **Euro** EM Corporate Plus OAS
- (plus the ICE BofA release `rid=209` for the full family)

**Wired ✅**
- FRED EM OAS family → `src/tools/data/series.ts` (`market: "EM"`), synced by the
  existing `syncMarketData()`.
- World Bank sovereign fundamentals (reserves, external debt, debt/GDP, current
  account, CPI, growth) → `src/tools/data/worldbank.ts` (keyless), live-verified
  for MX/BR/NG.

## 3. Central-bank APIs by country (best free source for *local* yields)

The highest-quality free local-curve/policy data is each central bank's own feed.
One thin adapter per bank, registered per region in `src/regions/`.

| Country | Bank / system | Access | Auth |
|---------|---------------|--------|------|
| 🇲🇽 Mexico | Banxico **SIE** | REST JSON | free token |
| 🇧🇷 Brazil | BCB **SGS** | REST JSON | none |
| 🇿🇦 South Africa | SARB web/query API | REST/CSV | none |
| 🇮🇳 India | RBI **DBIE** | REST/CSV | none |
| 🇹🇷 Türkiye | TCMB **EVDS** | REST JSON | free key |
| 🇮🇩 Indonesia | Bank Indonesia / BI | web/CSV | none |
| 🇪🇺 EM-Europe | **ECB Data Portal** (SDMX) covers euro periphery + some CEE | SDMX REST | none |
| 🌍 fallback | IMF IFS / BIS policy rates cover countries without a clean local API | SDMX REST | none |

> As we add regions, fill this table. The IMF + BIS SDMX feeds are the universal
> fallback: they carry policy rates and some yields for nearly every country, so
> **no country blocks a region** — a bespoke central-bank adapter is an upgrade,
> not a prerequisite.

## 4. Region → coverage (free tier)

| Region | Local yields | Hard-ccy spread | Macro / debt | News |
|--------|-------------|-----------------|--------------|------|
| **LatAm** (MX, BR, CO, CL, PE) | Banxico, BCB, IMF/BIS | FRED EM OAS + EMB proxy | World Bank IDS, IMF | GDELT |
| **EM Europe** (PL, HU, CZ, TR, ZA-adj) | ECB SDW, TCMB, IMF/BIS | FRED EUR-EM OAS + EMB | World Bank, IMF | GDELT |
| **MENA** (SA, AE, EG, QA) | IMF/BIS, local CBs | FRED EM OAS + EMB (heavy GCC weight) | World Bank, IMF | GDELT |
| **Africa** (ZA, NG, KE, EG) | SARB, IMF/BIS | EMB/EMHY proxy, FRED EM HY | World Bank IDS, IMF | GDELT |
| **EM Asia** (ID, IN, PH, MY, TH) | RBI, BI, IMF/BIS | FRED EM OAS + EMB | World Bank, IMF | GDELT |

## 5. Paid / premium — add only where it earns its cost

| Source | What it unlocks | Rough cost | When it's worth it |
|--------|-----------------|-----------|--------------------|
| **JPMorgan EMBI / GBI-EM / CEMBI** | The institutional index standard (clean per-country spreads, index weights) | $$$ (via Bloomberg/Refinitiv/JPM DataQuery) | Once we publish index-relative calls and the ETF proxy isn't precise enough |
| **Trading Economics API** | Ratings, econ calendar, unified series across countries | $ (limited free tier) | Fast breadth for calendars/ratings before building scrapers |
| **Bloomberg / Refinitiv / ICE** | Full curves, live OAS, intraday, corporate-bond level | $$$$ | Instrument-level credit work / anything intraday |

## 6. Paste-a-resource evaluation template

Drop a URL or a name; it comes back scored on exactly this, then lands in the
tables above:

- **What it gives** — instruments, metrics, tenors, history depth.
- **Coverage** — which countries/regions, update frequency.
- **Access** — REST / SDMX / CSV / scrape; base endpoint; how to page.
- **Auth** — none / free key / paid; where to register; rate limits; **ToS**
  (can we redistribute derived numbers? scraping allowed?).
- **Format & mapping** — JSON/XML/CSV → which `MarketObservation` fields
  (`series`, `metric`, `value`, `asOf`, `region`) and which adapter file.
- **Verdict** — free backbone ▸ paid-worth-it ▸ skip — and **what I need from
  you** (e.g. "register a Banxico token and drop it in `.env` as `BANXICO_TOKEN`").

---

### Sourcing notes (where these live)
- FRED ICE BofA EM OAS family: <https://fred.stlouisfed.org/release?rid=209>
- World Bank IDS: <https://www.worldbank.org/en/programs/debt-statistics/ids>
- IMF SDMX API: <https://data.imf.org/en/Resource-Pages/IMF-API>
- BIS SDMX API: <https://stats.bis.org/api-doc/v1/>
- Banxico SIE: <https://www.banxico.org.mx/SieAPIRest/service/v1/>
- BCB SGS: <https://opendata.bcb.gov.br/>
- EMB (iShares) / EMLC (VanEck) holdings: ishares.com / vaneck.com product pages
- Sovereign ratings: <https://countryeconomy.com/ratings>
- GDELT: <https://docs.gdeltcloud.com/>
