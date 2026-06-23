import { describe, expect, it } from "vitest";
import {
  addHabit,
  addLongGoal,
  addLooseHabit,
  addLooseTask,
  addShortGoal,
  addStandaloneShortGoal,
  addTask,
  allHabits,
  allMetrics,
  allTasks,
  bumpMetric,
  findHabit,
  findItem,
  findTask,
  goalById,
  longGoals,
  removeGoalById,
  removeItem,
  removeMetric,
  setMetric,
  shortGoalsOf,
  standaloneShortGoals,
  updateGoalById,
  updateHabit,
  updateTask,
} from "../goalTree";
import { createTree, addPath } from "../tree";
import { LocalPathGenerator } from "../generator/localGenerator";
import type { Goal, Habit, LifeTree, Metric, Profile, Task } from "../types";

const NOW = "2026-06-20T00:00:00.000Z";

// 最小可用 tree：只填 goalTree 关心的字段；其余用空壳满足类型。
function makeTree(
  goals: Goal[],
  activity: LifeTree["activity"] = [],
  loose: { tasks?: Task[]; habits?: Habit[] } = {},
): LifeTree {
  return {
    id: "tree-test",
    profile: {} as Profile,
    horizonYears: 15,
    paths: [],
    decisions: [],
    goals,
    tasks: loose.tasks ?? [],
    habits: loose.habits ?? [],
    choices: [],
    activity,
    calendarFeeds: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const longGoal = (over: Partial<Goal> = {}): Goal => ({
  id: "g1",
  kind: "long",
  parentGoalId: null,
  area: "career",
  title: "长期目标",
  why: "",
  status: "active",
  createdAt: NOW,
  metrics: [],
  tasks: [],
  habits: [],
  ...over,
});

const shortGoal = (over: Partial<Goal> = {}): Goal => ({
  id: "s1",
  kind: "short",
  parentGoalId: "g1",
  area: "career",
  title: "短期目标",
  why: "",
  status: "active",
  createdAt: NOW,
  startDate: "2026-06-01",
  endDate: "2026-06-30",
  pathId: null,
  metrics: [],
  tasks: [],
  habits: [],
  ...over,
});

describe("goalTree reads", () => {
  it("allTasks / allHabits flatten items across long and short goals with owning goal", () => {
    const tree = makeTree([
      longGoal({ id: "g1", tasks: [{ id: "gt1", text: "长任务", done: false }], habits: [{ id: "gh1", text: "长习惯", repeat: "daily" }] }),
      shortGoal({ id: "s1", parentGoalId: "g1", tasks: [{ id: "st1", text: "短任务", done: false }], habits: [{ id: "sh1", text: "短习惯", repeat: "weekly", repeatWeekday: 1 }] }),
    ]);
    const tasks = allTasks(tree);
    expect(tasks.map((t) => t.task.id).sort()).toEqual(["gt1", "st1"]);
    expect(tasks.find((t) => t.task.id === "gt1")?.goal?.id).toBe("g1");
    expect(tasks.find((t) => t.task.id === "st1")?.goal?.id).toBe("s1");

    const habits = allHabits(tree);
    expect(habits.map((h) => h.habit.id).sort()).toEqual(["gh1", "sh1"]);
    expect(habits.find((h) => h.habit.id === "sh1")?.goal?.id).toBe("s1");
  });

  it("findTask / findHabit / findItem locate across goals", () => {
    const tree = makeTree([
      longGoal({ id: "g1", tasks: [{ id: "gt1", text: "x", done: false }] }),
      shortGoal({ id: "s1", parentGoalId: "g1", habits: [{ id: "sh1", text: "y", repeat: "daily" }] }),
    ]);
    expect(findTask(tree, "gt1")?.goal?.id).toBe("g1");
    expect(findHabit(tree, "sh1")?.goal?.id).toBe("s1");
    expect(findItem(tree, "gt1")?.kind).toBe("task");
    expect(findItem(tree, "sh1")?.kind).toBe("habit");
    expect(findItem(tree, "missing")).toBeNull();
  });

  it("allMetrics returns each metric with its owning goal", () => {
    const m1: Metric = { id: "m1", label: "存款", current: 0, target: 100, unit: "k" };
    const m2: Metric = { id: "m2", label: "里程", current: 1, target: 5, unit: "次" };
    const tree = makeTree([
      longGoal({ id: "g1", metrics: [m1] }),
      shortGoal({ id: "s1", parentGoalId: "g1", metrics: [m2] }),
    ]);
    const metrics = allMetrics(tree);
    expect(metrics).toHaveLength(2);
    expect(metrics.find((x) => x.metric.id === "m1")?.goal?.id).toBe("g1");
    expect(metrics.find((x) => x.metric.id === "m2")?.goal?.id).toBe("s1");
  });

  it("longGoals / shortGoalsOf / goalById partition the flat array by tier", () => {
    const tree = makeTree([
      longGoal({ id: "g1" }),
      longGoal({ id: "g2" }),
      shortGoal({ id: "s1", parentGoalId: "g1" }),
      shortGoal({ id: "s2", parentGoalId: "g1" }),
      shortGoal({ id: "s3", parentGoalId: "g2" }),
    ]);
    expect(longGoals(tree).map((g) => g.id).sort()).toEqual(["g1", "g2"]);
    expect(shortGoalsOf(tree, "g1").map((g) => g.id).sort()).toEqual(["s1", "s2"]);
    expect(shortGoalsOf(tree, "g2").map((g) => g.id)).toEqual(["s3"]);
    expect(goalById(tree, "s3")?.id).toBe("s3");
    expect(goalById(tree, "nope")).toBeNull();
  });
});

describe("goalTree writes — goals (two tiers)", () => {
  it("addLongGoal creates a kind:long goal with parentGoalId:null and a goal- id", () => {
    const tree = makeTree([]);
    const r = addLongGoal(tree, { area: "wealth", title: "存钱", endDate: "2026-12-31", pathId: "p1" }, NOW);
    const g = r.tree.goals[0];
    expect(g.id).toBe(r.id);
    expect(g.id).toMatch(/^goal-/);
    expect(g.kind).toBe("long");
    expect(g.parentGoalId).toBeNull();
    expect(g.status).toBe("active");
    expect(g.endDate).toBe("2026-12-31");
    expect(g.pathId).toBe("p1");
    expect(g.metrics).toEqual([]);
    expect(g.tasks).toEqual([]);
    expect(g.habits).toEqual([]);
  });

  it("addShortGoal links to parent long via parentGoalId and never carries a pathId", () => {
    let tree = makeTree([]);
    const long = addLongGoal(tree, { area: "health", title: "健康" }, NOW);
    tree = long.tree;
    const short = addShortGoal(tree, long.id, { area: "health", title: "减肥", startDate: "2026-06-01", endDate: "2026-06-30" }, NOW);
    tree = short.tree;
    const g = goalById(tree, short.id)!;
    expect(g.kind).toBe("short");
    expect(g.parentGoalId).toBe(long.id);
    expect(g.pathId).toBeNull();
    expect(g.startDate).toBe("2026-06-01");
    expect(g.endDate).toBe("2026-06-30");
    expect(shortGoalsOf(tree, long.id).map((s) => s.id)).toEqual([short.id]);
  });

  it("updateGoalById patches fields but keeps id", () => {
    const tree = makeTree([longGoal({ id: "g1", title: "旧" })]);
    const next = updateGoalById(tree, "g1", { title: "新", status: "done" });
    expect(next.goals[0].id).toBe("g1");
    expect(next.goals[0].title).toBe("新");
    expect(next.goals[0].status).toBe("done");
  });

  it("removeGoalById on a LONG cascades its short children + prunes all their activity ids", () => {
    const tree = makeTree(
      [
        longGoal({ id: "g1", tasks: [{ id: "gt1", text: "x", done: false }] }),
        shortGoal({ id: "s1", parentGoalId: "g1", tasks: [{ id: "st1", text: "y", done: false }], habits: [{ id: "sh1", text: "z", repeat: "daily" }] }),
        longGoal({ id: "g2", tasks: [{ id: "other", text: "keep", done: false }] }),
      ],
      [{ date: "2026-06-20", plannedActionIds: ["gt1", "st1", "other"], completedActionIds: ["sh1", "other"] }],
    );
    const next = removeGoalById(tree, "g1", NOW);
    // g1 + 其 short 子目标 s1 都被删；g2 留存。
    expect(next.goals.map((g) => g.id)).toEqual(["g2"]);
    expect(shortGoalsOf(next, "g1")).toEqual([]);
    // gt1/st1/sh1 的 activity 记录被清；other 保留。
    expect(next.activity[0].plannedActionIds).toEqual(["other"]);
    expect(next.activity[0].completedActionIds).toEqual(["other"]);
  });

  it("removeGoalById on a SHORT removes only itself + prunes its activity ids (parent untouched)", () => {
    const tree = makeTree(
      [
        longGoal({ id: "g1" }),
        shortGoal({ id: "s1", parentGoalId: "g1", tasks: [{ id: "st1", text: "y", done: false }] }),
        shortGoal({ id: "s2", parentGoalId: "g1", tasks: [{ id: "st2", text: "keep", done: false }] }),
      ],
      [{ date: "2026-06-20", plannedActionIds: ["st1", "st2"], completedActionIds: ["st1"] }],
    );
    const next = removeGoalById(tree, "s1", NOW);
    expect(next.goals.map((g) => g.id)).toEqual(["g1", "s2"]);
    expect(next.activity[0].plannedActionIds).toEqual(["st2"]);
    expect(next.activity[0].completedActionIds).toEqual([]);
  });

  it("removeGoalById on a long with pathId prunes the linked tree branch via removePath", () => {
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
    const added = addLongGoal(tree, { area: "career", title: "创业", pathId: branch.id }, NOW);
    tree = added.tree;
    expect(tree.paths.some((p) => p.id === branch.id)).toBe(true);

    const next = removeGoalById(tree, added.id, NOW);
    expect(next.goals.some((g) => g.id === added.id)).toBe(false);
    expect(next.paths.some((p) => p.id === branch.id)).toBe(false); // branch pruned
  });
});

describe("goalTree writes — tasks / habits", () => {
  it("addTask appends to a goal (long or short) and returns a findable new id", () => {
    let tree = makeTree([longGoal({ id: "g1" }), shortGoal({ id: "s1", parentGoalId: "g1" })]);
    const a = addTask(tree, "g1", "长任务", NOW);
    tree = a.tree;
    expect(findTask(tree, a.id)?.goal?.id).toBe("g1");
    expect(findTask(tree, a.id)?.task.text).toBe("长任务");

    const b = addTask(tree, "s1", "短任务", "2026-06-20T01:00:00.000Z");
    tree = b.tree;
    expect(findTask(tree, b.id)?.goal?.id).toBe("s1");
    expect(a.id).not.toBe(b.id);
  });

  it("addHabit weekly defaults weekday and daily omits it", () => {
    let tree = makeTree([longGoal({ id: "g1" })]);
    const w = addHabit(tree, "g1", "周复盘", "weekly", undefined, NOW);
    tree = w.tree;
    expect(findHabit(tree, w.id)?.habit.repeat).toBe("weekly");
    expect(findHabit(tree, w.id)?.habit.repeatWeekday).toBe(1);

    const d = addHabit(tree, "g1", "晨跑", "daily", undefined, "2026-06-20T02:00:00.000Z");
    tree = d.tree;
    expect(findHabit(tree, d.id)?.habit.repeatWeekday).toBeUndefined();
  });

  it("updateTask / updateHabit patch by id without changing id", () => {
    let tree = makeTree([
      longGoal({ id: "g1", tasks: [{ id: "gt1", text: "x", done: false }] }),
      shortGoal({ id: "s1", parentGoalId: "g1", habits: [{ id: "sh1", text: "y", repeat: "daily" }] }),
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
      [shortGoal({ id: "s1", parentGoalId: "g1", tasks: [{ id: "st1", text: "x", done: false }] })],
      [{ date: "2026-06-20", plannedActionIds: ["st1", "other"], completedActionIds: ["st1"] }],
    );
    const next = removeItem(tree, "st1");
    expect(findTask(next, "st1")).toBeNull();
    expect(next.activity[0].plannedActionIds).toEqual(["other"]);
    expect(next.activity[0].completedActionIds).toEqual([]);
  });
});

describe("goalTree writes — metrics", () => {
  it("setMetric upserts on a goal owner (insert then update same id)", () => {
    let tree = makeTree([longGoal({ id: "g1" })]);
    const m: Metric = { id: "m1", label: "存款", current: 0, target: 100, unit: "k" };
    tree = setMetric(tree, "g1", m);
    expect(tree.goals[0].metrics).toHaveLength(1);
    tree = setMetric(tree, "g1", { ...m, current: 50 });
    expect(tree.goals[0].metrics).toHaveLength(1);
    expect(tree.goals[0].metrics[0].current).toBe(50);
  });

  it("setMetric works on a short goal owner too", () => {
    let tree = makeTree([shortGoal({ id: "s1", parentGoalId: "g1" })]);
    tree = setMetric(tree, "s1", { id: "m2", label: "次数", current: 0, target: 5, unit: "次" });
    expect(tree.goals[0].metrics[0].id).toBe("m2");
  });

  it("removeMetric drops by id from the right goal", () => {
    let tree = makeTree([longGoal({ id: "g1", metrics: [{ id: "m1", label: "a", current: 0, target: 1, unit: "" }] })]);
    tree = removeMetric(tree, "g1", "m1");
    expect(tree.goals[0].metrics).toEqual([]);
  });

  it("bumpMetric clamps current to [0, target]", () => {
    let tree = makeTree([longGoal({ id: "g1", metrics: [{ id: "m1", label: "a", current: 8, target: 10, unit: "" }] })]);
    tree = bumpMetric(tree, "m1", 5);
    expect(tree.goals[0].metrics[0].current).toBe(10); // clamped to target
    tree = bumpMetric(tree, "m1", -20);
    expect(tree.goals[0].metrics[0].current).toBe(0); // clamped to 0
  });
});

describe("goalTree — loose (goal-less) tasks / habits", () => {
  it("addLooseTask lands in tree.tasks and surfaces via allTasks with goal:null", () => {
    let tree = makeTree([longGoal({ id: "g1", tasks: [{ id: "gt1", text: "目标任务", done: false }] })]);
    const r = addLooseTask(tree, "临时买菜", NOW);
    tree = r.tree;
    expect(r.id).toMatch(/^task-/);
    // 落在树根 tree.tasks，而非任何 goal。
    expect(tree.tasks.map((t) => t.id)).toEqual([r.id]);
    expect(tree.goals[0].tasks.map((t) => t.id)).toEqual(["gt1"]); // goal 任务不受影响
    // allTasks 同时含目标任务（goal=g1）与散任务（goal=null）。
    const tasks = allTasks(tree);
    expect(tasks.map((t) => t.task.id).sort()).toEqual([r.id, "gt1"].sort());
    expect(tasks.find((t) => t.task.id === "gt1")?.goal?.id).toBe("g1");
    expect(tasks.find((t) => t.task.id === r.id)?.goal).toBeNull();
  });

  it("addLooseHabit lands in tree.habits and surfaces via allHabits with goal:null", () => {
    let tree = makeTree([]);
    const d = addLooseHabit(tree, "上班", "daily", undefined, NOW);
    tree = d.tree;
    expect(d.id).toMatch(/^habit-/);
    expect(tree.habits.map((h) => h.id)).toEqual([d.id]);
    const habits = allHabits(tree);
    expect(habits).toHaveLength(1);
    expect(habits[0].habit.repeat).toBe("daily");
    expect(habits[0].goal).toBeNull();
    // weekly 散习惯默认锚定周一。
    const w = addLooseHabit(tree, "每周采购", "weekly", undefined, `${NOW}-w`);
    expect(w.tree.habits.find((h) => h.id === w.id)?.repeatWeekday).toBe(1);
  });

  it("findItem / findTask / findHabit resolve a loose id with goal:null", () => {
    let tree = makeTree([longGoal({ id: "g1" })]);
    const t = addLooseTask(tree, "买菜", NOW);
    tree = t.tree;
    const h = addLooseHabit(tree, "上班", "daily", undefined, `${NOW}-h`);
    tree = h.tree;
    expect(findTask(tree, t.id)?.goal).toBeNull();
    expect(findTask(tree, t.id)?.task.text).toBe("买菜");
    expect(findHabit(tree, h.id)?.goal).toBeNull();
    const item = findItem(tree, t.id);
    expect(item?.kind).toBe("task");
    expect(item?.goal).toBeNull();
    expect(findItem(tree, h.id)?.kind).toBe("habit");
  });

  it("updateTask patches a loose task in place (keeps id)", () => {
    let tree = makeTree([]);
    const t = addLooseTask(tree, "买菜", NOW);
    tree = updateTask(t.tree, t.id, { done: true, scheduledDate: "2026-07-01" });
    expect(tree.tasks[0].id).toBe(t.id);
    expect(tree.tasks[0].done).toBe(true);
    expect(tree.tasks[0].scheduledDate).toBe("2026-07-01");
  });

  it("updateHabit patches a loose habit in place (keeps id)", () => {
    let tree = makeTree([]);
    const h = addLooseHabit(tree, "上班", "daily", undefined, NOW);
    tree = updateHabit(h.tree, h.id, { startTime: "09:00", durationMin: 480 });
    expect(tree.habits[0].id).toBe(h.id);
    expect(tree.habits[0].startTime).toBe("09:00");
    expect(tree.habits[0].durationMin).toBe(480);
  });

  it("removeItem deletes a loose task and prunes its activity ids", () => {
    let tree = makeTree(
      [],
      [{ date: "2026-06-20", plannedActionIds: ["other"], completedActionIds: ["other"] }],
    );
    const t = addLooseTask(tree, "买菜", NOW);
    tree = t.tree;
    // 把它排进/勾掉当天，再删除应一并清掉。
    tree = {
      ...tree,
      activity: [
        { date: "2026-06-20", plannedActionIds: ["other", t.id], completedActionIds: ["other", t.id] },
      ],
    };
    const next = removeItem(tree, t.id);
    expect(next.tasks).toEqual([]);
    expect(findTask(next, t.id)).toBeNull();
    expect(next.activity[0].plannedActionIds).toEqual(["other"]);
    expect(next.activity[0].completedActionIds).toEqual(["other"]);
  });
});

describe("goalTree — standalone short goals (no long parent)", () => {
  it("addStandaloneShortGoal creates a parentless short; standaloneShortGoals returns it; longGoals excludes it", () => {
    const base = makeTree([longGoal({ id: "g1" })]);
    const r = addStandaloneShortGoal(base, { area: "health", title: "这周运动10小时", endDate: "2026-06-27" }, NOW);
    const tree = r.tree;
    const g = goalById(tree, r.id)!;
    expect(g.kind).toBe("short");
    expect(g.parentGoalId).toBeNull();
    expect(g.endDate).toBe("2026-06-27");
    // standaloneShortGoals 仅含无父短期目标。
    expect(standaloneShortGoals(tree).map((s) => s.id)).toEqual([r.id]);
    // longGoals 只含长期；不含此短期。
    expect(longGoals(tree).map((s) => s.id)).toEqual(["g1"]);
    // 它不挂在任何长期下（shortGoalsOf("g1") 不含它）。
    expect(shortGoalsOf(tree, "g1")).toEqual([]);
  });

  it("addShortGoal with null/empty parent creates a standalone short", () => {
    const tree = makeTree([]);
    const a = addShortGoal(tree, null, { area: "career", title: "无父短期" }, NOW);
    expect(goalById(a.tree, a.id)!.parentGoalId).toBeNull();
    const b = addShortGoal(a.tree, "", { area: "career", title: "空串父短期" }, `${NOW}-b`);
    expect(goalById(b.tree, b.id)!.parentGoalId).toBeNull();
    expect(standaloneShortGoals(b.tree).map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });
});
