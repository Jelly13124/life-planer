import { describe, it, expect } from "vitest";
import {
  upsertGoal,
  linkGoalPath,
  goalById,
  goalProgress,
  completeGoal,
  achievedPathIds,
  dueGoalReviews,
  recordGoalReview,
  AREA_BUMP,
  daysUntilDeadline,
  addGoalTag,
  removeGoalTag,
  allTags,
} from "@/domain/goals";
import {
  addGoal,
  addHabit,
  addSubgoal,
  addTask,
  setMetric,
  updateTask,
  updateGoalById,
  removeGoalById,
} from "@/domain/goalTree";
import { createTree, addPath } from "@/domain/tree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { LifeTree, Metric, Profile } from "@/domain/types";

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
const NOW = "2026-06-18T00:00:00.000Z";
const base = (): LifeTree => createTree(profile, gen, NOW);

const metric = (over: Partial<Metric> = {}): Metric => ({
  id: "m",
  label: "存款",
  current: 0,
  target: 100,
  unit: "k",
  ...over,
});

describe("goals domain", () => {
  it("addGoal fills defaults", () => {
    const { tree, id } = addGoal(base(), { area: "career", title: "做到独当一面", why: "三年内" }, NOW);
    const g = goalById(tree, id)!;
    expect(g.status).toBe("active");
    expect(g.tasks).toEqual([]);
    expect(g.subgoals).toEqual([]);
    expect(g.metrics).toEqual([]);
    expect(g.habits).toEqual([]);
    expect(g.pathId).toBeNull();
    expect(g.createdAt).toBe(NOW);
    expect(g.id).toMatch(/^goal-/);
  });

  it("upsertGoal adds then replaces by id", () => {
    let t = base();
    const r = addGoal(t, { area: "health", title: "每周运动三次" }, NOW);
    t = r.tree;
    expect(t.goals).toHaveLength(1);
    t = upsertGoal(t, { ...goalById(t, r.id)!, title: "每周运动四次" });
    expect(t.goals).toHaveLength(1);
    expect(t.goals[0].title).toBe("每周运动四次");
  });

  it("goalProgress: done tasks ratio (goal-level tasks)", () => {
    let t = base();
    const r = addGoal(t, { area: "growth", title: "学英语" }, NOW);
    t = r.tree;
    const ids: string[] = [];
    for (const text of ["a", "b", "c", "d"]) {
      const a = addTask(t, r.id, null, text, `${NOW}-${text}`);
      t = a.tree;
      ids.push(a.id);
    }
    t = updateTask(t, ids[0], { done: true });
    expect(goalProgress(t, goalById(t, r.id)!)).toBeCloseTo(0.25, 5);
  });

  it("goalProgress: composite over tasks + metrics + subgoals", () => {
    let t = base();
    const r = addGoal(t, { area: "career", title: "转管理岗" }, NOW);
    t = r.tree;
    // 1 goal-level task (done) + 1 metric (achieved) + 1 subgoal (incomplete) → 2/3
    const a = addTask(t, r.id, null, "读两本书", NOW);
    t = updateTask(a.tree, a.id, { done: true });
    t = setMetric(t, r.id, metric({ id: "m1", current: 100, target: 100 })); // achieved
    const s = addSubgoal(t, r.id, "带一个小项目", NOW);
    t = s.tree;
    // give the subgoal one undone task → subgoal incomplete
    const st = addTask(t, r.id, s.id, "招一个人", NOW);
    t = st.tree;
    expect(goalProgress(t, goalById(t, r.id)!)).toBeCloseTo(2 / 3, 5);
  });

  it("goalProgress: a subgoal counts as complete when all its tasks done & metrics achieved", () => {
    let t = base();
    const r = addGoal(t, { area: "career", title: "L" }, NOW);
    t = r.tree;
    const s = addSubgoal(t, r.id, "子目标", NOW);
    t = s.tree;
    const st = addTask(t, r.id, s.id, "x", NOW);
    t = updateTask(st.tree, st.id, { done: true });
    t = setMetric(t, s.id, metric({ id: "sm", current: 5, target: 5 }));
    // only unit = 1 subgoal, complete → progress 1
    expect(goalProgress(t, goalById(t, r.id)!)).toBe(1);
  });

  it("goalProgress: empty subgoal is not complete", () => {
    const r = addGoal(base(), { area: "career", title: "L" }, NOW);
    const s = addSubgoal(r.tree, r.id, "空子目标", NOW);
    expect(goalProgress(s.tree, goalById(s.tree, r.id)!)).toBe(0);
  });

  it("goalProgress: metric achieved when current >= target", () => {
    let t = base();
    const r = addGoal(t, { area: "wealth", title: "存钱" }, NOW);
    t = r.tree;
    t = setMetric(t, r.id, metric({ id: "m1", current: 60, target: 100 })); // not yet
    expect(goalProgress(t, goalById(t, r.id)!)).toBe(0);
    t = setMetric(t, r.id, metric({ id: "m1", current: 120, target: 100 })); // over → achieved
    expect(goalProgress(t, goalById(t, r.id)!)).toBe(1);
  });

  it("goalProgress: habits are excluded from milestone progress", () => {
    const r = addGoal(base(), { area: "growth", title: "学英语" }, NOW);
    // a goal with ONLY habits has no milestone units → progress 0
    let t = addHabit(r.tree, r.id, null, "每天背单词", "daily", undefined, NOW).tree;
    expect(goalProgress(t, goalById(t, r.id)!)).toBe(0);
    // add one done task → 1/1 (habit still ignored)
    const a = addTask(t, r.id, null, "写完简历", NOW);
    t = updateTask(a.tree, a.id, { done: true });
    expect(goalProgress(t, goalById(t, r.id)!)).toBe(1);
  });

  it("goalProgress: zero when nothing measurable", () => {
    const r = addGoal(base(), { area: "growth", title: "空目标" }, NOW);
    expect(goalProgress(r.tree, goalById(r.tree, r.id)!)).toBe(0);
  });

  it("completeGoal: bumps its area (clamped) and marks done", () => {
    let t = base(); // career = 50
    const r = addGoal(t, { area: "career", title: "L" }, NOW);
    t = r.tree;
    t = completeGoal(t, r.id, "2026-07-01T00:00:00.000Z");
    expect(goalById(t, r.id)!.status).toBe("done");
    expect(goalById(t, r.id)!.completedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(t.profile.areas.career).toBe(50 + AREA_BUMP);
  });

  it("completeGoal: area bump clamps at 100", () => {
    let t = base();
    t = { ...t, profile: { ...t.profile, areas: { ...t.profile.areas, wealth: 96 } } };
    const r = addGoal(t, { area: "wealth", title: "L" }, NOW);
    t = r.tree;
    t = completeGoal(t, r.id, NOW);
    expect(t.profile.areas.wealth).toBe(100);
  });

  it("completeGoal: a done goal is a no-op (no double bump)", () => {
    let t = base();
    const r = addGoal(t, { area: "career", title: "L" }, NOW);
    t = completeGoal(r.tree, r.id, NOW);
    const after = completeGoal(t, r.id, "2026-08-01T00:00:00.000Z");
    expect(after.profile.areas.career).toBe(50 + AREA_BUMP); // not bumped twice
  });

  it("linkGoalPath sets pathId; achievedPathIds collects done goals' paths", () => {
    let t = addPath(base(), "去读研", gen, NOW);
    const branch = t.paths.find((p) => p.kind === "choice")!;
    const r = addGoal(t, { area: "career", title: "读研" }, NOW);
    t = r.tree;
    t = linkGoalPath(t, r.id, branch.id);
    expect(goalById(t, r.id)!.pathId).toBe(branch.id);
    expect(achievedPathIds(t).size).toBe(0); // 还没达成
    t = completeGoal(t, r.id, NOW);
    expect(achievedPathIds(t).has(branch.id)).toBe(true);
  });

  it("removeGoalById removes the goal, its subgoals/tasks, and its branch", () => {
    let t = addPath(base(), "去读研", gen, NOW);
    const branch = t.paths.find((p) => p.kind === "choice")!;
    const r = addGoal(t, { area: "career", title: "读研", pathId: branch.id }, NOW);
    t = r.tree;
    const s = addSubgoal(t, r.id, "考雅思", NOW);
    t = s.tree;
    t = removeGoalById(t, r.id, NOW);
    expect(t.goals).toHaveLength(0); // 目标 + 子目标都没了
    expect(t.paths.some((p) => p.id === branch.id)).toBe(false); // 分支也删了
  });

  it("dueGoalReviews: active goal never reviewed is due; reviewed within 7d is not", () => {
    let t = base();
    const a = addGoal(t, { area: "career", title: "A" }, "2026-06-01T00:00:00.000Z");
    t = a.tree;
    const b = addGoal(t, { area: "career", title: "B" }, "2026-06-01T00:00:00.000Z");
    t = b.tree;
    t = recordGoalReview(t, b.id, "2026-06-16T00:00:00.000Z"); // 2 天前复盘过
    const due = dueGoalReviews(t, "2026-06-18T00:00:00.000Z");
    expect(due.map((g) => g.id)).toEqual([a.id]); // 只有从没复盘过的 A
  });

  it("dueGoalReviews: a review older than 7 days becomes due again", () => {
    let t = base();
    const r = addGoal(t, { area: "career", title: "G" }, "2026-05-01T00:00:00.000Z");
    t = r.tree;
    t = recordGoalReview(t, r.id, "2026-06-01T00:00:00.000Z"); // 17 天前
    expect(dueGoalReviews(t, "2026-06-18T00:00:00.000Z").map((x) => x.id)).toEqual([r.id]);
  });

  it("done goals are not due for review", () => {
    let t = base();
    const r = addGoal(t, { area: "career", title: "G" }, NOW);
    t = completeGoal(r.tree, r.id, NOW);
    expect(dueGoalReviews(t, "2027-01-01T00:00:00.000Z")).toHaveLength(0);
  });

  describe("goal date range (endDate)", () => {
    it("updateGoalById sets an endDate on a goal", () => {
      let t = base();
      const r = addGoal(t, { area: "career", title: "交报告" }, NOW);
      t = updateGoalById(r.tree, r.id, { endDate: "2026-07-01" });
      expect(goalById(t, r.id)!.endDate).toBe("2026-07-01");
    });

    it("updateGoalById clears an endDate when set to undefined", () => {
      let t = base();
      const r = addGoal(t, { area: "career", title: "交报告", endDate: "2026-07-01" }, NOW);
      t = updateGoalById(r.tree, r.id, { endDate: undefined });
      expect(goalById(t, r.id)!.endDate).toBeUndefined();
    });

    it("updateGoalById supports startDate + endDate together", () => {
      let t = base();
      const r = addGoal(t, { area: "career", title: "季度冲刺" }, NOW);
      t = updateGoalById(r.tree, r.id, { startDate: "2026-06-01", endDate: "2026-09-01" });
      expect(goalById(t, r.id)!.startDate).toBe("2026-06-01");
      expect(goalById(t, r.id)!.endDate).toBe("2026-09-01");
    });
  });

  describe("daysUntilDeadline (endDate)", () => {
    it("returns null when goal has no endDate", () => {
      const g = addGoal(base(), { area: "career", title: "X" }, NOW);
      expect(daysUntilDeadline(goalById(g.tree, g.id)!, "2026-06-20")).toBeNull();
    });

    it("returns positive number when endDate is in the future", () => {
      const r = addGoal(base(), { area: "career", title: "X", endDate: "2026-06-25" }, NOW);
      expect(daysUntilDeadline(goalById(r.tree, r.id)!, "2026-06-20")).toBe(5);
    });

    it("returns 0 when endDate is today", () => {
      const r = addGoal(base(), { area: "career", title: "X", endDate: "2026-06-20" }, NOW);
      expect(daysUntilDeadline(goalById(r.tree, r.id)!, "2026-06-20")).toBe(0);
    });

    it("returns negative number when endDate is in the past (overdue)", () => {
      const r = addGoal(base(), { area: "career", title: "X", endDate: "2026-06-15" }, NOW);
      expect(daysUntilDeadline(goalById(r.tree, r.id)!, "2026-06-20")).toBe(-5);
    });
  });

  describe("goal tags", () => {
    it("addGoalTag adds a tag to the correct goal", () => {
      let t = base();
      const r = addGoal(t, { area: "career", title: "T" }, NOW);
      t = addGoalTag(r.tree, r.id, "重要");
      expect(goalById(t, r.id)!.tags).toEqual(["重要"]);
    });

    it("addGoalTag trims whitespace before adding", () => {
      let t = base();
      const r = addGoal(t, { area: "career", title: "T" }, NOW);
      t = addGoalTag(r.tree, r.id, "  工作  ");
      expect(goalById(t, r.id)!.tags).toEqual(["工作"]);
    });

    it("addGoalTag deduplicates — adding same tag twice is a no-op the second time", () => {
      let t = base();
      const r = addGoal(t, { area: "career", title: "T" }, NOW);
      t = addGoalTag(r.tree, r.id, "重要");
      t = addGoalTag(t, r.id, "重要");
      expect(goalById(t, r.id)!.tags).toEqual(["重要"]);
    });

    it("addGoalTag ignores empty / whitespace-only tags", () => {
      let t = base();
      const r = addGoal(t, { area: "career", title: "T" }, NOW);
      t = addGoalTag(r.tree, r.id, "   ");
      expect(goalById(t, r.id)!.tags ?? []).toEqual([]);
    });

    it("addGoalTag does not touch other goals", () => {
      let t = base();
      const g1 = addGoal(t, { area: "career", title: "A" }, NOW);
      t = g1.tree;
      const g2 = addGoal(t, { area: "health", title: "B" }, NOW);
      t = g2.tree;
      t = addGoalTag(t, g1.id, "健康");
      expect(goalById(t, g2.id)!.tags ?? []).toEqual([]);
    });

    it("removeGoalTag removes the tag from the goal", () => {
      let t = base();
      const r = addGoal(t, { area: "career", title: "T" }, NOW);
      t = addGoalTag(r.tree, r.id, "重要");
      t = addGoalTag(t, r.id, "紧急");
      t = removeGoalTag(t, r.id, "重要");
      expect(goalById(t, r.id)!.tags).toEqual(["紧急"]);
    });

    it("removeGoalTag on a non-existent tag is a no-op", () => {
      let t = base();
      const r = addGoal(t, { area: "career", title: "T" }, NOW);
      t = addGoalTag(r.tree, r.id, "重要");
      t = removeGoalTag(t, r.id, "不存在");
      expect(goalById(t, r.id)!.tags).toEqual(["重要"]);
    });

    it("allTags returns unique tags sorted across all goals", () => {
      let t = base();
      const g1 = addGoal(t, { area: "career", title: "A" }, NOW);
      t = g1.tree;
      const g2 = addGoal(t, { area: "health", title: "B" }, NOW);
      t = g2.tree;
      t = addGoalTag(t, g1.id, "重要");
      t = addGoalTag(t, g1.id, "工作");
      t = addGoalTag(t, g2.id, "重要"); // duplicate across goals
      t = addGoalTag(t, g2.id, "健康");
      expect(allTags(t)).toEqual(["健康", "工作", "重要"]); // sorted, deduped
    });

    it("allTags returns empty array when no goals have tags", () => {
      expect(allTags(base())).toEqual([]);
    });
  });
});
