/**
 * Fabrication guardrail — the hard gate for financial content. Every meaningful
 * number in a draft must trace to a number in the data the author was given.
 * Deterministic + cheap; runs before publication. This is a domain-specific
 * seatbelt on top of the LLM CriticAgent.
 *
 * Heuristic, deliberately conservative: ignores years and small integers/counts,
 * matches within a small tolerance to allow rounding/bps↔% conversions.
 */
export interface FabricationResult {
  ok: boolean;
  flagged: string[];
}

function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.match(/-?\d+(?:\.\d+)?/g) ?? []) {
    const v = Number(m);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

export function checkFabrication(draft: string, allowedContext: string): FabricationResult {
  // Build the allowed set from the data context, including rounded + bps/% variants.
  const allowed = new Set<number>();
  for (const v of numbersIn(allowedContext)) {
    allowed.add(v);
    allowed.add(Math.round(v));
    allowed.add(Math.round(v * 100)); // % → bps
    allowed.add(Math.round(v) / 100); // bps → %
  }

  const flagged = new Set<string>();
  // Only scrutinize numbers that read like financial figures (%, bps, or decimals).
  for (const token of draft.match(/-?\d+(?:\.\d+)?\s?(?:%|bps|bp)?/gi) ?? []) {
    const v = Number.parseFloat(token);
    if (!Number.isFinite(v)) continue;
    if (Number.isInteger(v) && v >= 1900 && v <= 2100) continue; // years
    if (Number.isInteger(v) && Math.abs(v) <= 12) continue; // small counts/ordinals
    const near = [...allowed].some((a) => Math.abs(a - v) <= Math.max(0.05, Math.abs(a) * 0.02));
    if (!near) flagged.add(token.trim());
  }

  return { ok: flagged.size === 0, flagged: [...flagged] };
}
