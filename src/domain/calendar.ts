import type { Goal, GoalAction, LifeTree } from "./types";
import { addDays, isActionDoneToday } from "./daily";

// ───────────────────────────────────────────────────────────────────────────
// calendar —— 月历排程的纯函数。日期一律 "YYYY-MM-DD"，用 UTC 解析避免时区漂移
// （与 daily.ts 一致）。不用 Date.now/Math.random：年月/日期由 state/组件注入。
// ───────────────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0");

// 0=周日 … 6=周六（UTC，稳定）。
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// 覆盖整月的网格：周一起始、前后补齐到整周。month 为 1-based。
export function monthGrid(year: number, month: number): { date: string; inMonth: boolean }[] {
  const firstStr = `${year}-${pad2(month)}-01`;
  // 周一起始：把首日往前推到本周一。getUTCDay: 0=Sun..6=Sat → 距上一个周一的天数
  const lead = (weekdayOf(firstStr) + 6) % 7;
  const start = addDays(firstStr, -lead);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  const out: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < total; i++) {
    const date = addDays(start, i);
    out.push({ date, inMonth: date.slice(0, 7) === `${year}-${pad2(month)}` });
  }
  return out;
}

export type DayActionKind = "scheduled" | "daily" | "weekly";

// 某天要在月历上显示的行动（仅 active 目标）。
export function actionsOnDay(
  tree: LifeTree,
  date: string,
): { goal: Goal; action: GoalAction; kind: DayActionKind; done: boolean }[] {
  const wd = weekdayOf(date);
  const out: { goal: Goal; action: GoalAction; kind: DayActionKind; done: boolean }[] = [];
  for (const goal of tree.goals ?? []) {
    if (goal.status !== "active") continue;
    for (const action of goal.actions) {
      let kind: DayActionKind | null = null;
      if (action.repeat === "daily") kind = "daily";
      else if (action.repeat === "weekly") kind = action.repeatWeekday === wd ? "weekly" : null;
      else if (action.scheduledDate === date) kind = "scheduled";
      if (kind) out.push({ goal, action, kind, done: isActionDoneToday(tree, action, date) });
    }
  }
  return out;
}

// 未排期托盘：active 目标里 一次性、未完成、没排期 的行动。
export function unscheduledActions(tree: LifeTree): { goal: Goal; action: GoalAction }[] {
  const out: { goal: Goal; action: GoalAction }[] = [];
  for (const goal of tree.goals ?? []) {
    if (goal.status !== "active") continue;
    for (const action of goal.actions) {
      if (!action.repeat && !action.done && !action.scheduledDate) out.push({ goal, action });
    }
  }
  return out;
}

// 设/清 某行动的 scheduledDate（null = 清）。
export function setActionScheduledDate(tree: LifeTree, actionId: string, date: string | null): LifeTree {
  return {
    ...tree,
    goals: (tree.goals ?? []).map((g) =>
      g.actions.some((a) => a.id === actionId)
        ? {
            ...g,
            actions: g.actions.map((a) =>
              a.id === actionId ? { ...a, scheduledDate: date ?? undefined } : a,
            ),
          }
        : g,
    ),
  };
}
