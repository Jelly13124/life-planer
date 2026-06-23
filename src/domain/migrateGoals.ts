import type {
  Goal,
  Habit,
  LegacyGoal,
  LegacyGoalAction,
  NestedGoal,
  NestedSubgoal,
  Task,
} from "./types";

// ───────────────────────────────────────────────────────────────────────────
// migrateGoals —— 把三种历史形态统一迁到「两级目标」（扁平 Goal[]，靠 kind/parentGoalId 区分）。
//   1) legacy 扁平（带 horizon/parentGoalId/actions）：本就两级 → long/short 直转，actions 拆 tasks/habits。
//   2) nested（带 subgoals[]）：顶层 goal → long；其每个 subgoal → 一个 short（parentGoalId=该 long）。
//   3) 已是两级（带 kind、无 subgoals）：原样透传（幂等）。
// 关键：保留 id —— 旧 action/subgoal/goal 的 id 原样保留，所以 activity（按 id 记完成/计划）、
// 排期、连续天数、热力图全部继续对得上，无需重算历史。
// 纯函数：不读 Date.now/Math.random。输出永远是扁平 Goal[]。
// ───────────────────────────────────────────────────────────────────────────

// 迁移入口可接收的混合形状：新两级 Goal / 旧 legacy 扁平 / 旧 nested 嵌套，任意混排。
export type MigratableGoal = Goal | LegacyGoal | NestedGoal;

// 把一组旧 action 按是否有 repeat 拆成 tasks（无 repeat）/ habits（有 repeat），保留 id。
export function migrateActions(actions: LegacyGoalAction[]): { tasks: Task[]; habits: Habit[] } {
  const tasks: Task[] = [];
  const habits: Habit[] = [];
  for (const a of actions ?? []) {
    if (a.repeat) {
      habits.push({
        id: a.id,
        text: a.text,
        repeat: a.repeat,
        repeatWeekday: a.repeatWeekday,
        startTime: a.startTime,
        durationMin: a.durationMin,
      });
    } else {
      tasks.push({
        id: a.id,
        text: a.text,
        done: a.done,
        scheduledDate: a.scheduledDate,
        startTime: a.startTime,
        durationMin: a.durationMin,
      });
    }
  }
  return { tasks, habits };
}

// ───────── 形态判定（松散读：用 in 探测特征字段） ─────────

const isLegacy = (g: MigratableGoal): g is LegacyGoal =>
  "actions" in g || "horizon" in g;

const isNested = (g: MigratableGoal): g is NestedGoal =>
  !isLegacy(g) && "subgoals" in g;

// 已是两级：有 kind 且无 subgoals（且非 legacy）。
const isTwoTier = (g: MigratableGoal): g is Goal =>
  !isLegacy(g) && !isNested(g) && "kind" in g;

// ───────── legacy 扁平 → 两级 ─────────

// 一个 legacy 目标转成两级 Goal（依其层级 long/short）。
function legacyToGoal(g: LegacyGoal, kind: "long" | "short", parentGoalId: string | null): Goal {
  const { tasks, habits } = migrateActions(g.actions ?? []);
  return {
    id: g.id,
    kind,
    parentGoalId: kind === "short" ? parentGoalId : null,
    area: g.area,
    title: g.title,
    why: g.why,
    status: g.status,
    createdAt: g.createdAt,
    endDate: g.deadline,
    pathId: kind === "long" ? g.pathId : null,
    tags: g.tags,
    metrics: [],
    tasks,
    habits,
    completedAt: g.completedAt,
    lastReviewedAt: g.lastReviewedAt,
  };
}

// 把一组 legacy 目标迁成两级：long（horizon==="long" 或无有效父）+ short（保留有效父，孤儿提为 long）。
function migrateLegacyGroup(legacy: LegacyGoal[]): Goal[] {
  const byId = new Map<string, LegacyGoal>();
  for (const g of legacy) byId.set(g.id, g);

  // 有效父：自指 → null；指向不存在/非 legacy 的父 → null（孤儿）。
  const effectiveParent = (g: LegacyGoal): string | null => {
    const p = g.parentGoalId;
    if (p == null) return null;
    if (p === g.id) return null; // 自指
    if (!byId.has(p)) return null; // 缺失父 → 孤儿
    return p;
  };

  // long = horizon==="long" 或无有效父；其余为 short（保留有效父）。
  const out: Goal[] = [];
  for (const g of legacy) {
    const parent = effectiveParent(g);
    const isLong = g.horizon === "long" || parent == null;
    out.push(legacyToGoal(g, isLong ? "long" : "short", parent));
  }
  return out;
}

// ───────── nested 嵌套 → 两级 ─────────

// nested 顶层 goal → long Goal（去掉 subgoals，保留自身 metrics/tasks/habits/pathId/dates/id）。
function nestedToLong(g: NestedGoal): Goal {
  return {
    id: g.id,
    kind: "long",
    parentGoalId: null,
    area: g.area,
    title: g.title,
    why: g.why,
    status: g.status,
    createdAt: g.createdAt,
    startDate: g.startDate,
    endDate: g.endDate,
    pathId: g.pathId ?? null,
    tags: g.tags,
    favorite: g.favorite,
    metrics: g.metrics ?? [],
    tasks: g.tasks ?? [],
    habits: g.habits ?? [],
    completedAt: g.completedAt,
    lastReviewedAt: g.lastReviewedAt,
  };
}

// nested subgoal S → short Goal（parentGoalId = 其 long 父；继承父的 area/dates；自带 metrics/tasks/habits）。
function nestedSubgoalToShort(s: NestedSubgoal, parent: NestedGoal): Goal {
  return {
    id: s.id,
    kind: "short",
    parentGoalId: parent.id,
    area: parent.area,
    title: s.title,
    why: "",
    status: "active",
    createdAt: parent.createdAt,
    startDate: parent.startDate,
    endDate: parent.endDate,
    pathId: null,
    metrics: s.metrics ?? [],
    tasks: s.tasks ?? [],
    habits: s.habits ?? [],
  };
}

// ───────── 主入口 ─────────

// 收集一个输入目标暴露的「应在输出里出现」的全部 id（自身 + nested subgoals）。
function inputIds(g: MigratableGoal): string[] {
  const ids = [g.id];
  if (isNested(g)) for (const s of g.subgoals ?? []) ids.push(s.id);
  return ids;
}

export function migrateGoals(input: ReadonlyArray<MigratableGoal>): Goal[] {
  const list = input ?? [];

  const out: Goal[] = [];
  const legacyBatch: LegacyGoal[] = [];

  // 1) 逐个分流：legacy 攒一批（需要互相推断父子）；nested 就地展开；two-tier 原样透传。
  for (const g of list) {
    if (isLegacy(g)) {
      legacyBatch.push(g);
    } else if (isNested(g)) {
      out.push(nestedToLong(g));
      for (const s of g.subgoals ?? []) out.push(nestedSubgoalToShort(s, g));
    } else if (isTwoTier(g)) {
      out.push(g); // 幂等：已是两级，原样透传
    } else {
      // 形态不明（无 actions/horizon/subgoals/kind）：当 long 兜底，保 id。
      out.push({ ...(g as Goal), kind: "long", parentGoalId: null });
    }
  }

  // 2) legacy 批量迁移（保留批内父子关系）。
  if (legacyBatch.length) out.push(...migrateLegacyGroup(legacyBatch));

  // 3) 安全网：每个输入目标 id + nested subgoal id 都必须作为输出 goal id 出现；
  //    缺失则补一条 long 兜底（极端形态防御，保证无损）。
  const present = new Set(out.map((g) => g.id));
  for (const g of list) {
    for (const id of inputIds(g)) {
      if (present.has(id)) continue;
      out.push({
        id,
        kind: "long",
        parentGoalId: null,
        area: ("area" in g ? (g as { area: Goal["area"] }).area : "other"),
        title: ("title" in g ? (g as { title: string }).title : ""),
        why: "",
        status: "active",
        createdAt: ("createdAt" in g ? (g as { createdAt: string }).createdAt : ""),
        pathId: null,
        metrics: [],
        tasks: [],
        habits: [],
      });
      present.add(id);
    }
  }

  // 注：每条 out 在构造时已显式带 kind + parentGoalId；two-tier 原样透传以保持幂等（按字节相等）。
  // normalize.ts 的兜底再补一遍 kind ??= "long" / parentGoalId ??= null，覆盖极端透传缺字段。
  return out;
}
