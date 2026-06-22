"use client";

import { forwardRef, type HTMLAttributes } from "react";

// 全应用统一卡片：单一观感（var(--bg-1) 面、1px var(--line) 描边、16px 圆角）。
// padding 用预设档位保证内距节奏一致；sunken 用于卡片内的次级容器。
type Pad = "none" | "sm" | "md" | "lg";

const PAD: Record<Pad, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export const Card = forwardRef<
  HTMLDivElement,
  // hover 为可选项（默认 false）：仅在交互卡片上启用悬浮抬升，静态卡片不动。
  HTMLAttributes<HTMLDivElement> & { pad?: Pad; sunken?: boolean; hover?: boolean }
>(function Card(
  { pad = "md", sunken = false, hover = false, className = "", ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`${sunken ? "lp-card-sunken" : "lp-card"} ${hover && !sunken ? "lp-card-hover" : ""} ${PAD[pad]} ${className}`}
      {...props}
    />
  );
});
