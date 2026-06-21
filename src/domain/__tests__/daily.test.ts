import { describe, it, expect } from "vitest";
import {
  localDay, addDays, dayEntry, planToday, unplanToday,
  completeAction, uncompleteAction, isActionDoneToday, recurringDueToday,
  todayItems, currentStreak, heatmap, branchPositionAge, removeActionEverywhere,
  findAction,
} from "@/domain/daily";
import { createTree, addPath } from "@/domain/tree";
import {
  addGoal, addHabit, addTask, findHabit, findTask,
} from "@/domain/goalTree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { LifeTree, Profile } from "@/domain/types";

const profile: Profile = {
  name: "小林", age: 30, education: "bachelor", major: "视觉传达", occupation: "设计师",
  salary: "5to10", hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "dating",
  location: "杭州", status: "工作5年", snapshot: "设计师", crossroad: "",
  areas: { career: 50, wealth: 45, relationships: 55, health: 60, growth: 50 },
};
const gen = new LocalPathGenerator();
const NOW = "2026-06-18T00:00:00.000Z";
const T = "2026-06-18";

// 一棵带一个目标 + 两个一次性 Task（a0,a1）的树。
function withGoal(): { tree: LifeTree; goalId: string; a0: string; a1: string } {
  let t = createTree(profile, gen, NOW);
  const g = addGoal(t, { area: "growth", title: "学英语" }, NOW);
  t = g.tree;
  const t0 = addTask(t, g.id, null, "写完简历", NOW);
  t = t0.tree;
  const t1 = addTask(t, g.id, null, "看一集美剧", `${NOW}-1`);
  t = t1.tree;
  return { tree: t, goalId: g.id, a0: t0.id, a1: t1.id };
}

// 在某目标里加一个习惯，返回新树 + 习惯 id。
function addHabitTo(
  tree: LifeTree, goalId: string, text: string, repeat: "daily" | "weekly", seed: string,
): { tree: LifeTree; id: string } {
  return addHabit(tree, goalId, null, text, repeat, undefined, seed);
}

describe("daily domain", () => {
  it("addDays steps calendar days (UTC-stable)", () => {
    expect(addDays("2026-06-18", -1)).toBe("2026-06-17");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("localDay slices a Date to YYYY-MM-DD", () => {
    expect(localDay(new Date("2026-06-18T15:30:00"))).toBe("2026-06-18");
  });

  it("planToday adds (deduped); unplanToday removes", () => {
    const { tree, a0 } = withGoal();
    let t = planToday(tree, a0, T);
    t = planToday(t, a0, T);
    expect(dayEntry(t, T).plannedActionIds).toEqual([a0]);
    t = unplanToday(t, a0, T);
    expect(dayEntry(t, T).plannedActionIds).toEqual([]);
  });

  it("completeAction (Task): marks done, records day, backfills planned", () => {
    const { tree, a0 } = withGoal();
    const t = completeAction(tree, a0, T);
    expect(findTask(t, a0)!.task.done).toBe(true);
    expect(dayEntry(t, T).completedActionIds).toEqual([a0]);
    expect(dayEntry(t, T).plannedActionIds).toContain(a0);
  });

  it("uncompleteAction (Task): reverses done and removes from day", () => {
    const { tree, a0 } = withGoal();
    let t = completeAction(tree, a0, T);
    t = uncompleteAction(t, a0, T);
    expect(findTask(t, a0)!.task.done).toBe(false);
    expect(dayEntry(t, T).completedActionIds).toEqual([]);
  });

  it("completeAction (Habit): records the day but does NOT set permanent done", () => {
    const { tree, goalId } = withGoal();
    const h = addHabitTo(tree, goalId, "每天背单词", "daily", NOW);
    const t = completeAction(h.tree, h.id, T);
    const habit = findHabit(t, h.id)!.habit;
    // habit has no permanent done; completion lives only in activity
    expect(dayEntry(t, T).completedActionIds).toContain(h.id);
    expect(isActionDoneToday(t, habit, T)).toBe(true);
    expect(isActionDoneToday(t, habit, "2026-06-19")).toBe(false);
  });

  it("recurringDueToday: daily always shows; weekly hides once done this week", () => {
    const { tree, goalId } = withGoal();
    const d = addHabitTo(tree, goalId, "每天背单词", "daily", NOW);
    const w = addHabit(d.tree, goalId, null, "每周复盘", "weekly", undefined, `${NOW}-w`);
    const base = w.tree;
    const daily = d.id;
    const weekly = w.id;
    expect(recurringDueToday(base, T).map((x) => x.item.id).sort()).toEqual([daily, weekly].sort());
    const t = completeAction(base, weekly, T);
    expect(recurringDueToday(t, T).map((x) => x.item.id)).toEqual([daily]);
    // weekly window boundary: completed at today-6 (inside 7-day window) → still hidden;
    // completed at today-7 (outside window) → due again.
    const at6 = completeAction(base, weekly, addDays(T, -6));
    expect(recurringDueToday(at6, T).map((x) => x.item.id)).not.toContain(weekly);
    const at7 = completeAction(base, weekly, addDays(T, -7));
    expect(recurringDueToday(at7, T).map((x) => x.item.id)).toContain(weekly);
  });

  it("todayItems = manual one-shot ∪ recurring-due, each with kind + doneToday", () => {
    const { tree, goalId, a0 } = withGoal();
    const d = addHabitTo(tree, goalId, "每天背单词", "daily", NOW);
    let t = planToday(d.tree, a0, T);
    t = completeAction(t, d.id, T);
    const items = todayItems(t, T);
    expect(items.map((i) => i.item.id).sort()).toEqual([a0, d.id].sort());
    expect(items.find((i) => i.item.id === d.id)!.doneToday).toBe(true);
    expect(items.find((i) => i.item.id === d.id)!.kind).toBe("habit");
    expect(items.find((i) => i.item.id === a0)!.doneToday).toBe(false);
    expect(items.find((i) => i.item.id === a0)!.kind).toBe("task");
  });

  it("findAction locates a task or habit and tags its kind", () => {
    const { tree, goalId, a0 } = withGoal();
    const h = addHabitTo(tree, goalId, "每天背单词", "daily", NOW);
    expect(findAction(h.tree, a0)!.kind).toBe("task");
    expect(findAction(h.tree, h.id)!.kind).toBe("habit");
    expect(findAction(h.tree, "missing")).toBeNull();
  });

  it("currentStreak counts consecutive completed days, grace for today", () => {
    const { tree, a0, a1 } = withGoal();
    let t = completeAction(tree, a0, "2026-06-16");
    t = completeAction(t, a1, "2026-06-17");
    expect(currentStreak(t, "2026-06-18")).toBe(2);
    const t2 = completeAction(t, a0, "2026-06-18");
    expect(currentStreak(t2, "2026-06-18")).toBe(3);
    const t3 = completeAction(withGoal().tree, a0, "2026-06-15");
    expect(currentStreak(t3, "2026-06-18")).toBe(0);
  });

  it("heatmap returns N days ending today with counts", () => {
    const { tree, a0, a1 } = withGoal();
    let t = completeAction(tree, a0, "2026-06-18");
    t = completeAction(t, a1, "2026-06-18");
    const hm = heatmap(t, 3, "2026-06-18");
    expect(hm.map((d) => d.date)).toEqual(["2026-06-16", "2026-06-17", "2026-06-18"]);
    expect(hm[2].count).toBe(2);
    expect(hm[0].count).toBe(0);
  });

  it("removeActionEverywhere drops the item from its goal and from every activity day", () => {
    const { tree, goalId, a0, a1 } = withGoal();
    // schedule + complete a0 on two different days so it lives in planned/completed arrays
    let t = planToday(tree, a0, T);
    t = completeAction(t, a0, T);
    t = completeAction(t, a0, addDays(T, -1));
    // sanity: a0 present before removal
    expect(findTask(t, a0)).not.toBeNull();
    expect(dayEntry(t, T).plannedActionIds).toContain(a0);
    expect(dayEntry(t, T).completedActionIds).toContain(a0);
    expect(dayEntry(t, addDays(T, -1)).completedActionIds).toContain(a0);

    const after = removeActionEverywhere(t, a0);
    // gone from the goal, but a1 untouched
    expect(findTask(after, a0)).toBeNull();
    const goal = after.goals.find((g) => g.id === goalId)!;
    expect(goal.tasks.map((x) => x.id)).toEqual([a1]);
    // id gone from every activity day
    for (const d of after.activity) {
      expect(d.plannedActionIds).not.toContain(a0);
      expect(d.completedActionIds).not.toContain(a0);
    }
  });

  it("branchPositionAge walks the branch by progress; null for no-path goal", () => {
    let t = addPath(createTree(profile, gen, NOW), "去读研", gen, NOW);
    const branch = t.paths.find((p) => p.kind === "choice")!;
    const g = addGoal(t, { area: "career", title: "读研", pathId: branch.id }, NOW);
    t = g.tree;
    // four goal-level tasks → four milestone units
    const ids: string[] = [];
    for (const text of ["a", "b", "c", "d"]) {
      const r = addTask(t, g.id, null, text, `${NOW}-${text}`);
      t = r.tree;
      ids.push(r.id);
    }
    const endAge = branch.nodes.length ? branch.nodes[branch.nodes.length - 1].age : branch.forkAge + t.horizonYears;
    expect(branchPositionAge(t, t.goals.find((x) => x.id === g.id)!)).toBeCloseTo(branch.forkAge, 5);
    let t2 = completeAction(t, ids[0], T);
    t2 = completeAction(t2, ids[1], T);
    const g1 = t2.goals.find((x) => x.id === g.id)!;
    expect(branchPositionAge(t2, g1)).toBeCloseTo(branch.forkAge + 0.5 * (endAge - branch.forkAge), 5);
    // a goal with no pathId → null
    const noPath = addGoal(t, { area: "health", title: "S" }, NOW);
    expect(branchPositionAge(noPath.tree, noPath.tree.goals.find((x) => x.id === noPath.id)!)).toBeNull();
  });
});
