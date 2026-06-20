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
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4 animate-fade">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] font-medium uppercase tracking-[3px] text-[var(--fg-faint)]">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-[var(--fg-dim)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
