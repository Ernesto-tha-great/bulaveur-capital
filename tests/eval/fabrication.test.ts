import { describe, expect, it } from "vitest";
import { checkFabrication } from "../../src/agents/fabrication";

/**
 * The fabrication guardrail is deterministic, so it's a fast unit test (no models,
 * no network) and a hard CI gate. This is the check that stops the desk from ever
 * publishing an invented figure.
 */
const DATA =
  "UST 10Y (UST10Y): 4.28% as of 2026-07-01\n" +
  "US HY OAS (HY_OAS): 320bps as of 2026-07-01\n" +
  "2s10s slope (2s10s): 0.15% as of 2026-07-01";

describe("fabrication guardrail", () => {
  it("passes when every number traces to the data", () => {
    const r = checkFabrication("10Y at 4.28%, HY OAS ~320bps, curve 2s10s +0.15%. Steady.", DATA);
    expect(r.ok).toBe(true);
  });

  it("flags an invented number", () => {
    const r = checkFabrication("10Y at 4.28% but HY OAS blew out to 720bps.", DATA);
    expect(r.ok).toBe(false);
    expect(r.flagged.join(" ")).toContain("720");
  });

  it("ignores years and small counts", () => {
    const r = checkFabrication("In 2026 we flag 3 key risks.", DATA);
    expect(r.ok).toBe(true);
  });
});
