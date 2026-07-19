import { prisma } from "../core/db";
import { logger } from "../core/logger";
import { ingestIssuerFilings } from "../tools/data/edgar";

/**
 * Ingest SEC EDGAR filings (10-K/10-Q) for watchlist issuers into RAG, so the
 * CreditAgent and weekly-credit-note can reason over — and cite — primary sources.
 * Run `pnpm seed:watchlist` first. Needs SEC_USER_AGENT set to "Name email".
 *
 *   pnpm ingest        # every watchlist issuer
 *   pnpm ingest F      # a single ticker (Ford)
 */
async function main() {
  const only = process.argv[2]?.toUpperCase();
  const issuers = await prisma.issuer.findMany({ orderBy: { createdAt: "asc" } });
  const targets = only ? issuers.filter((i) => i.ticker?.toUpperCase() === only) : issuers;

  if (targets.length === 0) {
    logger.warn(
      only
        ? `No watchlist issuer with ticker ${only}. Run \`pnpm seed:watchlist\` (and edit the list).`
        : "No issuers in the watchlist — run `pnpm seed:watchlist` first.",
    );
    process.exit(1);
  }

  let total = 0;
  for (const issuer of targets) {
    if (!issuer.ticker) {
      logger.warn({ issuer: issuer.name }, "ingest.skip.no-ticker");
      continue;
    }
    total += await ingestIssuerFilings(issuer.name, issuer.ticker);
  }
  logger.info({ issuers: targets.length, filings: total }, "ingest.done");
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err: String(err) }, "ingest.fatal");
  process.exit(1);
});
