import { describe, it, expect } from "vitest";
import {
  weekdayOf, monthGrid, actionsOnDay, unscheduledActions, setActionScheduledDate,
} from "@/domain/calendar";
import { createTree } from "@/domain/tree";
import { createGoal, upsertGoal, setGoalActions } from "@/domain/goals";
import { completeAction } from "@/domain/daily";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { LifeTree, Profile } from "@/domain/types";

const profile: Profile = {
  name: "小林", age: 30, education: "bachelor", major: "视觉传达", occupation: "设计师",
  salary: "5to10", hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "dating",
  location: "杭州", status: "工作5年", snapshot: "设计师", crossroad: "",
  areas: { career: 50, wealth: 45, relationships: 55, health: 60, growth: 50 },
};
const gen = new LocalPathGenerator();
const NOW = "2026-06-19T00:00:00.000Z";

// 一棵带一个短期目标(三条行动)的树
function withActions(): { tree: LifeTree; goalId: string; a: string[] } {
  let t = createTree(profile, gen, NOW);
  let g = createGoal({ area: "growth", horizon: "short", title: "找工作", why: "" }, NOW);
  g = setGoalActions(g, ["改简历", "投简历", "背单词"]);
  t = upsertGoal(t, g);
  return { tree: t, goalId: g.id, a: g.actions.map((x) => x.id) };
}

function setAction(tree: LifeTree, goalId: string, actionId: string, patch: Record<string, unknown>): LifeTree {
  return {
    ...tree,
    goals: tree.goals.map((g) =>
      g.id === goalId ? { ...g, actions: g.actions.map((x) => (x.id === actionId ? { ...x, ...patch } : x)) } : g,
    ),
  };
}

describe("calendar domain", () => {
  it("weekdayOf returns 0..6 (0=Sun) UTC-stable", () => {
    expect(weekdayOf("2026-06-21")).toBe(0); // Sunday
    expect(weekdayOf("2026-06-22")).toBe(1); // Monday
    expect(weekdayOf("2026-06-19")).toBe(5); // Friday
  });

  it("monthGrid covers the month, Monday-start, whole weeks", () => {
    const grid = monthGrid(2026, 6); // June 2026 (month is 1-based)
    expect(grid.length % 7).toBe(0);
    // first cell is a Monday
    expect(weekdayOf(grid[0].date)).toBe(1);
    // June 1 2026 is a Monday → first cell is exactly 2026-06-01, inMonth true
    expect(grid[0].date).toBe("2026-06-01");
    expect(grid.find((c) => c.date === "2026-06-30")?.inMonth).toBe(true);
    expect(grid.find((c) => c.date === "2026-07-01")?.inMonth).toBe(false);
  });

  it("actionsOnDay: scheduled one-shot only on its date", () => {
    const { a } = withActions();
    let { tree } = withActions();
    tree = setActionScheduledDate(tree, a[0], "2026-06-22");
    expect(actionsOnDay(tree, "2026-06-22").map((x) => x.action.id)).toContain(a[0]);
    expect(actionsOnDay(tree, "2026-06-23").map((x) => x.action.id)).not.toContain(a[0]);
    expect(actionsOnDay(tree, "2026-06-22").find((x) => x.action.id === a[0])!.kind).toBe("scheduled");
  });

  it("actionsOnDay: daily every day; weekly only on its anchor weekday", () => {
    const { goalId, a } = withActions();
    let { tree } = withActions();
    tree = setAction(tree, goalId, a[1], { repeat: "daily" });
    tree = setAction(tree, goalId, a[2], { repeat: "weekly", repeatWeekday: 1 }); // Monday
    expect(actionsOnDay(tree, "2026-06-22").map((x) => x.action.id)).toEqual(expect.arrayContaining([a[1], a[2]])); // Mon
    const tue = actionsOnDay(tree, "2026-06-23").map((x) => x.action.id);
    expect(tue).toContain(a[1]);      // daily still
    expect(tue).not.toContain(a[2]);  // weekly anchored to Monday
  });

  it("actionsOnDay: done flag reflects completion on that day", () => {
    const { a } = withActions();
    let { tree } = withActions();
    tree = setActionScheduledDate(tree, a[0], "2026-06-22");
    tree = completeAction(tree, a[0], "2026-06-22");
    expect(actionsOnDay(tree, "2026-06-22").find((x) => x.action.id === a[0])!.done).toBe(true);
  });

  it("unscheduledActions: active one-shot, not done, no scheduledDate", () => {
    const { goalId, a } = withActions();
    let { tree } = withActions();
    tree = setActionScheduledDate(tree, a[0], "2026-06-22"); // scheduled → excluded
    tree = setAction(tree, goalId, a[1], { repeat: "daily" }); // recurring → excluded
    expect(unscheduledActions(tree).map((x) => x.action.id)).toEqual([a[2]]);
  });

  it("setActionScheduledDate sets and clears", () => {
    const { a } = withActions();
    let { tree } = withActions();
    tree = setActionScheduledDate(tree, a[0], "2026-06-22");
    expect(actionsOnDay(tree, "2026-06-22").length).toBe(1);
    tree = setActionScheduledDate(tree, a[0], null);
    expect(unscheduledActions(tree).map((x) => x.action.id)).toContain(a[0]);
  });
});
