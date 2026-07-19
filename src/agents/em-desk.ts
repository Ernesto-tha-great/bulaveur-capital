import { z } from "zod";
import { BudgetLedger, routedGenerateObject } from "../core/models/model-router";
import { getMarketSnapshot, formatSnapshot } from "../tools/data/fred";
import { getSovereignFundamentals, formatFundamentals } from "../tools/data/worldbank";
import { getLocalData, formatLocal } from "../tools/data/local";
import { getMarket, type Market } from "../markets/registry";

/**
 * The per-market EM fixed-income desk. One instance covers exactly one market and
 * the FULL local FI stack — govvies/curve, T-bills, commercial paper, hard-currency
 * credit, FX — grounded only in that market's data (local central bank + EM
 * aggregates + World Bank fundamentals). Each idea is self-scored on actionability
 * and shareability so the report can rank what's worth publishing.
 */
export const IdeaSchema = z.object({
  title: z.string(),
  sleeve: z.enum(["rates", "curve", "fx", "hard_ccy_credit", "tbill", "commercial_paper", "trade_finance"]),
  action: z.enum(["buy", "sell", "hold", "watch"]),
  instrument: z.string().describe("specific expression, e.g. '10Y local govvie', '1y T-bill', 'USD/MXN'"),
  thesis: z.string().describe("2-3 sentences; must reference the data levels"),
  conviction: z.number().int().min(1).max(5),
  actionability: z.number().int().min(1).max(5).describe("how tradable/timely right now"),
  shareability: z.number().int().min(1).max(5).describe("how compelling as published content"),
  horizon: z.string(),
});
export type Idea = z.infer<typeof IdeaSchema>;

export const MarketReadSchema = z.object({
  summary: z.string().describe("2-3 sentence read of the market"),
  ratesView: z.string(),
  fxView: z.string(),
  creditView: z.string().describe("hard-currency spread / external-risk read"),
  keyRisks: z.array(z.string()).min(1),
  ideas: z.array(IdeaSchema).min(1).max(6),
});
export type MarketRead = z.infer<typeof MarketReadSchema>;

export interface DeskResult {
  market: Market;
  read: MarketRead;
  dataContext: string;
  ledger: BudgetLedger;
}

/** Assemble the full free-first data context for one market (all sources in parallel). */
export async function gatherMarketData(market: Market): Promise<string> {
  const [emSnap, usSnap, fundamentals, local] = await Promise.all([
    getMarketSnapshot("EM"),
    getMarketSnapshot("US"),
    getSovereignFundamentals(market.iso3),
    getLocalData(market),
  ]);
  return [
    `Market: ${market.name} (${market.code}, ${market.currency}) — region ${market.region}.`,
    local.length
      ? `Local (central bank):\n${formatLocal(local)}`
      : "Local central-bank feed: none wired — using EM aggregates + fundamentals.",
    `EM aggregate spreads:\n${formatSnapshot(emSnap)}`,
    `US anchor:\n${formatSnapshot(usSnap)}`,
    `Sovereign fundamentals:\n${formatFundamentals(market.iso3, fundamentals)}`,
  ].join("\n\n");
}

/** Run one market desk: gather data → structured, grounded read with ranked ideas. */
export async function runMarketDesk(marketCode: string, ledger = new BudgetLedger()): Promise<DeskResult> {
  const market = getMarket(marketCode);
  if (!market) throw new Error(`Unknown market "${marketCode}". See src/markets/registry.ts.`);
  const dataContext = await gatherMarketData(market);

  const { object: read } = await routedGenerateObject({
    task: { capability: "reasoning", complexity: "medium", label: `em-desk-${market.code}` },
    schema: MarketReadSchema,
    ledger,
    system:
      `You are the ${market.name} fixed-income desk analyst at Bulaveur Capital, a hedge fund. ` +
      "Cover the FULL local FI stack: govvies/curve, T-bills, commercial paper, hard-currency credit, and FX. " +
      "Reason ONLY from the data provided; cite specific levels; never invent numbers not in the data. " +
      "For each idea score actionability (tradable/timely now) and shareability (compelling as content) 1-5. " +
      "Be sober and specific. No hype, no return promises.",
    prompt: `Data for ${market.name}:\n${dataContext}\n\nGive the desk read with 2-5 ranked ideas across the FI stack.`,
  });

  return { market, read, dataContext, ledger };
}

/** Combined rank score — both dimensions must be high; conviction breaks ties. */
export function ideaScore(i: Idea): number {
  return i.actionability * i.shareability * 100 + i.conviction;
}

export function rankIdeas(ideas: Idea[]): Idea[] {
  return [...ideas].sort((a, b) => ideaScore(b) - ideaScore(a));
}

/** Render a market read as a grounded, human-readable note body. */
export function formatMarketNote(r: DeskResult): string {
  const ideas = rankIdeas(r.read.ideas)
    .map(
      (i, n) =>
        `${n + 1}. [${i.sleeve}] ${i.title} — ${i.action.toUpperCase()} ${i.instrument} ` +
        `(conviction ${i.conviction}/5 · actionable ${i.actionability}/5 · shareable ${i.shareability}/5, ${i.horizon})\n   ${i.thesis}`,
    )
    .join("\n\n");
  return [
    `${r.market.name} (${r.market.code}) — EM Fixed-Income Desk`,
    r.read.summary,
    `Rates: ${r.read.ratesView}`,
    `FX: ${r.read.fxView}`,
    `Credit (hard-ccy): ${r.read.creditView}`,
    `Key risks: ${r.read.keyRisks.join("; ")}`,
    `Ideas (ranked by actionable × shareable):\n${ideas}`,
  ].join("\n\n");
}
