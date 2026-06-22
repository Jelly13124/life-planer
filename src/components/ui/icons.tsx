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
