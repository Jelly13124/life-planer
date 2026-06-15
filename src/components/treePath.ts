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

// 生成从分叉点到终点的三次贝塞尔曲线 d 字符串
export function curvePath(
  curve: CurveShape,
  endValue: number,
  layout: TreeLayout = DEFAULT_LAYOUT,
): string {
  const { branchX, endX, midY } = layout;
  const ey = curve === "flat" ? midY : endY(endValue, layout);
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
