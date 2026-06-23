import { describe, it, expect } from "vitest";
import { areaSummaries } from "@/domain/areas";
import { LIFE_AREAS } from "@/domain/types";
import { addLongGoal, addHabit, updateGoalById } from "@/domain/goalTree";
import { createTree } from "@/domain/tree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { LifeTree, Profile } from "@/domain/types";

const profile: Profile = {
  name: "测试", age: 28, education: "bachelor", major: "计算机", occupation: "工程师",
  salary: "10to20", hasSideHustle: false, sideHustle: "", hobbies: "跑步", relationship: "single",
  location: "上海", status: "工作2年", snapshot: "工程师", crossroad: "要不要跳槽",
  areas: { career: 70, wealth: 40, relationships: 55, health: 80, growth: 60 },
};

const gen = new LocalPathGenerator();
const NOW = "2026-06-20T00:00:00.000Z";

function buildTree(): { tree: LifeTree; gCareer: string; gCareerShort: string; gHealth: string } {
  let t = createTree(profile, gen, NOW);

  // career: one active goal with a daily-repeat habit
  const gCareer = addLongGoal(t, { area: "career", title: "升到高级工程师", why: "涨薪" }, `${NOW}-c1`);
  t = gCareer.tree;
  t = addHabit(t, gCareer.id, "每天刷题", "daily", undefined, `${NOW}-c1h`).tree;

  // career: a second active goal (no habits)
  const gCareerShort = addLongGoal(t, { area: "career", title: "完成项目A", why: "年终奖" }, `${NOW}-c2`);
  t = gCareerShort.tree;

  // health: one active goal, no habits
  const gHealth = addLongGoal(t, { area: "health", title: "减脂5斤", why: "精力好" }, `${NOW}-h1`);
  t = gHealth.tree;

  // growth: done goal — must NOT appear in active list
  const gGrowthDone = addLongGoal(t, { area: "growth", title: "读完《思考快与慢》", why: "" }, `${NOW}-g1`);
  t = gGrowthDone.tree;
  t = updateGoalById(t, gGrowthDone.id, { status: "done" });

  // wealth / relationships: zero active goals

  return { tree: t, gCareer: gCareer.id, gCareerShort: gCareerShort.id, gHealth: gHealth.id };
}

describe("areaSummaries", () => {
  it("returns exactly 5 summaries in LIFE_AREAS order", () => {
    const { tree } = buildTree();
    const summaries = areaSummaries(tree);
    expect(summaries).toHaveLength(5);
    expect(summaries.map((s) => s.area)).toEqual(LIFE_AREAS);
  });

  it("reads score from profile.areas", () => {
    const { tree } = buildTree();
    const summaries = areaSummaries(tree);
    const careerS = summaries.find((s) => s.area === "career")!;
    expect(careerS.score).toBe(70);
    const wealthS = summaries.find((s) => s.area === "wealth")!;
    expect(wealthS.score).toBe(40);
  });

  it("defaults score to 50 when profile.areas key is missing", () => {
    const { tree } = buildTree();
    const areasWithout = { ...profile.areas } as Partial<typeof profile.areas>;
    delete (areasWithout as Record<string, number>)["growth"];
    const t = { ...tree, profile: { ...tree.profile, areas: areasWithout as typeof profile.areas } };
    const summaries = areaSummaries(t);
    const growthS = summaries.find((s) => s.area === "growth")!;
    expect(growthS.score).toBe(50);
  });

  it("clamps score to 0..100", () => {
    const { tree } = buildTree();
    const t = { ...tree, profile: { ...tree.profile, areas: { ...tree.profile.areas, health: 150 } } };
    const summaries = areaSummaries(t);
    const healthS = summaries.find((s) => s.area === "health")!;
    expect(healthS.score).toBe(100);
  });

  it("groups active goals correctly by area", () => {
    const { tree, gCareer, gCareerShort, gHealth } = buildTree();
    const summaries = areaSummaries(tree);

    const careerS = summaries.find((s) => s.area === "career")!;
    const goalIds = careerS.goals.map((g) => g.id);
    expect(goalIds).toContain(gCareer);
    expect(goalIds).toContain(gCareerShort);
    expect(careerS.goals).toHaveLength(2);

    const healthS = summaries.find((s) => s.area === "health")!;
    expect(healthS.goals.map((g) => g.id)).toContain(gHealth);
    expect(healthS.goals).toHaveLength(1);
  });

  it("excludes done goals from area goal list", () => {
    const { tree } = buildTree();
    const summaries = areaSummaries(tree);
    const growthS = summaries.find((s) => s.area === "growth")!;
    // The done goal must not appear
    expect(growthS.goals).toHaveLength(0);
  });

  it("areas with no active goals return empty arrays", () => {
    const { tree } = buildTree();
    const summaries = areaSummaries(tree);
    const wealthS = summaries.find((s) => s.area === "wealth")!;
    expect(wealthS.goals).toEqual([]);
    const relS = summaries.find((s) => s.area === "relationships")!;
    expect(relS.goals).toEqual([]);
  });

  it("counts habits (recurring actions) per area", () => {
    const { tree } = buildTree();
    const summaries = areaSummaries(tree);
    const careerS = summaries.find((s) => s.area === "career")!;
    // The career goal has 1 daily-repeat habit → 1 habit
    expect(careerS.habitCount).toBe(1);
    // health goal has no habit → 0
    const healthS = summaries.find((s) => s.area === "health")!;
    expect(healthS.habitCount).toBe(0);
  });

  it("habitCount is 0 for areas with no goals at all", () => {
    const { tree } = buildTree();
    const summaries = areaSummaries(tree);
    const wealthS = summaries.find((s) => s.area === "wealth")!;
    expect(wealthS.habitCount).toBe(0);
  });
});
