import { describe, expect, it } from "vitest";
import {
  addGoal,
  addHabit,
  addSubgoal,
  addTask,
  allHabits,
  allMetrics,
  allTasks,
  bumpMetric,
  findHabit,
  findItem,
  findTask,
  removeGoalById,
  removeItem,
  removeMetric,
  setMetric,
  updateGoalById,
  updateHabit,
  updateTask,
} from "../goalTree";
import { createTree, addPath } from "../tree";
import { LocalPathGenerator } from "../generator/localGenerator";
import type { Goal, LifeTree, Metric, Profile } from "../types";

const NOW = "2026-06-20T00:00:00.000Z";

// 最小可用 tree：只填 goalTree 关心的字段；其余用空壳满足类型。
function makeTree(goals: Goal[], activity: LifeTree["activity"] = []): LifeTree {
  return {
    id: "tree-test",
    profile: {} as Profile,
    horizonYears: 15,
    paths: [],
    decisions: [],
    goals,
    activity,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: "g1",
  area: "career",
  title: "目标",
  why: "",
  status: "active",
  createdAt: NOW,
  metrics: [],
  subgoals: [],
  tasks: [],
  habits: [],
  ...over,
});

describe("goalTree reads", () => {
  it("allTasks / allHabits flatten goal-level and subgoal-level items with ownership chain", () => {
    const tree = makeTree([
      goal({
        id: "g1",
        tasks: [{ id: "gt1", text: "目标任务", done: false }],
        habits: [{ id: "gh1", text: "目标习惯", repeat: "daily" }],
        subgoals: [
          {
            id: "s1",
            title: "子目标",
            metrics: [],
            tasks: [{ id: "st1", text: "子任务", done: false }],
            habits: [{ id: "sh1", text: "子习惯", repeat: "weekly", repeatWeekday: 1 }],
          },
        ],
      }),
    ]);
    const tasks = allTasks(tree);
    expect(tasks.map((t) => t.task.id).sort()).toEqual(["gt1", "st1"]);
    expect(tasks.find((t) => t.task.id === "gt1")?.subgoal).toBeNull();
    expect(tasks.find((t) => t.task.id === "st1")?.subgoal?.id).toBe("s1");

    const habits = allHabits(tree);
    expect(habits.map((h) => h.habit.id).sort()).toEqual(["gh1", "sh1"]);
    expect(habits.find((h) => h.habit.id === "sh1")?.subgoal?.id).toBe("s1");
  });

  it("findTask / findHabit / findItem locate at goal-level and subgoal-level", () => {
    const tree = makeTree([
      goal({
        id: "g1",
        tasks: [{ id: "gt1", text: "x", done: false }],
        subgoals: [
          { id: "s1", title: "s", metrics: [], tasks: [], habits: [{ id: "sh1", text: "y", repeat: "daily" }] },
        ],
      }),
    ]);
    expect(findTask(tree, "gt1")?.goal.id).toBe("g1");
    expect(findTask(tree, "gt1")?.subgoal).toBeNull();
    expect(findHabit(tree, "sh1")?.subgoal?.id).toBe("s1");
    expect(findItem(tree, "gt1")?.kind).toBe("task");
    expect(findItem(tree, "sh1")?.kind).toBe("habit");
    expect(findItem(tree, "missing")).toBeNull();
  });

  it("allMetrics returns goal and subgoal owners", () => {
    const m1: Metric = { id: "m1", label: "存款", current: 0, target: 100, unit: "k" };
    const m2: Metric = { id: "m2", label: "里程", current: 1, target: 5, unit: "次" };
    const tree = makeTree([
      goal({
        id: "g1",
        metrics: [m1],
        subgoals: [{ id: "s1", title: "s", metrics: [m2], tasks: [], habits: [] }],
      }),
    ]);
    const metrics = allMetrics(tree);
    expect(metrics).toHaveLength(2);
    expect(metrics.find((x) => x.metric.id === "m1")?.owner.id).toBe("g1");
    expect(metrics.find((x) => x.metric.id === "m2")?.owner.id).toBe("s1");
  });
});

describe("goalTree writes — tasks / habits", () => {
  it("addTask at goal-level and subgoal-level returns a new id and is findable", () => {
    let tree = makeTree([goal({ id: "g1", subgoals: [{ id: "s1", title: "s", metrics: [], tasks: [], habits: [] }] })]);
    const a = addTask(tree, "g1", null, "目标级任务", NOW);
    tree = a.tree;
    expect(findTask(tree, a.id)?.subgoal).toBeNull();
    expect(findTask(tree, a.id)?.task.text).toBe("目标级任务");

    const b = addTask(tree, "g1", "s1", "子目标级任务", "2026-06-20T01:00:00.000Z");
    tree = b.tree;
    expect(findTask(tree, b.id)?.subgoal?.id).toBe("s1");
    expect(a.id).not.toBe(b.id);
  });

  it("addHabit weekly defaults weekday and daily omits it", () => {
    let tree = makeTree([goal({ id: "g1" })]);
    const w = addHabit(tree, "g1", null, "周复盘", "weekly", undefined, NOW);
    tree = w.tree;
    expect(findHabit(tree, w.id)?.habit.repeat).toBe("weekly");
    expect(findHabit(tree, w.id)?.habit.repeatWeekday).toBe(1);

    const d = addHabit(tree, "g1", null, "晨跑", "daily", undefined, "2026-06-20T02:00:00.000Z");
    tree = d.tree;
    expect(findHabit(tree, d.id)?.habit.repeatWeekday).toBeUndefined();
  });

  it("updateTask / updateHabit patch by id without changing id, at any level", () => {
    let tree = makeTree([
      goal({
        id: "g1",
        tasks: [{ id: "gt1", text: "x", done: false }],
        subgoals: [{ id: "s1", title: "s", metrics: [], tasks: [], habits: [{ id: "sh1", text: "y", repeat: "daily" }] }],
      }),
    ]);
    tree = updateTask(tree, "gt1", { done: true, scheduledDate: "2026-07-01" });
    expect(findTask(tree, "gt1")?.task.done).toBe(true);
    expect(findTask(tree, "gt1")?.task.scheduledDate).toBe("2026-07-01");

    tree = updateHabit(tree, "sh1", { startTime: "07:00", durationMin: 30 });
    expect(findHabit(tree, "sh1")?.habit.startTime).toBe("07:00");
    expect(findHabit(tree, "sh1")?.habit.durationMin).toBe(30);
  });

  it("removeItem deletes a task/habit anywhere and prunes activity ids", () => {
    const tree = makeTree(
      [
        goal({
          id: "g1",
          subgoals: [{ id: "s1", title: "s", metrics: [], tasks: [{ id: "st1", text: "x", done: false }], habits: [] }],
        }),
      ],
      [{ date: "2026-06-20", plannedActionIds: ["st1", "other"], completedActionIds: ["st1"] }],
    );
    const next = removeItem(tree, "st1");
    expect(findTask(next, "st1")).toBeNull();
    expect(next.activity[0].plannedActionIds).toEqual(["other"]);
    expect(next.activity[0].completedActionIds).toEqual([]);
  });
});

describe("goalTree writes — subgoals / metrics", () => {
  it("addSubgoal appends an empty subgoal under a goal", () => {
    let tree = makeTree([goal({ id: "g1" })]);
    const r = addSubgoal(tree, "g1", "新子目标", NOW);
    tree = r.tree;
    const g = tree.goals[0];
    expect(g.subgoals).toHaveLength(1);
    expect(g.subgoals[0].id).toBe(r.id);
    expect(g.subgoals[0].title).toBe("新子目标");
    expect(g.subgoals[0].tasks).toEqual([]);
  });

  it("setMetric upserts on a goal owner and a subgoal owner", () => {
    let tree = makeTree([goal({ id: "g1", subgoals: [{ id: "s1", title: "s", metrics: [], tasks: [], habits: [] }] })]);
    const m: Metric = { id: "m1", label: "存款", current: 0, target: 100, unit: "k" };
    tree = setMetric(tree, "g1", m);
    expect(tree.goals[0].metrics).toHaveLength(1);
    // update same id
    tree = setMetric(tree, "g1", { ...m, current: 50 });
    expect(tree.goals[0].metrics).toHaveLength(1);
    expect(tree.goals[0].metrics[0].current).toBe(50);
    // subgoal owner
    tree = setMetric(tree, "s1", { id: "m2", label: "次数", current: 0, target: 5, unit: "次" });
    expect(tree.goals[0].subgoals[0].metrics[0].id).toBe("m2");
  });

  it("removeMetric drops by id from the right owner", () => {
    let tree = makeTree([
      goal({ id: "g1", metrics: [{ id: "m1", label: "a", current: 0, target: 1, unit: "" }] }),
    ]);
    tree = removeMetric(tree, "g1", "m1");
    expect(tree.goals[0].metrics).toEqual([]);
  });

  it("bumpMetric clamps current to [0, target]", () => {
    let tree = makeTree([
      goal({ id: "g1", metrics: [{ id: "m1", label: "a", current: 8, target: 10, unit: "" }] }),
    ]);
    tree = bumpMetric(tree, "m1", 5);
    expect(tree.goals[0].metrics[0].current).toBe(10); // clamped to target
    tree = bumpMetric(tree, "m1", -20);
    expect(tree.goals[0].metrics[0].current).toBe(0); // clamped to 0
  });
});

describe("goalTree writes — goals", () => {
  it("addGoal creates an active goal with empty arrays and a goal- id", () => {
    const tree = makeTree([]);
    const r = addGoal(tree, { area: "wealth", title: "存钱", endDate: "2026-12-31" }, NOW);
    const g = r.tree.goals[0];
    expect(g.id).toBe(r.id);
    expect(g.id).toMatch(/^goal-/);
    expect(g.status).toBe("active");
    expect(g.endDate).toBe("2026-12-31");
    expect(g.metrics).toEqual([]);
    expect(g.subgoals).toEqual([]);
    expect(g.pathId).toBeNull();
  });

  it("updateGoalById patches fields but keeps id", () => {
    const tree = makeTree([goal({ id: "g1", title: "旧" })]);
    const next = updateGoalById(tree, "g1", { title: "新", status: "done" });
    expect(next.goals[0].id).toBe("g1");
    expect(next.goals[0].title).toBe("新");
    expect(next.goals[0].status).toBe("done");
  });

  it("removeGoalById cascades subgoals/tasks/habits and prunes their activity ids", () => {
    const tree = makeTree(
      [
        goal({
          id: "g1",
          tasks: [{ id: "gt1", text: "x", done: false }],
          subgoals: [{ id: "s1", title: "s", metrics: [], tasks: [{ id: "st1", text: "y", done: false }], habits: [{ id: "sh1", text: "z", repeat: "daily" }] }],
        }),
        goal({ id: "g2", tasks: [{ id: "other", text: "keep", done: false }] }),
      ],
      [{ date: "2026-06-20", plannedActionIds: ["gt1", "st1", "other"], completedActionIds: ["sh1", "other"] }],
    );
    const next = removeGoalById(tree, "g1", NOW);
    expect(next.goals.map((g) => g.id)).toEqual(["g2"]);
    expect(next.activity[0].plannedActionIds).toEqual(["other"]);
    expect(next.activity[0].completedActionIds).toEqual(["other"]);
  });

  it("removeGoalById with pathId prunes the linked tree branch via removePath", () => {
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
    const gen = new LocalPathGenerator();
    let tree = createTree(profile, gen, NOW);
    tree = addPath(tree, "辞职创业", gen, NOW);
    const branch = tree.paths[tree.paths.length - 1];
    const added = addGoal(tree, { area: "career", title: "创业", pathId: branch.id }, NOW);
    tree = added.tree;
    expect(tree.paths.some((p) => p.id === branch.id)).toBe(true);

    const next = removeGoalById(tree, added.id, NOW);
    expect(next.goals.some((g) => g.id === added.id)).toBe(false);
    expect(next.paths.some((p) => p.id === branch.id)).toBe(false); // branch pruned
  });
});
