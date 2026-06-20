import type { Goal, GoalAction, LifeTree } from "./types";
import { addDays, dayEntry } from "./daily";

// 所有"习惯"（active 目标里设了 repeat 的行动）。
export function recurringActions(tree: LifeTree): { goal: Goal; action: GoalAction }[] {
  const out: { goal: Goal; action: GoalAction }[] = [];
  for (const goal of tree.goals ?? []) {
    if (goal.status !== "active") continue;
    for (const action of goal.actions) {
      if (action.repeat) out.push({ goal, action });
    }
  }
  return out;
}

// 习惯连续数：
// daily = 连续完成的天数（从 today 往前；宽限：今天没完成则从昨天起算）；
// weekly = 连续"有完成"的 7 天窗口数（窗口 [today-6..today], [today-13..today-7] …）。
export function habitStreak(tree: LifeTree, action: GoalAction, today: string): number {
  const doneOn = (day: string): boolean =>
    dayEntry(tree, day).completedActionIds.includes(action.id);

  if (action.repeat === "daily") {
    // Grace: if today not done, start checking from yesterday.
    let cursor = doneOn(today) ? today : addDays(today, -1);
    let n = 0;
    while (doneOn(cursor)) {
      n++;
      cursor = addDays(cursor, -1);
    }
    return n;
  }

  // weekly: check 7-day windows
  // Window k covers days addDays(today, -(7*k)) .. addDays(today, -(7*k+6))
  const weekHasDone = (k: number): boolean => {
    for (let d = 0; d < 7; d++) {
      if (doneOn(addDays(today, -(7 * k + d)))) return true;
    }
    return false;
  };

  // Grace: if window 0 has no completion but window 1 does, start counting at k=1.
  let startK = 0;
  if (!weekHasDone(0) && weekHasDone(1)) {
    startK = 1;
  }

  let n = 0;
  let k = startK;
  while (weekHasDone(k)) {
    n++;
    k++;
  }
  return n;
}
