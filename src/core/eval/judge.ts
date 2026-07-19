import { z } from "zod";
import { routedGenerateObject } from "../models/model-router";

/**
 * LLM-as-judge. The honest way to measure quality of open-ended output (a grant
 * draft, a research note) at scale. Judging is a `capability: "judge"` task, so
 * the router sends it to the FRONTIER tier — you don't grade with the same cheap
 * model that did the work. Use rubrics + low temperature to reduce judge variance.
 */
export const JudgeResultSchema = z.object({
  score: z.number().min(0).max(1),
  pass: z.boolean(),
  reasoning: z.string(),
  failures: z.array(z.string()).default([]),
});
export type JudgeResult = z.infer<typeof JudgeResultSchema>;

export interface JudgeInput {
  task: string; // what the output was supposed to achieve
  output: string; // the thing being graded
  rubric: string; // explicit criteria
  reference?: string; // optional gold answer
}

export async function judge(input: JudgeInput): Promise<JudgeResult> {
  const { object } = await routedGenerateObject({
    task: { capability: "judge", complexity: "high", label: "llm-judge" },
    schema: JudgeResultSchema,
    temperature: 0,
    system:
      "You are a strict, fair evaluator. Grade ONLY against the rubric. " +
      "Be concrete about failures. Do not reward verbosity or confident tone.",
    prompt:
      `# Task\n${input.task}\n\n# Rubric\n${input.rubric}\n\n` +
      (input.reference ? `# Reference answer\n${input.reference}\n\n` : "") +
      `# Output to grade\n${input.output}\n\n` +
      `Return score (0-1), pass/fail against the rubric, reasoning, and a list of specific failures.`,
  });
  return object;
}
