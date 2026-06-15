import { describe, it, expect } from "vitest";
import {
  computeLanes,
  curvePath,
  endY,
  trunkPath,
  DEFAULT_LAYOUT,
} from "@/components/treePath";

describe("treePath", () => {
  it("endY maps endValue into [topY, bottomY] and is monotonic", () => {
    expect(endY(100)).toBeCloseTo(DEFAULT_LAYOUT.topY, 1);
    expect(endY(0)).toBeCloseTo(DEFAULT_LAYOUT.bottomY, 1);
    expect(endY(80)).toBeLessThan(endY(20)); // 高分在上方（y 更小）
  });

  it("curvePath returns an SVG cubic path", () => {
    const d = curvePath("rise-gentle", 70);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toContain("C");
  });

  it("flat curve stays at midY regardless of endValue", () => {
    const d = curvePath("flat", 90);
    expect(d).toContain(String(DEFAULT_LAYOUT.midY));
  });

  it("trunkPath connects origin to branch at midY", () => {
    expect(trunkPath()).toBe(
      `M${DEFAULT_LAYOUT.originX},${DEFAULT_LAYOUT.midY} L${DEFAULT_LAYOUT.branchX},${DEFAULT_LAYOUT.midY}`,
    );
  });

  it("computeLanes enforces min gap and stays in bounds", () => {
    // 全部 endValue 接近 -> 自然高度几乎重叠
    const items = [
      { id: "a", curve: "rise-gentle" as const, endValue: 52 },
      { id: "b", curve: "rise-gentle" as const, endValue: 50 },
      { id: "c", curve: "dip-rise" as const, endValue: 51 },
      { id: "d", curve: "flat" as const, endValue: 50 },
    ];
    const lanes = computeLanes(items, DEFAULT_LAYOUT, 38);
    const ys = Object.values(lanes).sort((x, y) => x - y);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(37.9);
    }
    expect(ys[0]).toBeGreaterThanOrEqual(DEFAULT_LAYOUT.topY - 0.1);
    expect(ys[ys.length - 1]).toBeLessThanOrEqual(DEFAULT_LAYOUT.bottomY + 0.1);
  });
});
