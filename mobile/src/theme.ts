// 移动端视觉令牌：苹果风白色极简（对应 web 的 globals.css 令牌）。
// 浅色底、白卡片、发丝灰描边、近黑文字、品牌紫强调色（在白底上压暗以达 AA 对比）。
import type { GoalArea } from "@lifeplanner/core/types";

export const colors = {
  bg: "#f5f5f7", // 应用底（米白）
  card: "#ffffff", // 卡片
  line: "#e5e5ea", // 发丝描边
  fg: "#1c1c1e", // 近黑正文
  fgMuted: "#8e8e93", // 次要文字
  accent: "#c2410c", // 品牌暖橙（白字在其上达 WCAG AA ≈4.5:1）
  accentSoft: "#fbe4d5", // 暖橙浅底
  danger: "#ff3b30",
  success: "#34c759",
};

// 各领域强调色（与 web --c-* 完全对齐，跨端统一）。无一为暖橙，避免与品牌色撞。
// 紫已降级为 growth（成长）领域色，让品牌色（橙）与领域色系彼此独立。
export const AREA_COLORS: Record<GoalArea, string> = {
  career: "#0a93d6", // sky
  wealth: "#0a7d33", // green（money=green）
  relationships: "#e84a6f", // rose
  health: "#0b8a8a", // teal
  growth: "#6d4aff", // violet
  other: "#8e8e93", // gray（= web --fg-faint）
};

// 圆角标尺（统一形状，对齐 web）：输入/按钮=sm，卡片=md，底板/弹窗=lg，胶囊/FAB/分段控件=pill。
export const radii = { sm: 12, md: 16, lg: 24, pill: 999 } as const;
export const space = 16;
