import { describe, it, expect } from "vitest";
import { dueReminders } from "@/domain/reminders";
import { createTree } from "@/domain/tree";
import {
  addLongGoal, addTask, addHabit, addLooseTask, updateTask,
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
const NOW_SEED = "2026-06-23T00:00:00.000Z";
// 注入的「现在」：用无时区后缀的本地时间串，getHours/localDay 都按本地解析 → 跨时区稳定。
const NOW_AM = "2026-06-23T09:30"; // 本地 09:30
const TODAY = "2026-06-23";

// 一棵带一个长期目标 + 若干任务的树。
function base(): { tree: LifeTree; goalId: string } {
  const t = createTree(profile, gen, NOW_SEED);
  const g = addLongGoal(t, { area: "growth", title: "找工作" }, NOW_SEED);
  return { tree: g.tree, goalId: g.id };
}

describe("dueReminders", () => {
  it("classifies a task scheduled today into `today`", () => {
    const b = base();
    const r = addTask(b.tree, b.goalId, "改简历", `${NOW_SEED}-改简历`);
    const tree = updateTask(r.tree, r.id, { scheduledDate: TODAY, startTime: "14:00" });
    const due = dueReminders(tree, NOW_AM);
    const ids = due.today.map((x) => x.id);
    expect(ids).toContain(r.id);
    const item = due.today.find((x) => x.id === r.id)!;
    expect(item.date).toBe(TODAY);
    expect(item.startTime).toBe("14:00");
    expect(item.goalTitle).toBe("找工作");
    // not overdue (it's today, not past)
    expect(due.overdue.map((x) => x.id)).not.toContain(r.id);
  });

  it("classifies an unfinished past-dated task as `overdue` (not today)", () => {
    const b = base();
    const r = addTask(b.tree, b.goalId, "投简历", `${NOW_SEED}-投简历`);
    const tree = updateTask(r.tree, r.id, { scheduledDate: "2026-06-20" }); // before today
    const due = dueReminders(tree, NOW_AM);
    expect(due.overdue.map((x) => x.id)).toContain(r.id);
    expect(due.today.map((x) => x.id)).not.toContain(r.id);
    expect(due.overdue.find((x) => x.id === r.id)!.date).toBe("2026-06-20");
  });

  it("a completed past-dated task is NOT overdue", () => {
    const b = base();
    const r = addTask(b.tree, b.goalId, "已完成的", `${NOW_SEED}-done`);
    const tree = updateTask(r.tree, r.id, { scheduledDate: "2026-06-20", done: true });
    const due = dueReminders(tree, NOW_AM);
    expect(due.overdue.map((x) => x.id)).not.toContain(r.id);
  });

  it("loose (goal-less) past-dated task is overdue with goalTitle null", () => {
    let t = createTree(profile, gen, NOW_SEED);
    const r = addLooseTask(t, "临时买菜", `${NOW_SEED}-buy`);
    t = updateTask(r.tree, r.id, { scheduledDate: "2026-06-21" });
    const due = dueReminders(t, NOW_AM);
    const item = due.overdue.find((x) => x.id === r.id);
    expect(item).toBeTruthy();
    expect(item!.goalTitle).toBeNull();
  });

  it("upcomingSoon: timed today item within next 60 min; excludes far-future and already-past", () => {
    const b = base();
    let tree = b.tree;
    const soon = addTask(tree, b.goalId, "马上开会", `${NOW_SEED}-soon`);
    tree = updateTask(soon.tree, soon.id, { scheduledDate: TODAY, startTime: "10:00" }); // now=09:30 → +30min, in window
    const later = addTask(tree, b.goalId, "晚点的事", `${NOW_SEED}-later`);
    tree = updateTask(later.tree, later.id, { scheduledDate: TODAY, startTime: "18:00" }); // far future today
    const past = addTask(tree, b.goalId, "已经过点", `${NOW_SEED}-past`);
    tree = updateTask(past.tree, past.id, { scheduledDate: TODAY, startTime: "08:00" }); // earlier than now

    const due = dueReminders(tree, NOW_AM);
    const soonIds = due.upcomingSoon.map((x) => x.id);
    expect(soonIds).toContain(soon.id);
    expect(soonIds).not.toContain(later.id);
    expect(soonIds).not.toContain(past.id);
    // all three are still part of today
    const todayIds = due.today.map((x) => x.id);
    expect(todayIds).toEqual(expect.arrayContaining([soon.id, later.id, past.id]));
  });

  it("daily habit shows up in `today`", () => {
    const b = base();
    const h = addHabit(b.tree, b.goalId, "喝水", "daily", undefined, `${NOW_SEED}-water`);
    const due = dueReminders(h.tree, NOW_AM);
    expect(due.today.map((x) => x.id)).toContain(h.id);
  });

  it("empty tree → all buckets empty", () => {
    const t = createTree(profile, gen, NOW_SEED);
    const due = dueReminders(t, NOW_AM);
    expect(due.today).toEqual([]);
    expect(due.overdue).toEqual([]);
    expect(due.upcomingSoon).toEqual([]);
  });

  it("is pure: no Date.now — identical now yields identical result", () => {
    const b = base();
    const r = addTask(b.tree, b.goalId, "稳定", `${NOW_SEED}-stable`);
    const tree = updateTask(r.tree, r.id, { scheduledDate: TODAY, startTime: "10:00" });
    expect(dueReminders(tree, NOW_AM)).toEqual(dueReminders(tree, NOW_AM));
  });
});
