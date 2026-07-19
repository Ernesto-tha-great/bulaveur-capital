import { env, tierAvailable } from "../core/config/env";
import { routedGenerateText } from "../core/models/model-router";
import { logger } from "../core/logger";

/**
 * Health check for the whole stack. Run `pnpm verify` after setup: it pings each
 * available model tier and reports what's wired up. Extend with DB/Redis/Langfuse
 * pings as you connect them.
 */
async function ping(label: string, fn: () => Promise<string>): Promise<void> {
  try {
    const detail = await fn();
    logger.info({ check: label, ok: true, detail }, "verify.ok");
  } catch (err) {
    logger.error({ check: label, ok: false, err: String(err) }, "verify.fail");
  }
}

async function main() {
  logger.info(
    {
      local: tierAvailable.local(),
      open: tierAvailable.open(),
      frontier: tierAvailable.frontier(),
    },
    "verify.tiers",
  );

  if (tierAvailable.local()) {
    await ping("T0 local", async () => {
      const r = await routedGenerateText({
        task: { capability: "draft", complexity: "low", privacy: "private", label: "verify" },
        prompt: "Reply with exactly: OK",
        maxOutputTokens: 8,
      });
      return `${r.resolvedModel.id} → ${r.text.trim()}`;
    });
  }
  if (tierAvailable.open()) {
    await ping("T1 open", async () => {
      const r = await routedGenerateText({
        task: { capability: "reasoning", complexity: "medium", label: "verify" },
        prompt: "Reply with exactly: OK",
        maxOutputTokens: 8,
      });
      return `${r.resolvedModel.id} → ${r.text.trim()}`;
    });
  }
  if (tierAvailable.frontier()) {
    await ping("T2 frontier", async () => {
      const r = await routedGenerateText({
        task: { capability: "judge", complexity: "high", label: "verify" },
        prompt: "Reply with exactly: OK",
        maxOutputTokens: 8,
      });
      return `${r.resolvedModel.id} → ${r.text.trim()}`;
    });
  }

  logger.info(`Budget cap per run: $${(env.MAX_RUN_BUDGET_CENTS / 100).toFixed(2)}`);
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err: String(err) }, "verify.fatal");
  process.exit(1);
});
