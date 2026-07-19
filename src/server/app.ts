import { Hono } from "hono";
import { resolveApproval } from "../core/approval/approval";
import { prisma } from "../core/db";
import { logger } from "../core/logger";
import { resolvePublisher } from "../tools/publish/index";

/**
 * HTTP surface: health + human-in-the-loop approval endpoints. Approving an item
 * with a `channel` in its payload is what actually publishes it — the loop closes
 * here. Dispatches by channel (x thread / newsletter) and marks the linked note published.
 */
export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "bulaveur-capital", ts: Date.now() }));

app.get("/approvals/:id", async (c) => {
  const item = await prisma.approvalItem.findUnique({ where: { id: c.req.param("id") } });
  if (!item) return c.json({ error: "not found" }, 404);
  return c.json(item);
});

interface ApprovalPayload {
  channel?: string;
  lead?: string;
  text?: string;
  parts?: string[];
  subject?: string;
  noteId?: string;
}

app.post("/approvals/:id/:decision", async (c) => {
  const id = c.req.param("id");
  const decision = c.req.param("decision");
  if (decision !== "approved" && decision !== "rejected") {
    return c.json({ error: "decision must be approved|rejected" }, 400);
  }

  const item = await prisma.approvalItem.findUnique({ where: { id } });
  if (!item) return c.json({ error: "not found" }, 404);

  const updated = await resolveApproval(id, decision, "human");
  const payload = item.payload as ApprovalPayload;

  if (decision === "approved" && payload.channel) {
    try {
      const publisher = resolvePublisher(payload.channel);
      const result = await publisher.publish({
        text: payload.lead ?? payload.text ?? "",
        threadParts: payload.parts ?? [],
        meta: payload.subject ? { subject: payload.subject } : undefined,
      });
      await prisma.publication.create({
        data: {
          channel: result.channel,
          externalId: result.externalId,
          url: result.url,
          content: payload.text ?? payload.lead ?? "",
          approvalItemId: id,
        },
      });
      if (payload.noteId) {
        await prisma.researchNote.update({
          where: { id: payload.noteId },
          data: { status: "published", publishedAt: new Date() },
        });
      }
      logger.info({ id, channel: result.channel, url: result.url }, "approval.published");
      return c.json({ ...updated, published: result });
    } catch (err) {
      logger.error({ id, err: String(err) }, "approval.publish.fail");
      return c.json({ ...updated, publishError: String(err) }, 502);
    }
  }

  return c.json(updated);
});
