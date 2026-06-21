import type { ActivityDay, Goal, Habit, LifeTree, Task } from "./types";
import { goalProgress } from "./goals";
import {
  allHabits,
  findItem,
  removeItem,
  updateTask,
  type ItemKind,
} from "./goalTree";

// ───────────────────────────────────────────────────────────────────────────
// daily —— 每日激励闭环纯函数：今日计划 / 重复行动 / 连续天数 / 热力图 / 分支位置。
// 一律操作本地日 "YYYY-MM-DD"，日差用 UTC 解析避免时区漂移。
// 不用 Date.now/Math.random：today 由 state 层注入。
// 模型：嵌套目标 —— 一次性 Task（有永久 done）与重复 Habit（无永久 done），统一按 id 操作。
// ───────────────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0");

// 把 Date 切成本地日 YYYY-MM-DD（state 层用 new Date() 调它，是唯一不纯的边界）。
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dayNum(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function addDays(day: string, delta: number): string {
  const d = new Date((dayNum(day) + delta) * 86_400_000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function activity(tree: LifeTree): ActivityDay[] {
  return tree.activity ?? [];
}

export function dayEntry(tree: LifeTree, today: string): ActivityDay {
  return (
    activity(tree).find((a) => a.date === today) ?? {
      date: today,
      plannedActionIds: [],
      completedActionIds: [],
    }
  );
}

function putDay(tree: LifeTree, entry: ActivityDay): LifeTree {
  const list = activity(tree);
  const exists = list.some((a) => a.date === entry.date);
  return {
    ...tree,
    activity: exists ? list.map((a) => (a.date === entry.date ? entry : a)) : [...list, entry],
  };
}

const addUniq = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id]);

// 找一个行动（task 或 habit，任意层），返回它所属 goal + 本体 + 类型。
export function findAction(
  tree: LifeTree,
  actionId: string,
): { goal: Goal; item: Task | Habit; kind: ItemKind } | null {
  const loc = findItem(tree, actionId);
  if (!loc) return null;
  return { goal: loc.goal, item: loc.item, kind: loc.kind };
}

export function planToday(tree: LifeTree, actionId: string, today: string): LifeTree {
  const e = dayEntry(tree, today);
  return putDay(tree, { ...e, plannedActionIds: addUniq(e.plannedActionIds, actionId) });
}

export function unplanToday(tree: LifeTree, actionId: string, today: string): LifeTree {
  const e = dayEntry(tree, today);
  return putDay(tree, { ...e, plannedActionIds: e.plannedActionIds.filter((x) => x !== actionId) });
}

// 完成：记进当天 completed。重复 Habit 不写永久 done（次日/下周重新可做）；
// 一次性 Task 顺带写 done 并补进 planned（"勾了就算今天计划过"）。
export function completeAction(tree: LifeTree, actionId: string, today: string): LifeTree {
  const hit = findAction(tree, actionId);
  if (!hit) return tree;
  const isTask = hit.kind === "task";
  const t = isTask ? updateTask(tree, actionId, { done: true }) : tree;
  const e = dayEntry(t, today);
  return putDay(t, {
    ...e,
    plannedActionIds: isTask ? addUniq(e.plannedActionIds, actionId) : e.plannedActionIds,
    completedActionIds: addUniq(e.completedActionIds, actionId),
  });
}

// 彻底删除一个行动：从所属目标移除，并清掉它在每日活动里的计划/完成记录。
// goalTree.removeItem 已顺带清理 activity。
export function removeActionEverywhere(tree: LifeTree, actionId: string): LifeTree {
  return removeItem(tree, actionId);
}

// 取消完成：从当天 completed 移除；一次性 Task 同时 done=false。
export function uncompleteAction(tree: LifeTree, actionId: string, today: string): LifeTree {
  const hit = findAction(tree, actionId);
  if (!hit) return tree;
  const isTask = hit.kind === "task";
  const t = isTask ? updateTask(tree, actionId, { done: false }) : tree;
  const e = dayEntry(t, today);
  return putDay(t, { ...e, completedActionIds: e.completedActionIds.filter((x) => x !== actionId) });
}

// 某行动今天是否算"已完成"：一次性 Task = done；
// daily Habit = 今天记过；weekly Habit = 最近 7 天内记过。
export function isActionDoneToday(tree: LifeTree, item: Task | Habit, today: string): boolean {
  // Task：有 done 字段；Habit：有 repeat 字段。
  if ("done" in item) return item.done;
  if (item.repeat === "daily") return dayEntry(tree, today).completedActionIds.includes(item.id);
  for (let i = 0; i < 7; i++) {
    if (dayEntry(tree, addDays(today, -i)).completedActionIds.includes(item.id)) return true;
  }
  return false;
}

// 今天该出现的重复 Habit：daily 永远在；weekly 仅在"本周未完成"时出现（完成后隐藏一周）。
// 仅 active 目标。
export function recurringDueToday(
  tree: LifeTree,
  today: string,
): { goal: Goal; item: Habit }[] {
  const out: { goal: Goal; item: Habit }[] = [];
  for (const { goal, habit } of allHabits(tree)) {
    if (goal.status !== "active") continue;
    if (habit.repeat === "weekly" && isActionDoneToday(tree, habit, today)) continue;
    out.push({ goal, item: habit });
  }
  return out;
}

// 今日清单：手动挑的一次性 Task ∪ 今天该做的重复 Habit；每条带 kind + doneToday。
export function todayItems(
  tree: LifeTree,
  today: string,
): { goal: Goal; item: Task | Habit; kind: ItemKind; doneToday: boolean }[] {
  const e = dayEntry(tree, today);
  const seen = new Set<string>();
  const out: { goal: Goal; item: Task | Habit; kind: ItemKind; doneToday: boolean }[] = [];
  for (const id of [...e.plannedActionIds, ...e.completedActionIds]) {
    if (seen.has(id)) continue;
    const hit = findAction(tree, id);
    if (!hit || hit.kind !== "task") continue; // 只收一次性 Task；Habit 走下面的 due 逻辑
    seen.add(id);
    out.push({
      goal: hit.goal,
      item: hit.item,
      kind: "task",
      doneToday: isActionDoneToday(tree, hit.item, today),
    });
  }
  for (const { goal, item } of recurringDueToday(tree, today)) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ goal, item, kind: "habit", doneToday: isActionDoneToday(tree, item, today) });
  }
  return out;
}

function completedOn(tree: LifeTree, day: string): number {
  return dayEntry(tree, day).completedActionIds.length;
}

// 连续天数：从 today 往前数连续"完成≥1"的天；宽限——今天没完成则从昨天起算。
export function currentStreak(tree: LifeTree, today: string): number {
  let cursor = completedOn(tree, today) > 0 ? today : addDays(today, -1);
  let streak = 0;
  while (completedOn(tree, cursor) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// 最近 N 天（含今天）每天完成数，升序。
export function heatmap(
  tree: LifeTree,
  sinceDays: number,
  today: string,
): { date: string; count: number }[] {
  const out: { date: string; count: number }[] = [];
  for (let i = sinceDays - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push({ date, count: completedOn(tree, date) });
  }
  return out;
}

// "你在这里"：挂在人生树分支上的目标，按进度落在 forkAge→endAge 之间的年龄；无分支返回 null。
export function branchPositionAge(tree: LifeTree, goal: Goal): number | null {
  if (!goal.pathId) return null;
  const path = tree.paths.find((p) => p.id === goal.pathId);
  if (!path) return null;
  const endAge = path.nodes.length
    ? path.nodes[path.nodes.length - 1].age
    : path.forkAge + tree.horizonYears;
  return path.forkAge + goalProgress(tree, goal) * (endAge - path.forkAge);
}
