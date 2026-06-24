import { describe, it, expect } from "vitest";
import { createTree } from "@/domain/tree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import {
  createDecision,
  upsertDecision,
  setPlan,
  togglePlanItem,
  recordReview,
  activeDecisionFor,
  reviewedDecisionsFor,
  dueDecisions,
  calibrationNote,
  addDays,
  type DecisionInput,
} from "@/domain/decisions";
import type { Profile } from "@/domain/types";

const profile = {
  name: "小测", age: 28, education: "bachelor", major: "", occupation: "",
  salary: "5to10", hasSideHustle: false, sideHustle: "", hobbies: "",
  relationship: "single", location: "", status: "", snapshot: "", crossroad: "读研",
  areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 },
} as Profile;

const gen = new LocalPathGenerator();
const NOW = "2026-06-16T00:00:00.000Z";

function baseInput(over: Partial<DecisionInput> = {}): DecisionInput {
  return {
    pathId: "p1", choiceLabel: "去读研", rationale: "想转行", expectation: "两年后进大厂",
    confidence: 70, reversibility: "two-way", horizon: "90d", ...over,
  };
}

describe("decisions domain", () => {
  it("createDecision sets reviewDate = createdAt + horizon and clamps confidence", () => {
    const d = createDecision(baseInput({ confidence: 140 }), NOW);
    expect(d.createdAt).toBe(NOW);
    expect(d.confidence).toBe(100);
    expect(d.reviewDate).toBe(addDays(NOW, 90));
    expect(d.review).toBeNull();
    expect(d.plan.horizon).toBe("90d");
    expect(d.id.startsWith("dec-")).toBe(true);
  });

  it("upsertDecision replaces the active (unreviewed) decision for the same path", () => {
    let tree = createTree(profile, gen, NOW);
    const d1 = createDecision(baseInput(), NOW);
    tree = upsertDecision(tree, d1);
    const d2 = createDecision(baseInput({ rationale: "改主意了" }), "2026-06-17T00:00:00.000Z");
    tree = upsertDecision(tree, d2);
    const forPath = tree.decisions.filter((d) => d.pathId === "p1");
    expect(forPath.length).toBe(1);
    expect(forPath[0].rationale).toBe("改主意了");
  });

  it("setPlan + togglePlanItem build and flip items", () => {
    const d = setPlan(createDecision(baseInput(), NOW), ["第一步", "第二步"], ["小试验"], true);
    expect(d.plan.steps.length).toBe(2);
    expect(d.plan.experiments.length).toBe(1);
    expect(d.plan.generatedByAI).toBe(true);
    const toggled = togglePlanItem(d, d.plan.steps[0].id);
    expect(toggled.plan.steps[0].done).toBe(true);
    expect(toggled.plan.steps[1].done).toBe(false);
  });

  it("recordReview attaches the review; dueDecisions respects today and review state", () => {
    let tree = createTree(profile, gen, NOW);
    const d = createDecision(baseInput(), NOW); // reviewDate = NOW + 90d
    tree = upsertDecision(tree, d);
    expect(dueDecisions(tree, "2026-07-01T00:00:00.000Z")).toHaveLength(0); // before reviewDate
    const due = dueDecisions(tree, addDays(NOW, 91));
    expect(due).toHaveLength(1);
    const reviewed = recordReview(d, {
      reviewedAt: addDays(NOW, 91), whatHappened: "成了", outcome: 4, lesson: "还行",
    });
    tree = upsertDecision(tree, reviewed);
    expect(dueDecisions(tree, addDays(NOW, 91))).toHaveLength(0); // reviewed -> not due
    expect(activeDecisionFor(tree, "p1")).toBeNull();
    expect(reviewedDecisionsFor(tree, "p1")).toHaveLength(1); // 复盘后归入"已复盘"
    expect(reviewedDecisionsFor(tree, "p1")[0].review?.outcome).toBe(4);
  });

  it("calibrationNote reacts to confidence vs outcome", () => {
    expect(calibrationNote(80, 1)).toContain("高");
    expect(calibrationNote(30, 5)).toContain("低估");
    expect(calibrationNote(50, 3)).toContain("挺准");
  });
});
