import { describe, it, expect } from "vitest";
import { insightsSummary } from "@/domain/insights";
import { completeAction } from "@/domain/daily";
import { createTree, } from "@/domain/tree";
import { createGoal, setGoalActions, upsertGoal } from "@/domain/goals";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { Profile } from "@/domain/types";

const profile: Profile = {
  name: "Tester", age: 28, education: "bachelor", major: "CS", occupation: "dev",
  salary: "5to10", hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "single",
  location: "Shanghai", status: "", snapshot: "", crossroad: "",
  areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 },
};
const gen = new LocalPathGenerator();
const NOW = "2026-06-20T00:00:00.000Z";
const TODAY = "2026-06-20";

function baseTree() {
  let t = createTree(profile, gen, NOW);
  const g = setGoalActions(
    createGoal({ area: "growth", horizon: "short", title: "健身", why: "" }, NOW),
    ["俯卧撑", "跑步", "拉伸"],
  );
  t = upsertGoal(t, g);
  return { tree: t, a0: g.actions[0].id, a1: g.actions[1].id, a2: g.actions[2].id };
}

describe("insightsSummary", () => {
  it("empty tree: all zeros", () => {
    const { tree } = baseTree();
    const s = insightsSummary(tree, TODAY, 90);
    expect(s.streak).toBe(0);
    expect(s.longestStreak).toBe(0);
    expect(s.completions).toBe(0);
    expect(s.activeDays).toBe(0);
    expect(s.consistency).toBe(0);
    expect(s.windowDays).toBe(90);
  });

  it("streak: counts current consecutive days with grace for today", () => {
    const { tree, a0, a1 } = baseTree();
    // complete yesterday and day-before only (today empty → grace → looks back from yesterday)
    let t = completeAction(tree, a0, "2026-06-18");
    t = completeAction(t, a1, "2026-06-19");
    const s = insightsSummary(t, TODAY, 10);
    expect(s.streak).toBe(2);
  });

  it("longestStreak: isolated completed-day is 1", () => {
    const { tree, a0 } = baseTree();
    const t = completeAction(tree, a0, "2026-06-10");
    const s = insightsSummary(t, TODAY, 30);
    expect(s.longestStreak).toBe(1);
  });

  it("longestStreak: gap between runs keeps the longer one", () => {
    const { tree, a0, a1 } = baseTree();
    // run A: Jun 13, 14, 15 (length 3); gap Jun 16; run B: Jun 17, 18 (length 2)
    let t = completeAction(tree, a0, "2026-06-13");
    t = completeAction(t, a1, "2026-06-14");
    t = completeAction(t, a0, "2026-06-15");
    // Jun 16 intentionally empty
    t = completeAction(t, a0, "2026-06-17");
    t = completeAction(t, a1, "2026-06-18");
    const s = insightsSummary(t, TODAY, 30);
    expect(s.longestStreak).toBe(3);
  });

  it("longestStreak: single long continuous run equals its length", () => {
    const { tree, a0 } = baseTree();
    // complete today-5, today-4, today-3 → then today (gap at today-2, today-1)
    let t = completeAction(tree, a0, "2026-06-15");
    t = completeAction(t, a0, "2026-06-16");
    t = completeAction(t, a0, "2026-06-17");
    // gap on Jun 18, Jun 19
    t = completeAction(t, a0, TODAY);
    const s = insightsSummary(t, TODAY, 30);
    // longest run is Jun 15-17 = 3; today's single day = 1
    expect(s.longestStreak).toBe(3);
  });

  it("completions and activeDays count within the window", () => {
    const { tree, a0, a1, a2 } = baseTree();
    // 3 completions on Jun 19, 2 completions on Jun 18 (both inside 5-day window ending TODAY)
    // Jun 16 completion is outside a 3-day window
    let t = completeAction(tree, a0, "2026-06-16");
    t = completeAction(t, a1, "2026-06-18");
    t = completeAction(t, a2, "2026-06-18");
    t = completeAction(t, a0, "2026-06-19");
    t = completeAction(t, a1, "2026-06-19");
    t = completeAction(t, a2, "2026-06-19");

    const s3 = insightsSummary(t, TODAY, 3); // window: Jun 18, Jun 19, Jun 20
    expect(s3.completions).toBe(5); // 2 + 3
    expect(s3.activeDays).toBe(2);
    expect(s3.consistency).toBe(Math.round((2 / 3) * 100));

    const s5 = insightsSummary(t, TODAY, 5); // window: Jun 16..20
    expect(s5.completions).toBe(6); // 1 + 2 + 3
    expect(s5.activeDays).toBe(3);
  });

  it("defaults to 90-day window", () => {
    const { tree } = baseTree();
    const s = insightsSummary(tree, TODAY);
    expect(s.windowDays).toBe(90);
  });
});
