import { describe, it, expect } from "vitest";
import { firstRunSteps } from "@/domain/guide";
import { createTree } from "@/domain/tree";
import { createGoal, upsertGoal, setGoalActions } from "@/domain/goals";
import { setActionScheduledDate } from "@/domain/calendar";
import { completeAction } from "@/domain/daily";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { LifeTree, Profile } from "@/domain/types";

const profile: Profile = {
  name: "小林", age: 30, education: "bachelor", major: "视觉传达", occupation: "设计师",
  salary: "5to10", hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "dating",
  location: "杭州", status: "工作5年", snapshot: "设计师", crossroad: "",
  areas: { career: 50, wealth: 45, relationships: 55, health: 60, growth: 50 },
};
const gen = new LocalPathGenerator();
const NOW = "2026-06-19T00:00:00.000Z";
const DAY = "2026-06-20";

// 加一个长期目标（带一条行动），返回树 + 行动 id
function withLongGoal(): { tree: LifeTree; actionId: string } {
  let tree = createTree(profile, gen, NOW);
  let goal = createGoal({ area: "career", horizon: "long", title: "成为独立设计师", why: "" }, NOW);
  goal = setGoalActions(goal, ["攒作品集"]);
  tree = upsertGoal(tree, goal);
  return { tree, actionId: goal.actions[0].id };
}

describe("firstRunSteps", () => {
  it("空树 —— 三步全 false，allDone false", () => {
    const tree = createTree(profile, gen, NOW);
    expect(firstRunSteps(tree)).toEqual({
      hasLongGoal: false,
      hasScheduled: false,
      hasCompletion: false,
      allDone: false,
    });
  });

  it("有长期目标 —— hasLongGoal true（其余仍 false）", () => {
    const { tree } = withLongGoal();
    const steps = firstRunSteps(tree);
    expect(steps.hasLongGoal).toBe(true);
    expect(steps.hasScheduled).toBe(false);
    expect(steps.hasCompletion).toBe(false);
    expect(steps.allDone).toBe(false);
  });

  it("有行动排进了某天 —— hasScheduled true", () => {
    const { tree, actionId } = withLongGoal();
    const scheduled = setActionScheduledDate(tree, actionId, DAY);
    const steps = firstRunSteps(scheduled);
    expect(steps.hasLongGoal).toBe(true);
    expect(steps.hasScheduled).toBe(true);
    expect(steps.hasCompletion).toBe(false);
    expect(steps.allDone).toBe(false);
  });

  it("有完成记录 —— hasCompletion true", () => {
    const { tree, actionId } = withLongGoal();
    const completed = completeAction(tree, actionId, DAY);
    expect(firstRunSteps(completed).hasCompletion).toBe(true);
  });

  it("三步都走通 —— allDone true", () => {
    const { tree, actionId } = withLongGoal();
    let next = setActionScheduledDate(tree, actionId, DAY);
    next = completeAction(next, actionId, DAY);
    expect(firstRunSteps(next)).toEqual({
      hasLongGoal: true,
      hasScheduled: true,
      hasCompletion: true,
      allDone: true,
    });
  });
});
