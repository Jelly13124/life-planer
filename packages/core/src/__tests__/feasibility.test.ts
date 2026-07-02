import { describe, it, expect } from "vitest";
import { linkedGoals, pathProgress, effectiveFeasibility } from "@/domain/feasibility";
import type { Goal, LifePath, LifeTree, Metric, Profile, Task } from "@/domain/types";

// ── 测试用最小骨架（纯数据，不走生成器，保证确定性）──
const profile: Profile = {
  name: "小林",
  age: 30,
  education: "bachelor",
  major: "视觉传达",
  occupation: "设计师",
  salary: "5to10",
  hasSideHustle: false,
  sideHustle: "",
  hobbies: "",
  relationship: "dating",
  location: "杭州",
  status: "工作5年",
  snapshot: "设计师",
  crossroad: "",
  areas: { career: 50, wealth: 45, relationships: 55, health: 60, growth: 50 },
};

const NOW = "2026-06-23T00:00:00.000Z";

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
    feasibility: 50,
    ...over,
  };
}

function task(id: string, done: boolean): Task {
  return { id, text: id, done };
}

function metric(over: Partial<Metric> = {}): Metric {
  return { id: "m", label: "存款", current: 0, target: 100, unit: "k", ...over };
}

function longGoal(over: Partial<Goal> = {}): Goal {
  return {
    id: "g1",
    kind: "long",
    parentGoalId: null,
    area: "career",
    title: "目标",
    why: "",
    status: "active",
    createdAt: NOW,
    pathId: "p1",
    metrics: [],
    tasks: [],
    ...over,
  };
}

function tree(over: Partial<LifeTree> = {}): LifeTree {
  return {
    id: "t1",
    profile,
    horizonYears: 20,
    paths: [path()],
    decisions: [],
    goals: [],
    tasks: [],
    choices: [],
    activity: [],
    calendarFeeds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe("feasibility domain", () => {
  describe("linkedGoals", () => {
    it("returns active long goals whose pathId matches", () => {
      const goals: Goal[] = [
        longGoal({ id: "a", pathId: "p1" }),
        longGoal({ id: "b", pathId: "p2" }),
        longGoal({ id: "c", pathId: "p1", status: "done" }), // done → excluded
        { ...longGoal({ id: "d", pathId: "p1" }), kind: "short" }, // short → excluded
      ];
      const t = tree({ goals });
      const linked = linkedGoals(t, "p1");
      expect(linked.map((g) => g.id)).toEqual(["a"]);
    });

    it("returns [] when nothing is linked", () => {
      expect(linkedGoals(tree(), "p1")).toEqual([]);
    });
  });

  describe("pathProgress", () => {
    it("is 0 when no goals are linked", () => {
      expect(pathProgress(tree(), "p1")).toBe(0);
    });

    it("averages the goalProgress of the linked goals", () => {
      const goals: Goal[] = [
        // half done: 1 of 2 tasks
        longGoal({ id: "a", pathId: "p1", tasks: [task("t1", true), task("t2", false)] }),
        // fully done: both tasks
        longGoal({ id: "b", pathId: "p1", tasks: [task("t3", true), task("t4", true)] }),
      ];
      // avg(0.5, 1) = 0.75
      expect(pathProgress(tree({ goals }), "p1")).toBeCloseTo(0.75, 5);
    });

    it("ignores goals linked to other paths", () => {
      const goals: Goal[] = [
        longGoal({ id: "a", pathId: "p2", tasks: [task("t1", true)] }),
      ];
      expect(pathProgress(tree({ goals }), "p1")).toBe(0);
    });
  });

  describe("effectiveFeasibility", () => {
    it("returns null when path.feasibility is undefined", () => {
      const p = path({ feasibility: undefined });
      expect(effectiveFeasibility(tree({ paths: [p] }), p)).toBeNull();
    });

    it("no linked goals → bump 0, value = baseline", () => {
      const p = path({ feasibility: 50 });
      const eff = effectiveFeasibility(tree({ paths: [p] }), p);
      expect(eff).toEqual({ value: 50, baseline: 50, bump: 0, pathProgress: 0 });
    });

    it("half-done linked goal → bump ≈ 15", () => {
      const p = path({ id: "p1", feasibility: 50 });
      const goals: Goal[] = [
        longGoal({ id: "a", pathId: "p1", tasks: [task("t1", true), task("t2", false)] }),
      ];
      const eff = effectiveFeasibility(tree({ paths: [p], goals }), p)!;
      expect(eff.pathProgress).toBeCloseTo(0.5, 5);
      expect(eff.bump).toBe(15); // round(0.5 * 30)
      expect(eff.baseline).toBe(50);
      expect(eff.value).toBe(65);
    });

    it("fully done linked goal → bump 30, value = baseline + 30", () => {
      const p = path({ id: "p1", feasibility: 50 });
      const goals: Goal[] = [
        longGoal({ id: "a", pathId: "p1", tasks: [task("t1", true), task("t2", true)] }),
      ];
      const eff = effectiveFeasibility(tree({ paths: [p], goals }), p)!;
      expect(eff.bump).toBe(30);
      expect(eff.value).toBe(80);
    });

    it("caps value at min(95, baseline + 30)", () => {
      const p = path({ id: "p1", feasibility: 80 });
      const goals: Goal[] = [
        longGoal({ id: "a", pathId: "p1", tasks: [task("t1", true)] }), // fully done
      ];
      const eff = effectiveFeasibility(tree({ paths: [p], goals }), p)!;
      expect(eff.bump).toBe(30); // 80 + 30 = 110 → capped to 95
      expect(eff.value).toBe(95);
    });

    it("never exceeds 95 even with a high baseline", () => {
      const p = path({ id: "p1", feasibility: 90 });
      const goals: Goal[] = [
        longGoal({ id: "a", pathId: "p1", tasks: [task("t1", true)] }),
      ];
      const eff = effectiveFeasibility(tree({ paths: [p], goals }), p)!;
      expect(eff.value).toBe(95);
    });

    it("averages multiple linked goals before bumping", () => {
      const p = path({ id: "p1", feasibility: 40 });
      const goals: Goal[] = [
        // 0% (no done tasks)
        longGoal({ id: "a", pathId: "p1", tasks: [task("t1", false), task("t2", false)] }),
        // 100%
        longGoal({ id: "b", pathId: "p1", tasks: [task("t3", true)] }),
      ];
      const eff = effectiveFeasibility(tree({ paths: [p], goals }), p)!;
      expect(eff.pathProgress).toBeCloseTo(0.5, 5);
      expect(eff.bump).toBe(15);
      expect(eff.value).toBe(55);
    });

    it("counts achieved metrics toward progress (not just tasks)", () => {
      const p = path({ id: "p1", feasibility: 50 });
      const goals: Goal[] = [
        longGoal({
          id: "a",
          pathId: "p1",
          metrics: [metric({ current: 100, target: 100 })],
        }),
      ];
      const eff = effectiveFeasibility(tree({ paths: [p], goals }), p)!;
      expect(eff.pathProgress).toBe(1);
      expect(eff.bump).toBe(30);
    });
  });
});
