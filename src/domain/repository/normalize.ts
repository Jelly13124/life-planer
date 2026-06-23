import type { Goal, LifeTree } from "../types";
import { migrateGoals, type MigratableGoal } from "../migrateGoals";

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
  // 散（goal-less）任务/习惯：旧数据无此字段 → 补空数组（不动 goal.tasks/goal.habits）。
  if (!Array.isArray(t.tasks)) t.tasks = [];
  if (!Array.isArray(t.habits)) t.habits = [];
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
  t.goals = t.goals.map((g): Goal => ({
    ...g,
    metrics: Array.isArray(g.metrics) ? g.metrics : [],
    tasks: Array.isArray(g.tasks) ? g.tasks : [],
    habits: Array.isArray(g.habits) ? g.habits : [],
    kind: g.kind ?? "long",
    parentGoalId: g.parentGoalId ?? null,
  }));

  return t;
}
