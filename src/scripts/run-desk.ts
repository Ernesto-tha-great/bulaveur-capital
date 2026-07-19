import { BudgetLedger } from "../core/models/model-router";
import { prisma } from "../core/db";
import { logger } from "../core/logger";
import { runMarketDesk, formatMarketNote, rankIdeas } from "../agents/em-desk";
import { checkFabrication } from "../agents/fabrication";
import { allMarkets } from "../markets/registry";

/**
 * Run one market desk on demand: gather that market's data → grounded read →
 * store an em_market_note + ranked recommendations, and print the note.
 *   pnpm desk BR
 * Needs a synced FRED (`pnpm sync:data`) for EM/US anchors; local + World Bank
 * data are pulled live. A central-bank token (e.g. BANXICO_TOKEN) upgrades a market.
 */
async function main() {
  const code = process.argv[2];
  if (!code) {
    // eslint-disable-next-line no-console
    console.error(`usage: pnpm desk <market>\nmarkets: ${allMarkets().map((m) => m.code).join(", ")}`);
    process.exit(1);
  }

  const ledger = new BudgetLedger();
  const result = await runMarketDesk(code, ledger);
  const body = formatMarketNote(result);
  const fab = checkFabrication(body, result.dataContext);

  const note = await prisma.researchNote.create({
    data: {
      kind: "em_market_note",
      market: result.market.code,
      title: `${result.market.name} EM FI desk`,
      body,
      status: "in_review",
    },
  });

  for (const i of rankIdeas(result.read.ideas)) {
    await prisma.recommendation.create({
      data: {
        noteId: note.id,
        market: result.market.code,
        action: i.action,
        rationale: i.thesis,
        conviction: i.conviction,
        actionability: i.actionability,
        shareability: i.shareability,
        horizon: i.horizon,
      },
    });
  }

  logger.info(
    { market: result.market.code, ideas: result.read.ideas.length, flagged: fab.flagged.length, costUsd: ledger.totalUsd.toFixed(4) },
    "desk.done",
  );
  // eslint-disable-next-line no-console
  console.log("\n" + body + "\n");
  if (fab.flagged.length) {
    // eslint-disable-next-line no-console
    console.log("⚠️ fabrication-guard flags (numbers not traced to data):", fab.flagged.join(", "));
  }
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err: String(err) }, "desk.fatal");
  process.exit(1);
});
