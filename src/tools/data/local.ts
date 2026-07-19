import type { Market } from "../../markets/registry";
import { fetchBcbLocal } from "./bcb";
import { fetchBanxicoLocal } from "./banxico";

/**
 * Local central-bank data — a market's own curve/policy/FX, the highest-quality
 * free source for that market. Dispatched by the registry's `localSource`; markets
 * without one degrade gracefully to FRED-EM aggregates + World Bank fundamentals,
 * so no market is ever blocked.
 */
export interface LocalPoint {
  series: string; // internal key, e.g. "BR_SELIC"
  label: string; // "Selic target"
  value: number;
  unit: string; // "%", "BRL", "MXN", …
  asOf: string; // ISO date
  source: string; // "BCB:432"
}

export async function getLocalData(market: Market): Promise<LocalPoint[]> {
  switch (market.localSource) {
    case "bcb":
      return fetchBcbLocal();
    case "banxico":
      return fetchBanxicoLocal();
    default:
      return [];
  }
}

export function formatLocal(points: LocalPoint[]): string {
  if (points.length === 0) return "";
  return points
    .map((p) => `${p.label}: ${p.value}${p.unit === "%" ? "%" : ` ${p.unit}`} (${p.asOf}, ${p.source})`)
    .join("\n");
}
