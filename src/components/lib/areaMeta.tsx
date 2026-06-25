import type { ReactElement } from "react";
import type { GoalArea } from "@/domain/types";
import {
  IconBriefcase,
  IconCoins,
  IconHeart,
  IconActivity,
  IconSprout,
  IconBox,
} from "@/components/ui/icons";

// ───────────────────────────────────────────────────────────────────────────
// areaMeta —— 目标领域（GoalArea）共享的视觉元数据：颜色 + 线性图标。
// 供新的待办/标签视图复用，避免每个组件各自维护一份 map（DRY）。
// other = 中性灰（var(--fg-faint)），与「不参与预测」的语义一致。
// 图标继承 currentColor；用 AreaIcon 渲染时按 AREA_COLOR[area] 着色（替代彩色 emoji）。
// ───────────────────────────────────────────────────────────────────────────

export const AREA_COLOR: Record<GoalArea, string> = {
  career: "var(--c-sky)",
  wealth: "var(--c-green)",
  relationships: "var(--c-rose)",
  health: "var(--c-teal)",
  growth: "var(--c-violet)",
  other: "var(--fg-faint)",
};

// 每个领域的线性图标组件（career→公文包 / wealth→硬币 / relationships→心 /
// health→脉搏 / growth→抽芽 / other→盒子）。stroke=currentColor，由外层着色。
export const AREA_ICON: Record<GoalArea, (p: { className?: string }) => ReactElement> = {
  career: IconBriefcase,
  wealth: IconCoins,
  relationships: IconHeart,
  health: IconActivity,
  growth: IconSprout,
  other: IconBox,
};

// 便捷组件：渲染某领域的线性图标，默认按 AREA_COLOR[area] 着色。
// 用 color 覆盖（如想继承文字色，传 color="currentColor"）。
export function AreaIcon({
  area,
  className = "h-4 w-4",
  color,
}: {
  area: GoalArea;
  className?: string;
  color?: string;
}) {
  const Icon = AREA_ICON[area];
  return (
    <span
      aria-hidden="true"
      className="inline-flex flex-shrink-0"
      style={{ color: color ?? AREA_COLOR[area] }}
    >
      <Icon className={className} />
    </span>
  );
}
