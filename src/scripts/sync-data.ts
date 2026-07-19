import { logger } from "../core/logger";
import { syncMarketData } from "../tools/data/fred";

/**
 * Manual market-data sync. Run `pnpm sync:data` to pull the latest FRED series
 * into MarketObservation. The morning-brief mission calls this automatically; this
 * script is for seeding/testing.
 */
async function main() {
  const n = await syncMarketData();
  logger.info({ stored: n }, "sync-data.done");
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err: String(err) }, "sync-data.fatal");
  process.exit(1);
});
