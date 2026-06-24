import type { Goal, LifeTree } from "./types";
import { allTags } from "./goals";

// ───────────────────────────────────────────────────────────────────────────
// sidebar —— 侧边栏「收藏」「标签」组的纯函数。
// 日期一律本地日 "YYYY-MM-DD"，日差用 UTC 解析避免时区漂移（与 daily.ts/calendar.ts 一致）。
// 不用 Date.now/Math.random：today 由 state 层注入。
// ───────────────────────────────────────────────────────────────────────────

function goals(tree: LifeTree): Goal[] {
  return tree.goals ?? [];
}

// 把本地日 "YYYY-MM-DD" 解析成 UTC 天序号（与 daily/calendar 同一约定）。
function dayNum(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

// 把 ISO 时间戳（createdAt）截成本地日 "YYYY-MM-DD" 的天序号。
// createdAt 形如 "2026-06-18T00:00:00.000Z"，取其前 10 位即日期部分。
function isoDayNum(iso: string): number {
  return dayNum(iso.slice(0, 10));
}

// 收藏的目标：favorite === true；active（status !== "done"）排在前，再按 createdAt 升序。
export function favoriteGoals(tree: LifeTree): Goal[] {
  return goals(tree)
    .filter((g) => g.favorite === true)
    .slice()
    .sort((a, b) => {
      const aActive = a.status !== "done";
      const bActive = b.status !== "done";
      if (aActive !== bActive) return aActive ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
}

export type FavoriteTimeLabel = {
  kind: "due" | "overdue" | "created";
  days: number;
};

// 收藏项右侧小字所需的时间标：
//   有 endDate → 距截止天数 = endDate - today；>=0 → due（剩 days 天），<0 → overdue（已过期 |days| 天）。
//   无 endDate → created（建于 today - createdAt-date 天前）。
// today 为注入的本地日 "YYYY-MM-DD"。
export function favoriteTimeLabel(goal: Goal, today: string): FavoriteTimeLabel {
  if (goal.endDate) {
    const days = dayNum(goal.endDate) - dayNum(today);
    if (days < 0) return { kind: "overdue", days: Math.abs(days) };
    return { kind: "due", days };
  }
  const days = dayNum(today) - isoDayNum(goal.createdAt);
  return { kind: "created", days };
}

// 侧边栏「标签」组：树里所有目标的标签去重并排序（复用 goals.ts allTags）。
export function sidebarTags(tree: LifeTree): string[] {
  return allTags(tree);
}
