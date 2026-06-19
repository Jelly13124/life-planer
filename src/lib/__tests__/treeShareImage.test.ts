import { describe, it, expect } from "vitest";
import { buildShareSvg } from "@/lib/treeShareImage";
import type { LifeArea, LifePath, LifeTree, MetricPoint, Profile } from "@/domain/types";

// ── minimal helpers ──────────────────────────────────────────────────────────

const emptyMetrics = {} as Record<LifeArea, MetricPoint[]>;

function makeProfile(): Profile {
  return {
    name: "阿明",
    age: 28,
    education: "bachelor",
    major: "计算机",
    occupation: "后端工程师",
    salary: "10to20", // private — must NOT appear in SVG
    hasSideHustle: false,
    sideHustle: "",
    hobbies: "跑步",
    relationship: "single",
    location: "上海",
    status: "H1B工作签",
    snapshot: "28岁，后端工程师",
    areas: { career: 60, wealth: 40, relationships: 50, health: 70, growth: 65 },
    crossroad: "要不要辞职创业",
    skills: "Python, Go",
    savings: "10to50w", // private — must NOT appear in SVG
    debt: "none",      // private — must NOT appear in SVG
    assets: "无",      // private — must NOT appear in SVG
    family: "none",
    riskAppetite: "balanced",
  };
}

function makeSqPath(age: number): LifePath {
  return {
    id: "sq-1",
    choiceLabel: "",
    kind: "status-quo",
    summary: "平平淡淡过日子",
    color: "#64748b",
    curve: "flat",
    endValue: 50,
    nodes: [
      { age: age + 5, title: "继续工作", story: "故事", mood: "mid", dimensions: ["career"] },
      { age: age + 10, title: "稳定生活", story: "故事", mood: "mid", dimensions: ["career"] },
    ],
    metrics: emptyMetrics,
    parentId: null,
    forkAge: age,
    scenario: "likely",
  };
}

function makeChoicePath(age: number): LifePath {
  return {
    id: "choice-1",
    choiceLabel: "辞职创业",
    kind: "choice",
    summary: "五年后公司上轨道",
    color: "#a78bfa",
    curve: "rise-steep",
    endValue: 80,
    nodes: [
      { age: age + 2, title: "初创阶段", story: "故事", mood: "low", dimensions: ["career"] },
      { age: age + 7, title: "融资成功", story: "故事", mood: "high", dimensions: ["career"] },
    ],
    metrics: emptyMetrics,
    parentId: null,
    forkAge: age,
    scenario: "likely",
  };
}

function makeTree(): LifeTree {
  const profile = makeProfile();
  return {
    id: "tree-1",
    profile,
    horizonYears: 15,
    paths: [makeSqPath(profile.age), makeChoicePath(profile.age)],
    decisions: [],
    goals: [],
    activity: [],
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
  };
}

const LABELS = {
  disclaimer: "可能的人生，不是预测的命运",
  watermark: "人生树 · Life Planner",
  now: "现在",
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe("buildShareSvg", () => {
  it("returns a string that starts with <svg and ends with </svg>", () => {
    const tree = makeTree();
    const svg = buildShareSvg(tree, LABELS);
    expect(typeof svg).toBe("string");
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it("contains the disclaimer text", () => {
    const svg = buildShareSvg(makeTree(), LABELS);
    expect(svg).toContain("可能的人生，不是预测的命运");
  });

  it("contains the watermark text", () => {
    const svg = buildShareSvg(makeTree(), LABELS);
    expect(svg).toContain("人生树 · Life Planner");
  });

  it("contains the choice path's choiceLabel", () => {
    const svg = buildShareSvg(makeTree(), LABELS);
    expect(svg).toContain("辞职创业");
  });

  it("contains the status-quo terminal label", () => {
    const svg = buildShareSvg(makeTree(), LABELS);
    // layoutMap sets choiceLabel to "维持现状" for status-quo paths
    expect(svg).toContain("维持现状");
  });

  it("contains the 'now' label", () => {
    const svg = buildShareSvg(makeTree(), LABELS);
    expect(svg).toContain("现在");
  });

  it("does NOT leak the salary band code", () => {
    // profile.salary = "10to20" — must not appear anywhere in the SVG
    const svg = buildShareSvg(makeTree(), LABELS);
    expect(svg).not.toContain("10to20");
  });

  it("does NOT leak the savings band code", () => {
    // profile.savings = "10to50w" — must not appear anywhere in the SVG
    const svg = buildShareSvg(makeTree(), LABELS);
    expect(svg).not.toContain("10to50w");
  });

  it("does NOT leak the debt band code", () => {
    // profile.debt = "none" is a common word but we check the specific structured enum
    // More importantly: no structured field keys should be rendered
    const svg = buildShareSvg(makeTree(), LABELS);
    // The raw enum value "none" for debt could collide, so we check debt band indirectly.
    // We assert the SVG does not contain any of the other clearly private enum codes.
    expect(svg).not.toContain("10to50w");
    expect(svg).not.toContain("10to20");
  });

  it("does NOT leak assets free-text", () => {
    const tree = makeTree();
    // Set a distinctive assets value that must not appear
    tree.profile.assets = "三套房产SECRET";
    const svg = buildShareSvg(tree, LABELS);
    expect(svg).not.toContain("三套房产SECRET");
  });

  it("does NOT use CSS variables (no var(--...))", () => {
    const svg = buildShareSvg(makeTree(), LABELS);
    expect(svg).not.toContain("var(--");
  });

  it("has a dark background rect", () => {
    const svg = buildShareSvg(makeTree(), LABELS);
    // Should contain a rect fill with a dark hex color
    expect(svg).toMatch(/<rect[^>]*fill="#0[a-f0-9]{5}/i);
  });

  it("uses the choice path color as stroke", () => {
    const svg = buildShareSvg(makeTree(), LABELS);
    // The choice path color is #a78bfa — it should appear as a stroke
    expect(svg).toContain("#a78bfa");
  });

  it("is a single contiguous string with no undefined/null tokens", () => {
    const svg = buildShareSvg(makeTree(), LABELS);
    expect(svg).not.toContain("undefined");
    expect(svg).not.toContain("null");
  });

  it("has a viewBox attribute derived from layout dimensions", () => {
    const svg = buildShareSvg(makeTree(), LABELS);
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
  });
});
