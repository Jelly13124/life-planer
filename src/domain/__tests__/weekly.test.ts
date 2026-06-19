import { describe, it, expect } from "vitest";
import { weeklyRecap } from "@/domain/weekly";
import { createTree, addPath } from "@/domain/tree";
import { createGoal, upsertGoal, setGoalActions, completeGoal } from "@/domain/goals";
import { createDecision } from "@/domain/decisions";
import { completeAction } from "@/domain/daily";
import type { LifeTree, Profile } from "@/domain/types";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";

const profile: Profile = {
  name: "小林", age: 30, education: "bachelor", major: "设计", occupation: "设计师",
  salary: "5to10", hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "dating",
  location: "杭州", status: "工作5年", snapshot: "设计师", crossroad: "",
  areas: { career: 50, wealth: 45, relationships: 55, health: 60, growth: 50 },
};
const gen = new LocalPathGenerator();
const NOW = "2026-06-18T00:00:00.000Z";
const TODAY = "2026-06-18";

function makeBaseTree(): LifeTree {
  return createTree(profile, gen, NOW);
}

describe("weeklyRecap", () => {
  it("completions = sum of completedActionIds across the last 7 days", () => {
    let tree = makeBaseTree();
    let g = createGoal({ area: "growth", horizon: "short", title: "健身", why: "" }, NOW);
    g = setGoalActions(g, ["跑步", "俯卧撑", "拉伸"]);
    tree = upsertGoal(tree, g);
    const [a0, a1, a2] = g.actions.map((a) => a.id);

    // Day -5: 2 completions
    tree = completeAction(tree, a0, "2026-06-13");
    tree = completeAction(tree, a1, "2026-06-13");
    // Day -2: 1 completion
    tree = completeAction(tree, a2, "2026-06-16");
    // Day -8: outside window — should not count
    tree = completeAction(tree, a0, "2026-06-10");

    const recap = weeklyRecap(tree, TODAY);
    expect(recap.completions).toBe(3);
  });

  it("activeDays = count of days with ≥1 completion in the window", () => {
    let tree = makeBaseTree();
    let g = createGoal({ area: "growth", horizon: "short", title: "学习", why: "" }, NOW);
    g = setGoalActions(g, ["读书", "笔记"]);
    tree = upsertGoal(tree, g);
    const [a0, a1] = g.actions.map((a) => a.id);

    tree = completeAction(tree, a0, "2026-06-12"); // within window (day -6)
    tree = completeAction(tree, a1, "2026-06-12"); // same day, should count as 1
    tree = completeAction(tree, a0, "2026-06-15"); // another day

    const recap = weeklyRecap(tree, TODAY);
    expect(recap.activeDays).toBe(2);
  });

  it("streak uses currentStreak from daily.ts", () => {
    let tree = makeBaseTree();
    let g = createGoal({ area: "health", horizon: "short", title: "运动", why: "" }, NOW);
    g = setGoalActions(g, ["慢跑"]);
    tree = upsertGoal(tree, g);
    const a0 = g.actions[0].id;

    tree = completeAction(tree, a0, "2026-06-16");
    tree = completeAction(tree, a0, "2026-06-17");
    // today (2026-06-18) no completions — grace: streak counts from yesterday
    const recap = weeklyRecap(tree, TODAY);
    expect(recap.streak).toBe(2);
  });

  it("weekStart is today-6, weekEnd is today", () => {
    const tree = makeBaseTree();
    const recap = weeklyRecap(tree, TODAY);
    expect(recap.weekStart).toBe("2026-06-12");
    expect(recap.weekEnd).toBe(TODAY);
  });

  it("dueGoals returns goals due for review", () => {
    let tree = makeBaseTree();
    // Goal with no lastReviewedAt is immediately due
    const g = createGoal({ area: "career", horizon: "short", title: "升职", why: "" }, NOW);
    tree = upsertGoal(tree, g);

    const recap = weeklyRecap(tree, TODAY);
    expect(recap.dueGoals.some((x) => x.id === g.id)).toBe(true);
  });

  it("dueDecisions returns decisions whose reviewDate has passed", () => {
    let tree = makeBaseTree();
    tree = addPath(tree, "辞职创业", gen, NOW);
    const path = tree.paths.find((p) => p.kind === "choice")!;
    // Create decision with reviewDate = yesterday
    const decision = createDecision(
      {
        pathId: path.id,
        choiceLabel: "辞职创业",
        rationale: "想试试",
        expectation: "成功",
        confidence: 60,
        reversibility: "two-way",
        horizon: "30d",
      },
      "2026-05-18T00:00:00.000Z", // 31 days before today → reviewDate already past
    );
    tree = { ...tree, decisions: [...tree.decisions, decision] };

    const recap = weeklyRecap(tree, TODAY);
    expect(recap.dueDecisions.some((d) => d.id === decision.id)).toBe(true);
  });

  it("milestonesThisWeek includes long goals completed within the last 7 days", () => {
    let tree = makeBaseTree();
    tree = addPath(tree, "读完一本书", gen, NOW);
    const path = tree.paths.find((p) => p.kind === "choice")!;
    let g = createGoal(
      { area: "growth", horizon: "long", title: "读完一本书", why: "", pathId: path.id },
      NOW,
    );
    g = setGoalActions(g, ["第一章", "第二章"]);
    tree = upsertGoal(tree, g);

    // Complete the goal 2 days ago (within window)
    tree = completeGoal(tree, g.id, "2026-06-16T10:00:00.000Z");

    const recap = weeklyRecap(tree, TODAY);
    expect(recap.milestonesThisWeek.some((m) => m.id === g.id)).toBe(true);
  });

  it("milestonesThisWeek EXCLUDES long goals completed 10 days ago", () => {
    let tree = makeBaseTree();
    tree = addPath(tree, "学完课程", gen, NOW);
    const path = tree.paths.find((p) => p.kind === "choice")!;
    let g = createGoal(
      { area: "growth", horizon: "long", title: "学完课程", why: "", pathId: path.id },
      NOW,
    );
    g = setGoalActions(g, ["第一课"]);
    tree = upsertGoal(tree, g);

    // Complete the goal 10 days ago (outside 7-day window)
    tree = completeGoal(tree, g.id, "2026-06-08T10:00:00.000Z");

    const recap = weeklyRecap(tree, TODAY);
    expect(recap.milestonesThisWeek.some((m) => m.id === g.id)).toBe(false);
  });

  it("milestonesThisWeek includes goal completed exactly 6 days ago (boundary)", () => {
    let tree = makeBaseTree();
    tree = addPath(tree, "减重5公斤", gen, NOW);
    const path = tree.paths.find((p) => p.kind === "choice")!;
    let g = createGoal(
      { area: "health", horizon: "long", title: "减重5公斤", why: "", pathId: path.id },
      NOW,
    );
    g = setGoalActions(g, ["坚持节食"]);
    tree = upsertGoal(tree, g);

    // Completed exactly on weekStart (2026-06-12)
    tree = completeGoal(tree, g.id, "2026-06-12T00:00:00.000Z");

    const recap = weeklyRecap(tree, TODAY);
    expect(recap.milestonesThisWeek.some((m) => m.id === g.id)).toBe(true);
  });

  it("short goals are NOT included in milestonesThisWeek", () => {
    let tree = makeBaseTree();
    let g = createGoal({ area: "career", horizon: "short", title: "整理简历", why: "" }, NOW);
    g = setGoalActions(g, ["写自我介绍"]);
    tree = upsertGoal(tree, g);
    tree = completeGoal(tree, g.id, "2026-06-17T00:00:00.000Z");

    const recap = weeklyRecap(tree, TODAY);
    expect(recap.milestonesThisWeek.some((m) => m.id === g.id)).toBe(false);
  });

  it("empty tree returns all-zero recap with empty arrays", () => {
    const tree = makeBaseTree();
    const recap = weeklyRecap(tree, TODAY);
    expect(recap.completions).toBe(0);
    expect(recap.activeDays).toBe(0);
    expect(recap.dueGoals).toEqual([]);
    expect(recap.dueDecisions).toEqual([]);
    expect(recap.milestonesThisWeek).toEqual([]);
  });
});
