"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { LifeTree, Mood } from "@/domain/types";
import { useT } from "@/prefs/PreferencesContext";
import { layoutMap, type MapLayout, type MapNode, type PathLayout } from "./mapLayout";

const MIN_K = 0.4;
const MAX_K = 2.5;

// 心情 → 节点描边色（克制，只在 hover/选中时点亮）
const MOOD_RING: Record<Mood, string> = {
  high: "var(--c-emerald)",
  mid: "var(--fg-dim)",
  low: "var(--c-rose)",
};

function usePrefersReducedMotion(): boolean {
  // 初值在客户端首帧读取，避免在 effect 里同步 setState 触发级联渲染。
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function LifeMap({
  tree,
  onSelectPath,
  onForkAtNode,
}: {
  tree: LifeTree;
  onSelectPath: (id: string) => void;
  onForkAtNode: (parentId: string, forkAge: number, atLabel: string) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const { t } = useT();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const layout: MapLayout = useMemo(
    () => layoutMap(tree.paths, tree.profile.age, tree.horizonYears),
    [tree.paths, tree.profile.age, tree.horizonYears],
  );

  // 祖先链：用于 hover/选中时高亮"这条路 + 它的来路"，其余淡化
  const parentOf = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const it of layout.items) m.set(it.id, it.parentId);
    return m;
  }, [layout.items]);

  const ancestorChain = useCallback(
    (id: string | null): Set<string> => {
      const out = new Set<string>();
      let cur = id;
      const guard = new Set<string>();
      while (cur && parentOf.has(cur) && !guard.has(cur)) {
        guard.add(cur);
        out.add(cur);
        cur = parentOf.get(cur) ?? null;
      }
      return out;
    },
    [parentOf],
  );

  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null); // `${pathId}:${age}`

  const focusId = hover ?? selected;
  const litChain = useMemo(() => ancestorChain(focusId), [ancestorChain, focusId]);

  // ── 平移 / 缩放 ──
  const [view, setView] = useState({ tx: 0, ty: 0, k: 1 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const moved = useRef(false);

  const resetView = useCallback(() => setView({ tx: 0, ty: 0, k: 1 }), []);

  const zoomBy = useCallback((factor: number) => {
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      // 以画布中心为锚点缩放
      const cx = layout.width / 2;
      const cy = layout.height / 2;
      const tx = cx - (cx - v.tx) * (k / v.k);
      const ty = cy - (cy - v.ty) * (k / v.k);
      return { tx, ty, k };
    });
  }, [layout.width, layout.height]);

  const onWheel = useCallback(
    (e: ReactWheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // 屏幕坐标 → viewBox 坐标
      const px = ((e.clientX - rect.left) / rect.width) * layout.width;
      const py = ((e.clientY - rect.top) / rect.height) * layout.height;
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
        if (k === v.k) return v;
        // 锚定鼠标位置
        const tx = px - (px - v.tx) * (k / v.k);
        const ty = py - (py - v.ty) * (k / v.k);
        return { tx, ty, k };
      });
    },
    [layout.width, layout.height],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGElement>) => {
      // 只在空白背景上开始拖拽（曲线/节点各自处理点击，不会触发这里）
      drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
      moved.current = false;
      setDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [view.tx, view.ty],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGElement>) => {
      const d = drag.current;
      if (!d) return;
      const svg = svgRef.current;
      const rect = svg?.getBoundingClientRect();
      const sx = rect ? layout.width / rect.width : 1;
      const sy = rect ? layout.height / rect.height : 1;
      const dx = (e.clientX - d.x) * sx;
      const dy = (e.clientY - d.y) * sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
      setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }));
    },
    [layout.width, layout.height],
  );

  const endDrag = useCallback((e: ReactPointerEvent<SVGElement>) => {
    drag.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  const onBackgroundClick = useCallback(() => {
    if (moved.current) return; // 拖拽不算点击
    setSelected(null);
  }, []);

  // 键盘可达：选中后 Esc 取消
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectPath = useCallback(
    (id: string) => {
      setSelected(id);
      onSelectPath(id);
    },
    [onSelectPath],
  );

  const { width: W, height: H, origin } = layout;
  const name = tree.profile.name || "你";

  // 时间轴刻度（每 ~5 年一根）
  const ticks = useMemo(() => {
    const out: number[] = [];
    const step = layout.maxAge - layout.minAge > 24 ? 5 : layout.maxAge - layout.minAge > 10 ? 3 : 2;
    for (let a = layout.minAge; a <= layout.maxAge + 0.001; a += step) out.push(a);
    if (out[out.length - 1] !== layout.maxAge) out.push(layout.maxAge);
    return out;
  }, [layout]);

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="block touch-none select-none"
        role="application"
        aria-label={t("{name} 的人生地图：可平移缩放，点曲线看那段人生，点节点在那里加岔路", { name })}
        onWheel={onWheel}
      >
        <defs>
          {/* 柔光：让曲线在深色底上有"发光"质感 */}
          <filter id="lm-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 背景命中区（透明）：只在空白处承接平移与"点空白取消选中"。
            平移/点击只挂在这里，曲线/节点的点击才不会被 SVG 级别的指针捕获吞掉。 */}
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="transparent"
          style={{ cursor: dragging ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={onBackgroundClick}
        />

        <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
          {/* 时间轴：年龄刻度（极淡，作为地图底纹） */}
          <g aria-hidden>
            {ticks.map((age) => {
              const x = layout.xFor(age);
              return (
                <g key={age}>
                  <line
                    x1={x}
                    y1={origin.y - (H * 0.42)}
                    x2={x}
                    y2={origin.y + (H * 0.42)}
                    stroke="var(--line)"
                    strokeWidth={1}
                    strokeDasharray="2 8"
                  />
                  <text
                    x={x}
                    y={H - 22}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--fg-faint)"
                  >
                    {t("{age} 岁", { age })}
                  </text>
                </g>
              );
            })}
          </g>

          {/* 路径（先画淡的、未聚焦的，聚焦链最后画以压在上层） */}
          {layout.items.map((p, i) => (
            <PathCurve
              key={p.id}
              p={p}
              index={i}
              reduced={reduced}
              dim={Boolean(focusId) && !litChain.has(p.id)}
              active={focusId === p.id}
              onHoverIn={() => setHover(p.id)}
              onHoverOut={() => setHover(null)}
              onSelect={() => selectPath(p.id)}
              hoverNodeKey={hoverNode}
              onHoverNode={setHoverNode}
              onForkNode={(node) =>
                onForkAtNode(p.id, node.age, t("{age} 岁这里", { age: node.age }))
              }
            />
          ))}

          {/* 起点："现在 · 名字"，呼吸脉冲 */}
          <g aria-hidden>
            <circle
              cx={origin.x}
              cy={origin.y}
              r={9}
              fill="var(--bg-1)"
              stroke="#fff"
              strokeWidth={2}
              className={reduced ? undefined : "lp-origin"}
              style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,.5))" }}
            />
            <text
              x={origin.x}
              y={origin.y - 18}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill="var(--fg)"
            >
              {t("现在")}
            </text>
            <text
              x={origin.x}
              y={origin.y + 28}
              textAnchor="middle"
              fontSize={12}
              fill="var(--fg-dim)"
            >
              {name}
            </text>
          </g>
        </g>
      </svg>

      {/* 缩放/重置控件 */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <ZoomBtn label={t("放大")} onClick={() => zoomBy(1.2)}>
          ＋
        </ZoomBtn>
        <ZoomBtn label={t("缩小")} onClick={() => zoomBy(1 / 1.2)}>
          −
        </ZoomBtn>
        <button
          type="button"
          onClick={resetView}
          className="rounded-full border border-[var(--line)] bg-black/30 px-2.5 py-1 text-[11px] text-[var(--fg-dim)] backdrop-blur transition hover:border-[var(--accent)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          {t("重置视图")}
        </button>
      </div>

      {/* 操作提示（地图语义） */}
      <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-[var(--fg-faint)]">
        {t("拖动平移 · 滚轮缩放 · 点曲线看那段人生 · 点节点在那里加岔路")}
      </div>
    </div>
  );
}

// ── 单条路径：曲线 + 命中区 + 终点标签 + 节点 ──
function PathCurve({
  p,
  index,
  reduced,
  dim,
  active,
  onHoverIn,
  onHoverOut,
  onSelect,
  hoverNodeKey,
  onHoverNode,
  onForkNode,
}: {
  p: PathLayout;
  index: number;
  reduced: boolean;
  dim: boolean;
  active: boolean;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onSelect: () => void;
  hoverNodeKey: string | null;
  onHoverNode: (key: string | null) => void;
  onForkNode: (node: MapNode) => void;
}) {
  const { t } = useT();
  const isSq = p.kind === "status-quo";
  const color = isSq ? "var(--c-slate)" : p.color;
  // 越深的分支起手越晚一点，营造"逐层展开"的节奏
  const delay = reduced ? 0 : 0.35 + index * 0.14 + p.depth * 0.1;
  const opacity = dim ? 0.16 : 1;

  return (
    <g
      style={{ opacity, transition: "opacity .25s ease" }}
      onPointerEnter={onHoverIn}
      onPointerLeave={onHoverOut}
    >
      {/* 透明加粗命中区：点曲线 = 选这条路 */}
      <path
        d={p.dPath}
        stroke="transparent"
        strokeWidth={28}
        fill="none"
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      />
      {/* 可见曲线 */}
      <path
        d={p.dPath}
        fill="none"
        stroke={color}
        strokeWidth={active ? 4.5 : 3}
        strokeLinecap="round"
        strokeDasharray={isSq ? "8 8" : reduced ? undefined : 1600}
        strokeDashoffset={isSq || reduced ? undefined : 1600}
        style={{
          animation:
            isSq || reduced
              ? undefined
              : `lpDraw 1.5s cubic-bezier(0.2,0.7,0.2,1) ${delay}s forwards`,
          filter: isSq ? undefined : active ? "url(#lm-glow)" : `drop-shadow(0 0 5px ${color}66)`,
          transition: "stroke-width .15s ease",
          pointerEvents: "none",
        }}
      />

      {/* 节点：沿路径的小点，点它 = 在这里长岔路 */}
      {p.nodes.map((n, i) => {
        const key = `${p.id}:${n.age}`;
        const isFirst = i === 0; // 起点（分叉处）不再重复给加岔路
        const nodeHover = hoverNodeKey === key;
        const nDelay = reduced ? 0 : delay + 0.9 + i * 0.06;
        // 当路径被聚焦时，标注位置在节点上方（偶数索引）或下方（奇数索引）以减少重叠
        const labelAbove = i % 2 === 0;
        const labelBaseY = labelAbove ? n.y - 12 : n.y + 20;
        const ageY = labelAbove ? n.y - 24 : n.y + 32;
        return (
          <g
            key={key}
            style={{
              animation: reduced ? undefined : `lpFade .4s ease ${nDelay}s both`,
            }}
          >
            <circle
              cx={n.x}
              cy={n.y}
              r={nodeHover ? 7 : active && !isFirst ? 5 : 4}
              fill={nodeHover ? color : "var(--bg-0)"}
              stroke={nodeHover ? "#fff" : active && !isFirst ? color : MOOD_RING[n.mood]}
              strokeWidth={nodeHover ? 2 : active && !isFirst ? 2 : 1.6}
              style={{
                cursor: isFirst ? "default" : "pointer",
                transition: "r .12s ease, fill .12s ease",
                pointerEvents: isFirst ? "none" : "auto",
              }}
              onPointerEnter={() => !isFirst && onHoverNode(key)}
              onPointerLeave={() => onHoverNode(null)}
              onClick={(e) => {
                if (isFirst) return;
                e.stopPropagation();
                onForkNode(n);
              }}
            >
              {!isFirst && (
                <title>{t("＋ 在这里加岔路（{age} 岁 · {title}）", { age: n.age, title: n.title })}</title>
              )}
            </circle>
            {/* 聚焦路径：常显节点标注（标题 + 年龄） */}
            {active && !isFirst && (
              <g style={{ pointerEvents: "none" }}>
                <text
                  x={n.x}
                  y={labelBaseY}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill={color}
                  style={{ paintOrder: "stroke", stroke: "var(--bg-0)", strokeWidth: 3 }}
                >
                  {truncate(n.title, 6)}
                </text>
                <text
                  x={n.x}
                  y={ageY}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--fg-faint)"
                  style={{ paintOrder: "stroke", stroke: "var(--bg-0)", strokeWidth: 3 }}
                >
                  {t("{age} 岁", { age: n.age })}
                </text>
              </g>
            )}
            {/* hover 时浮出"加岔路"提示 */}
            {nodeHover && !isFirst && (
              <g style={{ pointerEvents: "none" }}>
                <rect
                  x={n.x - 58}
                  y={n.y - 34}
                  width={116}
                  height={20}
                  rx={10}
                  fill="var(--bg-2)"
                  stroke={color}
                  strokeWidth={1}
                  opacity={0.96}
                />
                <text
                  x={n.x}
                  y={n.y - 20}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--fg)"
                >
                  {t("＋ 在这里加岔路")}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* 终点 + 标签 */}
      <g
        style={{
          animation: reduced ? undefined : `lpPop .5s ease ${delay + 1}s both`,
          cursor: "pointer",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <circle
          cx={p.end.x}
          cy={p.end.y}
          r={active ? 7.5 : 5.5}
          fill={color}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "r .15s ease" }}
        />
        <text
          x={p.end.x + 14}
          y={p.end.y - 3}
          fontSize={15}
          fontWeight={700}
          fill={isSq ? "var(--fg-dim)" : "var(--fg)"}
        >
          {truncate(t(p.choiceLabel), 12)}
        </text>
        <text x={p.end.x + 14} y={p.end.y + 15} fontSize={12} fill="var(--fg-dim)">
          {truncate(p.summary, 20)}
        </text>
      </g>
    </g>
  );
}

function ZoomBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-black/30 text-base leading-none text-[var(--fg-dim)] backdrop-blur transition hover:border-[var(--accent)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
    >
      {children}
    </button>
  );
}
