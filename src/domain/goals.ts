import type { Goal, GoalAction, GoalInput, LifeTree } from "./types";
import { hashSeed } from "./seed";
import { removePath } from "./tree";

// 达成一个长期目标，给它所属人生面加的分（影响之后新生成的路）。
export const AREA_BUMP = 8;
const REVIEW_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

function goals(tree: LifeTree): Goal[] {
  return tree.goals ?? [];
}

// 不用 Date.now/Math.random：id 由 标题+时间戳 散列而来（确定性）。
export function createGoal(input: GoalInput, now: string): Goal {
  return {
    id: `goal-${hashSeed(`${input.title}|${now}`)}`,
    area: input.area,
    horizon: input.horizon,
    title: input.title.trim(),
    why: input.why.trim(),
    status: "active",
    createdAt: now,
    parentGoalId: input.parentGoalId ?? null,
    pathId: input.pathId ?? null,
    actions: [],
  };
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

// 注意：这是"整段替换" actions（拆解/重拆都是全量覆盖，done 状态会重置）。
// 先去空再编号，保证 id 连续（-a0、-a1…），避免过滤后留出空号。
export function setGoalActions(goal: Goal, texts: string[]): Goal {
  const actions: GoalAction[] = texts
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `${goal.id}-a${i}`, text, done: false }));
  return { ...goal, actions };
}

export function toggleGoalAction(goal: Goal, actionId: string): Goal {
  return {
    ...goal,
    actions: goal.actions.map((a) => (a.id === actionId ? { ...a, done: !a.done } : a)),
  };
}

// 设置/清除某行动的重复标记（关→每天→每周→关 由 UI 决定）。
// weekly 时可传 weekday（0=周日…6=周六）锚定星期几，不传则保留旧值或默认周一(1)。
export function setActionRepeat(
  goal: Goal,
  actionId: string,
  repeat: GoalAction["repeat"],
  weekday?: number,
): Goal {
  return {
    ...goal,
    actions: goal.actions.map((a) =>
      a.id === actionId
        ? { ...a, repeat, repeatWeekday: repeat === "weekly" ? (weekday ?? a.repeatWeekday ?? 1) : undefined }
        : a,
    ),
  };
}

// 某个长期目标下的短期子目标（按创建时间）。
export function childGoals(tree: LifeTree, longGoalId: string): Goal[] {
  return goals(tree)
    .filter((g) => g.parentGoalId === longGoalId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// 进度 0–1：只数"一次性行动(里程碑)"+子目标；重复行动是日常纪律，不计入进度。
export function goalProgress(tree: LifeTree, goal: Goal): number {
  const milestones = goal.actions.filter((a) => !a.repeat);
  if (goal.horizon === "long") {
    const kids = childGoals(tree, goal.id);
    const total = kids.length + milestones.length;
    if (total === 0) return 0;
    const done = kids.filter((k) => k.status === "done").length + milestones.filter((a) => a.done).length;
    return done / total;
  }
  if (milestones.length === 0) return 0;
  return milestones.filter((a) => a.done).length / milestones.length;
}

// 达成目标：标 done + 时间戳；长期目标顺带给它的人生面加分（影响之后的预测）。
export function completeGoal(tree: LifeTree, goalId: string, now: string): LifeTree {
  const goal = goalById(tree, goalId);
  if (!goal || goal.status === "done") return tree;
  const updated = goals(tree).map((g) =>
    g.id === goalId ? { ...g, status: "done" as const, completedAt: now } : g,
  );
  let profile = tree.profile;
  if (goal.horizon === "long") {
    const cur = profile.areas[goal.area] ?? 50;
    profile = { ...profile, areas: { ...profile.areas, [goal.area]: clamp100(cur + AREA_BUMP) } };
  }
  return { ...tree, goals: updated, profile, updatedAt: now };
}

// 移除目标：连同它的短期子目标；若是长期目标，连同它在树上的分支一起删。
export function dropGoal(tree: LifeTree, goalId: string, now: string): LifeTree {
  const goal = goalById(tree, goalId);
  if (!goal) return tree;
  // 结构是扁平的：长期目标 ⊃ 短期子目标（短期目标不再有子目标），故只级联一层。
  const removeIds = new Set<string>([goalId, ...childGoals(tree, goalId).map((g) => g.id)]);
  let next: LifeTree = {
    ...tree,
    goals: goals(tree).filter((g) => !removeIds.has(g.id)),
    updatedAt: now,
  };
  if (goal.horizon === "long" && goal.pathId) {
    next = removePath(next, goal.pathId, now); // 删分支（removePath 也会再清一遍 goals，幂等）
  }
  return next;
}

// 已达成的长期目标对应的分支 id 集合（供人生树高亮里程碑）。
export function achievedPathIds(tree: LifeTree): Set<string> {
  const ids = goals(tree)
    .filter((g) => g.status === "done" && g.horizon === "long" && g.pathId)
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

// 设置/清除目标的截止日（本地日 YYYY-MM-DD）。null → 清除（deadline 字段变为 undefined）。
export function setGoalDeadline(tree: LifeTree, goalId: string, date: string | null): LifeTree {
  return {
    ...tree,
    goals: goals(tree).map((g) => (g.id === goalId ? { ...g, deadline: date ?? undefined } : g)),
  };
}

// 距截止天数：>0 还剩，=0 今天，<0 逾期。today/deadline 均 YYYY-MM-DD，按 UTC 解析。null deadline → null。
export function daysUntilDeadline(goal: Goal, today: string): number | null {
  if (!goal.deadline) return null;
  const day = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  };
  return day(goal.deadline) - day(today);
}
