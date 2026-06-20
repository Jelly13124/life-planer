import { describe, it, expect } from "vitest";
import { recurringActions, habitStreak } from "@/domain/habits";
import { completeAction } from "@/domain/daily";
import { createGoal, upsertGoal, setGoalActions, setActionRepeat } from "@/domain/goals";
import { createTree } from "@/domain/tree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { LifeTree, Profile } from "@/domain/types";

const profile: Profile = {
  name: "小林", age: 30, education: "bachelor", major: "视觉传达", occupation: "设计师",
  salary: "5to10", hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "dating",
  location: "杭州", status: "工作5年", snapshot: "设计师", crossroad: "",
  areas: { career: 50, wealth: 45, relationships: 55, health: 60, growth: 50 },
};
const gen = new LocalPathGenerator();
const NOW = "2026-06-20T00:00:00.000Z";
const TODAY = "2026-06-20";

// Build a tree with one active goal containing two actions:
// a0 = daily repeat, a1 = weekly repeat.
function buildTree(): { tree: LifeTree; a0: string; a1: string; a2: string } {
  let t = createTree(profile, gen, NOW);
  let g = createGoal({ area: "health", horizon: "short", title: "健康习惯", why: "" }, NOW);
  g = setGoalActions(g, ["每天冥想", "每周跑步", "一次性任务"]);
  const rawA0 = g.actions[0].id;
  const rawA1 = g.actions[1].id;
  const rawA2 = g.actions[2].id;
  g = setActionRepeat(g, rawA0, "daily");
  g = setActionRepeat(g, rawA1, "weekly");
  // a2 stays non-repeat (one-shot)
  t = upsertGoal(t, g);
  return { tree: t, a0: rawA0, a1: rawA1, a2: rawA2 };
}

describe("habits domain", () => {
  describe("recurringActions", () => {
    it("returns only repeat-set actions of active goals", () => {
      const { tree, a0, a1, a2 } = buildTree();
      const habits = recurringActions(tree);
      const ids = habits.map((h) => h.action.id);
      expect(ids).toContain(a0);
      expect(ids).toContain(a1);
      expect(ids).not.toContain(a2); // one-shot, no repeat
    });

    it("excludes actions from non-active (done) goals", () => {
      const { tree } = buildTree();
      // Mark the goal as done by setting its status directly via type manipulation
      const t: LifeTree = {
        ...tree,
        goals: tree.goals.map((g) => ({ ...g, status: "done" as const })),
      };
      const habits = recurringActions(t);
      expect(habits).toHaveLength(0);
    });

    it("includes actions from multiple active goals", () => {
      let t = createTree(profile, gen, NOW);
      let g1 = createGoal({ area: "health", horizon: "short", title: "目标A", why: "" }, NOW);
      g1 = setGoalActions(g1, ["跑步"]);
      g1 = setActionRepeat(g1, g1.actions[0].id, "daily");
      let g2 = createGoal({ area: "growth", horizon: "short", title: "目标B", why: "" }, NOW);
      g2 = setGoalActions(g2, ["读书"]);
      g2 = setActionRepeat(g2, g2.actions[0].id, "weekly");
      t = upsertGoal(t, g1);
      t = upsertGoal(t, g2);
      const habits = recurringActions(t);
      expect(habits).toHaveLength(2);
    });
  });

  describe("habitStreak — daily", () => {
    it("returns 0 when no completions", () => {
      const { tree, a0 } = buildTree();
      const action = tree.goals[0].actions.find((a) => a.id === a0)!;
      expect(habitStreak(tree, action, TODAY)).toBe(0);
    });

    it("streak 3: completed on today-2, today-1, today", () => {
      const { tree, a0 } = buildTree();
      const action = tree.goals[0].actions.find((a) => a.id === a0)!;
      let t = completeAction(tree, a0, "2026-06-18");
      t = completeAction(t, a0, "2026-06-19");
      t = completeAction(t, a0, TODAY);
      expect(habitStreak(t, action, TODAY)).toBe(3);
    });

    it("grace: completed today-2 and today-1 but NOT today → streak 2", () => {
      const { tree, a0 } = buildTree();
      const action = tree.goals[0].actions.find((a) => a.id === a0)!;
      let t = completeAction(tree, a0, "2026-06-18");
      t = completeAction(t, a0, "2026-06-19");
      // today (2026-06-20) not completed — grace kicks in, starts from yesterday
      expect(habitStreak(t, action, TODAY)).toBe(2);
    });

    it("gap resets streak", () => {
      const { tree, a0 } = buildTree();
      const action = tree.goals[0].actions.find((a) => a.id === a0)!;
      let t = completeAction(tree, a0, "2026-06-17"); // gap at 2026-06-18
      t = completeAction(t, a0, "2026-06-19");
      // yesterday done, day before yesterday not → streak = 1 (yesterday only)
      expect(habitStreak(t, action, TODAY)).toBe(1);
    });
  });

  describe("habitStreak — weekly", () => {
    it("returns 0 when no completions", () => {
      const { tree, a1 } = buildTree();
      const action = tree.goals[0].actions.find((a) => a.id === a1)!;
      expect(habitStreak(tree, action, TODAY)).toBe(0);
    });

    it("completed once this week and once last week → streak 2", () => {
      const { tree, a1 } = buildTree();
      const action = tree.goals[0].actions.find((a) => a.id === a1)!;
      // this week: TODAY (window 0)
      let t = completeAction(tree, a1, TODAY);
      // last week: today-7 (window 1)
      t = completeAction(t, a1, "2026-06-13");
      expect(habitStreak(t, action, TODAY)).toBe(2);
    });

    it("only this week → streak 1", () => {
      const { tree, a1 } = buildTree();
      const action = tree.goals[0].actions.find((a) => a.id === a1)!;
      const t = completeAction(tree, a1, TODAY);
      expect(habitStreak(t, action, TODAY)).toBe(1);
    });

    it("weekly grace: only last week done → streak 1", () => {
      const { tree, a1 } = buildTree();
      const action = tree.goals[0].actions.find((a) => a.id === a1)!;
      // only last week, nothing this week
      const t = completeAction(tree, a1, "2026-06-13");
      expect(habitStreak(t, action, TODAY)).toBe(1);
    });

    it("skip a week resets streak", () => {
      const { tree, a1 } = buildTree();
      const action = tree.goals[0].actions.find((a) => a.id === a1)!;
      // this week and 2 weeks ago; skip 1 week
      let t = completeAction(tree, a1, TODAY);
      t = completeAction(t, a1, "2026-06-06"); // 2 weeks ago
      // window 0 = this week (done), window 1 = last week (none) → stops at 1
      expect(habitStreak(t, action, TODAY)).toBe(1);
    });
  });
});
