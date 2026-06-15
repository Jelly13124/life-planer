import type { MetricPoint } from "@/domain/types";

// 把 MetricPoint[] 归一化为 SVG polyline 的 points 字符串
export function polylinePoints(
  points: MetricPoint[],
  w: number,
  h: number,
  pad = 4,
): string {
  if (points.length === 0) return "";
  const ages = points.map((p) => p.age);
  const aMin = Math.min(...ages);
  const aMax = Math.max(...ages);
  const span = Math.max(1, aMax - aMin);
  return points
    .map((p) => {
      const x = pad + ((p.age - aMin) / span) * (w - 2 * pad);
      const y = h - pad - (p.value / 100) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
