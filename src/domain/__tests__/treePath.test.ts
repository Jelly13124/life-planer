import { describe, it, expect } from "vitest";
import {
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
});
