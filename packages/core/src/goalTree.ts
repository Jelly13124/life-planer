import type { Goal, LifeTree, Metric, Task } from "./types";
import { hashSeed } from "./seed";
import { removePath } from "./tree";

// ───────────────────────────────────────────────────────────────────────────
// goalTree —— 两级目标（扁平 Goal[]，靠 kind/parentGoalId 区分）的纯访问器 / 写入器。
// 读：遍历每个 goal 的 metrics/tasks（不再有 subgoal 层，也不再有独立 habits 数组）。
// Habit 已并入 Task：Task.repeat 有值 = 重复项（旧称"习惯"）；无值 = 一次性任务。
// 写：按 id 在 goals 里定位，返回新 tree。
// 一律纯函数：不读 Date.now/Math.random；id 由 hashSeed 生成，时间 now 注入。
// ───────────────────────────────────────────────────────────────────────────

const goalsOf = (tree: LifeTree): Goal[] => tree.goals ?? [];
const looseTasksOf = (tree: LifeTree): Task[] => tree.tasks ?? [];

// 一个 Task 是否重复项（旧称"习惯"）：Task.repeat 有值。
const isRepeating = (task: Task): boolean => task.repeat != null;

export type ItemKind = "task" | "habit";

// Loc.goal === null 表示该项是「散」（goal-less）的，挂在 tree 根而非任何目标下。
export interface TaskLoc {
  goal: Goal | null;
  task: Task;
}
// 「习惯」现在只是 repeat 有值的 Task；HabitLoc.habit 与 TaskLoc.task 指向同一种底层类型 Task。
export interface HabitLoc {
  goal: Goal | null;
  habit: Task;
}
export interface ItemLoc {
  goal: Goal | null;
  kind: ItemKind;
  item: Task;
}
export interface MetricLoc {
  goal: Goal; // 指标只属于目标；散项无指标，故此处恒为非空。
  metric: Metric;
}

// ───────── reads ─────────

// 所有一次性任务（repeat 未设）：每个目标的 goal.tasks（goal=该目标）+ 树根的散任务（goal=null）。
export function allTasks(tree: LifeTree): TaskLoc[] {
  const out: TaskLoc[] = [];
  for (const goal of goalsOf(tree)) {
    for (const task of goal.tasks ?? []) {
      if (!isRepeating(task)) out.push({ goal, task });
    }
  }
  for (const task of looseTasksOf(tree)) {
    if (!isRepeating(task)) out.push({ goal: null, task });
  }
  return out;
}

// 所有习惯（repeat 有值的 Task）：每个目标的 goal.tasks（goal=该目标）+ 树根的散任务（goal=null）。
export function allHabits(tree: LifeTree): HabitLoc[] {
  const out: HabitLoc[] = [];
  for (const goal of goalsOf(tree)) {
    for (const task of goal.tasks ?? []) {
      if (isRepeating(task)) out.push({ goal, habit: task });
    }
  }
  for (const task of looseTasksOf(tree)) {
    if (isRepeating(task)) out.push({ goal: null, habit: task });
  }
  return out;
}

export function allMetrics(tree: LifeTree): MetricLoc[] {
  const out: MetricLoc[] = [];
  for (const goal of goalsOf(tree)) {
    for (const metric of goal.metrics ?? []) out.push({ goal, metric });
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
  if (t) return { goal: t.goal, kind: "task", item: t.task };
  const h = findHabit(tree, id);
  if (h) return { goal: h.goal, kind: "habit", item: h.habit };
  return null;
}

// ───────── reads: goal tiers ─────────

export function goalById(tree: LifeTree, id: string): Goal | null {
  return goalsOf(tree).find((g) => g.id === id) ?? null;
}

export function longGoals(tree: LifeTree): Goal[] {
  return goalsOf(tree).filter((g) => g.kind === "long");
}

// 某长期目标旗下的短期目标（parentGoalId 指向它）。
export function shortGoalsOf(tree: LifeTree, longId: string): Goal[] {
  return goalsOf(tree).filter((g) => g.kind === "short" && g.parentGoalId === longId);
}

// 独立短期目标：kind==="short" 且无长期父（parentGoalId 为 null/undefined）。如「这周运动10小时」。
export function standaloneShortGoals(tree: LifeTree): Goal[] {
  return goalsOf(tree).filter((g) => g.kind === "short" && g.parentGoalId == null);
}

// ───────── write helpers ─────────

// 对每个 goal 应用变换；用于按 id 定位修改 task/habit/metric。
function mapGoals(tree: LifeTree, fn: (g: Goal) => Goal): LifeTree {
  return { ...tree, goals: goalsOf(tree).map(fn) };
}

// 从 tree.activity 里清掉一组 id 的计划/完成记录。
function pruneActivity(tree: LifeTree, ids: Set<string>): LifeTree {
  return {
    ...tree,
    activity: (tree.activity ?? []).map((d) => ({
      ...d,
      plannedActionIds: d.plannedActionIds.filter((x) => !ids.has(x)),
      completedActionIds: d.completedActionIds.filter((x) => !ids.has(x)),
    })),
  };
}

// ───────── writes: tasks / habits (habit = Task with repeat set) ─────────

// 改一个 task/habit（任意目标，或树根散项）的字段，按 id 定位，保留 id。两者同存于 tasks[]。
export function updateTask(tree: LifeTree, id: string, patch: Partial<Task>): LifeTree {
  const next = mapGoals(tree, (g) => ({
    ...g,
    tasks: (g.tasks ?? []).map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t)),
  }));
  return {
    ...next,
    tasks: looseTasksOf(next).map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t)),
  };
}

// updateHabit 是 updateTask 的别名：习惯已并入 Task，二者操作同一底层数组，行为完全一致。
// 保留独立导出是为了让调用方按语义选用（"这是在改一个习惯"），减少上层改动。
export const updateHabit = updateTask;

// 删除一个 task 或 habit（任意目标，或树根散项，同存于 tasks[]），并清理它在每日活动里的计划/完成记录。
export function removeItem(tree: LifeTree, id: string): LifeTree {
  const next = mapGoals(tree, (g) => ({
    ...g,
    tasks: (g.tasks ?? []).filter((t) => t.id !== id),
  }));
  const pruned: LifeTree = {
    ...next,
    tasks: looseTasksOf(next).filter((t) => t.id !== id),
  };
  return pruneActivity(pruned, new Set([id]));
}

// 在某 goal（长或短皆可）上新增一次性任务，返回新 tree + 新 id。
export function addTask(
  tree: LifeTree,
  goalId: string,
  text: string,
  now: string,
): { tree: LifeTree; id: string } {
  const id = `task-${hashSeed(`${goalId}|${text}|${now}`)}`;
  const task: Task = { id, text: text.trim(), done: false };
  const next = mapGoals(tree, (g) =>
    g.id === goalId ? { ...g, tasks: [...(g.tasks ?? []), task] } : g,
  );
  return { tree: next, id };
}

// 在某 goal（长或短皆可）上新增一个重复任务（旧称"习惯"）：Task 带 repeat，落进同一个 goal.tasks。
export function addHabit(
  tree: LifeTree,
  goalId: string,
  text: string,
  repeat: "daily" | "weekly",
  weekday: number | undefined,
  now: string,
): { tree: LifeTree; id: string } {
  const id = `habit-${hashSeed(`${goalId}|${text}|${now}`)}`;
  const habit: Task = {
    id,
    text: text.trim(),
    done: false,
    repeat,
    repeatWeekday: repeat === "weekly" ? (weekday ?? 1) : undefined,
  };
  const next = mapGoals(tree, (g) =>
    g.id === goalId ? { ...g, tasks: [...(g.tasks ?? []), habit] } : g,
  );
  return { tree: next, id };
}

// ───────── writes: loose (goal-less) tasks / habits ─────────

// 新增一个「散」一次性任务（不属任何目标），挂到 tree.tasks。
export function addLooseTask(
  tree: LifeTree,
  text: string,
  now: string,
): { tree: LifeTree; id: string } {
  const id = `task-${hashSeed(`loose|${text}|${now}`)}`;
  const task: Task = { id, text: text.trim(), done: false };
  return { tree: { ...tree, tasks: [...looseTasksOf(tree), task] }, id };
}

// 新增一个「散」习惯/日常（不属任何目标），挂到 tree.tasks（带 repeat）。无目标 → 无时间窗，永远重复。
export function addLooseHabit(
  tree: LifeTree,
  text: string,
  repeat: "daily" | "weekly",
  weekday: number | undefined,
  now: string,
): { tree: LifeTree; id: string } {
  const id = `habit-${hashSeed(`loose|${text}|${now}`)}`;
  const habit: Task = {
    id,
    text: text.trim(),
    done: false,
    repeat,
    repeatWeekday: repeat === "weekly" ? (weekday ?? 1) : undefined,
  };
  return { tree: { ...tree, tasks: [...looseTasksOf(tree), habit] }, id };
}

// ───────── writes: metrics ─────────

// 在某 goal（按 id）上 upsert 一个指标（按 metric.id 判重）。
export function setMetric(tree: LifeTree, goalId: string, metric: Metric): LifeTree {
  const upsert = (metrics: Metric[]) => {
    const exists = metrics.some((m) => m.id === metric.id);
    return exists ? metrics.map((m) => (m.id === metric.id ? metric : m)) : [...metrics, metric];
  };
  return mapGoals(tree, (g) =>
    g.id === goalId ? { ...g, metrics: upsert(g.metrics ?? []) } : g,
  );
}

export function removeMetric(tree: LifeTree, goalId: string, metricId: string): LifeTree {
  return mapGoals(tree, (g) =>
    g.id === goalId ? { ...g, metrics: (g.metrics ?? []).filter((m) => m.id !== metricId) } : g,
  );
}

// 把某指标的 current 增量 delta（按 metric.id，任意 goal），夹在 [0, target]。
export function bumpMetric(tree: LifeTree, metricId: string, delta: number): LifeTree {
  return mapGoals(tree, (g) => ({
    ...g,
    metrics: (g.metrics ?? []).map((m) =>
      m.id === metricId
        ? { ...m, current: Math.max(0, Math.min(m.target, m.current + delta)) }
        : m,
    ),
  }));
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

// 新增长期目标：kind:"long"，parentGoalId:null，可带 pathId（分支）。
export function addLongGoal(
  tree: LifeTree,
  input: AddGoalInput,
  now: string,
): { tree: LifeTree; id: string } {
  const id = `goal-${hashSeed(`${input.title}|${now}`)}`;
  const goal: Goal = {
    id,
    kind: "long",
    parentGoalId: null,
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
    tasks: [],
  };
  return { tree: { ...tree, goals: [...goalsOf(tree), goal] }, id };
}

// 新增短期目标：kind:"short"，无 pathId（不上树）。
//   parentLongId 为某长期目标 id → 挂在其下；为 null/"" → 独立短期目标（无长期父）。
export function addShortGoal(
  tree: LifeTree,
  parentLongId: string | null | undefined,
  input: AddGoalInput,
  now: string,
): { tree: LifeTree; id: string } {
  const parent = parentLongId ? parentLongId : null; // 空串/undefined → null（独立）
  const id = `goal-${hashSeed(`${parent ?? "standalone"}|${input.title}|${now}`)}`;
  const goal: Goal = {
    id,
    kind: "short",
    parentGoalId: parent,
    area: input.area,
    title: input.title.trim(),
    why: (input.why ?? "").trim(),
    status: "active",
    createdAt: now,
    startDate: input.startDate,
    endDate: input.endDate,
    pathId: null,
    tags: input.tags,
    metrics: [],
    tasks: [],
  };
  return { tree: { ...tree, goals: [...goalsOf(tree), goal] }, id };
}

// 新增独立短期目标（无长期父）：addShortGoal 的便捷封装，parentGoalId 固定 null。
export function addStandaloneShortGoal(
  tree: LifeTree,
  input: AddGoalInput,
  now: string,
): { tree: LifeTree; id: string } {
  return addShortGoal(tree, null, input, now);
}

export function updateGoalById(tree: LifeTree, id: string, patch: Partial<Goal>): LifeTree {
  return mapGoals(tree, (g) => (g.id === id ? { ...g, ...patch, id: g.id } : g));
}

// 删除目标（按 id），保 activity 一致：
//   long → 连带删除其所有 short 子目标；清掉自身 + 各子目标的所有 task/habit id 的 activity 记录；
//          若有 pathId，调 removePath 剪掉树枝。
//   short → 仅删自身；清掉自身 task/habit id 的 activity 记录。
export function removeGoalById(tree: LifeTree, id: string, now: string): LifeTree {
  const goal = goalById(tree, id);
  if (!goal) return tree;

  // 要删除的 goal id 集合（long 含其 short 子目标）。
  const removeGoalIds = new Set<string>([id]);
  if (goal.kind === "long") {
    for (const s of shortGoalsOf(tree, id)) removeGoalIds.add(s.id);
  }

  // 收集所有被删 goal 的 task/habit id（同存于 g.tasks[]），用于清 activity。
  const itemIds = new Set<string>();
  for (const g of goalsOf(tree)) {
    if (!removeGoalIds.has(g.id)) continue;
    for (const t of g.tasks ?? []) itemIds.add(t.id);
  }

  let next: LifeTree = {
    ...pruneActivity(tree, itemIds),
    goals: goalsOf(tree).filter((g) => !removeGoalIds.has(g.id)),
    updatedAt: now,
  };

  if (goal.kind === "long" && goal.pathId) {
    next = removePath(next, goal.pathId, now); // 剪掉对应分支（removePath 也会再清一遍 goals，幂等）
  }
  return next;
}
