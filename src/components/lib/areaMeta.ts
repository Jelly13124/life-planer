import type { GoalArea } from "@/domain/types";

// ───────────────────────────────────────────────────────────────────────────
// areaMeta —— 目标领域（GoalArea）共享的视觉元数据：颜色 + emoji。
// 供新的待办/标签视图复用，避免每个组件各自维护一份 map（DRY）。
// 既有的 PlanScreen / AreasSection 保留各自的局部 map，不在此重构。
// other = 中性灰（var(--fg-faint)），与「不参与预测」的语义一致。
// ───────────────────────────────────────────────────────────────────────────

export const AREA_COLOR: Record<GoalArea, string> = {
  career: "var(--c-sky)",
  wealth: "var(--c-amber)",
  relationships: "var(--c-rose)",
  health: "var(--c-emerald)",
  growth: "var(--accent)",
  other: "var(--fg-faint)",
};

export const AREA_EMOJI: Record<GoalArea, string> = {
  career: "💼",
  wealth: "💰",
  relationships: "❤️",
  health: "🏃",
  growth: "🌱",
  other: "📦",
};
