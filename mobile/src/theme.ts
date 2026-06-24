// 移动端视觉令牌：苹果风白色极简（对应 web 的 globals.css 令牌）。
// 浅色底、白卡片、发丝灰描边、近黑文字、品牌紫强调色（在白底上压暗以达 AA 对比）。
import type { GoalArea } from "@lifeplanner/core/types";

export const colors = {
  bg: "#f5f5f7", // 应用底（米白）
  card: "#ffffff", // 卡片
  line: "#e5e5ea", // 发丝描边
  fg: "#1c1c1e", // 近黑正文
  fgMuted: "#8e8e93", // 次要文字
  accent: "#6d28d9", // 品牌紫（压暗）
  accentSoft: "#ede9fe", // 紫色浅底
  danger: "#ff3b30",
  success: "#34c759",
};

// 各领域强调色（对应 web areaMeta 的色相，line/dot 用）。
export const AREA_COLORS: Record<GoalArea, string> = {
  career: "#6d28d9",
  wealth: "#0a7d33",
  relationships: "#d6336c",
  health: "#0b8a8a",
  growth: "#1d4ed8",
  other: "#8e8e93",
};

export const radius = 14;
export const space = 16;
