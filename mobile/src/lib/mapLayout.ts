// ───────────────────────────────────────────────────────────────────────────
// mapLayout —— 把一组 LifePath 布成「可平移缩放的人生地图」的纯几何函数。
// 时间（年龄）走 X 轴，左→右；所有分支共享同一个 xFor(age)。纯函数、无副作用。
//
// 这是 web `src/components/mapLayout.ts` 的镜像（逐字一致），让手机端人生地图与
// 网页端几何完全相同。改动请两端同步（或将来上提到 @lifeplanner/core）。
// ───────────────────────────────────────────────────────────────────────────
import type { CurveShape, LifePath, Mood, PathKind, Scenario } from "@lifeplanner/core/types";

export interface MapLayoutOptions {
  width?: number;
  height?: number;
  padLeft?: number;
  padRight?: number;
  padTop?: number;
  padBottom?: number;
  minLaneGap?: number;
  childOffset?: number;
}

const DEFAULTS = {
  width: 1280,
  height: 560,
  padLeft: 120,
  padRight: 220,
  padTop: 64,
  padBottom: 64,
  minLaneGap: 64,
  childOffset: 78,
} satisfies Required<MapLayoutOptions>;

export interface MapNode {
  age: number;
  x: number;
  y: number;
  mood: Mood;
  title: string;
}

export interface PathLayout {
  id: string;
  parentId: string | null;
  color: string;
  curve: CurveShape;
  kind: PathKind;
  scenario: Scenario;
  choiceLabel: string;
  summary: string;
  feasibility?: number;
  forkAge: number;
  endAge: number;
  depth: number;
  dPath: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  c1: { x: number; y: number };
  c2: { x: number; y: number };
  nodes: MapNode[];
}

export interface MapLayout {
  width: number;
  height: number;
  origin: { x: number; y: number };
  minAge: number;
  maxAge: number;
  xFor: (age: number) => number;
  items: PathLayout[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function bezier1(a: number, b: number, c: number, d: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
}

export function cubicYAtX(
  p0: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  p3: { x: number; y: number },
  x: number,
): number {
  if (x <= p0.x) return p0.y;
  if (x >= p3.x) return p3.y;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (bezier1(p0.x, c1.x, c2.x, p3.x, mid) < x) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return bezier1(p0.y, c1.y, c2.y, p3.y, t);
}

function laneFromValue(endValue: number, topY: number, bottomY: number): number {
  const v = clamp(endValue, 0, 100);
  return bottomY - (v / 100) * (bottomY - topY);
}

function cubicControls(
  start: { x: number; y: number },
  end: { x: number; y: number },
  curve: CurveShape,
): { c1: { x: number; y: number }; c2: { x: number; y: number } } {
  const dx = end.x - start.x;
  const c1x = start.x + dx * 0.42;
  const c2x = start.x + dx * 0.74;
  const span = end.y - start.y;

  let c1y = start.y;
  let c2y = end.y;
  switch (curve) {
    case "flat":
      c1y = start.y + span * 0.33;
      c2y = start.y + span * 0.66;
      break;
    case "rise-gentle":
      c1y = start.y + span * 0.4;
      c2y = end.y;
      break;
    case "rise-steep":
      c1y = start.y;
      c2y = end.y - Math.sign(span || -1) * 0 - 34;
      break;
    case "dip-rise":
      c1y = start.y + 64;
      c2y = end.y;
      break;
    case "decline":
      c1y = start.y;
      c2y = end.y;
      break;
  }
  return { c1: { x: c1x, y: c1y }, c2: { x: c2x, y: c2y } };
}

function cubicPath(
  start: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  end: { x: number; y: number },
): string {
  return (
    `M${start.x.toFixed(1)},${start.y.toFixed(1)} ` +
    `C ${c1.x.toFixed(1)},${c1.y.toFixed(1)} ` +
    `${c2.x.toFixed(1)},${c2.y.toFixed(1)} ` +
    `${end.x.toFixed(1)},${end.y.toFixed(1)}`
  );
}

export function layoutMap(
  paths: LifePath[],
  startAge: number,
  horizonYears: number,
  opts: MapLayoutOptions = {},
): MapLayout {
  const o = { ...DEFAULTS, ...opts };
  const topY = o.padTop;
  const bottomY = o.height - o.padBottom;
  const midY = (topY + bottomY) / 2;

  const likely = paths.filter((p) => p.scenario === "likely");

  let maxAge = startAge + horizonYears;
  for (const p of likely) {
    for (const n of p.nodes) if (n.age > maxAge) maxAge = n.age;
    if (p.forkAge > maxAge) maxAge = p.forkAge;
  }
  const minAge = startAge;
  const xLo = o.padLeft;
  const xHi = o.width - o.padRight;
  const ageSpan = Math.max(1, maxAge - minAge);
  const xFor = (age: number): number =>
    xLo + ((clamp(age, minAge, maxAge) - minAge) / ageSpan) * (xHi - xLo);

  const byId = new Map(likely.map((p) => [p.id, p]));
  const depthCache = new Map<string, number>();
  const depthOf = (p: LifePath): number => {
    if (depthCache.has(p.id)) return depthCache.get(p.id)!;
    let d = 0;
    let cur: LifePath | undefined = p;
    const guard = new Set<string>();
    while (cur && cur.parentId && byId.has(cur.parentId) && !guard.has(cur.id)) {
      guard.add(cur.id);
      d += 1;
      cur = byId.get(cur.parentId);
    }
    depthCache.set(p.id, d);
    return d;
  };

  const ordered = [...likely].sort((a, b) => depthOf(a) - depthOf(b));

  const roots = ordered.filter((p) => !p.parentId || !byId.has(p.parentId));
  const rootLaneY = spreadRootLanes(roots, topY, bottomY, midY, o.minLaneGap);

  const layoutById = new Map<string, PathLayout>();
  const items: PathLayout[] = [];
  const childCount = new Map<string, number>();

  for (const p of ordered) {
    const endAge =
      p.nodes.length > 0 ? p.nodes[p.nodes.length - 1].age : p.forkAge + horizonYears;
    const startX = xFor(p.forkAge);
    const endX = xFor(endAge);
    const depth = depthOf(p);
    const isRoot = !p.parentId || !byId.has(p.parentId);

    let yStart: number;
    let laneY: number;

    if (isRoot) {
      laneY = rootLaneY.get(p.id) ?? midY;
      yStart = midY;
      if (p.kind === "status-quo") {
        laneY = midY;
      }
    } else {
      const parent = layoutById.get(p.parentId!)!;
      yStart = cubicYAtX(parent.start, parent.c1, parent.c2, parent.end, startX);
      const idx = childCount.get(parent.id) ?? 0;
      childCount.set(parent.id, idx + 1);
      const dir = idx % 2 === 0 ? -1 : 1;
      const magnitude = Math.ceil((idx + 1) / 2);
      const off = o.childOffset * magnitude * (depth >= 2 ? 0.78 : 1);
      laneY = clamp(yStart + dir * off, topY, bottomY);
    }

    const start = { x: startX, y: yStart };
    const end = { x: endX, y: clamp(laneY, topY, bottomY) };
    const { c1, c2 } = cubicControls(start, end, p.kind === "status-quo" ? "flat" : p.curve);
    const dPath = cubicPath(start, c1, c2, end);

    const nodes: MapNode[] = p.nodes.map((n) => {
      const nx = xFor(n.age);
      return {
        age: n.age,
        x: nx,
        y: cubicYAtX(start, c1, c2, end, nx),
        mood: n.mood,
        title: n.title,
      };
    });

    const item: PathLayout = {
      id: p.id,
      parentId: p.parentId,
      color: p.color,
      curve: p.curve,
      kind: p.kind,
      scenario: p.scenario,
      choiceLabel: p.kind === "status-quo" ? "维持现状" : p.choiceLabel,
      summary: p.summary,
      feasibility: p.kind === "choice" ? p.feasibility : undefined,
      forkAge: p.forkAge,
      endAge,
      depth,
      dPath,
      start,
      end,
      c1,
      c2,
      nodes,
    };
    layoutById.set(p.id, item);
    items.push(item);
  }

  return {
    width: o.width,
    height: o.height,
    origin: { x: xFor(startAge), y: midY },
    minAge,
    maxAge,
    xFor,
    items,
  };
}

function spreadRootLanes(
  roots: LifePath[],
  topY: number,
  bottomY: number,
  midY: number,
  minGap: number,
): Map<string, number> {
  const arr = roots.map((p) => ({
    id: p.id,
    isSq: p.kind === "status-quo",
    y: p.kind === "status-quo" ? midY : laneFromValue(p.endValue, topY, bottomY),
  }));
  arr.sort((a, b) => a.y - b.y);

  for (let i = 1; i < arr.length; i++) {
    if (arr[i].y < arr[i - 1].y + minGap) arr[i].y = arr[i - 1].y + minGap;
  }
  if (arr.length) {
    const overflow = arr[arr.length - 1].y - bottomY;
    if (overflow > 0) for (const a of arr) a.y -= overflow;
    const under = topY - arr[0].y;
    if (under > 0) for (const a of arr) a.y += under;
  }

  const out = new Map<string, number>();
  for (const a of arr) out.set(a.id, clamp(a.y, topY, bottomY));
  return out;
}
