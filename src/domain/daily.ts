import type { ActivityDay, Goal, GoalAction, LifeTree } from "./types";
import { goalProgress } from "./goals";

// ───────────────────────────────────────────────────────────────────────────
// daily —— 每日激励闭环纯函数：今日计划 / 重复行动 / 连续天数 / 热力图 / 分支位置。
// 一律操作本地日 "YYYY-MM-DD"，日差用 UTC 解析避免时区漂移。
// 不用 Date.now/Math.random：today 由 state 层注入。
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

export function findAction(
  tree: LifeTree,
  actionId: string,
): { goal: Goal; action: GoalAction } | null {
  for (const goal of tree.goals ?? []) {
    const action = goal.actions.find((a) => a.id === actionId);
    if (action) return { goal, action };
  }
  return null;
}

function setActionDone(tree: LifeTree, actionId: string, done: boolean): LifeTree {
  return {
    ...tree,
    goals: (tree.goals ?? []).map((g) =>
      g.actions.some((a) => a.id === actionId)
        ? { ...g, actions: g.actions.map((a) => (a.id === actionId ? { ...a, done } : a)) }
        : g,
    ),
  };
}

export function planToday(tree: LifeTree, actionId: string, today: string): LifeTree {
  const e = dayEntry(tree, today);
  return putDay(tree, { ...e, plannedActionIds: addUniq(e.plannedActionIds, actionId) });
}

export function unplanToday(tree: LifeTree, actionId: string, today: string): LifeTree {
  const e = dayEntry(tree, today);
  return putDay(tree, { ...e, plannedActionIds: e.plannedActionIds.filter((x) => x !== actionId) });
}

// 完成：记进当天 completed。重复行动不写永久 done（次日/下周重新可做）；
// 一次性行动顺带写 done 并补进 planned（"勾了就算今天计划过"）。
export function completeAction(tree: LifeTree, actionId: string, today: string): LifeTree {
  const hit = findAction(tree, actionId);
  if (!hit) return tree;
  const recurring = Boolean(hit.action.repeat);
  const t = recurring ? tree : setActionDone(tree, actionId, true);
  const e = dayEntry(t, today);
  return putDay(t, {
    ...e,
    plannedActionIds: recurring ? e.plannedActionIds : addUniq(e.plannedActionIds, actionId),
    completedActionIds: addUniq(e.completedActionIds, actionId),
  });
}

// 取消完成：从当天 completed 移除；一次性行动同时 done=false。
export function uncompleteAction(tree: LifeTree, actionId: string, today: string): LifeTree {
  const hit = findAction(tree, actionId);
  const recurring = Boolean(hit?.action.repeat);
  const t = recurring ? tree : setActionDone(tree, actionId, false);
  const e = dayEntry(t, today);
  return putDay(t, { ...e, completedActionIds: e.completedActionIds.filter((x) => x !== actionId) });
}

// 某行动今天是否算"已完成"：一次性=done；daily=今天记过；weekly=最近 7 天内记过。
export function isActionDoneToday(tree: LifeTree, action: GoalAction, today: string): boolean {
  if (!action.repeat) return action.done;
  if (action.repeat === "daily") return dayEntry(tree, today).completedActionIds.includes(action.id);
  for (let i = 0; i < 7; i++) {
    if (dayEntry(tree, addDays(today, -i)).completedActionIds.includes(action.id)) return true;
  }
  return false;
}

// 今天该出现的重复行动：daily 永远在；weekly 仅在"本周未完成"时出现（完成后隐藏一周）。
export function recurringDueToday(
  tree: LifeTree,
  today: string,
): { goal: Goal; action: GoalAction }[] {
  const out: { goal: Goal; action: GoalAction }[] = [];
  for (const goal of tree.goals ?? []) {
    if (goal.status !== "active") continue;
    for (const action of goal.actions) {
      if (!action.repeat) continue;
      if (action.repeat === "weekly" && isActionDoneToday(tree, action, today)) continue;
      out.push({ goal, action });
    }
  }
  return out;
}

// 今日清单：手动挑的一次性行动 ∪ 今天该做的重复行动；每条带 doneToday。
export function todayItems(
  tree: LifeTree,
  today: string,
): { goal: Goal; action: GoalAction; doneToday: boolean }[] {
  const e = dayEntry(tree, today);
  const seen = new Set<string>();
  const out: { goal: Goal; action: GoalAction; doneToday: boolean }[] = [];
  for (const id of [...e.plannedActionIds, ...e.completedActionIds]) {
    if (seen.has(id)) continue;
    const hit = findAction(tree, id);
    if (!hit || hit.action.repeat) continue;
    seen.add(id);
    out.push({ goal: hit.goal, action: hit.action, doneToday: isActionDoneToday(tree, hit.action, today) });
  }
  for (const { goal, action } of recurringDueToday(tree, today)) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    out.push({ goal, action, doneToday: isActionDoneToday(tree, action, today) });
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

// "你在这里"：长期目标分支上按进度落在 forkAge→endAge 之间的年龄；短期/无分支返回 null。
export function branchPositionAge(tree: LifeTree, goal: Goal): number | null {
  if (goal.horizon !== "long" || !goal.pathId) return null;
  const path = tree.paths.find((p) => p.id === goal.pathId);
  if (!path) return null;
  const endAge = path.nodes.length
    ? path.nodes[path.nodes.length - 1].age
    : path.forkAge + tree.horizonYears;
  return path.forkAge + goalProgress(tree, goal) * (endAge - path.forkAge);
}
