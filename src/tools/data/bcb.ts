import { logger } from "../../core/logger";
import type { LocalPoint } from "./local";

/**
 * Banco Central do Brasil — SGS (Sistema Gerenciador de Séries Temporais).
 * Free, no key. We pull the policy rate, inflation, and FX as the Brazil desk's
 * local anchor; a fuller local curve (DI) can be added as more SGS codes.
 */
const SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

interface SgsRow {
  data: string; // dd/mm/yyyy
  valor: string;
}

const BR_SERIES = [
  { code: 432, series: "BR_SELIC", label: "Selic target", unit: "%" },
  { code: 433, series: "BR_IPCA_M", label: "IPCA (monthly)", unit: "%" },
  { code: 1, series: "BR_USDBRL", label: "USD/BRL", unit: "BRL" },
] as const;

function toIso(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

async function sgsLatest(code: number): Promise<{ value: number; asOf: string } | null> {
  const res = await fetch(`${SGS}.${code}/dados/ultimos/1?formato=json`);
  if (!res.ok) throw new Error(`BCB SGS ${code} ${res.status}`);
  const rows = (await res.json()) as SgsRow[];
  const r = rows[rows.length - 1];
  if (!r) return null;
  const value = Number(r.valor);
  return Number.isFinite(value) ? { value, asOf: toIso(r.data) } : null;
}

export async function fetchBcbLocal(): Promise<LocalPoint[]> {
  const out: LocalPoint[] = [];
  for (const s of BR_SERIES) {
    try {
      const latest = await sgsLatest(s.code);
      if (latest) {
        out.push({ series: s.series, label: s.label, value: latest.value, unit: s.unit, asOf: latest.asOf, source: `BCB:${s.code}` });
      }
    } catch (err) {
      logger.warn({ code: s.code, err: String(err) }, "bcb.fetch.fail");
    }
  }
  return out;
}
