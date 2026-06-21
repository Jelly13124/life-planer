import type { Goal, LifeTree } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// goals —— 嵌套目标的领域逻辑（进度/达成/复盘/标签）。
// 结构由 goalTree 适配器读写；这里只保留"目标级"语义。
// 不用 Date.now/Math.random：now / today 由 state 层注入。
// ───────────────────────────────────────────────────────────────────────────

// 达成一个目标，给它所属人生面加的分（影响之后新生成的路）。
export const AREA_BUMP = 8;
const REVIEW_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

function goals(tree: LifeTree): Goal[] {
  return tree.goals ?? [];
}

export function goalById(tree: LifeTree, id: string): Goal | undefined {
  return goals(tree).find((g) => g.id === id);
}

export function upsertGoal(tree: LifeTree, goal: Goal): LifeTree {
  const list = goals(tree);
  const exists = list.some((g) => g.id === goal.id);
  return {
    ...tree,
    goals: exists ? list.map((g) => (g.id === goal.id ? goal : g)) : [...list, goal],
  };
}

export function linkGoalPath(tree: LifeTree, goalId: string, pathId: string): LifeTree {
  return { ...tree, goals: goals(tree).map((g) => (g.id === goalId ? { ...g, pathId } : g)) };
}

// 一个指标是否已达成：current ≥ target。
function metricAchieved(m: { current: number; target: number }): boolean {
  return m.current >= m.target;
}

// 一个子目标是否"完成"：它的所有 Task 都 done 且所有 Metric 都达成（空子目标视为未完成，
// 因为没有任何可衡量的进度可言）。习惯不计入。
function subgoalComplete(sub: Goal["subgoals"][number]): boolean {
  const tasks = sub.tasks ?? [];
  const metrics = sub.metrics ?? [];
  if (tasks.length === 0 && metrics.length === 0) return false;
  return tasks.every((t) => t.done) && metrics.every(metricAchieved);
}

// 一个子目标是否"可计入进度"：至少有一个 Task 或 Metric（空子目标无可衡量进度，不计）。
function subgoalCounts(sub: Goal["subgoals"][number]): boolean {
  return (sub.tasks?.length ?? 0) > 0 || (sub.metrics?.length ?? 0) > 0;
}

// 综合进度 0–1：把目标级 Task / Metric / 非空子目标当作等权的"里程碑单元"。
//   progress = (已完成 Task + 已达成 Metric + 已完成子目标) / (总 Task + 总 Metric + 非空子目标数)
// 只数目标级 Task/Metric（子目标内部的 Task/Metric 折叠进"子目标是否完成"这一单元，避免重复计权）。
// 空子目标（无 Task 且无 Metric）既不进分子也不进分母，否则加一个空子目标会无声地把进度压在 100% 以下。
// 习惯（Habit）是日常纪律，不计入里程碑进度。总数为 0 时进度记 0。
export function goalProgress(_tree: LifeTree, goal: Goal): number {
  const tasks = goal.tasks ?? [];
  const metrics = goal.metrics ?? [];
  const subgoals = (goal.subgoals ?? []).filter(subgoalCounts);

  const total = tasks.length + metrics.length + subgoals.length;
  if (total === 0) return 0;

  const doneTasks = tasks.filter((t) => t.done).length;
  const achievedMetrics = metrics.filter(metricAchieved).length;
  const completedSubgoals = subgoals.filter(subgoalComplete).length;

  return (doneTasks + achievedMetrics + completedSubgoals) / total;
}

// 达成目标：标 done + 时间戳；顺带给它的人生面加分（影响之后的预测）。
export function completeGoal(tree: LifeTree, goalId: string, now: string): LifeTree {
  const goal = goalById(tree, goalId);
  if (!goal || goal.status === "done") return tree;
  const updated = goals(tree).map((g) =>
    g.id === goalId ? { ...g, status: "done" as const, completedAt: now } : g,
  );
  const cur = tree.profile.areas[goal.area] ?? 50;
  const profile = {
    ...tree.profile,
    areas: { ...tree.profile.areas, [goal.area]: clamp100(cur + AREA_BUMP) },
  };
  return { ...tree, goals: updated, profile, updatedAt: now };
}

// 已达成的目标对应的分支 id 集合（供人生树高亮里程碑）。
export function achievedPathIds(tree: LifeTree): Set<string> {
  const ids = goals(tree)
    .filter((g) => g.status === "done" && g.pathId)
    .map((g) => g.pathId as string);
  return new Set(ids);
}

// 该回看的目标：active 且（从没复盘过 或 距上次复盘 ≥ 7 天）。today 注入，便于测试。
export function dueGoalReviews(tree: LifeTree, today: string): Goal[] {
  const t = new Date(today).getTime();
  return goals(tree).filter(
    (g) =>
      g.status === "active" &&
      (!g.lastReviewedAt || t - new Date(g.lastReviewedAt).getTime() >= REVIEW_INTERVAL_MS),
  );
}

export function recordGoalReview(tree: LifeTree, goalId: string, now: string): LifeTree {
  return {
    ...tree,
    goals: goals(tree).map((g) => (g.id === goalId ? { ...g, lastReviewedAt: now } : g)),
  };
}

// 给目标加标签（trim；空字符串忽略；已存在则去重）。
export function addGoalTag(tree: LifeTree, goalId: string, tag: string): LifeTree {
  const t = tag.trim();
  if (!t) return tree;
  return {
    ...tree,
    goals: goals(tree).map((g) => {
      if (g.id !== goalId) return g;
      const cur = g.tags ?? [];
      return cur.includes(t) ? g : { ...g, tags: [...cur, t] };
    }),
  };
}

// 从目标移除某个标签。
export function removeGoalTag(tree: LifeTree, goalId: string, tag: string): LifeTree {
  return {
    ...tree,
    goals: goals(tree).map((g) =>
      g.id === goalId ? { ...g, tags: (g.tags ?? []).filter((x) => x !== tag) } : g,
    ),
  };
}

// 树里所有目标的标签去重并排序。
export function allTags(tree: LifeTree): string[] {
  const set = new Set<string>();
  for (const g of goals(tree)) for (const t of g.tags ?? []) set.add(t);
  return [...set].sort();
}

// 距截止天数：>0 还剩，=0 今天，<0 逾期。today/endDate 均 YYYY-MM-DD，按 UTC 解析。无 endDate → null。
export function daysUntilDeadline(goal: Goal, today: string): number | null {
  if (!goal.endDate) return null;
  const day = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  };
  return day(goal.endDate) - day(today);
}
