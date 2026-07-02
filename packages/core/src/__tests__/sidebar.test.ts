import { describe, it, expect } from "vitest";
import { favoriteGoals, favoriteTimeLabel, sidebarTags } from "@/domain/sidebar";
import { addLongGoal, updateGoalById } from "@/domain/goalTree";
import { completeGoal, addGoalTag } from "@/domain/goals";
import { createTree } from "@/domain/tree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { Goal, LifeTree, Profile } from "@/domain/types";

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

// 收藏目标用的小工具：addLongGoal 后 updateGoalById 设 favorite。
function addFav(
  t: LifeTree,
  input: Parameters<typeof addLongGoal>[1],
  favorite: boolean,
  now: string,
): { tree: LifeTree; id: string } {
  const r = addLongGoal(t, input, now);
  const tree = updateGoalById(r.tree, r.id, { favorite });
  return { tree, id: r.id };
}

describe("sidebar.favoriteGoals", () => {
  it("returns only favorite goals", () => {
    let t = base();
    const a = addFav(t, { area: "career", title: "A" }, true, NOW);
    t = a.tree;
    const b = addLongGoal(t, { area: "health", title: "B" }, NOW); // not favorite
    t = b.tree;
    const ids = favoriteGoals(t).map((g) => g.id);
    expect(ids).toEqual([a.id]);
  });

  it("orders active favorites before done ones, then by createdAt ascending", () => {
    let t = base();
    // 三个收藏：done(早建) / active(晚建) / active(早建)
    const done = addFav(t, { area: "career", title: "DONE" }, true, "2026-06-01T00:00:00.000Z");
    t = done.tree;
    t = completeGoal(t, done.id, "2026-06-10T00:00:00.000Z");
    const activeLate = addFav(t, { area: "growth", title: "LATE" }, true, "2026-06-05T00:00:00.000Z");
    t = activeLate.tree;
    const activeEarly = addFav(t, { area: "health", title: "EARLY" }, true, "2026-06-02T00:00:00.000Z");
    t = activeEarly.tree;
    const ids = favoriteGoals(t).map((g) => g.id);
    // active 在前（按 createdAt 升序：early 先于 late），done 垫底
    expect(ids).toEqual([activeEarly.id, activeLate.id, done.id]);
  });

  it("returns empty array when no favorites", () => {
    let t = base();
    t = addLongGoal(t, { area: "career", title: "X" }, NOW).tree;
    expect(favoriteGoals(t)).toEqual([]);
  });
});

describe("sidebar.favoriteTimeLabel", () => {
  const goalWith = (over: Partial<Goal>): Goal => ({
    id: "g",
    kind: "long",
    parentGoalId: null,
    area: "career",
    title: "G",
    why: "",
    status: "active",
    createdAt: NOW,
    metrics: [],
    tasks: [],
    ...over,
  });

  it("future endDate → due with whole-day count", () => {
    const g = goalWith({ endDate: "2026-06-25" });
    expect(favoriteTimeLabel(g, "2026-06-20")).toEqual({ kind: "due", days: 5 });
  });

  it("endDate today → due with 0 days", () => {
    const g = goalWith({ endDate: "2026-06-20" });
    expect(favoriteTimeLabel(g, "2026-06-20")).toEqual({ kind: "due", days: 0 });
  });

  it("past endDate → overdue with absolute day count", () => {
    const g = goalWith({ endDate: "2026-06-15" });
    expect(favoriteTimeLabel(g, "2026-06-20")).toEqual({ kind: "overdue", days: 5 });
  });

  it("no endDate → created with days since createdAt date", () => {
    const g = goalWith({ createdAt: "2026-06-10T08:30:00.000Z" });
    expect(favoriteTimeLabel(g, "2026-06-20")).toEqual({ kind: "created", days: 10 });
  });

  it("no endDate, created today → created with 0 days", () => {
    const g = goalWith({ createdAt: "2026-06-20T23:59:00.000Z" });
    expect(favoriteTimeLabel(g, "2026-06-20")).toEqual({ kind: "created", days: 0 });
  });
});

describe("sidebar.sidebarTags", () => {
  it("dedups and sorts tags across goals", () => {
    let t = base();
    const g1 = addLongGoal(t, { area: "career", title: "A" }, NOW);
    t = g1.tree;
    const g2 = addLongGoal(t, { area: "health", title: "B" }, NOW);
    t = g2.tree;
    t = addGoalTag(t, g1.id, "重要");
    t = addGoalTag(t, g1.id, "工作");
    t = addGoalTag(t, g2.id, "重要"); // duplicate across goals
    t = addGoalTag(t, g2.id, "健康");
    expect(sidebarTags(t)).toEqual(["健康", "工作", "重要"]);
  });

  it("returns empty array when no tags", () => {
    expect(sidebarTags(base())).toEqual([]);
  });
});
