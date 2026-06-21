import { describe, it, expect } from "vitest";
import { recurringActions, habitStreak } from "@/domain/habits";
import { completeAction } from "@/domain/daily";
import { addGoal, addHabit, addTask } from "@/domain/goalTree";
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

// Build a tree with one active goal containing:
// h0 = daily habit, h1 = weekly habit, a2 = one-shot task.
function buildTree(): { tree: LifeTree; h0: string; h1: string; a2: string } {
  let t = createTree(profile, gen, NOW);
  const g = addGoal(t, { area: "health", title: "健康习惯", why: "" }, NOW);
  t = g.tree;
  const r0 = addHabit(t, g.id, null, "每天冥想", "daily", undefined, `${NOW}-h0`);
  t = r0.tree;
  const r1 = addHabit(t, g.id, null, "每周跑步", "weekly", undefined, `${NOW}-h1`);
  t = r1.tree;
  const r2 = addTask(t, g.id, null, "一次性任务", `${NOW}-a2`);
  t = r2.tree;
  return { tree: t, h0: r0.id, h1: r1.id, a2: r2.id };
}

describe("habits domain", () => {
  describe("recurringActions", () => {
    it("returns only habits (repeat actions) of active goals", () => {
      const { tree, h0, h1, a2 } = buildTree();
      const habits = recurringActions(tree);
      const ids = habits.map((h) => h.habit.id);
      expect(ids).toContain(h0);
      expect(ids).toContain(h1);
      expect(ids).not.toContain(a2); // one-shot task, not a habit
    });

    it("excludes habits from non-active (done) goals", () => {
      const { tree } = buildTree();
      const t: LifeTree = {
        ...tree,
        goals: tree.goals.map((g) => ({ ...g, status: "done" as const })),
      };
      const habits = recurringActions(t);
      expect(habits).toHaveLength(0);
    });

    it("includes habits from multiple active goals", () => {
      let t = createTree(profile, gen, NOW);
      const g1 = addGoal(t, { area: "health", title: "目标A", why: "" }, NOW);
      t = g1.tree;
      t = addHabit(t, g1.id, null, "跑步", "daily", undefined, `${NOW}-g1h`).tree;
      const g2 = addGoal(t, { area: "growth", title: "目标B", why: "" }, `${NOW}-g2`);
      t = g2.tree;
      t = addHabit(t, g2.id, null, "读书", "weekly", undefined, `${NOW}-g2h`).tree;
      const habits = recurringActions(t);
      expect(habits).toHaveLength(2);
    });
  });

  describe("habitStreak — daily", () => {
    it("returns 0 when no completions", () => {
      const { tree, h0 } = buildTree();
      expect(habitStreak(tree, h0, TODAY)).toBe(0);
    });

    it("streak 3: completed on today-2, today-1, today", () => {
      const { tree, h0 } = buildTree();
      let t = completeAction(tree, h0, "2026-06-18");
      t = completeAction(t, h0, "2026-06-19");
      t = completeAction(t, h0, TODAY);
      expect(habitStreak(t, h0, TODAY)).toBe(3);
    });

    it("grace: completed today-2 and today-1 but NOT today → streak 2", () => {
      const { tree, h0 } = buildTree();
      let t = completeAction(tree, h0, "2026-06-18");
      t = completeAction(t, h0, "2026-06-19");
      // today (2026-06-20) not completed — grace kicks in, starts from yesterday
      expect(habitStreak(t, h0, TODAY)).toBe(2);
    });

    it("gap resets streak", () => {
      const { tree, h0 } = buildTree();
      let t = completeAction(tree, h0, "2026-06-17"); // gap at 2026-06-18
      t = completeAction(t, h0, "2026-06-19");
      // yesterday done, day before yesterday not → streak = 1 (yesterday only)
      expect(habitStreak(t, h0, TODAY)).toBe(1);
    });
  });

  describe("habitStreak — weekly", () => {
    it("returns 0 when no completions", () => {
      const { tree, h1 } = buildTree();
      expect(habitStreak(tree, h1, TODAY)).toBe(0);
    });

    it("completed once this week and once last week → streak 2", () => {
      const { tree, h1 } = buildTree();
      // this week: TODAY (window 0)
      let t = completeAction(tree, h1, TODAY);
      // last week: today-7 (window 1)
      t = completeAction(t, h1, "2026-06-13");
      expect(habitStreak(t, h1, TODAY)).toBe(2);
    });

    it("only this week → streak 1", () => {
      const { tree, h1 } = buildTree();
      const t = completeAction(tree, h1, TODAY);
      expect(habitStreak(t, h1, TODAY)).toBe(1);
    });

    it("weekly grace: only last week done → streak 1", () => {
      const { tree, h1 } = buildTree();
      // only last week, nothing this week
      const t = completeAction(tree, h1, "2026-06-13");
      expect(habitStreak(t, h1, TODAY)).toBe(1);
    });

    it("skip a week resets streak", () => {
      const { tree, h1 } = buildTree();
      // this week and 2 weeks ago; skip 1 week
      let t = completeAction(tree, h1, TODAY);
      t = completeAction(t, h1, "2026-06-06"); // 2 weeks ago
      // window 0 = this week (done), window 1 = last week (none) → stops at 1
      expect(habitStreak(t, h1, TODAY)).toBe(1);
    });

    it("weekly grace over 2 prior weeks: window 0 empty, window 1 and window 2 both done → streak 2", () => {
      const { tree, h1 } = buildTree();
      // window 0 (this week): nothing — grace kicks in, start counting from window 1
      // window 1 (last week): today-7 = 2026-06-13
      // window 2 (two weeks ago): today-14 = 2026-06-06
      let t = completeAction(tree, h1, "2026-06-13"); // window 1
      t = completeAction(t, h1, "2026-06-06");        // window 2
      expect(habitStreak(t, h1, TODAY)).toBe(2);
    });
  });
});
