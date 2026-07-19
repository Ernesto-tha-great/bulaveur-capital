import { z } from "zod";
import type { BudgetLedger } from "../core/models/model-router";
import { routedGenerateObject } from "../core/models/model-router";
import { hybridRetrieve, rerank } from "../core/rag/retrieve";

/**
 * CreditAgent — forms a credit view on an issuer grounded ONLY in retrieved filing
 * excerpts (RAG over EDGAR). Hybrid retrieve → rerank → structured, cited view.
 * If evidence is thin it must say so rather than speculate with invented figures.
 */
export const CreditViewSchema = z.object({
  issuer: z.string(),
  view: z.enum(["improving", "stable", "deteriorating", "insufficient-evidence"]),
  summary: z.string(),
  keyDrivers: z.array(z.string()),
  risks: z.array(z.string()),
  citations: z.array(z.string()).describe("excerpt numbers [n] supporting the view"),
});
export type CreditView = z.infer<typeof CreditViewSchema>;

export async function creditView(issuerName: string, ledger?: BudgetLedger): Promise<CreditView> {
  const hits = await hybridRetrieve(`${issuerName} credit leverage liquidity cash flow debt maturities outlook`, 10);
  const top = await rerank(issuerName, hits, 6).catch(() => hits.slice(0, 6));
  const context = top.map((h, i) => `[${i + 1}] ${h.content.slice(0, 700)}`).join("\n---\n");

  if (!context.trim()) {
    return {
      issuer: issuerName,
      view: "insufficient-evidence",
      summary: "No filings ingested for this issuer — run EDGAR ingestion first.",
      keyDrivers: [],
      risks: [],
      citations: [],
    };
  }

  const { object } = await routedGenerateObject({
    task: { capability: "reasoning", complexity: "high", label: "credit-view" },
    schema: CreditViewSchema,
    ledger,
    system:
      "You are a credit analyst. Form a credit view grounded ONLY in the retrieved filing " +
      "excerpts. Cite excerpt numbers like [2]. Never invent figures not present in the excerpts. " +
      "If the evidence is insufficient, say so and set view to 'insufficient-evidence'.",
    prompt: `Issuer: ${issuerName}\n\nRetrieved filing excerpts:\n${context}\n\nGive the credit view with citations.`,
  });
  return object;
}
