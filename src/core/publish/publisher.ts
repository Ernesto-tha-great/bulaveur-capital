import { logger } from "../logger";

/**
 * Distribution. A `Publisher` takes an approved post and pushes it to a channel.
 * The interface is identical across channels so missions don't care where they
 * publish. Add LinkedIn / newsletter / web-feed publishers the same way.
 */
export interface Post {
  text: string;
  /** For X threads: extra parts posted as chained replies. */
  threadParts?: string[];
  mediaUrls?: string[];
  meta?: Record<string, unknown>;
}

export interface PublishResult {
  channel: string;
  externalId?: string;
  url?: string;
}

export interface Publisher {
  readonly channel: string;
  publish(post: Post): Promise<PublishResult>;
}

/** Dev/dry-run publisher: logs instead of posting. Default in development. */
export class ConsolePublisher implements Publisher {
  readonly channel = "console";
  async publish(post: Post): Promise<PublishResult> {
    logger.info({ text: post.text, threadParts: post.threadParts?.length ?? 0 }, "publish.console");
    return { channel: this.channel };
  }
}

/**
 * X / Twitter (API v2, OAuth2 user-context).
 * Requires env `X_ACCESS_TOKEN` — a user token with `tweet.write` scope.
 * Posts the main text, then chains `threadParts` as replies into a thread.
 * See each project's README → "Publishing to X" for how to get the token.
 */
export class XPublisher implements Publisher {
  readonly channel = "x";
  private readonly token = process.env.X_ACCESS_TOKEN;

  async publish(post: Post): Promise<PublishResult> {
    if (!this.token) throw new Error("X_ACCESS_TOKEN not set — see README → Publishing to X.");
    const first = await this.tweet(post.text);
    let replyTo = first.id;
    for (const part of post.threadParts ?? []) {
      const next = await this.tweet(part, replyTo);
      replyTo = next.id;
    }
    return {
      channel: this.channel,
      externalId: first.id,
      url: `https://x.com/i/web/status/${first.id}`,
    };
  }

  private async tweet(text: string, replyToId?: string): Promise<{ id: string }> {
    const body: Record<string, unknown> = { text };
    if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`X publish failed ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data: { id: string } };
    return { id: json.data.id };
  }
}

/** Resolve a publisher by channel; defaults to console in development. */
export function getPublisher(channel: string): Publisher {
  switch (channel) {
    case "x":
      return new XPublisher();
    case "console":
      return new ConsolePublisher();
    default:
      throw new Error(`No publisher registered for channel "${channel}"`);
  }
}
