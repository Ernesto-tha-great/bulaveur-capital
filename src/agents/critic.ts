import { z } from "zod";
import type { BudgetLedger } from "../core/models/model-router";
import { routedGenerateObject } from "../core/models/model-router";

/**
 * CriticAgent — the quality gate before publication. Routed at `judge` (frontier),
 * temperature 0. Rejects notes with unsupported claims, numbers not in the data,
 * hype, or missing risk disclosure. This is the reflection step that keeps an
 * autonomous research desk honest.
 */
export const CritiqueSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.string()),
  suggestedFixes: z.array(z.string()).default([]),
});
export type Critique = z.infer<typeof CritiqueSchema>;

export async function critique(note: string, dataContext: string, ledger?: BudgetLedger): Promise<Critique> {
  const { object } = await routedGenerateObject({
    task: { capability: "judge", complexity: "high", label: "critic" },
    schema: CritiqueSchema,
    temperature: 0,
    ledger,
    system:
      "You are the head of a fixed-income research desk reviewing a note before publication. " +
      "Reject (approved=false) if ANY of: a claim is unsupported by the data, a number is not " +
      "present in the data provided, there is hype or a promise of returns, or material risks " +
      "are not disclosed. Be strict and specific.",
    prompt:
      `# Data provided to the author\n${dataContext}\n\n# Draft note\n${note}\n\n` +
      `Approve only if every claim is supported and no number is invented. List concrete issues.`,
  });
  return object;
}
