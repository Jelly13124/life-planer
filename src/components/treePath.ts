import type { CurveShape } from "@/domain/types";

export interface TreeLayout {
  width: number;
  height: number;
  originX: number; // "现在"点
  branchX: number; // 分叉点
  endX: number; // 曲线终点
  midY: number; // 维持现状高度
  topY: number; // endValue=100 对应的 y
  bottomY: number; // endValue=0 对应的 y
}

export const DEFAULT_LAYOUT: TreeLayout = {
  width: 1120,
  height: 460,
  originX: 110,
  branchX: 290,
  endX: 760,
  midY: 230,
  topY: 70,
  bottomY: 400,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// endValue(0-100) -> 终点纵坐标（越大越高，y 越小）
export function endY(endValue: number, layout: TreeLayout = DEFAULT_LAYOUT): number {
  const v = clamp(endValue, 0, 100);
  return layout.bottomY - (v / 100) * (layout.bottomY - layout.topY);
}

// 生成从分叉点到终点的三次贝塞尔曲线 d 字符串。
// yOverride 用于"车道"防重叠布局：覆盖由 endValue 推出的终点高度。
export function curvePath(
  curve: CurveShape,
  endValue: number,
  layout: TreeLayout = DEFAULT_LAYOUT,
  yOverride?: number,
): string {
  const { branchX, endX, midY } = layout;
  const ey =
    yOverride ?? (curve === "flat" ? midY : endY(endValue, layout));
  const dx = endX - branchX;
  const c1x = branchX + dx * 0.45;
  const c2x = branchX + dx * 0.72;

  let c1y = midY;
  let c2y = ey;
  switch (curve) {
    case "flat":
      c1y = midY;
      c2y = midY;
      break;
    case "rise-gentle":
      c1y = midY;
      c2y = ey;
      break;
    case "rise-steep":
      c1y = midY; // 起步平，后段急升
      c2y = ey - 30;
      break;
    case "dip-rise":
      c1y = midY + 70; // 先下探
      c2y = ey;
      break;
    case "decline":
      c1y = midY;
      c2y = ey;
      break;
  }
  return `M${branchX},${midY} C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(
    1,
  )},${c2y.toFixed(1)} ${endX},${ey.toFixed(1)}`;
}

// 主干（共享段）
export function trunkPath(layout: TreeLayout = DEFAULT_LAYOUT): string {
  return `M${layout.originX},${layout.midY} L${layout.branchX},${layout.midY}`;
}

export interface LaneItem {
  id: string;
  curve: CurveShape;
  endValue: number;
}

// 车道布局：把各终点按 endValue 高度排开，强制最小间距，避免曲线/标签重叠。
// 保持"指数越高越靠上"的次序，整体居中并夹在 [topY, bottomY] 内。
export function computeLanes(
  items: LaneItem[],
  layout: TreeLayout = DEFAULT_LAYOUT,
  minGap = 38,
): Record<string, number> {
  const arr = items.map((it) => ({
    id: it.id,
    y: it.curve === "flat" ? layout.midY : endY(it.endValue, layout),
  }));
  arr.sort((a, b) => a.y - b.y);

  // 从上往下强制最小间距
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].y < arr[i - 1].y + minGap) arr[i].y = arr[i - 1].y + minGap;
  }
  // 底部溢出则整体上移
  if (arr.length) {
    const overflow = arr[arr.length - 1].y - layout.bottomY;
    if (overflow > 0) for (const a of arr) a.y -= overflow;
    const under = layout.topY - arr[0].y;
    if (under > 0) for (const a of arr) a.y += under;
  }

  const out: Record<string, number> = {};
  for (const a of arr) out[a.id] = a.y;
  return out;
}
