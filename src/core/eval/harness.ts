import { logger } from "../logger";
import { judge, type JudgeInput } from "./judge";

/**
 * A tiny eval harness. A "golden set" is a list of cases; each runs your system,
 * then grades the output. Wire `runEvalSuite` into Vitest (tests/eval) so a PR
 * that drops quality fails CI. This is the discipline that separates "it worked
 * once in a demo" from "it works every day in production."
 */
export interface EvalCase<Input> {
  name: string;
  input: Input;
  rubric: string;
  reference?: string;
  /** Minimum score to pass. */
  threshold?: number;
}

export interface EvalReport {
  name: string;
  score: number;
  pass: boolean;
  reasoning: string;
}

export async function runEvalSuite<Input>(
  cases: EvalCase<Input>[],
  system: (input: Input) => Promise<{ task: string; output: string }>,
): Promise<{ reports: EvalReport[]; passRate: number; avgScore: number }> {
  const reports: EvalReport[] = [];
  for (const c of cases) {
    const { task, output } = await system(c.input);
    const judgeInput: JudgeInput = { task, output, rubric: c.rubric, reference: c.reference };
    const result = await judge(judgeInput);
    const pass = result.pass && result.score >= (c.threshold ?? 0.7);
    reports.push({ name: c.name, score: result.score, pass, reasoning: result.reasoning });
    logger.info({ case: c.name, score: result.score, pass }, "eval.case");
  }
  const passRate = reports.filter((r) => r.pass).length / Math.max(1, reports.length);
  const avgScore = reports.reduce((s, r) => s + r.score, 0) / Math.max(1, reports.length);
  return { reports, passRate, avgScore };
}
