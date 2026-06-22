// 极简线性图标集（自绘，无第三方依赖）。
// 每个图标用 stroke="currentColor" 继承文字色——侧栏 active=accent / inactive=dim
// 因此能自动着色（这正是我们弃用彩色 emoji 的核心原因）。
// 风格取 Lucide/Feather 的克制几何感，但路径全为本项目原创。
// 统一 viewBox 0 0 24 24、strokeWidth 1.6、圆头圆角；在 ~18px 下保持干净不杂乱。

import type { ReactNode } from "react";

type IconProps = { className?: string };

// 公共 svg 外壳：固定描边参数，子路径只管几何形状。
function Svg({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// 我的人生树：一条主干分叉成 2–3 支，末端带小节点——品牌核心隐喻，做得克制而有性格。
export function IconTree({ className }: IconProps) {
  return (
    <Svg className={className}>
      {/* 主干 */}
      <path d="M12 21V12" />
      {/* 三条分叉 */}
      <path d="M12 12C12 9 9.5 8 7.5 7" />
      <path d="M12 13C12 10.5 14.5 9.5 16.5 8.5" />
      <path d="M12 15c0-2 2-3.2 3.8-4" />
      {/* 末端节点 */}
      <circle cx="7" cy="6.6" r="1.4" />
      <circle cx="17" cy="8" r="1.4" />
      <circle cx="16.4" cy="10.6" r="1.2" />
    </Svg>
  );
}

// 今天：太阳——圆心 + 短射线。
export function IconSun({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </Svg>
  );
}

// 即将到来：日历 + 向前小箭头。
export function IconUpcoming({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      <path d="M9 15h5M12 12.7l2.3 2.3-2.3 2.3" />
    </Svg>
  );
}

// 日历：基本网格。
export function IconCalendar({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      <path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" />
    </Svg>
  );
}

// 全部任务：清单——三行，每行带前导小点。
export function IconList({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.5" cy="6.5" r="1.1" />
      <circle cx="4.5" cy="12" r="1.1" />
      <circle cx="4.5" cy="17.5" r="1.1" />
    </Svg>
  );
}

// 已完成：圆 + 勾。
export function IconCheckCircle({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.4 2.4 4.6-5" />
    </Svg>
  );
}

// 人生面：指南针——圆 + 指针。
export function IconCompass({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.2 8.8l-1.7 4.7-4.7 1.7 1.7-4.7z" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </Svg>
  );
}

// 目标：两个同心圆 + 圆心点。
export function IconTarget({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </Svg>
  );
}

// 习惯：循环/刷新箭头环。
export function IconRepeat({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4.5 9.5A8 8 0 0 1 18.5 7l1.5 1.5" />
      <path d="M20 4v4.5h-4.5" />
      <path d="M19.5 14.5A8 8 0 0 1 5.5 17L4 15.5" />
      <path d="M4 20v-4.5h4.5" />
    </Svg>
  );
}

// 洞察：极简柱状图——三根高度递增的柱。
export function IconChart({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 20h16" />
      <path d="M7.5 20v-5M12 20v-9M16.5 20v-7" />
    </Svg>
  );
}

// 选择面板：天平——横梁 + 两个托盘，契合权衡/选择。
export function IconScale({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 4v16M8 20h8" />
      <path d="M5 7h14M5 7l2.5 6M5 7l-2.5 6M19 7l2.5 6M19 7l-2.5 6" />
      <path d="M2.5 13a2.5 2.5 0 0 0 5 0M16.5 13a2.5 2.5 0 0 0 5 0" />
    </Svg>
  );
}

// 收藏：星形——支持 filled 状态（收藏时填充 currentColor）。
export function IconStar({
  className,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <Svg className={className}>
      <path
        d="M12 3.5l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z"
        fill={filled ? "currentColor" : "none"}
      />
    </Svg>
  );
}

// 标签：标签/吊牌形 + 穿孔点。
export function IconTag({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 4.5h7.2a2 2 0 0 1 1.42.6l6.3 6.3a2 2 0 0 1 0 2.83l-4.69 4.69a2 2 0 0 1-2.83 0l-6.3-6.3A2 2 0 0 1 4 11.2V4.5z" />
      <circle cx="8" cy="8" r="1.2" />
    </Svg>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 人生面（GoalArea）领域图标：career/wealth/relationships/health/growth/other。
// 经 areaMeta 的 AREA_ICON / AreaIcon 着色（用 AREA_COLOR[area]），替代彩色 emoji。
// ───────────────────────────────────────────────────────────────────────────

// 事业：公文包。
export function IconBriefcase({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="7.5" width="18" height="12" rx="2.2" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18M11 12h2" />
    </Svg>
  );
}

// 财富：硬币（圆 + 内圈刻度，暗示币面）。
export function IconCoins({ className }: IconProps) {
  return (
    <Svg className={className}>
      <ellipse cx="9" cy="7" rx="5.5" ry="2.6" />
      <path d="M3.5 7v4c0 1.44 2.46 2.6 5.5 2.6s5.5-1.16 5.5-2.6V7" />
      <path d="M9 13.6v3.4c0 1.44 2.46 2.6 5.5 2.6S20 18.44 20 17v-6.6" />
      <ellipse cx="14.5" cy="10.4" rx="5.5" ry="2.6" />
    </Svg>
  );
}

// 关系：心形。
export function IconHeart({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 20.5l-7.4-7.1a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5z" />
    </Svg>
  );
}

// 健康：脉搏波。
export function IconActivity({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 12h3.5l2-6 3.5 12 2.5-7 1.5 1h4.5" />
    </Svg>
  );
}

// 成长：抽芽（茎 + 两片叶）。
export function IconSprout({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 20v-7" />
      <path d="M12 13C12 9.5 9 8 5.5 8 5.5 11.5 8.5 13 12 13z" />
      <path d="M12 11.5c0-3 2.6-4.3 5.8-4.3.2 3-2.4 4.3-5.8 4.3z" />
    </Svg>
  );
}

// 其他：盒子（中性桶）。
export function IconBox({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.5l8 4.2v8.6l-8 4.2-8-4.2V7.7z" />
      <path d="M4.2 7.8L12 12l7.8-4.2M12 12v9.5" />
    </Svg>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 通用动作/状态图标。
// ───────────────────────────────────────────────────────────────────────────

// AI / 灵感：四角星花（sparkle）。
export function IconSparkle({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
      <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </Svg>
  );
}

// 达成 / 奖杯（trophy）。
export function IconTrophy({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 4.5h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 6H4.5v1.5A3 3 0 0 0 7 10.4M17 6h2.5v1.5A3 3 0 0 1 17 10.4" />
      <path d="M12 13.5V16M9 19.5h6M9.5 19.5l.5-3.5h4l.5 3.5" />
    </Svg>
  );
}

// 连续 / 火苗（flame）。
export function IconFlame({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.5c2.5 3 4.5 5 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.4.6-2.5 1.5-3.5.3 1 .9 1.6 1.7 1.9-.2-2.6 .5-5 1.3-6.9z" />
    </Svg>
  );
}

// 时间 / 时钟（clock）。
export function IconClock({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

// 关闭 / 删除（✕）。
export function IconX({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

// 新增（＋）。
export function IconPlus({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

// 空态 / 收件箱（inbox 替代）。
export function IconInbox({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3.5 13.5L6 5.5h12l2.5 8v5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M3.5 13.5H8l1.2 2.2h5.6L16 13.5h4.5" />
    </Svg>
  );
}

// 指针 / 提示（pointer 替代：向上的轻指引）。
export function IconPointer({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 21V8" />
      <path d="M8 12l4-4 4 4" />
    </Svg>
  );
}

// 分享（share 替代）。
export function IconShare({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 15V4M8.5 7.5L12 4l3.5 3.5" />
      <path d="M6 11.5H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 20.5h14a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 19 11.5h-1" />
    </Svg>
  );
}

// 编辑（pencil 替代）。
export function IconPencil({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </Svg>
  );
}

// 对话气泡（chat 替代）。
export function IconChat({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 16.5H9l-4 3.5v-3.5h-1A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5z" />
    </Svg>
  );
}

// 重推 / 刷新（refresh 替代；与 IconRepeat 区分：单环 + 箭头）。
export function IconRefresh({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M20 11.5A8 8 0 1 0 19 16" />
      <path d="M20 5.5V11h-5.5" />
    </Svg>
  );
}

// 庆祝（party 替代：礼花）。
export function IconParty({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 20l4.5-12 7.5 7.5z" />
      <path d="M14 4.5c1.2.4 1.8 1.4 1.6 2.6M17.5 8c1.2-.2 2.2.4 2.6 1.6M15 3l.3 1.6M20.4 8.2L19 8.5M18.5 4.5l-1 1.2" />
    </Svg>
  );
}
