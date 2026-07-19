import type { z } from "zod";
import { logger } from "../logger";

/**
 * Guardrails: cheap, deterministic checks around the probabilistic model.
 * Input side: blunt prompt-injection heuristics. Output side: schema validation
 * with a bounded repair loop. None of this replaces evals — it's the seatbelt,
 * not the driver.
 */
const INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /disregard (the )?(system|above)/i,
  /you are now/i,
  /reveal your (system )?prompt/i,
];

export function looksLikeInjection(input: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(input));
}

/** Light PII redaction for logs/telemetry (emails, obvious card-like numbers). */
export function redactPII(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b(?:\d[ -]*?){13,16}\b/g, "[number]");
}

/**
 * Run a structured generator, validate against a schema, and repair up to
 * `maxAttempts` times by feeding the validation error back. Returns the first
 * valid object or throws.
 */
export async function withRepair<T>(
  schema: z.ZodType<T>,
  generate: (repairHint?: string) => Promise<unknown>,
  maxAttempts = 2,
): Promise<T> {
  let hint: string | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const raw = await generate(hint);
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    lastErr = parsed.error;
    hint = `Your previous output failed validation: ${JSON.stringify(parsed.error.issues)}. Fix and return valid output.`;
    logger.warn({ attempt, issues: parsed.error.issues.length }, "guardrail.repair");
  }
  throw new Error(`Output failed validation after ${maxAttempts} attempts: ${String(lastErr)}`);
}
