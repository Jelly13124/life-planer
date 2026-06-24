import type { Goal, Habit, LifeTree } from "./types";
import { addDays, dayEntry } from "./daily";
import { allHabits } from "./goalTree";

// ───────────────────────────────────────────────────────────────────────────
// habits —— "习惯"（重复 Habit）的领域逻辑。结构由 goalTree 适配器铺平读取。
// 纯函数；today 由外部注入，不调 Date.now/Math.random。
// ───────────────────────────────────────────────────────────────────────────

// 所有"习惯"（active 目标里的重复 Habit，任意层）+ 散习惯/日常（goal=null，无 active 概念，恒计入）。
export function recurringActions(tree: LifeTree): { goal: Goal | null; habit: Habit }[] {
  const out: { goal: Goal | null; habit: Habit }[] = [];
  for (const { goal, habit } of allHabits(tree)) {
    if (goal && goal.status !== "active") continue;
    out.push({ goal, habit });
  }
  return out;
}

// 习惯连续数（按 habitId + 每日活动记录）：
// daily = 连续完成的天数（从 today 往前；宽限：今天没完成则从昨天起算）；
// weekly = 连续"有完成"的 7 天窗口数（窗口 [today-6..today], [today-13..today-7] …）。
export function habitStreak(tree: LifeTree, habitId: string, today: string): number {
  const doneOn = (day: string): boolean =>
    dayEntry(tree, day).completedActionIds.includes(habitId);

  // 找到该习惯以判定 daily/weekly；找不到则视为 daily。
  const habit = allHabits(tree).find((h) => h.habit.id === habitId)?.habit;
  const repeat = habit?.repeat ?? "daily";

  if (repeat === "daily") {
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
