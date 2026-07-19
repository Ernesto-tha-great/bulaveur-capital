import type { Metric } from "@prisma/client";

/**
 * The market series Bulaveur tracks. FRED is the free, reliable workhorse for
 * rates + credit spreads — including the ICE BofA **emerging-markets** OAS family,
 * which is how the desk gets EM aggregate risk premia at $0. Add/adjust ids here;
 * the sync + snapshot code is generic.
 *
 * `series` is our stable internal key; `fredId` is the FRED series id. `market`
 * tags which desk reads it ("US", "EM" for global-EM aggregates, or an ISO code
 * like "MX" for market-specific series).
 */
export interface SeriesConfig {
  series: string;
  fredId: string;
  label: string;
  metric: Metric;
  /** spreads are in bps, yields in %. Used for display formatting. */
  unit: "pct" | "bps";
  /** "US" | "EM" (global-EM aggregate) | ISO market code. */
  market: string;
}

export const TRACKED_SERIES: SeriesConfig[] = [
  // ── US rates + credit (the global anchor every EM read references) ──
  { series: "UST2Y", fredId: "DGS2", label: "UST 2Y", metric: "yield", unit: "pct", market: "US" },
  { series: "UST5Y", fredId: "DGS5", label: "UST 5Y", metric: "yield", unit: "pct", market: "US" },
  { series: "UST10Y", fredId: "DGS10", label: "UST 10Y", metric: "yield", unit: "pct", market: "US" },
  { series: "UST30Y", fredId: "DGS30", label: "UST 30Y", metric: "yield", unit: "pct", market: "US" },
  { series: "2s10s", fredId: "T10Y2Y", label: "2s10s slope", metric: "spread", unit: "pct", market: "US" },
  { series: "HY_OAS", fredId: "BAMLH0A0HYM2", label: "US HY OAS", metric: "spread", unit: "pct", market: "US" },
  { series: "IG_OAS", fredId: "BAMLC0A0CM", label: "US IG OAS", metric: "spread", unit: "pct", market: "US" },

  // ── Emerging-markets aggregate spreads (ICE BofA via FRED, free) ──
  { series: "EM_CORP_OAS", fredId: "BAMLEMCBPIOAS", label: "EM Corporate Plus OAS", metric: "spread", unit: "pct", market: "EM" },
  { series: "EM_HY_OAS", fredId: "BAMLEMHBHYCRPIOAS", label: "EM HY Corporate OAS", metric: "spread", unit: "pct", market: "EM" },
  { series: "EM_BLW_OAS", fredId: "BAMLEM4BRRBLCRPIOAS", label: "EM B & lower Corporate OAS", metric: "spread", unit: "pct", market: "EM" },
  { series: "EM_EUR_OAS", fredId: "BAMLEMEBCRPIEOAS", label: "EM Euro Corporate OAS", metric: "spread", unit: "pct", market: "EM" },
];

/** Series for one market (e.g. "US", "EM"). Desks read only their own market. */
export function seriesForMarket(market: string): SeriesConfig[] {
  return TRACKED_SERIES.filter((s) => s.market === market);
}
