import { describe, it, expect } from "vitest";
import { localPathGoals } from "../pathGoals";
import type { LifePath, LifeArea, MetricPoint } from "../types";

const series = (a: number, b: number): MetricPoint[] => [
  { age: 28, value: a }, { age: 43, value: b },
];

function path(overrides: Partial<LifePath> = {}): LifePath {
  return {
    id: "p1", choiceLabel: "去创业", kind: "choice", summary: "", color: "#000",
    curve: "rise-gentle", endValue: 60, nodes: [], parentId: null, forkAge: 28, scenario: "likely",
    metrics: {
      career: series(50, 80),      // +30 (biggest)
      wealth: series(50, 65),      // +15
      relationships: series(50, 45), // -5
      health: series(50, 52),      // +2
      growth: series(50, 70),      // +20 (2nd)
    } as Record<LifeArea, MetricPoint[]>,
    ...overrides,
  };
}

describe("localPathGoals", () => {
  it("returns goals for the top-gain areas, deterministic order", () => {
    const goals = localPathGoals(path(), 3);
    expect(goals.map((g) => g.area)).toEqual(["career", "growth", "wealth"]);
    expect(goals[0].title).toContain("去创业");
    expect(goals.length).toBe(3);
  });

  it("respects the count cap and never returns zero for a real path", () => {
    expect(localPathGoals(path(), 2)).toHaveLength(2);
    expect(localPathGoals(path(), 1)).toHaveLength(1);
  });

  it("is pure — same input yields identical output", () => {
    expect(localPathGoals(path(), 3)).toEqual(localPathGoals(path(), 3));
  });
});
