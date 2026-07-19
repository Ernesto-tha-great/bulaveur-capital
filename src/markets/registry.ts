/**
 * The market registry — the backbone of market-specific desks.
 *
 * Bulaveur's EM fixed-income coverage is split into one **desk per market** so
 * nothing slips: each desk covers the full FI stack (govvies, T-bills, commercial
 * paper, trade finance) for exactly one market, reading only that market's data
 * and its own memory. A market is pure config here; the desk agent
 * (`src/agents/em-desk.ts`) is instantiated once per entry.
 *
 * Coverage is free-first (see docs/DATA-SOURCES.md): every market resolves via
 * FRED EM aggregates + World Bank fundamentals, and a `localSource` upgrades a
 * market to its central bank's own curve where a free API exists. No market is
 * blocked on a bespoke adapter.
 */
export type Region = "LatAm" | "EM Europe" | "MENA" | "Africa" | "EM Asia";

export type LocalSource = "banxico" | "bcb";

export interface Market {
  /** Stable desk code, e.g. "MX". */
  code: string;
  name: string;
  region: Region;
  /** ISO3 for World Bank fundamentals. */
  iso3: string;
  /** Local currency, e.g. "MXN". */
  currency: string;
  /** Central-bank curve adapter, if a free one exists; else FRED-EM + IMF/BIS. */
  localSource?: LocalSource;
  /** Benchmark tenors (years) the desk anchors its curve read on. */
  benchmarkTenors: number[];
  /** Primary language of local sources — the desk reads filings/news in it. */
  language: string;
  notes?: string;
}

const M = (m: Market): [string, Market] => [m.code, m];

export const MARKETS: Record<string, Market> = Object.fromEntries([
  // ── LatAm ──
  M({ code: "MX", name: "Mexico", region: "LatAm", iso3: "MEX", currency: "MXN", localSource: "banxico", benchmarkTenors: [2, 5, 10, 30], language: "es" }),
  M({ code: "BR", name: "Brazil", region: "LatAm", iso3: "BRA", currency: "BRL", localSource: "bcb", benchmarkTenors: [2, 5, 10], language: "pt" }),
  M({ code: "CO", name: "Colombia", region: "LatAm", iso3: "COL", currency: "COP", benchmarkTenors: [2, 5, 10], language: "es" }),
  M({ code: "CL", name: "Chile", region: "LatAm", iso3: "CHL", currency: "CLP", benchmarkTenors: [2, 5, 10], language: "es" }),
  // ── EM Europe ──
  M({ code: "TR", name: "Türkiye", region: "EM Europe", iso3: "TUR", currency: "TRY", benchmarkTenors: [2, 5, 10], language: "tr" }),
  M({ code: "PL", name: "Poland", region: "EM Europe", iso3: "POL", currency: "PLN", benchmarkTenors: [2, 5, 10], language: "pl" }),
  // ── MENA ──
  M({ code: "SA", name: "Saudi Arabia", region: "MENA", iso3: "SAU", currency: "SAR", benchmarkTenors: [5, 10, 30], language: "ar", notes: "USD-pegged; hard-ccy sukuk/bond focus." }),
  M({ code: "EG", name: "Egypt", region: "MENA", iso3: "EGY", currency: "EGP", benchmarkTenors: [1, 3, 5], language: "ar", notes: "High-carry local T-bills; IMF program watch." }),
  // ── Africa ──
  M({ code: "ZA", name: "South Africa", region: "Africa", iso3: "ZAF", currency: "ZAR", benchmarkTenors: [2, 10, 30], language: "en" }),
  M({ code: "NG", name: "Nigeria", region: "Africa", iso3: "NGA", currency: "NGN", benchmarkTenors: [1, 5, 10], language: "en", notes: "OMO/T-bills, Eurobond curve; FX regime key." }),
  // ── EM Asia ──
  M({ code: "ID", name: "Indonesia", region: "EM Asia", iso3: "IDN", currency: "IDR", benchmarkTenors: [5, 10], language: "id" }),
  M({ code: "IN", name: "India", region: "EM Asia", iso3: "IND", currency: "INR", benchmarkTenors: [5, 10], language: "en" }),
]);

export function getMarket(code: string): Market | undefined {
  return MARKETS[code.toUpperCase()];
}

export function allMarkets(): Market[] {
  return Object.values(MARKETS);
}

export function marketsInRegion(region: Region): Market[] {
  return allMarkets().filter((m) => m.region === region);
}

export const REGIONS: Region[] = ["LatAm", "EM Europe", "MENA", "Africa", "EM Asia"];
