import { describe, it, expect } from "vitest";
import { aiOpsUsed, aiOpsLeft, canUseAi, consumeAiOp, FREE_AI_OPS_PER_MONTH } from "../aiQuota";
import type { LifeTree, Profile } from "../types";

const profile = (): Profile => ({
  name: "测试", age: 28, education: "bachelor", major: "", occupation: "", salary: "10to20",
  hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "single", location: "上海",
  status: "", snapshot: "", crossroad: "",
  areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 },
});

function baseTree(aiOps?: { month: string; used: number }): LifeTree {
  return {
    id: "tree-1",
    profile: profile(),
    horizonYears: 15,
    paths: [],
    decisions: [],
    goals: [],
    tasks: [],
    choices: [],
    activity: [],
    calendarFeeds: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...(aiOps ? { aiOps } : {}),
  };
}

const TODAY = "2026-07-08";

describe("aiQuota", () => {
  describe("aiOpsUsed", () => {
    it("is 0 when aiOps undefined", () => {
      expect(aiOpsUsed(baseTree(), TODAY)).toBe(0);
    });

    it("is 0 when aiOps.month !== today's month", () => {
      expect(aiOpsUsed(baseTree({ month: "2026-06", used: 5 }), TODAY)).toBe(0);
    });

    it("is used when month matches", () => {
      expect(aiOpsUsed(baseTree({ month: "2026-07", used: 7 }), TODAY)).toBe(7);
    });
  });

  describe("aiOpsLeft", () => {
    it("is 20 fresh", () => {
      expect(aiOpsLeft(baseTree(), TODAY)).toBe(FREE_AI_OPS_PER_MONTH);
    });

    it("floors at 0 when used >= 20", () => {
      expect(aiOpsLeft(baseTree({ month: "2026-07", used: 20 }), TODAY)).toBe(0);
      expect(aiOpsLeft(baseTree({ month: "2026-07", used: 999 }), TODAY)).toBe(0);
    });
  });

  describe("consumeAiOp", () => {
    it("increments within the same month", () => {
      const t = baseTree({ month: "2026-07", used: 3 });
      const next = consumeAiOp(t, TODAY);
      expect(next.aiOps).toEqual({ month: "2026-07", used: 4 });
    });

    it("resets to { month: newMonth, used: 1 } on month rollover", () => {
      const t = baseTree({ month: "2026-06", used: 15 });
      const next = consumeAiOp(t, TODAY);
      expect(next.aiOps).toEqual({ month: "2026-07", used: 1 });
    });
  });

  describe("canUseAi", () => {
    it("true when isPro even at used=999", () => {
      const t = baseTree({ month: "2026-07", used: 999 });
      expect(canUseAi(t, TODAY, true)).toBe(true);
    });

    it("true when left > 0", () => {
      const t = baseTree({ month: "2026-07", used: 5 });
      expect(canUseAi(t, TODAY, false)).toBe(true);
    });

    it("false when used=20 && !isPro", () => {
      const t = baseTree({ month: "2026-07", used: 20 });
      expect(canUseAi(t, TODAY, false)).toBe(false);
    });
  });
});
