import { describe, it, expect } from "vitest";
import {
  localDay, addDays, dayEntry, planToday, unplanToday,
  completeAction, uncompleteAction, isActionDoneToday, recurringDueToday,
  todayItems, currentStreak, heatmap, branchPositionAge,
} from "@/domain/daily";
import { createTree, addPath } from "@/domain/tree";
import { createGoal, upsertGoal, setGoalActions, setActionRepeat, linkGoalPath } from "@/domain/goals";
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

function withShortGoal(): { tree: LifeTree; goalId: string; a0: string; a1: string } {
  let t = createTree(profile, gen, NOW);
  let g = createGoal({ area: "growth", horizon: "short", title: "学英语", why: "" }, NOW);
  g = setGoalActions(g, ["写完简历", "看一集美剧"]);
  t = upsertGoal(t, g);
  return { tree: t, goalId: g.id, a0: g.actions[0].id, a1: g.actions[1].id };
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
    const { tree, a0 } = withShortGoal();
    let t = planToday(tree, a0, T);
    t = planToday(t, a0, T);
    expect(dayEntry(t, T).plannedActionIds).toEqual([a0]);
    t = unplanToday(t, a0, T);
    expect(dayEntry(t, T).plannedActionIds).toEqual([]);
  });

  it("completeAction (one-shot): marks done, records day, backfills planned", () => {
    const { tree, goalId, a0 } = withShortGoal();
    const t = completeAction(tree, a0, T);
    const goal = t.goals.find((g) => g.id === goalId)!;
    expect(goal.actions.find((a) => a.id === a0)!.done).toBe(true);
    expect(dayEntry(t, T).completedActionIds).toEqual([a0]);
    expect(dayEntry(t, T).plannedActionIds).toContain(a0);
  });

  it("uncompleteAction (one-shot): reverses done and removes from day", () => {
    const { tree, goalId, a0 } = withShortGoal();
    let t = completeAction(tree, a0, T);
    t = uncompleteAction(t, a0, T);
    const goal = t.goals.find((g) => g.id === goalId)!;
    expect(goal.actions.find((a) => a.id === a0)!.done).toBe(false);
    expect(dayEntry(t, T).completedActionIds).toEqual([]);
  });

  it("completeAction (recurring): records the day but does NOT set permanent done", () => {
    const { goalId, a1 } = withShortGoal();
    let { tree } = withShortGoal();
    const g = tree.goals.find((x) => x.id === goalId)!;
    tree = upsertGoal(tree, setActionRepeat(g, a1, "daily"));
    const t = completeAction(tree, a1, T);
    const action = t.goals.find((x) => x.id === goalId)!.actions.find((a) => a.id === a1)!;
    expect(action.done).toBe(false);
    expect(dayEntry(t, T).completedActionIds).toContain(a1);
    expect(isActionDoneToday(t, action, T)).toBe(true);
    expect(isActionDoneToday(t, action, "2026-06-19")).toBe(false);
  });

  it("recurringDueToday: daily always shows; weekly hides once done this week", () => {
    const { goalId, a0, a1 } = withShortGoal();
    let { tree } = withShortGoal();
    let g = tree.goals.find((x) => x.id === goalId)!;
    g = setActionRepeat(g, a0, "daily");
    g = setActionRepeat(g, a1, "weekly");
    tree = upsertGoal(tree, g);
    expect(recurringDueToday(tree, T).map((x) => x.action.id).sort()).toEqual([a0, a1].sort());
    const t = completeAction(tree, a1, T);
    expect(recurringDueToday(t, T).map((x) => x.action.id)).toEqual([a0]);
    // weekly window boundary: completed at today-6 (still inside 7-day window) → still hidden;
    // completed at today-7 (outside window) → due again.
    const at6 = completeAction(tree, a1, addDays(T, -6));
    expect(recurringDueToday(at6, T).map((x) => x.action.id)).not.toContain(a1);
    const at7 = completeAction(tree, a1, addDays(T, -7));
    expect(recurringDueToday(at7, T).map((x) => x.action.id)).toContain(a1);
  });

  it("todayItems = manual one-shot ∪ recurring-due, each with doneToday", () => {
    const { goalId, a0, a1 } = withShortGoal();
    let { tree } = withShortGoal();
    let g = tree.goals.find((x) => x.id === goalId)!;
    g = setActionRepeat(g, a1, "daily");
    tree = upsertGoal(tree, g);
    let t = planToday(tree, a0, T);
    t = completeAction(t, a1, T);
    const items = todayItems(t, T);
    expect(items.map((i) => i.action.id).sort()).toEqual([a0, a1].sort());
    expect(items.find((i) => i.action.id === a1)!.doneToday).toBe(true);
    expect(items.find((i) => i.action.id === a0)!.doneToday).toBe(false);
  });

  it("currentStreak counts consecutive completed days, grace for today", () => {
    const { tree, a0, a1 } = withShortGoal();
    let t = completeAction(tree, a0, "2026-06-16");
    t = completeAction(t, a1, "2026-06-17");
    expect(currentStreak(t, "2026-06-18")).toBe(2);
    const t2 = completeAction(t, a0, "2026-06-18");
    expect(currentStreak(t2, "2026-06-18")).toBe(3);
    const t3 = completeAction(withShortGoal().tree, a0, "2026-06-15");
    expect(currentStreak(t3, "2026-06-18")).toBe(0);
  });

  it("heatmap returns N days ending today with counts", () => {
    const { tree, a0, a1 } = withShortGoal();
    let t = completeAction(tree, a0, "2026-06-18");
    t = completeAction(t, a1, "2026-06-18");
    const hm = heatmap(t, 3, "2026-06-18");
    expect(hm.map((d) => d.date)).toEqual(["2026-06-16", "2026-06-17", "2026-06-18"]);
    expect(hm[2].count).toBe(2);
    expect(hm[0].count).toBe(0);
  });

  it("branchPositionAge walks the branch by progress; null for short/no-path", () => {
    let t = addPath(createTree(profile, gen, NOW), "去读研", gen, NOW);
    const branch = t.paths.find((p) => p.kind === "choice")!;
    let long = createGoal({ area: "career", horizon: "long", title: "读研", why: "", pathId: branch.id }, NOW);
    long = setGoalActions(long, ["a", "b", "c", "d"]);
    t = upsertGoal(t, long);
    t = linkGoalPath(t, long.id, branch.id);
    const g0 = t.goals.find((g) => g.id === long.id)!;
    const endAge = branch.nodes.length ? branch.nodes[branch.nodes.length - 1].age : branch.forkAge + t.horizonYears;
    expect(branchPositionAge(t, g0)).toBeCloseTo(branch.forkAge, 5);
    let t2 = completeAction(t, g0.actions[0].id, T);
    t2 = completeAction(t2, g0.actions[1].id, T);
    const g1 = t2.goals.find((g) => g.id === long.id)!;
    expect(branchPositionAge(t2, g1)).toBeCloseTo(branch.forkAge + 0.5 * (endAge - branch.forkAge), 5);
    const short = createGoal({ area: "health", horizon: "short", title: "S", why: "" }, NOW);
    expect(branchPositionAge(upsertGoal(t, short), short)).toBeNull();
  });
});
