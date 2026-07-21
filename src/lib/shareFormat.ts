// 与网页卡片和 OG 图片的 feasibility 展示口径保持一致。
export function roundFeasibility(n: number): number {
  return Math.min(95, Math.max(0, Math.round(n / 5) * 5));
}
