import { describe, it, expect } from "vitest";
import { COARSE_FEASIBILITY_NOTE, isEnriched } from "@/domain/pathEnriched";
import type { LifePath } from "@/domain/types";

function path(over: Partial<LifePath> = {}): LifePath {
  return {
    id: "p1",
    choiceLabel: "去创业",
    kind: "choice",
    summary: "一句话结局",
    color: "#34d399",
    curve: "rise-gentle",
    endValue: 70,
    nodes: [],
    metrics: { career: [], wealth: [], relationships: [], health: [], growth: [] },
    parentId: null,
    forkAge: 30,
    scenario: "likely",
    ...over,
  };
}

describe("isEnriched", () => {
  it("explicit enriched:true → true", () => {
    expect(isEnriched(path({ enriched: true }))).toBe(true);
  });

  it("coarse local-generator placeholder note → false", () => {
    expect(
      isEnriched(path({ feasibility: 40, feasibilityNote: COARSE_FEASIBILITY_NOTE })),
    ).toBe(false);
  });

  it("real (non-placeholder) note + feasibility → true", () => {
    expect(
      isEnriched(path({ feasibility: 55, feasibilityNote: "有设计功底+已起号，但变现门槛高" })),
    ).toBe(true);
  });

  it("no feasibility at all → false", () => {
    expect(isEnriched(path())).toBe(false);
  });
});
