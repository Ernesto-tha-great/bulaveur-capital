import { BudgetLedger, routedGenerateText } from "../core/models/model-router";
import { readRegime, type Regime } from "./macro";
import { creditView, type CreditView } from "./credit";
import { scanOpportunities, type Opportunity } from "./rv";
import { getMarketSnapshot, formatSnapshot } from "../tools/data/fred";
import { ingestIssuerFilings } from "../tools/data/edgar";
import { logger } from "../core/logger";

/**
 * StrategistSupervisor — the multi-agent weekly note. Runs specialist workers
 * (macro, credit, RV) in parallel over a shared data context, then synthesizes a
 * structured multi-section note. This is the supervisor/worker pattern applied to
 * real research: cheap specialists gather, a frontier model synthesizes.
 */
export interface WeeklyNote {
  text: string;
  dataContext: string;
  regime: Regime;
  credit: CreditView;
  opportunities: Opportunity[];
  ledger: BudgetLedger;
}

export async function buildWeeklyNote(issuerName: string, ticker: string): Promise<WeeklyNote> {
  const ledger = new BudgetLedger();

  // Best-effort: refresh the issuer's filings into RAG before the credit worker runs.
  await ingestIssuerFilings(issuerName, ticker).catch((err) => {
    logger.warn({ issuerName, err: String(err) }, "weekly.ingest.skip");
    return 0;
  });

  const snap = await getMarketSnapshot();
  const dataContext = formatSnapshot(snap);

  // Workers run in parallel over the shared context.
  const [regime, credit, rv] = await Promise.all([
    readRegime(dataContext, ledger),
    creditView(issuerName, ledger),
    scanOpportunities(ledger),
  ]);

  // Supervisor synthesizes (frontier tier — quality matters for the flagship note).
  const draft = await routedGenerateText({
    task: { capability: "draft", complexity: "high", label: "weekly-note" },
    ledger,
    system:
      "You are the lead strategist at Bulaveur Capital. Write a structured weekly credit note " +
      "with sections: **Macro backdrop**, **Credit view** (on the issuer, cite drivers), " +
      "**Relative value**, and **Recommendation** (action, rationale, risk, horizon). Ground " +
      "EVERY number in the provided data. Disclose risks. No hype, never promise returns.",
    prompt:
      `Issuer: ${issuerName}\n\nMacro regime:\n${JSON.stringify(regime, null, 2)}\n\n` +
      `Credit view:\n${JSON.stringify(credit, null, 2)}\n\n` +
      `Relative-value ideas:\n${JSON.stringify(rv.opportunities, null, 2)}\n\n` +
      `Market data:\n${dataContext}\n\nWrite the weekly credit note.`,
  });

  return { text: draft.text, dataContext, regime, credit, opportunities: rv.opportunities, ledger };
}
