import { describe, it, expect } from "vitest";
import { applyEnrichment, type EnrichResult } from "@/lib/enrichClient";
import type { LifeArea, LifePath, MetricPoint } from "@/domain/types";

const emptyMetrics = {} as Record<LifeArea, MetricPoint[]>;

function makePath(over: Partial<LifePath>): LifePath {
  return {
    id: over.id ?? "p1",
    choiceLabel: over.choiceLabel ?? "辞职做自媒体",
    kind: over.kind ?? "choice",
    summary: over.summary ?? "占位",
    color: over.color ?? "#a78bfa",
    curve: over.curve ?? "rise-gentle",
    endValue: over.endValue ?? 60,
    nodes: over.nodes ?? [
      { age: 30, title: "占位", story: "占位", mood: "mid", dimensions: ["career"] },
    ],
    metrics: emptyMetrics,
    parentId: over.parentId ?? null,
    forkAge: over.forkAge ?? 30,
    scenario: over.scenario ?? "likely",
  };
}

const CURRENT_AGE = 30;
const HORIZON = 15;

function result(forkDelayYears: number, ages: number[]): EnrichResult {
  return {
    forkDelayYears,
    summary: "三年后转型成功",
    nodes: ages.map((age) => ({
      age,
      title: `t${age}`,
      story: "三句话的具体故事，有人有数字有细节。",
      mood: "mid" as const,
      dimensions: ["career" as const],
    })),
  };
}

describe("applyEnrichment — AI decides the fork timing", () => {
  it("re-anchors a root choice's forkAge to currentAge + forkDelayYears", () => {
    const path = makePath({ parentId: null, kind: "choice", forkAge: 32 }); // 占位 32
    const r = result(3, [33, 36, 39, 42]); // AI 说 3 年后才分叉 → 起点 33
    const out = applyEnrichment(path, r, CURRENT_AGE, HORIZON);
    expect(out.forkAge).toBe(CURRENT_AGE + 3); // 33，覆盖了占位的 32
    expect(out.nodes[0].age).toBeGreaterThanOrEqual(33);
    expect(out.nodes[out.nodes.length - 1].age).toBeLessThanOrEqual(33 + HORIZON);
  });

  it("forkDelayYears = 0 means the path starts now", () => {
    const path = makePath({ parentId: null, kind: "choice", forkAge: 32 });
    const out = applyEnrichment(path, result(0, [30, 33, 37]), CURRENT_AGE, HORIZON);
    expect(out.forkAge).toBe(CURRENT_AGE);
  });

  it("does NOT retime a child branch (fork point was chosen at a node)", () => {
    const child = makePath({ parentId: "root", kind: "choice", forkAge: 38 });
    const out = applyEnrichment(child, result(5, [39, 42, 45]), CURRENT_AGE, HORIZON);
    expect(out.forkAge).toBe(38); // 子分支起点不动
  });

  it("does NOT retime status-quo", () => {
    const sq = makePath({ parentId: null, kind: "status-quo", forkAge: CURRENT_AGE });
    const out = applyEnrichment(sq, result(4, [31, 34, 38]), CURRENT_AGE, HORIZON);
    expect(out.forkAge).toBe(CURRENT_AGE);
  });

  it("clamps an out-of-range forkDelayYears", () => {
    const path = makePath({ parentId: null, kind: "choice" });
    const out = applyEnrichment(path, result(999, [40, 41, 42]), CURRENT_AGE, HORIZON);
    expect(out.forkAge).toBeLessThanOrEqual(CURRENT_AGE + 10);
    expect(out.forkAge).toBeGreaterThanOrEqual(CURRENT_AGE);
  });

  it("does NOT retime a non-likely (conservative) root choice", () => {
    const path = makePath({ parentId: null, kind: "choice", scenario: "conservative", forkAge: 32 });
    const out = applyEnrichment(path, result(5, [33, 36, 39, 42]), CURRENT_AGE, HORIZON);
    expect(out.forkAge).toBe(32); // conservative variant must inherit forkAge, not re-time
  });
});
