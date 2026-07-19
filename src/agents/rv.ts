import { z } from "zod";
import type { BudgetLedger } from "../core/models/model-router";
import { routedGenerateObject } from "../core/models/model-router";
import { formatSnapshot, getMarketSnapshot } from "../tools/data/fred";

/**
 * RVAgent — relative-value / positioning screen over the latest market data.
 * Produces 1-3 concrete ideas (carry/roll, curve 2s10s, IG vs HY), each grounded
 * in the actual levels. Structured so ideas can become Recommendation rows.
 */
export const OpportunitySchema = z.object({
  title: z.string(),
  thesis: z.string(),
  instrument: z.string(),
  action: z.enum(["buy", "sell", "hold", "watch"]),
  conviction: z.number().int().min(1).max(5),
  horizon: z.string(),
  risks: z.array(z.string()),
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

export async function scanOpportunities(ledger?: BudgetLedger): Promise<{ opportunities: Opportunity[]; dataContext: string }> {
  const snap = await getMarketSnapshot();
  if (snap.length === 0) throw new Error("No market data — run `pnpm sync:data` first.");
  const dataContext = formatSnapshot(snap);

  const { object } = await routedGenerateObject({
    task: { capability: "reasoning", complexity: "high", label: "rv-scan" },
    schema: z.object({ opportunities: z.array(OpportunitySchema).max(3) }),
    ledger,
    system:
      "You are a fixed-income relative-value strategist. From the data ONLY, identify up to 3 " +
      "concrete, actionable ideas (carry/roll, curve positioning via 2s10s, IG vs HY risk). " +
      "Ground each in the specific levels. No hype, never promise returns, never invent numbers.",
    prompt: `Latest market data:\n${dataContext}\n\nList the opportunities.`,
  });
  return { opportunities: object.opportunities, dataContext };
}
