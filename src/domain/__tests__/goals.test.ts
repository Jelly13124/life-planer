import { describe, it, expect } from "vitest";
import {
  createGoal,
  upsertGoal,
  linkGoalPath,
  setGoalActions,
  toggleGoalAction,
  goalById,
  childGoals,
  goalProgress,
  completeGoal,
  dropGoal,
  achievedPathIds,
  dueGoalReviews,
  recordGoalReview,
  AREA_BUMP,
  setActionRepeat,
} from "@/domain/goals";
import { createTree, addPath } from "@/domain/tree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { LifeTree, Profile } from "@/domain/types";

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

describe("goals domain", () => {
  it("createGoal fills defaults", () => {
    const g = createGoal({ area: "career", horizon: "long", title: "做到独当一面", why: "三年内" }, NOW);
    expect(g.status).toBe("active");
    expect(g.actions).toEqual([]);
    expect(g.parentGoalId).toBeNull();
    expect(g.pathId).toBeNull();
    expect(g.createdAt).toBe(NOW);
    expect(g.id).toMatch(/^goal-/);
  });

  it("upsertGoal adds then replaces by id", () => {
    let t = base();
    const g = createGoal({ area: "health", horizon: "short", title: "每周运动三次", why: "" }, NOW);
    t = upsertGoal(t, g);
    expect(t.goals).toHaveLength(1);
    t = upsertGoal(t, { ...g, title: "每周运动四次" });
    expect(t.goals).toHaveLength(1);
    expect(t.goals[0].title).toBe("每周运动四次");
  });

  it("setGoalActions builds ids and drops blanks; toggle flips done", () => {
    const g = createGoal({ area: "growth", horizon: "short", title: "学英语", why: "" }, NOW);
    const g2 = setGoalActions(g, ["背 20 个词", "  ", "看一集美剧"]);
    expect(g2.actions.map((a) => a.text)).toEqual(["背 20 个词", "看一集美剧"]);
    expect(g2.actions[0].id).toBe(`${g.id}-a0`);
    expect(g2.actions[1].id).toBe(`${g.id}-a1`);
    const g3 = toggleGoalAction(g2, g2.actions[0].id);
    expect(g3.actions[0].done).toBe(true);
  });

  it("goalProgress: short = actions done ratio", () => {
    let g = createGoal({ area: "growth", horizon: "short", title: "学英语", why: "" }, NOW);
    g = setGoalActions(g, ["a", "b", "c", "d"]);
    g = toggleGoalAction(g, g.actions[0].id);
    const t = upsertGoal(base(), g);
    expect(goalProgress(t, g)).toBeCloseTo(0.25, 5);
  });

  it("goalProgress: long counts done children + own actions", () => {
    let t = base();
    let long = createGoal({ area: "career", horizon: "long", title: "转管理岗", why: "" }, NOW);
    long = setGoalActions(long, ["读两本书"]); // 1 own action
    t = upsertGoal(t, long);
    let kid1 = createGoal({ area: "career", horizon: "short", title: "带一个小项目", why: "", parentGoalId: long.id }, NOW);
    const kid2 = createGoal({ area: "career", horizon: "short", title: "做季度复盘", why: "", parentGoalId: long.id }, NOW);
    kid1 = { ...kid1, status: "done" };
    t = upsertGoal(upsertGoal(t, kid1), kid2);
    // 分母 = 2 children + 1 action = 3；分子 = 1 done child + 0 done action = 1
    expect(goalProgress(t, t.goals.find((g) => g.id === long.id)!)).toBeCloseTo(1 / 3, 5);
  });

  it("childGoals returns only the long goal's short children", () => {
    let t = base();
    const long = createGoal({ area: "career", horizon: "long", title: "L", why: "" }, NOW);
    const kid = createGoal({ area: "career", horizon: "short", title: "K", why: "", parentGoalId: long.id }, NOW);
    const orphan = createGoal({ area: "career", horizon: "short", title: "O", why: "" }, NOW);
    t = upsertGoal(upsertGoal(upsertGoal(t, long), kid), orphan);
    expect(childGoals(t, long.id).map((g) => g.title)).toEqual(["K"]);
  });

  it("completeGoal: long goal bumps its area (clamped) and marks done", () => {
    let t = base(); // career = 50
    const long = createGoal({ area: "career", horizon: "long", title: "L", why: "" }, NOW);
    t = upsertGoal(t, long);
    t = completeGoal(t, long.id, "2026-07-01T00:00:00.000Z");
    expect(goalById(t, long.id)!.status).toBe("done");
    expect(goalById(t, long.id)!.completedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(t.profile.areas.career).toBe(50 + AREA_BUMP);
  });

  it("completeGoal: area bump clamps at 100", () => {
    let t = base();
    t = { ...t, profile: { ...t.profile, areas: { ...t.profile.areas, wealth: 96 } } };
    const long = createGoal({ area: "wealth", horizon: "long", title: "L", why: "" }, NOW);
    t = upsertGoal(t, long);
    t = completeGoal(t, long.id, NOW);
    expect(t.profile.areas.wealth).toBe(100);
  });

  it("completeGoal: short goal marks done but does NOT bump area", () => {
    let t = base(); // career = 50
    const short = createGoal({ area: "career", horizon: "short", title: "S", why: "" }, NOW);
    t = upsertGoal(t, short);
    t = completeGoal(t, short.id, NOW);
    expect(goalById(t, short.id)!.status).toBe("done");
    expect(t.profile.areas.career).toBe(50);
  });

  it("linkGoalPath sets pathId; achievedPathIds collects done long goals' paths", () => {
    let t = addPath(base(), "去读研", gen, NOW);
    const branch = t.paths.find((p) => p.kind === "choice")!;
    const long = createGoal({ area: "career", horizon: "long", title: "读研", why: "" }, NOW);
    t = upsertGoal(t, long);
    t = linkGoalPath(t, long.id, branch.id);
    expect(goalById(t, long.id)!.pathId).toBe(branch.id);
    expect(achievedPathIds(t).size).toBe(0); // 还没达成
    t = completeGoal(t, long.id, NOW);
    expect(achievedPathIds(t).has(branch.id)).toBe(true);
  });

  it("dropGoal removes the goal, its short children, and its branch", () => {
    let t = addPath(base(), "去读研", gen, NOW);
    const branch = t.paths.find((p) => p.kind === "choice")!;
    const long = createGoal({ area: "career", horizon: "long", title: "读研", why: "", pathId: branch.id }, NOW);
    t = upsertGoal(t, long);
    const kid = createGoal({ area: "career", horizon: "short", title: "考雅思", why: "", parentGoalId: long.id }, NOW);
    t = upsertGoal(t, kid);
    t = dropGoal(t, long.id, NOW);
    expect(t.goals).toHaveLength(0); // 长期目标 + 子目标都没了
    expect(t.paths.some((p) => p.id === branch.id)).toBe(false); // 分支也删了
  });

  it("dueGoalReviews: active goal never reviewed is due; reviewed within 7d is not", () => {
    let t = base();
    const a = createGoal({ area: "career", horizon: "short", title: "A", why: "" }, "2026-06-01T00:00:00.000Z");
    const b = createGoal({ area: "career", horizon: "short", title: "B", why: "" }, "2026-06-01T00:00:00.000Z");
    t = upsertGoal(upsertGoal(t, a), b);
    t = recordGoalReview(t, b.id, "2026-06-16T00:00:00.000Z"); // 2 天前复盘过
    const due = dueGoalReviews(t, "2026-06-18T00:00:00.000Z");
    expect(due.map((g) => g.id)).toEqual([a.id]); // 只有从没复盘过的 A
  });

  it("dueGoalReviews: a review older than 7 days becomes due again", () => {
    let t = base();
    const g = createGoal({ area: "career", horizon: "short", title: "G", why: "" }, "2026-05-01T00:00:00.000Z");
    t = upsertGoal(t, g);
    t = recordGoalReview(t, g.id, "2026-06-01T00:00:00.000Z"); // 17 天前
    expect(dueGoalReviews(t, "2026-06-18T00:00:00.000Z").map((x) => x.id)).toEqual([g.id]);
  });

  it("done goals are not due for review", () => {
    let t = base();
    const g = createGoal({ area: "career", horizon: "long", title: "G", why: "" }, NOW);
    t = upsertGoal(t, g);
    t = completeGoal(t, g.id, NOW);
    expect(dueGoalReviews(t, "2027-01-01T00:00:00.000Z")).toHaveLength(0);
  });

  it("goalProgress ignores recurring actions (they are daily discipline, not milestones)", () => {
    let g = createGoal({ area: "growth", horizon: "short", title: "学英语", why: "" }, NOW);
    g = setGoalActions(g, ["写完简历", "每天背单词"]); // a0 一次性, a1 将设为重复
    g = setActionRepeat(g, g.actions[1].id, "daily");
    g = toggleGoalAction(g, g.actions[1].id); // 勾了重复那条，也不该算进度
    const t = upsertGoal(base(), g);
    expect(goalProgress(t, g)).toBe(0); // 只有一次性那条算分母，且它没完成
    const g2 = toggleGoalAction(g, g.actions[0].id); // 完成一次性那条
    const t2 = upsertGoal(base(), g2);
    expect(goalProgress(t2, g2)).toBe(1); // 1/1
  });

  it("setActionRepeat sets and clears the repeat flag", () => {
    let g = createGoal({ area: "health", horizon: "short", title: "运动", why: "" }, NOW);
    g = setGoalActions(g, ["跑步"]);
    g = setActionRepeat(g, g.actions[0].id, "weekly");
    expect(g.actions[0].repeat).toBe("weekly");
    g = setActionRepeat(g, g.actions[0].id, undefined);
    expect(g.actions[0].repeat).toBeUndefined();
  });
});
