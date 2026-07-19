import { prisma } from "../core/db";

/**
 * Seed an issuer watchlist. The weekly-credit-note mission picks the first issuer.
 * Edit this list to your coverage universe, then run `pnpm seed:watchlist`.
 */
const WATCHLIST = [
  { name: "Ford Motor Company", ticker: "F", sector: "Automotive", country: "US" },
  { name: "AT&T Inc.", ticker: "T", sector: "Telecom", country: "US" },
  { name: "Occidental Petroleum Corporation", ticker: "OXY", sector: "Energy", country: "US" },
];

async function main() {
  for (const w of WATCHLIST) {
    await prisma.issuer.upsert({
      where: { name: w.name },
      create: w,
      update: { ticker: w.ticker, sector: w.sector, country: w.country },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${WATCHLIST.length} issuers. Edit src/scripts/seed-watchlist.ts for your universe.`);
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
