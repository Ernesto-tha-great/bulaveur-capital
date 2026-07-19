import type { Post, PublishResult, Publisher } from "../../core/publish/publisher";

/**
 * Newsletter publisher via Resend. Requires RESEND_API_KEY + NEWSLETTER_TO
 * (comma-separated). Used for the long-form weekly credit note (X gets a teaser
 * thread; the newsletter carries the full note).
 */
export class NewsletterPublisher implements Publisher {
  readonly channel = "newsletter";

  async publish(post: Post): Promise<PublishResult> {
    const key = process.env.RESEND_API_KEY;
    const to = process.env.NEWSLETTER_TO;
    const from = process.env.NEWSLETTER_FROM || "Bulaveur Capital <research@bulaveur.example>";
    if (!key || !to) throw new Error("RESEND_API_KEY / NEWSLETTER_TO not set — see README.");

    const subject = (post.meta?.subject as string | undefined) ?? "Bulaveur Capital — Research";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: to.split(",").map((s) => s.trim()),
        subject,
        html: post.text.replace(/\n/g, "<br>"),
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { id?: string };
    return { channel: this.channel, externalId: json.id };
  }
}
