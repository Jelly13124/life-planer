import type { Goal, LegacyGoal, LifeTree } from "../types";
import { migrateGoals } from "../migrateGoals";

// 迁移入口可接收的混合形状：新嵌套 Goal 与旧扁平 LegacyGoal 混排。
type MixedGoal = Goal | LegacyGoal;

// 校验 + 旧数据补字段（decisions/goals/activity/inbox）。无效返回 null。不改 storage key。
// 嵌套目标迁移：检测旧扁平结构（goal 带 actions 字段或缺 subgoals 字段）→ migrateGoals 无损升级。
export function normalizeLoadedTree(parsed: unknown): LifeTree | null {
  if (!parsed || typeof parsed !== "object") return null;
  const src = parsed as LifeTree;
  if (!Array.isArray(src.paths) || !src.profile) return null;
  const t: LifeTree = { ...src };
  if (!Array.isArray(t.decisions)) t.decisions = [];
  if (!Array.isArray(t.goals)) t.goals = [];
  if (!Array.isArray(t.activity)) t.activity = [];
  if (!Array.isArray(t.inbox)) t.inbox = [];

  // 旧→新嵌套目标迁移：任一目标带 `actions` 或缺 `subgoals` 即视为旧结构。
  // migrateGoals 现在原样透传已是新形状的目标，所以混合树（新+旧）也安全。
  const rawGoals = t.goals as unknown[];
  const isLegacy = rawGoals.some(
    (g) => g != null && typeof g === "object" && ("actions" in g || !("subgoals" in g)),
  );
  if (isLegacy) {
    t.goals = migrateGoals(rawGoals as MixedGoal[]);
  }

  // 兜底：补齐每个 Goal/Subgoal 的数组字段（防御未来缺字段或部分迁移）。
  t.goals = t.goals.map((g): Goal => ({
    ...g,
    metrics: Array.isArray(g.metrics) ? g.metrics : [],
    tasks: Array.isArray(g.tasks) ? g.tasks : [],
    habits: Array.isArray(g.habits) ? g.habits : [],
    subgoals: (Array.isArray(g.subgoals) ? g.subgoals : []).map((s) => ({
      ...s,
      metrics: Array.isArray(s.metrics) ? s.metrics : [],
      tasks: Array.isArray(s.tasks) ? s.tasks : [],
      habits: Array.isArray(s.habits) ? s.habits : [],
    })),
  }));

  return t;
}
