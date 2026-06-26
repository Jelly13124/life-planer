import { describe, it, expect } from "vitest";
import { scenarioOdds } from "../scenarioOdds";

describe("scenarioOdds", () => {
  it("sums to 100 with 中性 dominant across the range", () => {
    for (const f of [0, 10, 20, 35, 50, 65, 80, 95, 100, undefined]) {
      const o = scenarioOdds(f);
      expect(o.optimistic + o.likely + o.conservative).toBe(100);
      expect(o.likely).toBeGreaterThanOrEqual(o.optimistic);
      expect(o.likely).toBeGreaterThanOrEqual(o.conservative);
    }
  });

  it("matches the spec anchors", () => {
    expect(scenarioOdds(50)).toEqual({ optimistic: 20, likely: 60, conservative: 20 });
    expect(scenarioOdds(80)).toEqual({ optimistic: 30, likely: 60, conservative: 10 });
    expect(scenarioOdds(20)).toEqual({ optimistic: 10, likely: 60, conservative: 30 });
  });

  it("clamps out-of-range + defaults undefined to 50", () => {
    expect(scenarioOdds(999)).toEqual(scenarioOdds(100));
    expect(scenarioOdds(-50)).toEqual(scenarioOdds(0));
    expect(scenarioOdds(undefined)).toEqual({ optimistic: 20, likely: 60, conservative: 20 });
  });
});
