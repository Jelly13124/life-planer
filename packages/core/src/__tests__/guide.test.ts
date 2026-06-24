import { describe, it, expect } from "vitest";
import { firstRunSteps } from "@/domain/guide";
import { createTree } from "@/domain/tree";
import { addLongGoal, addTask } from "@/domain/goalTree";
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

// 加一个目标（带一个一次性任务），返回树 + 任务 id
function withGoal(): { tree: LifeTree; taskId: string } {
  let tree = createTree(profile, gen, NOW);
  const g = addLongGoal(tree, { area: "career", title: "成为独立设计师", why: "" }, NOW);
  tree = g.tree;
  const r = addTask(tree, g.id, "攒作品集", `${NOW}-task`);
  tree = r.tree;
  return { tree, taskId: r.id };
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

  it("有目标 —— hasLongGoal true（其余仍 false）", () => {
    const { tree } = withGoal();
    const steps = firstRunSteps(tree);
    expect(steps.hasLongGoal).toBe(true);
    expect(steps.hasScheduled).toBe(false);
    expect(steps.hasCompletion).toBe(false);
    expect(steps.allDone).toBe(false);
  });

  it("有任务排进了某天 —— hasScheduled true", () => {
    const { tree, taskId } = withGoal();
    const scheduled = setActionScheduledDate(tree, taskId, DAY);
    const steps = firstRunSteps(scheduled);
    expect(steps.hasLongGoal).toBe(true);
    expect(steps.hasScheduled).toBe(true);
    expect(steps.hasCompletion).toBe(false);
    expect(steps.allDone).toBe(false);
  });

  it("有完成记录 —— hasCompletion true", () => {
    const { tree, taskId } = withGoal();
    const completed = completeAction(tree, taskId, DAY);
    expect(firstRunSteps(completed).hasCompletion).toBe(true);
  });

  it("三步都走通 —— allDone true", () => {
    const { tree, taskId } = withGoal();
    let next = setActionScheduledDate(tree, taskId, DAY);
    next = completeAction(next, taskId, DAY);
    expect(firstRunSteps(next)).toEqual({
      hasLongGoal: true,
      hasScheduled: true,
      hasCompletion: true,
      allDone: true,
    });
  });
});
