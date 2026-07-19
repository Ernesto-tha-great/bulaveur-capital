import { tierAvailable } from "../config/env";
import type { ModelSpec } from "./catalog";

/**
 * Filter a candidate model chain down to tiers we actually have credentials for,
 * preserving order. Lets you author ideal escalation chains without crashing when,
 * say, OPENROUTER_API_KEY isn't set in a given environment.
 */
export function usableChain(specs: ModelSpec[]): ModelSpec[] {
  return specs.filter((s) =>
    s.tier === "local"
      ? tierAvailable.local()
      : s.tier === "open"
        ? tierAvailable.open()
        : tierAvailable.frontier(),
  );
}
