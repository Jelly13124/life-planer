import { describe, it, expect } from "vitest";
import { polylinePoints } from "@/components/metricPoints";
import type { MetricPoint } from "@/domain/types";

const pts: MetricPoint[] = [
  { age: 28, value: 50 },
  { age: 30, value: 80 },
  { age: 32, value: 20 },
];

describe("polylinePoints", () => {
  it("produces one coord pair per point", () => {
    const s = polylinePoints(pts, 100, 50);
    expect(s.split(" ").length).toBe(3);
  });

  it("x is non-decreasing and within bounds", () => {
    const s = polylinePoints(pts, 100, 50, 4);
    const xs = s.split(" ").map((c) => Number(c.split(",")[0]));
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
    xs.forEach((x) => {
      expect(x).toBeGreaterThanOrEqual(4);
      expect(x).toBeLessThanOrEqual(96);
    });
  });

  it("higher value -> smaller y", () => {
    const s = polylinePoints(pts, 100, 50, 4);
    const ys = s.split(" ").map((c) => Number(c.split(",")[1]));
    expect(ys[1]).toBeLessThan(ys[0]); // value 80 高于 50
    expect(ys[2]).toBeGreaterThan(ys[1]); // value 20 低于 80
  });

  it("empty input -> empty string", () => {
    expect(polylinePoints([], 100, 50)).toBe("");
  });
});
