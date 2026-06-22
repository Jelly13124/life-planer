"use client";

import type { MetricPoint } from "@/domain/types";
import { polylinePoints } from "./metricPoints";

export function MetricChart({
  label,
  points,
  color,
}: {
  label: string;
  points: MetricPoint[];
  color: string;
}) {
  const W = 220;
  const H = 64;
  const pad = 6;
  const line = polylinePoints(points, W, H, pad);
  const last = points[points.length - 1]?.value ?? 0;
  const first = points[0]?.value ?? 0;
  const delta = last - first;
  const gradId = `g-${label}`;

  // 填充区域：折线 + 底边闭合
  const area = line
    ? `${line} ${W - pad},${H - pad} ${pad},${H - pad}`
    : "";

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-black/[0.02] p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm text-[var(--fg)]">{label}</span>
        <span className="text-xs tabular-nums" style={{ color }}>
          {last}
          <span className="ml-1 text-[var(--fg-faint)]">
            {delta >= 0 ? `+${delta}` : delta}
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {area && <polygon points={area} fill={`url(#${gradId})`} />}
        {line && (
          <polyline
            points={line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}
