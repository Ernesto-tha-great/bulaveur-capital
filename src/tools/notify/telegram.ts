import { logger } from "../../core/logger";

/**
 * Telegram approval notifier — sends the pending item with one-tap approve/reject
 * links to your phone. Requires TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID. No-op (logs)
 * if unset, so dev still works. Create a bot via @BotFather; get your chat id from
 * @userinfobot.
 */
export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    logger.warn("telegram not configured (TELEGRAM_BOT_TOKEN/CHAT_ID) — skipping notify");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) logger.warn({ status: res.status }, "telegram.send.fail");
  } catch (err) {
    logger.warn({ err: String(err) }, "telegram.send.error");
  }
}

/** Send an approval prompt with tap-to-act links. */
export async function notifyApproval(id: string, summary: string): Promise<void> {
  const base = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8080}`;
  await notifyTelegram(
    `🔔 Approval needed: ${summary}\n\n✅ Approve: ${base}/approvals/${id}/approved\n❌ Reject: ${base}/approvals/${id}/rejected`,
  );
}
