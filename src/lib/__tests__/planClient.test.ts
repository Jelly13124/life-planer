import { describe, it, expect } from "vitest";
import { sanitizePlan, localPlanTemplate } from "@/lib/planClient";

describe("planClient helpers", () => {
  it("localPlanTemplate has steps and experiments", () => {
    const t = localPlanTemplate();
    expect(t.steps.length).toBeGreaterThanOrEqual(2);
    expect(t.experiments.length).toBeGreaterThanOrEqual(1);
  });

  it("sanitizePlan trims, drops blanks, caps lengths", () => {
    const p = sanitizePlan({
      steps: ["  做第一步 ", "", "第二步", "三", "四", "五", "六", "七"],
      experiments: ["  试一下 ", "  ", "再试"],
    });
    expect(p.steps).toEqual(["做第一步", "第二步", "三", "四", "五", "六"]); // cap 6, trimmed, no blanks
    expect(p.experiments).toEqual(["试一下", "再试"]); // cap 3
  });

  it("sanitizePlan tolerates non-arrays", () => {
    expect(sanitizePlan({})).toEqual({ steps: [], experiments: [] });
  });
});
