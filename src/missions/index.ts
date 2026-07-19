import { complianceCheck, requestApproval } from "../core/approval/approval";
import { logger } from "../core/logger";
import { BudgetLedger } from "../core/models/model-router";
import { prisma } from "../core/db";
import { MissionRegistry, type Mission } from "../core/schedule/scheduler";
import { draftMorningBrief, splitThread } from "../agents/macro";
import { scanOpportunities } from "../agents/rv";
import { buildWeeklyNote } from "../agents/strategist";
import { critique } from "../agents/critic";
import { checkFabrication } from "../agents/fabrication";
import { extractAndStoreRecommendations } from "../agents/recommendations";
import { syncMarketData } from "../tools/data/fred";
import { notifyApproval } from "../tools/notify/telegram";
import { recordMissionRun } from "../lib/run";

/**
 * Bulaveur Capital's autonomous research missions. Each: gather data → research →
 * compliance + fabrication guardrail → queue for approval (Telegram) → publish on
 * approval. Every run is recorded (AgentRun) + traced. Cron is UTC.
 */
export const DISCLAIMER =
  "Not investment advice. Informational only. Do your own research. — Bulaveur Capital";

const COMPLIANCE = {
  requiredDisclaimer: DISCLAIMER,
  bannedPhrases: ["guaranteed return", "risk-free", "can't lose"],
  maxLength: 8000,
};

/** Merge compliance + fabrication findings into a single issues list. */
function collectIssues(complianceIssues: string[], fabFlagged: string[], critiqueIssues: string[] = []): string[] {
  return [
    ...complianceIssues,
    ...fabFlagged.map((f) => `unverified number: ${f}`),
    ...critiqueIssues.map((c) => `critic: ${c}`),
  ];
}

// ── Morning brief (X thread) ──────────────────────────────────────────
const morningBrief: Mission = {
  name: "morning-brief",
  cron: "30 11 * * 1-5", // weekdays 11:30 UTC (~06:30 ET pre-open)
  description: "Sync data → draft brief → compliance + fabrication check → approval → X thread.",
  run: () =>
    recordMissionRun("morning-brief", async () => {
      await syncMarketData();
      const brief = await draftMorningBrief();
      const fab = checkFabrication(brief.text, brief.dataContext);
      const checked = complianceCheck(brief.text, COMPLIANCE);
      const { lead, parts } = splitThread(checked.text);
      const issues = collectIssues(checked.issues, fab.flagged);

      const item = await requestApproval({
        kind: "x_post",
        summary: `Morning brief (${brief.dataAsOf})${issues.length ? " ⚠️" : ""} — ${parts.length + 1} posts`,
        payload: { channel: "x", lead, parts, issues },
        autoApprove: false,
      });
      await notifyApproval(item.id, `Morning brief (${brief.dataAsOf})`);
      logger.info({ issues: issues.length, costUsd: brief.ledger.totalUsd.toFixed(4) }, "morning-brief.queued");
      return { ledger: brief.ledger };
    }),
};

// ── Intraday opportunity scan (X thread) ──────────────────────────────
const opportunityScan: Mission = {
  name: "opportunity-scan",
  cron: "0 13,15,17,19 * * 1-5", // every 2h during US session
  description: "RVAgent screen → opportunity note → compliance/fabrication → approval → X.",
  run: () =>
    recordMissionRun("opportunity-scan", async () => {
      const ledger = new BudgetLedger();
      const { opportunities, dataContext } = await scanOpportunities(ledger);
      if (opportunities.length === 0) {
        logger.info("opportunity-scan: no ideas");
        return { ledger };
      }
      const body = opportunities
        .map(
          (o, i) =>
            `${i + 1}. ${o.title} — ${o.action.toUpperCase()} ${o.instrument} ` +
            `(conviction ${o.conviction}/5, ${o.horizon}).\n${o.thesis}`,
        )
        .join("\n\n");
      const fab = checkFabrication(body, dataContext);
      const checked = complianceCheck(body, COMPLIANCE);
      const note = await prisma.researchNote.create({
        data: {
          kind: "opportunity",
          title: `Opportunity scan ${new Date().toISOString().slice(0, 10)}`,
          body: checked.text,
          status: "in_review",
        },
      });
      const issues = collectIssues(checked.issues, fab.flagged);
      const item = await requestApproval({
        kind: "x_post",
        summary: `Opportunity scan (${opportunities.length})${issues.length ? " ⚠️" : ""}`,
        payload: {
          channel: "x",
          lead: `RV / positioning ideas — ${new Date().toISOString().slice(0, 10)}`,
          parts: checked.text.split("\n\n"),
          noteId: note.id,
          issues,
        },
        autoApprove: false,
      });
      await notifyApproval(item.id, "Opportunity scan");
      return { ledger };
    }),
};

// ── Weekly deep credit note (newsletter + X teaser) ───────────────────
const weeklyCreditNote: Mission = {
  name: "weekly-credit-note",
  cron: "0 14 * * 3", // Wednesdays 14:00 UTC
  description: "Multi-agent weekly note (macro+credit+RV) → critic → recs → approval → newsletter.",
  run: () =>
    recordMissionRun("weekly-credit-note", async () => {
      const issuer = await prisma.issuer.findFirst({ orderBy: { createdAt: "asc" } });
      const name = issuer?.name ?? "Ford Motor Company";
      const ticker = issuer?.ticker ?? "F";

      const note = await buildWeeklyNote(name, ticker);
      const crit = await critique(note.text, note.dataContext, note.ledger);
      const fab = checkFabrication(note.text, note.dataContext);
      const checked = complianceCheck(note.text, COMPLIANCE);

      const rn = await prisma.researchNote.create({
        data: { kind: "credit_note", title: `Weekly Credit Note: ${name}`, body: checked.text, status: "in_review" },
      });
      const recs = await extractAndStoreRecommendations(rn.id, checked.text);
      const issues = collectIssues(checked.issues, fab.flagged, crit.approved ? [] : crit.issues);

      const item = await requestApproval({
        kind: "newsletter",
        summary: `Weekly credit note: ${name}${issues.length ? " ⚠️" : ""} (${recs} recs)`,
        payload: {
          channel: "newsletter",
          subject: `Bulaveur Capital — Weekly Credit Note: ${name}`,
          text: checked.text,
          noteId: rn.id,
          issues,
        },
        autoApprove: false,
      });
      await notifyApproval(item.id, `Weekly credit note: ${name}`);
      logger.info({ recs, approved: crit.approved, costUsd: note.ledger.totalUsd.toFixed(4) }, "weekly-note.queued");
      return { ledger: note.ledger };
    }),
};

export const missions = new MissionRegistry().register(morningBrief, opportunityScan, weeklyCreditNote);
