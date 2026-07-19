import { describe, expect, it } from "vitest";
import { tierAvailable } from "../../src/core/config/env";
import { judge } from "../../src/core/eval/judge";

/**
 * LLM-as-judge eval for brief quality. Skipped when no cloud model tier is
 * available (so CI without keys still runs the deterministic checks). Wire this
 * into CI with real keys to gate quality regressions.
 */
const haveJudge = tierAvailable.open() || tierAvailable.frontier();

describe.skipIf(!haveJudge)("morning-brief quality (LLM-as-judge)", () => {
  it("a grounded, sober brief scores acceptably", async () => {
    const brief =
      "Pre-open: US 10Y 4.28%, 2s10s +0.15% (still barely positive). HY OAS ~320bps — credit " +
      "calm. Idea: fade rich HY, add belly duration into supply. Risk: sticky CPI reprices cuts. " +
      "Not investment advice.";
    const result = await judge({
      task: "Write a sober pre-open fixed-income brief that cites levels, discloses risk, and gives one actionable idea without hype.",
      output: brief,
      rubric:
        "PASS if it cites specific levels, gives an actionable idea, discloses a risk, and contains no hype/return promises.",
    });
    expect(result.score).toBeGreaterThanOrEqual(0.5);
  }, 60_000);
});
