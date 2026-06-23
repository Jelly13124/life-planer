import type { Goal, LifeTree } from "./types";
import { shortGoalsOf } from "./goalTree";

// ───────────────────────────────────────────────────────────────────────────
// goals —— 两级目标（长期 ⊃ 短期）的领域逻辑（进度/达成/复盘/标签）。
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

// 一个目标自身直挂里程碑（Task + Metric）的 {完成数, 总数}。习惯不计入。
function ownUnits(goal: Goal): { done: number; total: number } {
  const tasks = goal.tasks ?? [];
  const metrics = goal.metrics ?? [];
  const done = tasks.filter((t) => t.done).length + metrics.filter(metricAchieved).length;
  return { done, total: tasks.length + metrics.length };
}

// 一个短期目标是否"完成"（供长期目标 roll-up）：自身进度 ≥ 1，或已标记 status==="done"。
function shortComplete(tree: LifeTree, short: Goal): boolean {
  if (short.status === "done") return true;
  return goalProgress(tree, short) >= 1;
}

// 综合进度 0–1：把 Task / Metric / 短期子目标当作等权的"里程碑单元"。习惯（Habit）不计入。
//   short：(自身已完成 Task + 已达成 Metric) / (自身 Task 数 + Metric 数)；无可衡量单元 → 0。
//   long ：综合自身直挂里程碑 + 旗下短期子目标 ——
//     分子 = 自身已完成 Task + 已达成 Metric + 已"完成"的短期子目标数；
//     分母 = 自身 Task 数 + Metric 数 + 计入的短期子目标数。
//     一个短期子目标"完成"= 其 goalProgress ≥ 1 或 status==="done"。
//     空短期子目标（无 Task 且无 Metric）既不进分子也不进分母（与旧版"空子目标不计"一致），
//     否则加一个空短期目标会无声地把进度压在 100% 以下。
//   分母为 0 → 进度 0。
export function goalProgress(tree: LifeTree, goal: Goal): number {
  if (goal.kind === "short") {
    const { done, total } = ownUnits(goal);
    return total === 0 ? 0 : done / total;
  }

  // long：自身单元 + 各非空短期子目标。
  const own = ownUnits(goal);
  // 短期子目标须有可衡量单元（Task 或 Metric）才计入分母（空的完全忽略）。
  const shorts = shortGoalsOf(tree, goal.id).filter((s) => ownUnits(s).total > 0);

  const total = own.total + shorts.length;
  if (total === 0) return 0;

  const completedShorts = shorts.filter((s) => shortComplete(tree, s)).length;
  return (own.done + completedShorts) / total;
}

// 达成目标：标 done + 时间戳；仅 **长期目标** 完成时给它的人生面加分（影响之后的预测）——
// 长期目标才是改变方向/身份、上树的那一层；短期目标完成只推动其长期父目标的进度，不直接 bump。
// 「其他」(other) 是中性桶，不参与 Profile.areas / 预测，即便长期也只标 done，不给任何领域加分。
export function completeGoal(tree: LifeTree, goalId: string, now: string): LifeTree {
  const goal = goalById(tree, goalId);
  if (!goal || goal.status === "done") return tree;
  const updated = goals(tree).map((g) =>
    g.id === goalId ? { ...g, status: "done" as const, completedAt: now } : g,
  );
  // 仅长期、且非 other 的目标 bump 领域分；其余（短期 / other）只标 done。
  if (goal.kind !== "long" || goal.area === "other") {
    return { ...tree, goals: updated, updatedAt: now };
  }
  const cur = tree.profile.areas[goal.area] ?? 50;
  const profile = {
    ...tree.profile,
    areas: { ...tree.profile.areas, [goal.area]: clamp100(cur + AREA_BUMP) },
  };
  return { ...tree, goals: updated, profile, updatedAt: now };
}

// 某长期目标旗下的短期子目标（薄封装 goalTree.shortGoalsOf，便于消费方按语义引用）。
export function childGoals(tree: LifeTree, longGoalId: string): Goal[] {
  return shortGoalsOf(tree, longGoalId);
}

// 已达成的目标对应的分支 id 集合（供人生树高亮里程碑）。
export function achievedPathIds(tree: LifeTree): Set<string> {
  const ids = goals(tree)
    .filter((g) => g.status === "done" && g.pathId)
    .map((g) => g.pathId as string);
  return new Set(ids);
}

// 该回看的目标：**长期** 且 active 且距「上次复盘；从未复盘则距创建」≥ 7 天。
// 只催长期目标 —— 短期目标自带时间盒、节奏快，逐个催复盘只会变成噪音。
// 以创建时间为基线 —— 刚建的目标不会立刻就"该回看"。today 注入，便于测试。
export function dueGoalReviews(tree: LifeTree, today: string): Goal[] {
  const t = new Date(today).getTime();
  return goals(tree).filter((g) => {
    if (g.kind !== "long") return false;
    if (g.status !== "active") return false;
    const baseline = g.lastReviewedAt ?? g.createdAt;
    return t - new Date(baseline).getTime() >= REVIEW_INTERVAL_MS;
  });
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
