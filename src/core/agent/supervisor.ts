import { z } from "zod";
import { BudgetLedger, routedGenerateObject } from "../models/model-router";
import type { Agent } from "./agent";

/**
 * Supervisor / worker multi-agent pattern. A planner (cheap/medium model)
 * decomposes a goal into steps assigned to specialist worker agents, executes
 * them against a shared scratchpad, then synthesizes a final result. This is the
 * workhorse pattern for anything non-trivial: research notes, multi-section drafts.
 *
 * Keep the planner model cheap and the workers specialized — that's how you get
 * good results without paying frontier prices on every token.
 */
export interface Worker {
  name: string;
  description: string;
  agent: Agent;
}

export class Supervisor {
  constructor(
    private readonly workers: Worker[],
    private readonly opts: { name?: string } = {},
  ) {}

  async run(goal: string, ledger = new BudgetLedger()): Promise<{ result: string; scratch: string; ledger: BudgetLedger }> {
    // 1. Plan.
    const plan = await routedGenerateObject({
      task: { capability: "reasoning", complexity: "medium", label: `${this.opts.name ?? "supervisor"}.plan` },
      schema: z.object({
        steps: z.array(z.object({ worker: z.string(), instruction: z.string() })).min(1),
      }),
      ledger,
      system:
        "You are a planner. Decompose the goal into ordered steps, each assigned to exactly one worker.\n" +
        "Available workers:\n" +
        this.workers.map((w) => `- ${w.name}: ${w.description}`).join("\n"),
      prompt: goal,
    });

    // 2. Execute against a shared scratchpad.
    let scratch = "";
    for (const step of plan.object.steps) {
      const worker = this.workers.find((w) => w.name === step.worker);
      if (!worker) continue;
      const res = await worker.agent.run(
        `${step.instruction}\n\n--- Shared context so far ---\n${scratch || "(empty)"}`,
        { ledger },
      );
      scratch += `\n\n## ${worker.name}\n${res.text}`;
    }

    // 3. Synthesize.
    const synth = await routedGenerateObject({
      task: { capability: "draft", complexity: "medium", label: `${this.opts.name ?? "supervisor"}.synth` },
      schema: z.object({ result: z.string() }),
      ledger,
      system: "Synthesize the workers' outputs into a single coherent, well-structured result.",
      prompt: `Goal: ${goal}\n\nWorker outputs:${scratch}`,
    });

    return { result: synth.object.result, scratch, ledger };
  }
}
