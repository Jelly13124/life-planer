import type { Decision, Goal, LifeTree } from "./types";
import { addDays, heatmap, currentStreak } from "./daily";
import { dueDecisions } from "./decisions";
import { dueGoalReviews } from "./goals";

// ─────────────────────────────────────────────────────────────────────────────
// weekly —— 本周回顾纯聚合：完成数 / 活跃天数 / 连续天数 / 到期回看列表 / 本周里程碑。
// 纯函数；today 由外部注入，不调 Date.now/Math.random。
// ─────────────────────────────────────────────────────────────────────────────

export interface WeeklyRecap {
  weekStart: string;        // today-6 (YYYY-MM-DD)
  weekEnd: string;          // today
  completions: number;      // total completed actions over the last 7 days
  activeDays: number;       // days in the window with ≥1 completion
  streak: number;
  dueDecisions: Decision[];
  dueGoals: Goal[];
  milestonesThisWeek: Goal[]; // long goals with status "done" and completedAt within the last 7 days
}

export function weeklyRecap(tree: LifeTree, today: string): WeeklyRecap {
  const weekStart = addDays(today, -6);
  const weekEnd = today;

  // heatmap returns 7 entries (indices 0..6) oldest→newest
  const hm = heatmap(tree, 7, today);
  const completions = hm.reduce((sum, d) => sum + d.count, 0);
  const activeDays = hm.filter((d) => d.count > 0).length;
  const streak = currentStreak(tree, today);

  const milestonesThisWeek = (tree.goals ?? []).filter(
    (g) =>
      g.horizon === "long" &&
      g.status === "done" &&
      g.completedAt != null &&
      // completedAt is an ISO timestamp; compare by date string (YYYY-MM-DD prefix)
      g.completedAt.slice(0, 10) >= weekStart &&
      g.completedAt.slice(0, 10) <= weekEnd,
  );

  return {
    weekStart,
    weekEnd,
    completions,
    activeDays,
    streak,
    dueDecisions: dueDecisions(tree, today),
    dueGoals: dueGoalReviews(tree, today),
    milestonesThisWeek,
  };
}
