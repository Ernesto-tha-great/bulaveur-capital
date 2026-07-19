import { z } from "zod";
import { BudgetLedger, routedGenerateObject, routedGenerateText } from "../core/models/model-router";
import { formatSnapshot, getMarketSnapshot } from "../tools/data/fred";

/**
 * MacroAgent — turns the market snapshot into a structured regime read, then
 * drafts the morning-brief X thread from it. Two steps on purpose:
 *  1) structured regime (medium tier) — auditable, gradeable.
 *  2) thread draft grounded in (1) + the raw data — so every claim traces to a number.
 */
export const RegimeSchema = z.object({
  ratesView: z.string().describe("direction & level read on UST yields"),
  curveShape: z.string().describe("slope/steepening/flattening read, cite 2s10s"),
  creditTone: z.string().describe("IG/HY risk-on or risk-off, cite OAS"),
  keyRisks: z.array(z.string()).min(1),
  oneIdea: z.string().describe("one specific, actionable fixed-income idea with rationale"),
});
export type Regime = z.infer<typeof RegimeSchema>;

export async function readRegime(snapshotText: string, ledger?: BudgetLedger): Promise<Regime> {
  const { object } = await routedGenerateObject({
    task: { capability: "reasoning", complexity: "medium", label: "macro-regime" },
    schema: RegimeSchema,
    ledger,
    system:
      "You are a fixed-income macro strategist. From the data only, infer the regime. " +
      "Cite specific levels. Be precise and sober. Never invent numbers not in the data.",
    prompt: `Latest market data:\n${snapshotText}\n\nGive the regime read.`,
  });
  return object;
}

export interface BriefDraft {
  text: string;
  regime: Regime;
  dataAsOf: string;
  dataContext: string;
  ledger: BudgetLedger;
}

/** Full morning-brief draft: snapshot → regime → X thread. */
export async function draftMorningBrief(): Promise<BriefDraft> {
  const ledger = new BudgetLedger();
  const snap = await getMarketSnapshot();
  if (snap.length === 0) throw new Error("No market data — run `pnpm sync:data` first.");
  const snapshotText = formatSnapshot(snap);
  const regime = await readRegime(snapshotText, ledger);

  const draft = await routedGenerateText({
    task: { capability: "draft", complexity: "medium", label: "morning-brief" },
    ledger,
    system:
      "You are a fixed-income strategist at Bulaveur Capital. Write a concise pre-open " +
      "X thread (3-5 short posts). Cover rates, curve, credit, and ONE actionable idea. " +
      "Lead with a hook. Cite the data levels. No hype. Never promise returns. " +
      "Separate each post with a line containing only '---'.",
    prompt: `Regime read:\n${JSON.stringify(regime, null, 2)}\n\nData:\n${snapshotText}\n\nWrite the thread.`,
  });

  return {
    text: draft.text,
    regime,
    dataAsOf: snap[0]!.asOf.toISOString().slice(0, 10),
    dataContext: snapshotText,
    ledger,
  };
}

/** Split a '---'-separated draft into X thread parts (lead + replies). */
export function splitThread(text: string): { lead: string; parts: string[] } {
  const segments = text
    .split(/\n-{3,}\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const [lead = text.trim(), ...parts] = segments;
  return { lead, parts };
}
