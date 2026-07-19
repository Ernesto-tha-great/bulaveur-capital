import type { Metric } from "@prisma/client";

/**
 * The market series Bulaveur tracks. FRED is the free, reliable workhorse for
 * rates + credit spreads. Add/adjust ids here; the sync + snapshot code is generic.
 *
 * `series` is our stable internal key; `fredId` is the FRED series id.
 */
export interface SeriesConfig {
  series: string;
  fredId: string;
  label: string;
  metric: Metric;
  /** spreads are in bps, yields in %. Used for display formatting. */
  unit: "pct" | "bps";
}

export const TRACKED_SERIES: SeriesConfig[] = [
  { series: "UST2Y", fredId: "DGS2", label: "UST 2Y", metric: "yield", unit: "pct" },
  { series: "UST5Y", fredId: "DGS5", label: "UST 5Y", metric: "yield", unit: "pct" },
  { series: "UST10Y", fredId: "DGS10", label: "UST 10Y", metric: "yield", unit: "pct" },
  { series: "UST30Y", fredId: "DGS30", label: "UST 30Y", metric: "yield", unit: "pct" },
  { series: "2s10s", fredId: "T10Y2Y", label: "2s10s slope", metric: "spread", unit: "pct" },
  { series: "HY_OAS", fredId: "BAMLH0A0HYM2", label: "US HY OAS", metric: "spread", unit: "pct" },
  { series: "IG_OAS", fredId: "BAMLC0A0CM", label: "US IG OAS", metric: "spread", unit: "pct" },
];
