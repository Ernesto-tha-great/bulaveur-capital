import { describe, it, expect } from "vitest";
import { rankIdeas, ideaScore, type Idea } from "../../src/agents/em-desk";

const idea = (actionability: number, shareability: number, conviction = 3): Idea => ({
  title: "x",
  sleeve: "rates",
  action: "buy",
  instrument: "10Y local govvie",
  thesis: "grounded thesis",
  conviction,
  actionability,
  shareability,
  horizon: "tactical",
});

describe("desk idea ranking (actionable × shareable)", () => {
  it("ranks the highest actionable × shareable idea first", () => {
    const ranked = rankIdeas([idea(2, 2), idea(5, 5), idea(5, 1)]);
    expect(ranked[0]).toMatchObject({ actionability: 5, shareability: 5 });
  });

  it("requires BOTH dimensions high: 4×4 outranks 5×1", () => {
    expect(ideaScore(idea(4, 4))).toBeGreaterThan(ideaScore(idea(5, 1)));
  });

  it("breaks ties on conviction", () => {
    const ranked = rankIdeas([idea(4, 4, 1), idea(4, 4, 5)]);
    expect(ranked[0].conviction).toBe(5);
  });
});
