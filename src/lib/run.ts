import type { BudgetLedger } from "../core/models/model-router";
import { prisma } from "../core/db";
import { withTrace } from "../core/obs/tracing";

/**
 * Wrap a mission body so every run is recorded as an AgentRun (status, cost,
 * timing, error) AND traced to Langfuse. This is the data behind the cost/quality
 * dashboards — you can't tune what you don't measure.
 */
type MissionOutcome = { ledger?: BudgetLedger } | void;

export async function recordMissionRun(
  mission: string,
  fn: () => Promise<MissionOutcome>,
): Promise<void> {
  const run = await prisma.agentRun.create({ data: { mission, status: "running" } });
  try {
    const res = await withTrace(mission, async () => fn());
    const cost = res && typeof res === "object" && "ledger" in res && res.ledger ? res.ledger.totalUsd : 0;
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "succeeded", finishedAt: new Date(), costUsd: cost },
    });
  } catch (err) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date(), error: String(err) },
    });
    throw err;
  }
}
