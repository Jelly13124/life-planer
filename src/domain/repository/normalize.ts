import type { LifeTree } from "../types";

// 校验 + 旧数据补字段（decisions/goals/activity）。无效返回 null。不改 storage key。
export function normalizeLoadedTree(parsed: unknown): LifeTree | null {
  if (!parsed || typeof parsed !== "object") return null;
  const t = parsed as LifeTree;
  if (!Array.isArray(t.paths) || !t.profile) return null;
  if (!Array.isArray(t.decisions)) t.decisions = [];
  if (!Array.isArray(t.goals)) t.goals = [];
  if (!Array.isArray(t.activity)) t.activity = [];
  return t;
}
