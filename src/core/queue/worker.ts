import { logger } from "../logger";
import { scheduleMissions, startMissionWorker } from "../schedule/scheduler";
import { missions } from "../../missions/index";

/**
 * Standalone mission worker — the autonomy half of the system, without the HTTP
 * server. Under load you split the app into two services (see Dockerfile):
 *   • `web`    (`pnpm start`)  — serves the approval / health API.
 *   • `worker` (`pnpm worker`) — installs the cron schedules and executes missions.
 *
 * It's safe to run alongside the single-process entrypoint: schedule upserts are
 * idempotent and BullMQ balances jobs across every worker on the queue.
 */
async function main() {
  await scheduleMissions(missions);
  const worker = startMissionWorker(missions);
  logger.info(
    { missions: missions.all().map((m) => m.name) },
    "bulaveur-capital worker up — missions scheduled",
  );

  const shutdown = async () => {
    logger.info("worker shutting down…");
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error({ err: String(err) }, "worker.fatal");
  process.exit(1);
});
