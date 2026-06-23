import type { CurveShape, LifePath, Mood, PathKind, Scenario } from "@/domain/types";

// ───────────────────────────────────────────────────────────────────────────
// mapLayout —— 把一组 LifePath 布成"可平移缩放的人生地图"的纯几何函数。
// 时间（年龄）走 X 轴，左→右；所有分支共享同一个 xFor(age)。
// 纯函数、无副作用、可测试（node 环境）。渲染交给 LifeMap.tsx。
// ───────────────────────────────────────────────────────────────────────────

export interface MapLayoutOptions {
  width?: number;
  height?: number;
  padLeft?: number; // 左留白（"现在"原点落在这里）
  padRight?: number; // 右留白（终点标签需要空间）
  padTop?: number;
  padBottom?: number;
  minLaneGap?: number; // 根分支之间的最小纵向间距
  childOffset?: number; // 子分支相对父车道的纵向偏移基数
}

const DEFAULTS = {
  width: 1280,
  height: 560,
  padLeft: 120,
  padRight: 220, // 终点标签 (choiceLabel + summary) 需要横向空间
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
  feasibility?: number; // 现实可行度 0-100（仅 choice 路有；status-quo 不带）
  forkAge: number;
  endAge: number;
  depth: number; // 0 = 根分支
  dPath: string; // start→end 的三次贝塞尔 'd' 串
  start: { x: number; y: number };
  end: { x: number; y: number };
  c1: { x: number; y: number }; // 贝塞尔控制点（节点/子分支起点据此采样曲线）
  c2: { x: number; y: number };
  nodes: MapNode[];
}

export interface MapLayout {
  width: number;
  height: number;
  origin: { x: number; y: number }; // "现在 · {name}" 节点
  minAge: number;
  maxAge: number;
  xFor: (age: number) => number;
  items: PathLayout[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// 三次贝塞尔在参数 t∈[0,1] 处的单分量取值。
function bezier1(a: number, b: number, c: number, d: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
}

// 给定 x，在「x 随 t 单调」的三次贝塞尔上求对应的 y（二分 t）。
// 控制点 x 取 0.42/0.74 处，恒落在 [p0.x, p3.x] 内且递增 → x(t) 单调，可二分。
// 节点与子分支起点都用它落在「真正的曲线」上，而不是首尾连线（弦）上。
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

// 端点纵坐标：endValue 越高越靠上（y 越小），夹在 [topY, bottomY]。
function laneFromValue(endValue: number, topY: number, bottomY: number): number {
  const v = clamp(endValue, 0, 100);
  return bottomY - (v / 100) * (bottomY - topY);
}

// 根据曲线形状给出从 start 到 end 的三次贝塞尔控制点。控制点用年龄跨度推 x，
// 用形状偏置 y，让"先抑后扬 / 陡升 / 下行"读起来有性格（呼应 treePath.curvePath）。
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
      c1y = start.y; // 起步平
      c2y = end.y - Math.sign(span || -1) * 0 - 34; // 后段急升（y 更小）
      break;
    case "dip-rise":
      c1y = start.y + 64; // 先下探
      c2y = end.y;
      break;
    case "decline":
      c1y = start.y;
      c2y = end.y;
      break;
  }
  return { c1: { x: c1x, y: c1y }, c2: { x: c2x, y: c2y } };
}

// 用控制点拼出 SVG 'd' 串（与节点采样共用同一组控制点 → 几何上完全一致）。
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

/**
 * 把"最可能"那一层的分支布成一张共享时间轴的人生地图。
 *
 * @param paths 全部分支（内部会筛 scenario === "likely"）
 * @param startAge 画像当前年龄（X 轴左端 = 现在）
 * @param horizonYears 推演跨度（兜底右端）
 */
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

  // 地图只展示"最可能"。变体（乐观/保守）在详情页切换。
  const likely = paths.filter((p) => p.scenario === "likely");

  // ── X 轴：跨所有分支共享 [minAge, maxAge] → [padLeft, width-padRight] ──
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

  // ── depth（按 parentId 链算层级）：父先于子处理 ──
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

  // 根分支：按 endValue 在 [topY, bottomY] 排开，强制最小间距防重叠
  const roots = ordered.filter((p) => !p.parentId || !byId.has(p.parentId));
  const rootLaneY = spreadRootLanes(roots, topY, bottomY, midY, o.minLaneGap);

  const layoutById = new Map<string, PathLayout>();
  const items: PathLayout[] = [];
  // 记录每个父分支已经分出去多少子分支 → 兄弟交替上下扇出
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
      // 根分支从"现在"那条中线分叉出来
      yStart = midY;
      if (p.kind === "status-quo") {
        laneY = midY; // 维持现状保持中线、平
      }
    } else {
      const parent = layoutById.get(p.parentId!)!;
      // 子分支起点 = 父「真正的曲线」在 forkAge 处的 y（沿父贝塞尔采样，不是弦）
      yStart = cubicYAtX(parent.start, parent.c1, parent.c2, parent.end, startX);
      // 兄弟交替上下扇出，越深偏移略减
      const idx = childCount.get(parent.id) ?? 0;
      childCount.set(parent.id, idx + 1);
      const dir = idx % 2 === 0 ? -1 : 1; // 先上后下
      const magnitude = Math.ceil((idx + 1) / 2);
      const off = o.childOffset * magnitude * (depth >= 2 ? 0.78 : 1);
      laneY = clamp(yStart + dir * off, topY, bottomY);
    }

    const start = { x: startX, y: yStart };
    const end = { x: endX, y: clamp(laneY, topY, bottomY) };
    const { c1, c2 } = cubicControls(
      start,
      end,
      p.kind === "status-quo" ? "flat" : p.curve,
    );
    const dPath = cubicPath(start, c1, c2, end);

    // 节点沿该路径放置：x = xFor(age)，y 落在「真正的曲线」上（与可见曲线完全贴合）
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
      // 可行度仅随 choice 路带出（status-quo 不评）；地图据此显示「约 N%」徽标。
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

// 把根分支终点高度按 endValue 排开，保证最小间距、整体居中、夹在边界内。
// 思路同 treePath.computeLanes，但这里只决定 laneY（X 由年龄统一负责）。
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

  // 从上往下强制最小间距
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].y < arr[i - 1].y + minGap) arr[i].y = arr[i - 1].y + minGap;
  }
  // 溢出回收：底超则整体上移，顶超则整体下移
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
