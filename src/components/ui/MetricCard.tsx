"use client";

import type { ReactNode } from "react";

// 全应用统一的指标卡：克制的小写标签（muted）+ 大号数字。
// 用于洞察、连续/热力图等处，保证跨屏一致。颜色用 CSS 变量（var(--c-*)）。
export function MetricCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  hint?: ReactNode;
}) {
  return (
    <div className="lp-card flex flex-col gap-1.5 p-4">
      <span className="text-[11px] uppercase tracking-wider text-[var(--fg-faint)]">{label}</span>
      <span
        className="text-2xl font-bold leading-none tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
      {hint && <span className="text-[11px] text-[var(--fg-faint)]">{hint}</span>}
    </div>
  );
}
