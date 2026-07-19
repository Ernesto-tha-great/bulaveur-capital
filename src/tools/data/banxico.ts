import { logger } from "../../core/logger";
import type { LocalPoint } from "./local";

/**
 * Banco de México — SIE API. Requires a free token (`BANXICO_TOKEN`, a 64-char
 * key from the SIE portal). Without a token the Mexico desk degrades to FRED-EM
 * aggregates + World Bank fundamentals rather than failing.
 *
 * Series ids should be confirmed against the SIE catalogue when wiring a token;
 * the two below (FIX FX, TIIE 28d) are the standard reference series.
 */
const SIE = "https://www.banxico.org.mx/SieAPIRest/service/v1/series";

const MX_SERIES = [
  { id: "SF43718", series: "MX_USDMXN", label: "USD/MXN (FIX)", unit: "MXN" },
  { id: "SF61745", series: "MX_TIIE28", label: "TIIE 28d", unit: "%" },
] as const;

interface SieResp {
  bmx?: { series?: { idSerie: string; datos?: { fecha: string; dato: string }[] }[] };
}

function toIso(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

export async function fetchBanxicoLocal(): Promise<LocalPoint[]> {
  const token = process.env.BANXICO_TOKEN;
  if (!token) {
    logger.warn("BANXICO_TOKEN not set — Mexico desk uses EM aggregates + fundamentals. See docs/DATA-SOURCES.md.");
    return [];
  }
  const ids = MX_SERIES.map((s) => s.id).join(",");
  try {
    const res = await fetch(`${SIE}/${ids}/datos/oportuno`, { headers: { "Bmx-Token": token } });
    if (!res.ok) throw new Error(`Banxico ${res.status}`);
    const json = (await res.json()) as SieResp;
    const out: LocalPoint[] = [];
    for (const s of json.bmx?.series ?? []) {
      const cfg = MX_SERIES.find((x) => x.id === s.idSerie);
      const d = s.datos?.[s.datos.length - 1];
      if (!cfg || !d) continue;
      const value = Number(d.dato);
      if (Number.isFinite(value)) {
        out.push({ series: cfg.series, label: cfg.label, value, unit: cfg.unit, asOf: toIso(d.fecha), source: `Banxico:${cfg.id}` });
      }
    }
    return out;
  } catch (err) {
    logger.warn({ err: String(err) }, "banxico.fetch.fail");
    return [];
  }
}
