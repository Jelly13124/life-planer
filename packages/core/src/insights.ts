import type { LifeTree } from "./types";
import { addDays, currentStreak, heatmap } from "./daily";

// ───────────────────────────────────────────────────────────────────────────
// insights —— 洞察摘要纯函数。不用 Date.now/Math.random；today 由外部注入。
// ───────────────────────────────────────────────────────────────────────────

export interface InsightsSummary {
  streak: number;        // currentStreak(tree, today)
  longestStreak: number; // longest run of consecutive days with ≥1 completion
  completions: number;   // total completed actions over `days` window
  activeDays: number;    // days in window with ≥1 completion
  consistency: number;   // Math.round(activeDays / days * 100)
  windowDays: number;    // the window size used
}

export function insightsSummary(tree: LifeTree, today: string, days = 90): InsightsSummary {
  const hm = heatmap(tree, days, today);

  let completions = 0;
  let activeDays = 0;
  for (const { count } of hm) {
    completions += count;
    if (count > 0) activeDays += 1;
  }
  const consistency = Math.round((activeDays / days) * 100);

  // longestStreak: collect all dates in tree.activity with ≥1 completed action.
  // For each completed date, if (date-1) is NOT also a completed date, it starts a run;
  // walk forward with addDays(+1) counting consecutive days; track max.
  const activityDates = new Set<string>(
    (tree.activity ?? [])
      .filter((a) => a.completedActionIds.length > 0)
      .map((a) => a.date),
  );

  let longestStreak = 0;
  for (const date of activityDates) {
    const prev = addDays(date, -1);
    if (activityDates.has(prev)) continue; // not a run start
    let run = 0;
    let cursor = date;
    while (activityDates.has(cursor)) {
      run += 1;
      cursor = addDays(cursor, 1);
    }
    if (run > longestStreak) longestStreak = run;
  }

  return {
    streak: currentStreak(tree, today),
    longestStreak,
    completions,
    activeDays,
    consistency,
    windowDays: days,
  };
}
