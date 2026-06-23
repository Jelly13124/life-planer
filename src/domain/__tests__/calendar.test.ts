import { describe, it, expect } from "vitest";
import {
  weekdayOf, monthGrid, actionsOnDay, unscheduledActions, setActionScheduledDate,
} from "@/domain/calendar";
import { createTree } from "@/domain/tree";
import {
  addLongGoal, addShortGoal, addHabit, addTask, addLooseHabit, addLooseTask,
} from "@/domain/goalTree";
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

// 一棵带一个目标 + 三个一次性 Task 的树。
function withTasks(): { tree: LifeTree; goalId: string; a: string[] } {
  let t = createTree(profile, gen, NOW);
  const g = addLongGoal(t, { area: "growth", title: "找工作" }, NOW);
  t = g.tree;
  const a: string[] = [];
  for (const text of ["改简历", "投简历", "背单词"]) {
    const r = addTask(t, g.id, text, `${NOW}-${text}`);
    t = r.tree;
    a.push(r.id);
  }
  return { tree: t, goalId: g.id, a };
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

  it("actionsOnDay: scheduled task only on its date", () => {
    const w = withTasks();
    const tree = setActionScheduledDate(w.tree, w.a[0], "2026-06-22");
    expect(actionsOnDay(tree, "2026-06-22").map((x) => x.item.id)).toContain(w.a[0]);
    expect(actionsOnDay(tree, "2026-06-23").map((x) => x.item.id)).not.toContain(w.a[0]);
    expect(actionsOnDay(tree, "2026-06-22").find((x) => x.item.id === w.a[0])!.kind).toBe("scheduled");
  });

  it("actionsOnDay: daily every day; weekly only on its anchor weekday", () => {
    const w = withTasks();
    // daily habit + weekly habit anchored to Monday (1)
    const d = addHabit(w.tree, w.goalId, "每天背单词", "daily", undefined, `${NOW}-d`);
    const wk = addHabit(d.tree, w.goalId, "每周复盘", "weekly", 1, `${NOW}-w`);
    const tree = wk.tree;
    expect(actionsOnDay(tree, "2026-06-22").map((x) => x.item.id)).toEqual(
      expect.arrayContaining([d.id, wk.id]),
    ); // Monday
    const tue = actionsOnDay(tree, "2026-06-23").map((x) => x.item.id);
    expect(tue).toContain(d.id);      // daily still
    expect(tue).not.toContain(wk.id); // weekly anchored to Monday
  });

  it("actionsOnDay: a habit disappears after its owning goal's endDate (habit window)", () => {
    // 短期目标时间窗 ..2026-06-30；其下一个 daily 习惯只在窗内出现。
    let t = createTree(profile, gen, NOW);
    const long = addLongGoal(t, { area: "health", title: "健康" }, NOW);
    t = long.tree;
    const short = addShortGoal(
      t, long.id, { area: "health", title: "本月计划", startDate: "2026-06-01", endDate: "2026-06-30" }, NOW,
    );
    t = short.tree;
    const h = addHabit(t, short.id, "每天快走", "daily", undefined, `${NOW}-cw`);
    t = h.tree;
    // 结束日当天仍在
    expect(actionsOnDay(t, "2026-06-30").map((x) => x.item.id)).toContain(h.id);
    // 结束日之后不再出现
    expect(actionsOnDay(t, "2026-07-01").map((x) => x.item.id)).not.toContain(h.id);
    // 起始日之前不出现
    expect(actionsOnDay(t, "2026-05-31").map((x) => x.item.id)).not.toContain(h.id);
  });

  it("actionsOnDay: a scheduled task is NOT affected by goal window (only habits are)", () => {
    // 一次性任务有自己的 scheduledDate，不受所属目标时间窗影响。
    let t = createTree(profile, gen, NOW);
    const long = addLongGoal(t, { area: "health", title: "健康" }, NOW);
    t = long.tree;
    const short = addShortGoal(
      t, long.id, { area: "health", title: "本月计划", endDate: "2026-06-30" }, NOW,
    );
    t = short.tree;
    const task = addTask(t, short.id, "月底复盘", `${NOW}-late`);
    t = task.tree;
    // 排到 endDate 之后的某天，仍然出现（任务不看习惯窗口）。
    t = setActionScheduledDate(t, task.id, "2026-07-05");
    expect(actionsOnDay(t, "2026-07-05").map((x) => x.item.id)).toContain(task.id);
  });

  it("actionsOnDay: done flag reflects completion on that day", () => {
    const w = withTasks();
    let tree = setActionScheduledDate(w.tree, w.a[0], "2026-06-22");
    tree = completeAction(tree, w.a[0], "2026-06-22");
    expect(actionsOnDay(tree, "2026-06-22").find((x) => x.item.id === w.a[0])!.done).toBe(true);
  });

  it("unscheduledActions: active task, not done, no scheduledDate", () => {
    const w = withTasks();
    let tree = setActionScheduledDate(w.tree, w.a[0], "2026-06-22"); // scheduled → excluded
    tree = completeAction(tree, w.a[1], "2026-06-22");               // done → excluded
    expect(unscheduledActions(tree).map((x) => x.item.id)).toEqual([w.a[2]]);
  });

  it("setActionScheduledDate sets and clears", () => {
    const w = withTasks();
    let tree = setActionScheduledDate(w.tree, w.a[0], "2026-06-22");
    expect(actionsOnDay(tree, "2026-06-22").length).toBe(1);
    tree = setActionScheduledDate(tree, w.a[0], null);
    expect(unscheduledActions(tree).map((x) => x.item.id)).toContain(w.a[0]);
  });

  it("actionsOnDay: a loose daily habit (no goal, no window) is due every day forever", () => {
    let t = createTree(profile, gen, NOW);
    const h = addLooseHabit(t, "上班", "daily", undefined, `${NOW}-loose`);
    t = h.tree;
    // 任意日期都到期（无目标 → 无时间窗），且 goal 为 null。
    const day1 = actionsOnDay(t, "2026-06-22");
    const day2 = actionsOnDay(t, "2030-01-01");
    expect(day1.find((x) => x.item.id === h.id)?.kind).toBe("daily");
    expect(day1.find((x) => x.item.id === h.id)?.goal).toBeNull();
    expect(day2.map((x) => x.item.id)).toContain(h.id);
  });

  it("actionsOnDay: a loose task shows only on its scheduledDate (goal null)", () => {
    let t = createTree(profile, gen, NOW);
    const task = addLooseTask(t, "临时买菜", `${NOW}-buy`);
    t = setActionScheduledDate(task.tree, task.id, "2026-06-22");
    expect(actionsOnDay(t, "2026-06-22").find((x) => x.item.id === task.id)?.goal).toBeNull();
    expect(actionsOnDay(t, "2026-06-23").map((x) => x.item.id)).not.toContain(task.id);
  });

  it("unscheduledActions: a loose unscheduled task appears (goal null)", () => {
    let t = createTree(profile, gen, NOW);
    const task = addLooseTask(t, "临时买菜", `${NOW}-buy`);
    t = task.tree;
    const u = unscheduledActions(t).find((x) => x.item.id === task.id);
    expect(u).toBeTruthy();
    expect(u!.goal).toBeNull();
  });
});
