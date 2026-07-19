import { prisma } from "../../core/db";
import { logger } from "../../core/logger";
import { TRACKED_SERIES, seriesForMarket, type SeriesConfig } from "./series";

/**
 * FRED (St. Louis Fed) data client. Free API key (FRED_API_KEY). Pulls the latest
 * value for each tracked series and stores it as a MarketObservation — the
 * system-of-record the research agents reason over (so claims trace to real data).
 *
 * Domain key is read from process.env (not core/config/env) to keep src/core
 * identical across the four projectb apps.
 */
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

interface FredObservation {
  date: string;
  value: string; // "." means missing
}
interface FredResponse {
  observations?: FredObservation[];
}

export async function fetchLatestFred(fredId: string, limit = 3): Promise<{ date: string; value: number }[]> {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY not set — see README → Market data accounts.");
  const url = `${FRED_BASE}?series_id=${fredId}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED ${fredId} ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as FredResponse;
  return (json.observations ?? [])
    .filter((o) => o.value !== ".")
    .map((o) => ({ date: o.date, value: Number(o.value) }))
    .filter((o) => Number.isFinite(o.value));
}

/** Pull the latest value for every tracked series and persist observations. */
export async function syncMarketData(): Promise<number> {
  let count = 0;
  for (const s of TRACKED_SERIES) {
    try {
      const latest = (await fetchLatestFred(s.fredId, 1))[0];
      if (!latest) continue;
      await prisma.marketObservation.create({
        data: {
          series: s.series,
          market: s.market,
          metric: s.metric,
          value: latest.value,
          asOf: new Date(latest.date),
          source: `FRED:${s.fredId}`,
        },
      });
      count++;
    } catch (err) {
      logger.warn({ series: s.series, err: String(err) }, "fred.sync.fail");
    }
  }
  logger.info({ count }, "fred.sync.done");
  return count;
}

export interface SnapshotPoint {
  series: string;
  label: string;
  metric: string;
  value: number;
  asOf: Date;
  unit: SeriesConfig["unit"];
}

/**
 * Latest stored value for each tracked series — what the agents read. Pass a
 * market ("US", "EM", …) to scope to that desk; omit for every tracked series.
 */
export async function getMarketSnapshot(market?: string): Promise<SnapshotPoint[]> {
  const out: SnapshotPoint[] = [];
  for (const s of market ? seriesForMarket(market) : TRACKED_SERIES) {
    const latest = await prisma.marketObservation.findFirst({
      where: { series: s.series },
      orderBy: { asOf: "desc" },
    });
    if (latest) {
      out.push({
        series: s.series,
        label: s.label,
        metric: String(latest.metric),
        value: latest.value,
        asOf: latest.asOf,
        unit: s.unit,
      });
    }
  }
  return out;
}

export function formatSnapshot(snap: SnapshotPoint[]): string {
  return snap
    .map((s) => {
      const u = s.series.includes("OAS") ? "bps" : s.unit === "pct" ? "%" : "";
      const v = s.series.includes("OAS") ? Math.round(s.value * 100) : s.value; // OAS in % → bps
      return `${s.label} (${s.series}): ${v}${u} as of ${s.asOf.toISOString().slice(0, 10)}`;
    })
    .join("\n");
}
