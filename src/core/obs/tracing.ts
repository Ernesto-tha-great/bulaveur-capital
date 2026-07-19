import { Langfuse } from "langfuse";
import { env } from "../config/env";
import { logger } from "../logger";

/**
 * Observability. Every mission/agent run becomes a Langfuse trace: model used,
 * tokens, cost, latency, inputs/outputs. You cannot tune routing, catch quality
 * drift, or control spend without this — it's the feedback loop that makes you good.
 *
 * No keys set → tracing is a no-op (dev-friendly), the app still runs.
 */
export const langfuse =
  env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY
    ? new Langfuse({
        publicKey: env.LANGFUSE_PUBLIC_KEY,
        secretKey: env.LANGFUSE_SECRET_KEY,
        baseUrl: env.LANGFUSE_BASE_URL,
      })
    : null;

/** Wrap a unit of work in a trace; returns the trace id for linking to AgentRun. */
export async function withTrace<T>(
  name: string,
  fn: (traceId: string | undefined) => Promise<T>,
  meta?: Record<string, unknown>,
): Promise<T> {
  const trace = langfuse?.trace({ name, metadata: meta });
  try {
    return await fn(trace?.id);
  } catch (err) {
    trace?.update({ metadata: { ...meta, error: String(err) } });
    logger.error({ trace: name, err: String(err) }, "trace.error");
    throw err;
  } finally {
    await langfuse?.flushAsync();
  }
}
