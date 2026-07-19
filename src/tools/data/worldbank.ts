import { logger } from "../../core/logger";

/**
 * World Bank Indicators API — free, no key, ~200 countries. Gives the desk the
 * sovereign-fundamentals backdrop (reserves, external debt, inflation, current
 * account, growth) behind any EM fixed-income view, so credit/solvency claims
 * trace to real data instead of vibes.
 *
 * Data is annual and lags (latest is usually last year), so it's context/anchor,
 * not a tradable signal — the curve/spread series carry the timely read.
 */
const WB_BASE = "https://api.worldbank.org/v2";

export interface WbIndicator {
  code: string;
  label: string;
  unit: "usd" | "pct" | "pct_gdp";
}

/** Curated set relevant to sovereign fixed-income risk. */
export const WB_FI_INDICATORS: WbIndicator[] = [
  { code: "FI.RES.TOTL.CD", label: "FX reserves (incl. gold)", unit: "usd" },
  { code: "DT.DOD.DECT.CD", label: "External debt stock, total", unit: "usd" },
  { code: "GC.DOD.TOTL.GD.ZS", label: "Govt debt / GDP", unit: "pct_gdp" },
  { code: "BN.CAB.XOKA.GD.ZS", label: "Current account / GDP", unit: "pct_gdp" },
  { code: "FP.CPI.TOTL.ZG", label: "Inflation (CPI, annual)", unit: "pct" },
  { code: "NY.GDP.MKTP.KD.ZG", label: "GDP growth (annual)", unit: "pct" },
];

interface WbRow {
  indicator: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
}

/** Most-recent non-null observations for one indicator in one country (ISO3). */
export async function fetchIndicator(iso3: string, code: string, mrv = 1): Promise<{ date: string; value: number }[]> {
  const url = `${WB_BASE}/country/${iso3}/indicator/${code}?format=json&mrv=${mrv}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`World Bank ${code} ${iso3} ${res.status}`);
  const json = (await res.json()) as [unknown, WbRow[] | null];
  const rows = Array.isArray(json) ? json[1] ?? [] : [];
  return rows
    .filter((r): r is WbRow & { value: number } => typeof r?.value === "number")
    .map((r) => ({ date: r.date, value: r.value }));
}

export interface Fundamental {
  code: string;
  label: string;
  unit: WbIndicator["unit"];
  value: number;
  date: string;
}

/** Latest value for each curated FI indicator. Skips indicators with no data. */
export async function getSovereignFundamentals(iso3: string): Promise<Fundamental[]> {
  const out: Fundamental[] = [];
  for (const ind of WB_FI_INDICATORS) {
    try {
      const latest = (await fetchIndicator(iso3, ind.code, 1))[0];
      if (latest) out.push({ code: ind.code, label: ind.label, unit: ind.unit, value: latest.value, date: latest.date });
    } catch (err) {
      logger.warn({ iso3, code: ind.code, err: String(err) }, "worldbank.indicator.fail");
    }
  }
  return out;
}

function fmtValue(f: Fundamental): string {
  if (f.unit === "usd") {
    const bn = f.value / 1e9;
    return bn >= 1000 ? `$${(bn / 1000).toFixed(2)}tn` : `$${bn.toFixed(1)}bn`;
  }
  return `${f.value.toFixed(1)}%`;
}

/** Grounding text for the desk — every line is a cited World Bank figure. */
export function formatFundamentals(iso3: string, fs: Fundamental[]): string {
  if (fs.length === 0) return `${iso3}: no World Bank fundamentals available.`;
  return fs.map((f) => `${f.label}: ${fmtValue(f)} (${f.date}, World Bank)`).join("\n");
}
