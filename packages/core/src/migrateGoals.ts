import type {
  Goal,
  LegacyGoal,
  LegacyGoalAction,
  LegacyHabit,
  NestedGoal,
  NestedSubgoal,
  Task,
} from "./types";

// ───────────────────────────────────────────────────────────────────────────
// migrateGoals —— 把三种历史形态统一迁到「两级目标」（扁平 Goal[]，靠 kind/parentGoalId 区分）。
//   1) legacy 扁平（带 horizon/parentGoalId/actions）：本就两级 → long/short 直转，actions 拆成
//      一次性 Task（无 repeat）/ 重复 Task（有 repeat，旧称 habit），同落进 goal.tasks。
//   2) nested（带 subgoals[]）：顶层 goal → long；其每个 subgoal → 一个 short（parentGoalId=该 long）；
//      旧 subgoal.habits[]（LegacyHabit[]）无损转成带 repeat 的 Task，并入 goal.tasks。
//   3) 已是两级（带 kind、无 subgoals）：原样透传（幂等）。
// 关键：保留 id —— 旧 action/habit/subgoal/goal 的 id 原样保留，所以 activity（按 id 记完成/计划）、
// 排期、连续天数、热力图全部继续对得上，无需重算历史。
// 纯函数：不读 Date.now/Math.random。输出永远是扁平 Goal[]，无 habits 字段（Habit 已并入 Task）。
// ───────────────────────────────────────────────────────────────────────────

// 迁移入口可接收的混合形状：新两级 Goal / 旧 legacy 扁平 / 旧 nested 嵌套，任意混排。
export type MigratableGoal = Goal | LegacyGoal | NestedGoal;

// 把一组旧 action 按是否有 repeat 拆成一次性 Task（无 repeat）/ 重复 Task（有 repeat，旧称 habit），
// 保留 id；两者统一装进同一个 Task[]（habits 已并入 Task.repeat，不再单独输出 habits 数组）。
export function migrateActions(actions: LegacyGoalAction[]): { tasks: Task[]; habits: Task[] } {
  const tasks: Task[] = [];
  const habits: Task[] = [];
  for (const a of actions ?? []) {
    if (a.repeat) {
      habits.push({
        id: a.id,
        text: a.text,
        done: false,
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

// 把旧 LegacyHabit[]（nested 形态下的 goal.habits/subgoal.habits）无损转成带 repeat 的 Task[]，保留 id。
function legacyHabitsToTasks(habits: LegacyHabit[] | undefined): Task[] {
  return (habits ?? []).map((h) => ({
    id: h.id,
    text: h.text,
    done: false,
    repeat: h.repeat,
    repeatWeekday: h.repeatWeekday,
    startTime: h.startTime,
    durationMin: h.durationMin,
  }));
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

// 一个 legacy 目标转成两级 Goal（依其层级 long/short）。actions 拆出的一次性/重复 Task 合并进 tasks[]。
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
    tasks: [...tasks, ...habits],
    completedAt: g.completedAt,
    lastReviewedAt: g.lastReviewedAt,
  };
}

// 把一组 legacy 目标迁成两级：long（horizon==="long" 或无最近 long 祖先）+ short（父=最近 long 祖先）。
//   nonLegacyLongIds：本批之外、在同一输入里已确定为 long 的 id（nested 顶层 / two-tier long），
//   用于混排输入：legacy short 指向这些 id 时，应保留为真实 short（父=该 long），而非误判孤儿提为 long。
function migrateLegacyGroup(
  legacy: LegacyGoal[],
  nonLegacyLongIds: ReadonlySet<string>,
): Goal[] {
  const byId = new Map<string, LegacyGoal>();
  for (const g of legacy) byId.set(g.id, g);

  // 某 legacy 目标自身是否会成为 long：horizon==="long"，或它没有任何「会成为 long 的祖先」。
  // （此处只判 batch 内 legacy；指向 nonLegacyLong 的另算，见 nearestLongParent。）
  const resolvesToLong = (g: LegacyGoal): boolean =>
    g.horizon === "long" || nearestLongParent(g) == null;

  // 沿父链向上走，找到「最近的 long 祖先」的 id：
  //   - 命中 nonLegacyLongIds（nested/two-tier long）→ 该 id；
  //   - 命中一个 horizon==="long" 的 legacy → 该 id；
  //   - 链断（父缺失/自指/越出）→ null（该节点自己提为 long）；
  //   - 成环 → null（cycle-safe，visited 集）。
  // 这样每个 short 最终都挂到一个真正的 long，绝不会出现 short→short（UI 不可达）。
  function nearestLongParent(g: LegacyGoal): string | null {
    const visited = new Set<string>([g.id]);
    let p = g.parentGoalId;
    while (p != null) {
      if (visited.has(p)) return null; // 成环
      visited.add(p);
      if (nonLegacyLongIds.has(p)) return p; // 跨输入：nested/two-tier long
      const parent = byId.get(p);
      if (!parent) return null; // 父缺失（且非 nonLegacyLong）→ 孤儿
      if (parent.horizon === "long") return p; // 命中 legacy long 祖先
      p = parent.parentGoalId; // 父是 legacy short → 继续向上
    }
    return null; // 父链终止于无父
  }

  // long = horizon==="long" 或无最近 long 祖先；其余为 short（父=最近 long 祖先）。
  const out: Goal[] = [];
  for (const g of legacy) {
    if (resolvesToLong(g)) {
      out.push(legacyToGoal(g, "long", null));
    } else {
      out.push(legacyToGoal(g, "short", nearestLongParent(g)));
    }
  }
  return out;
}

// ───────── nested 嵌套 → 两级 ─────────

// nested 顶层 goal → long Goal（去掉 subgoals，保留自身 metrics/pathId/dates/id；
// 旧 habits[]（LegacyHabit[]）无损转成带 repeat 的 Task，合并进 tasks[]）。
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
    tasks: [...(g.tasks ?? []), ...legacyHabitsToTasks(g.habits)],
    completedAt: g.completedAt,
    lastReviewedAt: g.lastReviewedAt,
  };
}

// nested subgoal S → short Goal（parentGoalId = 其 long 父；继承父的 area/dates；自带 metrics/tasks；
// 旧 habits[]（LegacyHabit[]）无损转成带 repeat 的 Task，合并进 tasks[]）。
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
    tasks: [...(s.tasks ?? []), ...legacyHabitsToTasks(s.habits)],
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

  // 跨输入的「已确定 long」id 集：nested 顶层 + two-tier long + 形态不明的兜底 long。
  // legacy short 指向这些 id 时应保留为真实 short（父=该 long），不可误判孤儿提为 long。
  // （legacy 自身的 long 由 migrateLegacyGroup 在批内判定，不进此集。）
  const nonLegacyLongIds = new Set<string>();

  // 1) 逐个分流：legacy 攒一批（需要互相推断父子）；nested 就地展开；two-tier 原样透传。
  for (const g of list) {
    if (isLegacy(g)) {
      legacyBatch.push(g);
    } else if (isNested(g)) {
      nonLegacyLongIds.add(g.id);
      out.push(nestedToLong(g));
      for (const s of g.subgoals ?? []) out.push(nestedSubgoalToShort(s, g));
    } else if (isTwoTier(g)) {
      if (g.kind === "long") nonLegacyLongIds.add(g.id); // 仅 long 可作 short 的父
      out.push(g); // 幂等：已是两级，原样透传
    } else {
      // 形态不明（无 actions/horizon/subgoals/kind）：当 long 兜底，保 id。
      const fallback = g as Goal;
      nonLegacyLongIds.add(fallback.id);
      out.push({ ...fallback, kind: "long", parentGoalId: null });
    }
  }

  // 2) legacy 批量迁移（保留批内父子关系；可挂到跨输入的 nested/two-tier long 上）。
  if (legacyBatch.length) out.push(...migrateLegacyGroup(legacyBatch, nonLegacyLongIds));

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
      });
      present.add(id);
    }
  }

  // 注：每条 out 在构造时已显式带 kind + parentGoalId；two-tier 原样透传以保持幂等（按字节相等）。
  // normalize.ts 的兜底再补一遍 kind ??= "long" / parentGoalId ??= null，覆盖极端透传缺字段。
  return out;
}
