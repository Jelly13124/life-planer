"use client";

import type { ReactNode } from "react";

// 全应用统一的空状态：图标/emoji + muted 文案 + 清晰 CTA，而不是裸文字。
// 两种尺寸：block 占据整块（如习惯首页），inline 用于卡片内的小空位。
// 视觉沿用深色电影感：var(--bg-1)/(--line) 与区块强调色（可选）。
export function EmptyState({
  icon,
  title,
  description,
  action,
  accent,
  size = "block",
  className = "",
}: {
  icon?: ReactNode;
  title?: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  accent?: string; // 区块强调色（var(--c-*)），仅用于图标底座点缀
  size?: "block" | "inline";
  className?: string;
}) {
  if (size === "inline") {
    return (
      <div className={`flex flex-col items-center gap-2.5 px-3 py-6 text-center ${className}`}>
        {icon && <div className="text-2xl leading-none" aria-hidden="true">{icon}</div>}
        {title && <div className="text-sm font-medium text-[var(--fg-dim)]">{title}</div>}
        <p className="max-w-xs text-xs leading-relaxed text-[var(--fg-faint)]">{description}</p>
        {action && <div className="mt-0.5">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={`lp-card flex flex-col items-center gap-3 px-6 py-12 text-center animate-fade ${className}`}
    >
      {icon && (
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
          style={
            accent
              ? {
                  backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
                }
              : {
                  backgroundColor: "rgba(0,0,0,0.03)",
                  border: "1px solid var(--line)",
                }
          }
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      {title && (
        <div className="mt-1 font-[family-name:var(--font-display)] text-lg font-medium tracking-tight text-[var(--fg)]">
          {title}
        </div>
      )}
      <p className="max-w-sm text-sm leading-relaxed text-[var(--fg-dim)]">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
