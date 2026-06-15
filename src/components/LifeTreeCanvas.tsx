"use client";

import { useState } from "react";
import type { LifePath, LifeTree } from "@/domain/types";
import { curvePath, DEFAULT_LAYOUT as L, endY, trunkPath } from "./treePath";

export function LifeTreeCanvas({
  tree,
  onSelect,
}: {
  tree: LifeTree;
  onSelect: (id: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  // status-quo 画在最后但视觉在中间；按 endValue 排序仅用于标签错位的稳定性
  const paths = tree.paths;

  return (
    <svg
      viewBox={`0 0 ${L.width} ${L.height}`}
      width="100%"
      className="select-none"
      role="img"
      aria-label="人生树"
    >
      {/* 主干 */}
      <path
        d={trunkPath()}
        className="lp-path"
        stroke="#c9cdf0"
        strokeWidth={3}
        style={{ strokeDasharray: 300, strokeDashoffset: 300, animationDuration: "0.6s" }}
      />

      {paths.map((p: LifePath, i: number) => {
        const ey = p.curve === "flat" ? L.midY : endY(p.endValue);
        const isSq = p.kind === "status-quo";
        const active = hover === p.id;
        const delay = 0.4 + i * 0.22;
        return (
          <g
            key={p.id}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(p.id)}
            style={{ cursor: "pointer" }}
          >
            {/* 透明加粗命中区 */}
            <path d={curvePath(p.curve, p.endValue)} stroke="transparent" strokeWidth={26} fill="none" />
            {/* 可见曲线 */}
            <path
              d={curvePath(p.curve, p.endValue)}
              className="lp-path"
              stroke={p.color}
              strokeWidth={active ? 4.5 : 3}
              strokeDasharray={isSq ? "9 9" : undefined}
              style={{
                animationDelay: `${delay}s`,
                filter: isSq ? undefined : `drop-shadow(0 0 6px ${p.color}88)`,
                opacity: hover && !active ? 0.45 : 1,
                transition: "opacity .2s, stroke-width .15s",
              }}
            />
            {/* 终点 */}
            <circle
              cx={L.endX}
              cy={ey}
              r={active ? 8 : 6}
              fill={p.color}
              style={{
                animation: `lpFade .5s ease both`,
                animationDelay: `${delay + 1}s`,
                filter: `drop-shadow(0 0 6px ${p.color})`,
                transition: "r .15s",
              }}
            />
            {/* 标签 */}
            <g
              style={{ animation: "lpPop .5s ease both", animationDelay: `${delay + 1.05}s` }}
            >
              <text
                x={L.endX + 16}
                y={ey - 3}
                fontSize={16}
                fontWeight={700}
                fill={isSq ? "#c2c7e6" : "#fff"}
              >
                {p.choiceLabel}
              </text>
              <text x={L.endX + 16} y={ey + 16} fontSize={12.5} fill="var(--fg-dim)">
                {truncate(p.summary, 22)}
              </text>
            </g>
          </g>
        );
      })}

      {/* 起点 */}
      <circle className="lp-origin" cx={L.originX} cy={L.midY} r={7} fill="#fff" />
      <text
        x={L.originX}
        y={L.midY + 28}
        textAnchor="middle"
        fontSize={12.5}
        fill="var(--fg-dim)"
      >
        现在 · {tree.profile.name}
      </text>
    </svg>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
