import type { Goal, Habit, LifeTree, Metric, Subgoal, Task } from "./types";
import { hashSeed } from "./seed";
import { removePath } from "./tree";

// ───────────────────────────────────────────────────────────────────────────
// goalTree —— 嵌套目标的纯访问器 / 写入器。
// 读：在 goal 级 + subgoal 级铺平查找。写：按 id 在嵌套里定位，返回新 tree。
// 一律纯函数：不读 Date.now/Math.random；id 由 hashSeed 生成，时间 now 注入。
// ───────────────────────────────────────────────────────────────────────────

const goalsOf = (tree: LifeTree): Goal[] => tree.goals ?? [];

export type ItemKind = "task" | "habit";

export interface TaskLoc {
  goal: Goal;
  subgoal: Subgoal | null;
  task: Task;
}
export interface HabitLoc {
  goal: Goal;
  subgoal: Subgoal | null;
  habit: Habit;
}
export interface ItemLoc {
  goal: Goal;
  subgoal: Subgoal | null;
  kind: ItemKind;
  item: Task | Habit;
}
export interface MetricLoc {
  owner: Goal | Subgoal;
  metric: Metric;
}

// ───────── reads ─────────

export function allTasks(tree: LifeTree): TaskLoc[] {
  const out: TaskLoc[] = [];
  for (const goal of goalsOf(tree)) {
    for (const task of goal.tasks ?? []) out.push({ goal, subgoal: null, task });
    for (const subgoal of goal.subgoals ?? []) {
      for (const task of subgoal.tasks ?? []) out.push({ goal, subgoal, task });
    }
  }
  return out;
}

export function allHabits(tree: LifeTree): HabitLoc[] {
  const out: HabitLoc[] = [];
  for (const goal of goalsOf(tree)) {
    for (const habit of goal.habits ?? []) out.push({ goal, subgoal: null, habit });
    for (const subgoal of goal.subgoals ?? []) {
      for (const habit of subgoal.habits ?? []) out.push({ goal, subgoal, habit });
    }
  }
  return out;
}

export function findTask(tree: LifeTree, id: string): TaskLoc | null {
  return allTasks(tree).find((t) => t.task.id === id) ?? null;
}

export function findHabit(tree: LifeTree, id: string): HabitLoc | null {
  return allHabits(tree).find((h) => h.habit.id === id) ?? null;
}

export function findItem(tree: LifeTree, id: string): ItemLoc | null {
  const t = findTask(tree, id);
  if (t) return { goal: t.goal, subgoal: t.subgoal, kind: "task", item: t.task };
  const h = findHabit(tree, id);
  if (h) return { goal: h.goal, subgoal: h.subgoal, kind: "habit", item: h.habit };
  return null;
}

export function allMetrics(tree: LifeTree): MetricLoc[] {
  const out: MetricLoc[] = [];
  for (const goal of goalsOf(tree)) {
    for (const metric of goal.metrics ?? []) out.push({ owner: goal, metric });
    for (const subgoal of goal.subgoals ?? []) {
      for (const metric of subgoal.metrics ?? []) out.push({ owner: subgoal, metric });
    }
  }
  return out;
}

// ───────── write helpers ─────────

// 对每个 goal 及其每个 subgoal 应用变换；用于按 id 定位修改 task/habit/metric。
function mapGoals(tree: LifeTree, fn: (g: Goal) => Goal): LifeTree {
  return { ...tree, goals: goalsOf(tree).map(fn) };
}

function mapSubgoals(goal: Goal, fn: (s: Subgoal) => Subgoal): Goal {
  return { ...goal, subgoals: (goal.subgoals ?? []).map(fn) };
}

// ───────── writes: tasks / habits ─────────

export function updateTask(tree: LifeTree, id: string, patch: Partial<Task>): LifeTree {
  const apply = (tasks: Task[]) =>
    tasks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t));
  return mapGoals(tree, (g) =>
    mapSubgoals({ ...g, tasks: apply(g.tasks ?? []) }, (s) => ({ ...s, tasks: apply(s.tasks ?? []) })),
  );
}

export function updateHabit(tree: LifeTree, id: string, patch: Partial<Habit>): LifeTree {
  const apply = (habits: Habit[]) =>
    habits.map((h) => (h.id === id ? { ...h, ...patch, id: h.id } : h));
  return mapGoals(tree, (g) =>
    mapSubgoals({ ...g, habits: apply(g.habits ?? []) }, (s) => ({
      ...s,
      habits: apply(s.habits ?? []),
    })),
  );
}

// 删除一个 task 或 habit（任意层），并清理它在每日活动里的计划/完成记录。
export function removeItem(tree: LifeTree, id: string): LifeTree {
  const dropTasks = (tasks: Task[]) => tasks.filter((t) => t.id !== id);
  const dropHabits = (habits: Habit[]) => habits.filter((h) => h.id !== id);
  const next = mapGoals(tree, (g) =>
    mapSubgoals(
      { ...g, tasks: dropTasks(g.tasks ?? []), habits: dropHabits(g.habits ?? []) },
      (s) => ({ ...s, tasks: dropTasks(s.tasks ?? []), habits: dropHabits(s.habits ?? []) }),
    ),
  );
  return {
    ...next,
    activity: (next.activity ?? []).map((d) => ({
      ...d,
      plannedActionIds: d.plannedActionIds.filter((x) => x !== id),
      completedActionIds: d.completedActionIds.filter((x) => x !== id),
    })),
  };
}

// 在 goal 级（subgoalId=null）或某 subgoal 级新增任务，返回新 tree + 新 id。
export function addTask(
  tree: LifeTree,
  goalId: string,
  subgoalId: string | null,
  text: string,
  now: string,
): { tree: LifeTree; id: string } {
  const id = `task-${hashSeed(`${goalId}|${subgoalId ?? ""}|${text}|${now}`)}`;
  const task: Task = { id, text: text.trim(), done: false };
  const next = mapGoals(tree, (g) => {
    if (g.id !== goalId) return g;
    if (subgoalId == null) return { ...g, tasks: [...(g.tasks ?? []), task] };
    return mapSubgoals(g, (s) =>
      s.id === subgoalId ? { ...s, tasks: [...(s.tasks ?? []), task] } : s,
    );
  });
  return { tree: next, id };
}

export function addHabit(
  tree: LifeTree,
  goalId: string,
  subgoalId: string | null,
  text: string,
  repeat: "daily" | "weekly",
  weekday: number | undefined,
  now: string,
): { tree: LifeTree; id: string } {
  const id = `habit-${hashSeed(`${goalId}|${subgoalId ?? ""}|${text}|${now}`)}`;
  const habit: Habit = {
    id,
    text: text.trim(),
    repeat,
    repeatWeekday: repeat === "weekly" ? (weekday ?? 1) : undefined,
  };
  const next = mapGoals(tree, (g) => {
    if (g.id !== goalId) return g;
    if (subgoalId == null) return { ...g, habits: [...(g.habits ?? []), habit] };
    return mapSubgoals(g, (s) =>
      s.id === subgoalId ? { ...s, habits: [...(s.habits ?? []), habit] } : s,
    );
  });
  return { tree: next, id };
}

// ───────── writes: subgoals ─────────

export function addSubgoal(
  tree: LifeTree,
  goalId: string,
  title: string,
  now: string,
): { tree: LifeTree; id: string } {
  const id = `subgoal-${hashSeed(`${goalId}|${title}|${now}`)}`;
  const subgoal: Subgoal = { id, title: title.trim(), metrics: [], tasks: [], habits: [] };
  const next = mapGoals(tree, (g) =>
    g.id === goalId ? { ...g, subgoals: [...(g.subgoals ?? []), subgoal] } : g,
  );
  return { tree: next, id };
}

// ───────── writes: metrics ─────────

// 在某 owner（goal 或 subgoal，按 id）上 upsert 一个指标（按 metric.id 判重）。
export function setMetric(tree: LifeTree, ownerId: string, metric: Metric): LifeTree {
  const upsert = (metrics: Metric[]) => {
    const exists = metrics.some((m) => m.id === metric.id);
    return exists ? metrics.map((m) => (m.id === metric.id ? metric : m)) : [...metrics, metric];
  };
  return mapGoals(tree, (g) => {
    let next = g;
    if (g.id === ownerId) next = { ...next, metrics: upsert(next.metrics ?? []) };
    return mapSubgoals(next, (s) =>
      s.id === ownerId ? { ...s, metrics: upsert(s.metrics ?? []) } : s,
    );
  });
}

export function removeMetric(tree: LifeTree, ownerId: string, metricId: string): LifeTree {
  const drop = (metrics: Metric[]) => metrics.filter((m) => m.id !== metricId);
  return mapGoals(tree, (g) => {
    let next = g;
    if (g.id === ownerId) next = { ...next, metrics: drop(next.metrics ?? []) };
    return mapSubgoals(next, (s) => (s.id === ownerId ? { ...s, metrics: drop(s.metrics ?? []) } : s));
  });
}

// 把某指标的 current 增量 delta（按 metric.id，任意 owner），夹在 [0, target]。
export function bumpMetric(tree: LifeTree, metricId: string, delta: number): LifeTree {
  const apply = (metrics: Metric[]) =>
    metrics.map((m) =>
      m.id === metricId
        ? { ...m, current: Math.max(0, Math.min(m.target, m.current + delta)) }
        : m,
    );
  return mapGoals(tree, (g) =>
    mapSubgoals({ ...g, metrics: apply(g.metrics ?? []) }, (s) => ({
      ...s,
      metrics: apply(s.metrics ?? []),
    })),
  );
}

// ───────── writes: goals ─────────

export interface AddGoalInput {
  area: Goal["area"];
  title: string;
  why?: string;
  startDate?: string;
  endDate?: string;
  pathId?: string | null;
  tags?: string[];
}

export function addGoal(
  tree: LifeTree,
  input: AddGoalInput,
  now: string,
): { tree: LifeTree; id: string } {
  const id = `goal-${hashSeed(`${input.title}|${now}`)}`;
  const goal: Goal = {
    id,
    area: input.area,
    title: input.title.trim(),
    why: (input.why ?? "").trim(),
    status: "active",
    createdAt: now,
    startDate: input.startDate,
    endDate: input.endDate,
    pathId: input.pathId ?? null,
    tags: input.tags,
    metrics: [],
    subgoals: [],
    tasks: [],
    habits: [],
  };
  return { tree: { ...tree, goals: [...goalsOf(tree), goal] }, id };
}

export function updateGoalById(tree: LifeTree, id: string, patch: Partial<Goal>): LifeTree {
  return mapGoals(tree, (g) => (g.id === id ? { ...g, ...patch, id: g.id } : g));
}

// 删除目标：级联其 subgoals/tasks/habits（连带所有后代 task/habit id）；
// 清掉这些 id 在每日活动里的计划/完成记录；若有 pathId，调 removePath 剪掉树枝。
export function removeGoalById(tree: LifeTree, id: string, now: string): LifeTree {
  const goal = goalsOf(tree).find((g) => g.id === id);
  if (!goal) return tree;

  // 收集这个目标下所有 task/habit id（goal 级 + 各 subgoal 级），用于清 activity。
  const ids = new Set<string>();
  for (const t of goal.tasks ?? []) ids.add(t.id);
  for (const h of goal.habits ?? []) ids.add(h.id);
  for (const s of goal.subgoals ?? []) {
    for (const t of s.tasks ?? []) ids.add(t.id);
    for (const h of s.habits ?? []) ids.add(h.id);
  }

  let next: LifeTree = {
    ...tree,
    goals: goalsOf(tree).filter((g) => g.id !== id),
    activity: (tree.activity ?? []).map((d) => ({
      ...d,
      plannedActionIds: d.plannedActionIds.filter((x) => !ids.has(x)),
      completedActionIds: d.completedActionIds.filter((x) => !ids.has(x)),
    })),
    updatedAt: now,
  };

  if (goal.pathId) {
    next = removePath(next, goal.pathId, now); // 剪掉对应分支（removePath 也会再清一遍 goals，幂等）
  }
  return next;
}
