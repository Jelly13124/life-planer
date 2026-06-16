import { describe, it, expect } from "vitest";
import { layoutMap } from "@/components/mapLayout";
import type { LifeArea, LifePath, MetricPoint, PathNode } from "@/domain/types";

// ── 轻量 fixture：只填 layoutMap 用到的字段 ──
const emptyMetrics = {} as Record<LifeArea, MetricPoint[]>;

function node(age: number, title = `t${age}`): PathNode {
  return { age, title, story: "", mood: "mid", dimensions: ["career"] };
}

function path(over: Partial<LifePath> & Pick<LifePath, "id">): LifePath {
  return {
    id: over.id,
    choiceLabel: over.choiceLabel ?? "选择",
    kind: over.kind ?? "choice",
    summary: over.summary ?? "一句话结局",
    color: over.color ?? "#a78bfa",
    curve: over.curve ?? "rise-gentle",
    endValue: over.endValue ?? 60,
    nodes: over.nodes ?? [node(28), node(32), node(36), node(40)],
    metrics: emptyMetrics,
    parentId: over.parentId ?? null,
    forkAge: over.forkAge ?? 26,
    scenario: over.scenario ?? "likely",
  };
}

const START_AGE = 26;
const HORIZON = 15;

describe("layoutMap", () => {
  it("filters to scenario === 'likely'", () => {
    const paths = [
      path({ id: "a", scenario: "likely" }),
      path({ id: "b", scenario: "optimistic" }),
      path({ id: "c", scenario: "conservative" }),
    ];
    const layout = layoutMap(paths, START_AGE, HORIZON);
    expect(layout.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("X is monotonic in age (later age → larger x)", () => {
    const layout = layoutMap([path({ id: "a" })], START_AGE, HORIZON);
    const xs = [
      layout.xFor(26),
      layout.xFor(30),
      layout.xFor(35),
      layout.xFor(41),
    ];
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
    // 每条路径上的节点 x 也随 age 单调
    const a = layout.items[0];
    for (let i = 1; i < a.nodes.length; i++) {
      expect(a.nodes[i].x).toBeGreaterThanOrEqual(a.nodes[i - 1].x);
    }
  });

  it("origin sits at startAge x and vertical mid", () => {
    const layout = layoutMap([path({ id: "a" })], START_AGE, HORIZON);
    expect(layout.origin.x).toBeCloseTo(layout.xFor(START_AGE), 5);
    expect(layout.minAge).toBe(START_AGE);
  });

  it("maxAge covers the latest node and at least startAge + horizon", () => {
    const layout = layoutMap(
      [path({ id: "a", nodes: [node(28), node(48)] })],
      START_AGE,
      HORIZON,
    );
    expect(layout.maxAge).toBe(48); // node beyond horizon extends axis
    const layout2 = layoutMap(
      [path({ id: "b", nodes: [node(28), node(30)] })],
      START_AGE,
      HORIZON,
    );
    expect(layout2.maxAge).toBe(START_AGE + HORIZON);
  });

  it("status-quo stays near vertical mid", () => {
    const layout = layoutMap(
      [
        path({ id: "sq", kind: "status-quo", curve: "flat" }),
        path({ id: "a", endValue: 90, curve: "rise-steep" }),
        path({ id: "b", endValue: 20, curve: "decline" }),
      ],
      START_AGE,
      HORIZON,
    );
    const sq = layout.items.find((i) => i.id === "sq")!;
    const mid = layout.height / 2;
    expect(Math.abs(sq.end.y - mid)).toBeLessThan(40);
    expect(Math.abs(sq.start.y - mid)).toBeLessThan(40);
  });

  it("lanes stay within [topY, bottomY] bounds", () => {
    // 多条同分 → 自然重叠，触发间距/回收逻辑
    const paths = Array.from({ length: 6 }, (_, i) =>
      path({ id: `p${i}`, endValue: 50 + i }),
    );
    const layout = layoutMap(paths, START_AGE, HORIZON, {
      height: 560,
      padTop: 64,
      padBottom: 64,
    });
    const top = 64;
    const bottom = 560 - 64;
    for (const it of layout.items) {
      expect(it.start.y).toBeGreaterThanOrEqual(top - 0.5);
      expect(it.start.y).toBeLessThanOrEqual(bottom + 0.5);
      expect(it.end.y).toBeGreaterThanOrEqual(top - 0.5);
      expect(it.end.y).toBeLessThanOrEqual(bottom + 0.5);
    }
  });

  it("child path starts near its parent's curve at the fork age", () => {
    const parent = path({
      id: "root",
      endValue: 80,
      curve: "rise-gentle",
      forkAge: 26,
      nodes: [node(26), node(34), node(41)],
    });
    const child = path({
      id: "kid",
      parentId: "root",
      forkAge: 34,
      curve: "rise-steep",
      nodes: [node(34), node(38), node(43)],
    });
    const layout = layoutMap([parent, child], START_AGE, HORIZON);
    const p = layout.items.find((i) => i.id === "root")!;
    const k = layout.items.find((i) => i.id === "kid")!;

    // child 起点 x 在父分叉年龄处
    expect(k.start.x).toBeCloseTo(layout.xFor(34), 5);
    // child 起点 y ≈ 父曲线在该 x 处的插值（沿父 start→end 直线）
    const t = (k.start.x - p.start.x) / (p.end.x - p.start.x);
    const parentYAtFork = p.start.y + (p.end.y - p.start.y) * t;
    expect(Math.abs(k.start.y - parentYAtFork)).toBeLessThan(1);
    // child depth = 1
    expect(k.depth).toBe(1);
    expect(p.depth).toBe(0);
  });

  it("emits a smooth cubic dPath for every item", () => {
    const layout = layoutMap(
      [path({ id: "a" }), path({ id: "sq", kind: "status-quo", curve: "flat" })],
      START_AGE,
      HORIZON,
    );
    for (const it of layout.items) {
      expect(it.dPath.startsWith("M")).toBe(true);
      expect(it.dPath).toContain("C");
    }
  });

  it("siblings fan out on opposite sides of the fork", () => {
    const parent = path({ id: "root", forkAge: 26, nodes: [node(26), node(41)] });
    const c1 = path({ id: "c1", parentId: "root", forkAge: 33, nodes: [node(33), node(41)] });
    const c2 = path({ id: "c2", parentId: "root", forkAge: 33, nodes: [node(33), node(41)] });
    const layout = layoutMap([parent, c1, c2], START_AGE, HORIZON);
    const a = layout.items.find((i) => i.id === "c1")!;
    const b = layout.items.find((i) => i.id === "c2")!;
    // 一个在分叉点上方、一个在下方
    expect(Math.sign(a.end.y - a.start.y)).not.toBe(Math.sign(b.end.y - b.start.y));
  });
});
