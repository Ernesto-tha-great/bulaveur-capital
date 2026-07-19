import { prisma } from "../db";
import { logger } from "../logger";

/**
 * The safety brake on autonomy. Anything published goes through:
 *   1. complianceCheck — deterministic policy (disclaimers, banned phrases, length)
 *   2. requestApproval — persist a review item; auto-approve low-risk, else wait
 *      for a human one-tap approve/reject.
 *
 * For financial content (Bulaveur) this is non-negotiable: every recommendation
 * carries a "not investment advice" disclaimer and is logged for audit.
 */
export interface CompliancePolicy {
  /** Appended if not already present (e.g. "Not investment advice."). */
  requiredDisclaimer?: string;
  bannedPhrases?: string[];
  /** Hard cap (e.g. 280 for a single X post). */
  maxLength?: number;
}

export interface ComplianceResult {
  ok: boolean;
  issues: string[];
  /** Text after auto-fixes (disclaimer appended). */
  text: string;
}

export function complianceCheck(text: string, policy: CompliancePolicy): ComplianceResult {
  const issues: string[] = [];
  let out = text;

  for (const phrase of policy.bannedPhrases ?? []) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) issues.push(`banned phrase: "${phrase}"`);
  }
  if (policy.requiredDisclaimer && !text.includes(policy.requiredDisclaimer)) {
    out = `${out}\n\n${policy.requiredDisclaimer}`;
  }
  if (policy.maxLength && out.length > policy.maxLength) {
    issues.push(`exceeds maxLength: ${out.length} > ${policy.maxLength}`);
  }
  return { ok: issues.length === 0, issues, text: out };
}

export interface ApprovalRequest {
  kind: string; // "x_post" | "grant_submission" | ...
  summary: string;
  payload: unknown; // the thing being approved
  /** If true and compliance passed, approve without a human. */
  autoApprove?: boolean;
}

export async function requestApproval(req: ApprovalRequest) {
  const status = req.autoApprove ? "auto_approved" : "pending";
  const item = await prisma.approvalItem.create({
    data: {
      kind: req.kind,
      summary: req.summary,
      // Prisma JSON column accepts arbitrary serializable values.
      payload: req.payload as never,
      status,
    },
  });
  if (status === "pending") await notifyReviewers(item.id, req.summary);
  logger.info({ id: item.id, kind: req.kind, status }, "approval.requested");
  return item;
}

export async function resolveApproval(
  id: string,
  decision: "approved" | "rejected",
  by = "human",
  reason?: string,
) {
  return prisma.approvalItem.update({
    where: { id },
    data: { status: decision, resolvedBy: by, reason, resolvedAt: new Date() },
  });
}

/**
 * Notify reviewers of a pending item. MVP logs a one-tap approval URL; wire a
 * Telegram bot or email for real (see README → Approvals). Keeps a human in the
 * loop without you having to babysit a dashboard.
 */
async function notifyReviewers(id: string, summary: string): Promise<void> {
  const base = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8080}`;
  logger.warn({ approveUrl: `${base}/approvals/${id}`, summary }, "approval.notify");
}
