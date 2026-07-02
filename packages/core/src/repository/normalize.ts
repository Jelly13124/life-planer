import type { Goal, LifeTree, Task } from "../types";
import { migrateGoals, type MigratableGoal } from "../migrateGoals";

// 习惯并入任务：把 legacy habits[] 转成带 repeat 的 tasks[]（保 id/字段），去重。幂等。
function foldHabits(tasks: unknown, habits: unknown): Task[] {
  const base: Task[] = Array.isArray(tasks) ? (tasks as Task[]) : [];
  const hs: any[] = Array.isArray(habits) ? (habits as any[]) : [];
  const seen = new Set(base.map((t) => t.id));
  const converted: Task[] = hs
    .filter((h) => h && typeof h === "object" && !seen.has(h.id))
    .map((h) => ({
      id: String(h.id),
      text: String(h.text ?? ""),
      done: false,
      repeat: h.repeat === "weekly" ? "weekly" : "daily",
      ...(typeof h.repeatWeekday === "number" ? { repeatWeekday: h.repeatWeekday } : {}),
      ...(h.startTime ? { startTime: String(h.startTime) } : {}),
      ...(typeof h.durationMin === "number" ? { durationMin: h.durationMin } : {}),
    }));
  return [...base, ...converted];
}

// 校验 + 旧数据补字段（decisions/goals/activity）。无效返回 null。不改 storage key。
// 两级目标迁移：检测三种历史形态（legacy 扁平带 actions/horizon、nested 带 subgoals、
// 或缺 kind）→ migrateGoals 无损升级为扁平两级 Goal[]。已是两级的数据原样透传（幂等）。
export function normalizeLoadedTree(parsed: unknown): LifeTree | null {
  if (!parsed || typeof parsed !== "object") return null;
  const src = parsed as LifeTree;
  if (!Array.isArray(src.paths) || !src.profile) return null;
  const t: LifeTree = { ...src };
  if (!Array.isArray(t.decisions)) t.decisions = [];
  if (!Array.isArray(t.goals)) t.goals = [];
  // 散（goal-less）任务：旧数据无此字段 → 补空数组。
  if (!Array.isArray(t.tasks)) t.tasks = [];
  if (!Array.isArray(t.choices)) t.choices = [];
  if (!Array.isArray(t.activity)) t.activity = [];
  // 只读日历订阅源/事件（P4 ICS）：旧数据无此字段 → 补空数组。
  if (!Array.isArray(t.calendarFeeds)) t.calendarFeeds = [];

  // 旧→两级目标迁移：任一目标带 `actions`/`horizon`（legacy）、带 `subgoals`（nested）、
  // 或缺 `kind`（未知/部分迁移）→ migrateGoals 统一升级。已是两级则不触发，原样通过。
  const rawGoals = t.goals as unknown[];
  const needsMigration = rawGoals.some(
    (g) =>
      g != null &&
      typeof g === "object" &&
      ("actions" in g || "horizon" in g || "subgoals" in g || !("kind" in g)),
  );
  if (needsMigration) {
    t.goals = migrateGoals(rawGoals as MigratableGoal[]);
  }

  // 兜底：补齐每个 Goal 的数组字段 + kind/parentGoalId（防御未来缺字段或部分迁移）。
  // 习惯并入任务：goal.habits[] 折入 goal.tasks[]（带 repeat），并从输出中去掉 habits 字段。
  t.goals = t.goals.map((g): Goal => {
    const ag = g as any;
    const { habits: _dropHabits, ...restNoHabits } = ag;
    return {
      ...restNoHabits,
      metrics: Array.isArray(g.metrics) ? g.metrics : [],
      tasks: foldHabits(ag.tasks, ag.habits),
      kind: g.kind ?? "long",
      parentGoalId: g.parentGoalId ?? null,
    };
  });

  // 习惯并入任务：tree.habits[] 折入 tree.tasks[]，并从树上去掉 habits 字段。
  const anyT = t as any;
  anyT.tasks = foldHabits(anyT.tasks, anyT.habits);
  delete anyT.habits;

  return t;
}
