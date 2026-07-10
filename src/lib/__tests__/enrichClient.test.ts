import { describe, it, expect } from "vitest";
import { allDecisionStyleTypes } from "@/domain/decisionStyle";
import { buildDecisionStyleContext } from "@/lib/enrich";
import { applyEnrichment, buildEnrichmentRequest, type EnrichResult } from "@/lib/enrichClient";
import { buildOnboardingProfile } from "@/lib/onboardingProfile";
import type { LifeArea, LifePath, LifeTree, MetricPoint, Profile } from "@/domain/types";

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

describe("decision-style AI boundary", () => {
  const summary = {
    version: 2 as const,
    source: "full" as const,
    code: "FDBG" as const,
    scores: { tempo: 76, focus: 64, engine: 82, drive: 91 },
    completedAt: "2026-07-10T09:00:00.000Z",
  };

  const profile: Profile = {
    name: "Ming", age: 28, education: "bachelor", major: "", occupation: "", salary: "5to10",
    hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "single", location: "", status: "",
    snapshot: "", areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 }, crossroad: "",
    riskAppetite: "conservative", decisionStyle: summary,
  };

  it("adds only numeric self-reported v2 tendencies and guardrails to AI context", () => {
    const context = buildDecisionStyleContext(summary);

    expect(context).toContain("tempo: 76/100");
    expect(context).toContain("focus: 64/100");
    expect(context).toContain("engine: 82/100");
    expect(context).toContain("drive: 91/100");
    expect(context).toContain("self-reported decision style summary");
    expect(context).toContain("not a fact, personality assessment, or judgment");
    expect(context).toContain("location, occupation, identity, finances, relationships, illness, or future events");
    for (const forbidden of [...allDecisionStyleTypes().map((type) => type.label), "answers", "tieBreaks", "evidence", "localDetail"]) {
      expect(context).not.toContain(forbidden);
    }
    expect(buildDecisionStyleContext({ ...summary, version: 1 } as never)).toBe("");
  });

  it.each([
    ["quick", "balanced"],
    ["full", "aggressive"],
  ] as const)("preserves a user-selected risk appetite through onboarding construction for %s summaries", (source, riskAppetite) => {
    const onboardingProfile = buildOnboardingProfile({
      name: "Ming",
      age: 28,
      education: "bachelor",
      major: "",
      location: "",
      nationality: undefined,
      occupation: "",
      salary: "5to10",
      hasSideHustle: false,
      sideHustle: "",
      hobbies: "",
      relationship: "single",
      status: "",
      crossroad: "",
      skills: undefined,
      savings: undefined,
      debt: undefined,
      assets: undefined,
      family: undefined,
      riskAppetite,
      decisionStyle: { ...summary, source },
    });
    const tree = {
      profile: onboardingProfile,
      horizonYears: 10,
    } as LifeTree;

    const request = buildEnrichmentRequest(tree, makePath({}));

    expect(request.profile.riskAppetite).toBe(riskAppetite);
    expect(request.profile.decisionStyle).toEqual({ ...summary, source });
  });

  it.each([
    [{ version: 2, source: "full", code: "FDBG", scores: null, completedAt: "2026-07-10T09:00:00.000Z" }],
    [{ version: 2, source: "full", code: "FDBG", completedAt: "2026-07-10T09:00:00.000Z" }],
    [{ version: 2, source: "full", code: "FDBG", scores: { tempo: 76, focus: 64, engine: 82 }, completedAt: "2026-07-10T09:00:00.000Z" }],
    [{ version: 2, source: "full", code: "FDBG", scores: { tempo: Number.NaN, focus: 64, engine: 82, drive: 91 }, completedAt: "2026-07-10T09:00:00.000Z" }],
    [{ version: 2, source: "full", code: "FDBG", scores: { tempo: 76, focus: 64, engine: 101, drive: Number.POSITIVE_INFINITY }, completedAt: "2026-07-10T09:00:00.000Z" }],
  ] as const)("returns no decision-style context and never throws for malformed v2 summaries: %j", (malformed) => {
    expect(() => buildDecisionStyleContext(malformed as never)).not.toThrow();
    expect(buildDecisionStyleContext(malformed as never)).toBe("");
  });

  it("whitelists the style summary in the client enrichment request", () => {
    const contaminatedProfile = {
      ...profile,
      decisionStyleLocalDetail: { secret: "device-only" },
      decisionStyle: {
        ...summary,
        label: "务实攻坚者",
        answers: [{ questionId: "tempo-1", value: 2 }],
        tieBreaks: { tempo: "a" },
        evidence: [{ questionId: "tempo-1" }],
        localDetail: { secret: "device-only" },
      },
    } as Profile;
    const tree = { profile: contaminatedProfile, horizonYears: 10 } as LifeTree;
    const body = JSON.stringify(buildEnrichmentRequest(tree, makePath({})));

    expect(JSON.parse(body).profile.decisionStyle).toEqual(summary);
    expect(body).not.toContain("tempo-1");
    expect(body).not.toContain("tieBreaks");
    expect(body).not.toContain("evidence");
    expect(body).not.toContain("localDetail");
    expect(body).not.toContain("decisionStyleLocalDetail");
    expect(body).not.toContain("务实攻坚者");
  });
});
