import { z } from "zod";
import { prisma } from "../core/db";
import { routedGenerateObject } from "../core/models/model-router";

/**
 * Extract explicit recommendations from a research note and persist them as
 * Recommendation rows (for tracking/mark-to-market later). Extraction is a cheap,
 * structured task → routes to T0 local. Only captures what the note actually states.
 */
const RecsSchema = z.object({
  recommendations: z.array(
    z.object({
      action: z.enum(["buy", "sell", "hold", "watch"]),
      instrument: z.string().optional(),
      issuer: z.string().optional(),
      rationale: z.string(),
      conviction: z.number().int().min(1).max(5).default(3),
      horizon: z.string().optional(),
    }),
  ),
});

export async function extractAndStoreRecommendations(noteId: string, noteText: string): Promise<number> {
  const { object } = await routedGenerateObject({
    task: { capability: "extraction", complexity: "low", privacy: "public", label: "rec-extract" },
    schema: RecsSchema,
    system: "Extract explicit trade/positioning recommendations from the note. Only what is stated; do not infer.",
    prompt: noteText,
  });

  for (const r of object.recommendations) {
    await prisma.recommendation.create({
      data: {
        noteId,
        action: r.action,
        rationale: r.rationale,
        conviction: r.conviction,
        horizon: r.horizon,
      },
    });
  }
  return object.recommendations.length;
}
