"use client";

import type { ReactNode } from "react";

// 全应用统一的区块页头：eyebrow（小写英文标签）+ 标题 + 一行副标题。
// 统一字号/间距/外距，让六个区块拥有一致的节奏。右侧 actions 槽位放区块级操作。
// 视觉沿用本项目深色电影感：var(--fg-*) tokens、克制的字重。
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4 animate-fade">
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[3px] text-[var(--fg-faint)]">
            <span
              aria-hidden="true"
              className="h-[3px] w-4 rounded-full bg-[image:var(--grad-accent)] opacity-80"
            />
            {eyebrow}
          </div>
        )}
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[1.65rem] font-semibold leading-tight tracking-[-0.01em] sm:text-[2rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--fg-dim)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
