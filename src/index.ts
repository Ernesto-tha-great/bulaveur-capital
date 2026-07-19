import { serve } from "@hono/node-server";
import { env } from "./core/config/env";
import { logger } from "./core/logger";
import { scheduleMissions, startMissionWorker } from "./core/schedule/scheduler";
import { missions } from "./missions/index";
import { app } from "./server/app";

/**
 * Process entrypoint. Starts the HTTP server, installs the cron schedules, and
 * runs the mission worker — i.e. the product begins operating itself. On a VPS
 * this is the single long-lived process (or split server/worker; see Dockerfile).
 */
async function main() {
  await scheduleMissions(missions);
  const worker = startMissionWorker(missions);

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port, env: env.NODE_ENV }, "bulaveur-capital up");
  });

  const shutdown = async () => {
    logger.info("shutting down…");
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error({ err: String(err) }, "fatal");
  process.exit(1);
});
