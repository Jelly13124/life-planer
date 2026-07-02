import { describe, expect, it } from "vitest";
import { normalizeLoadedTree } from "../repository/normalize";
import { findItem, goalById, shortGoalsOf } from "../goalTree";
import { actionsOnDay } from "../calendar";
import { habitStreak } from "../habits";
import { isActionDoneToday } from "../daily";
import type { LifeTree, Profile, Task } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// 迁移集成测试 —— 旧→两级 localStorage 升级的"无损契约"。
// 构造真实的历史形态树（legacy 扁平 / nested 嵌套），过一遍 normalizeLoadedTree（迁移入口），
// 证明：两级结构正确（kind/parentGoalId）、id 全保留、activity 原样不动、
// 历史经由 calendar/habits/daily 适配器仍然对得上、幂等。
// ─────────────────────────────────────────────────────────────────────────────

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

// 一条最小但合法的人生树分支（normalizeLoadedTree 只要求 paths 是数组；这里给足结构以贴近真实）。
const path = {
  id: "p1",
  choiceLabel: "现状",
  kind: "status-quo" as const,
  summary: "继续当前",
  color: "#888888",
  curve: "flat" as const,
  endValue: 50,
  nodes: [],
  metrics: { career: [], wealth: [], relationships: [], health: [], growth: [] },
  parentId: null,
  forkAge: 30,
  scenario: "likely" as const,
};

// activity 引用 OLD action id（t1/h1），迁移后 id 不变所以仍对得上。
// 两天 completedActionIds 含 h1 → habitStreak 有意义。
const legacyActivity = [
  { date: "2026-06-19", plannedActionIds: [] as string[], completedActionIds: ["h1"] },
  { date: "2026-06-20", plannedActionIds: ["t1"], completedActionIds: ["h1"] },
];

// ── legacy 扁平形态（goals 带 horizon/parentGoalId/actions，无 subgoals/kind）。
function buildLegacyTree() {
  return {
    id: "tree-1",
    profile,
    horizonYears: 20,
    paths: [path],
    decisions: [] as unknown[],
    goals: [
      {
        id: "L1",
        area: "career",
        horizon: "long",
        title: "成为资深工程师",
        why: "影响力",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        parentGoalId: null,
        pathId: "p1",
        deadline: "2026-12-31",
        tags: ["career", "2026"],
        actions: [
          { id: "t1", text: "上线 v1", done: false, scheduledDate: "2026-06-20", startTime: "09:00", durationMin: 60 },
          { id: "h1", text: "每天写代码", done: false, repeat: "daily" },
        ],
      },
      {
        id: "S1",
        area: "career",
        horizon: "short",
        title: "本季冲刺",
        why: "",
        status: "active",
        createdAt: "2026-02-01T00:00:00.000Z",
        parentGoalId: "L1",
        pathId: null,
        actions: [{ id: "t2", text: "完成评审", done: true }],
      },
      {
        id: "S2",
        area: "growth",
        horizon: "short",
        title: "孤儿目标",
        why: "",
        status: "active",
        createdAt: "2026-03-01T00:00:00.000Z",
        parentGoalId: "missing-id",
        pathId: null,
        actions: [{ id: "h2", text: "每周复盘", done: false, repeat: "weekly", repeatWeekday: 1 }],
      },
    ],
    activity: legacyActivity,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
  };
}

describe("migration integration — legacy 扁平 → 两级（无损）", () => {
  const migrate = (): LifeTree =>
    normalizeLoadedTree(JSON.parse(JSON.stringify(buildLegacyTree())))!;

  it("returns a non-null tree", () => {
    expect(migrate()).not.toBeNull();
  });

  it("1) goals are TWO-TIER: L1 long; S1 short with parentGoalId=L1; orphan S2 promoted to long; all arrays present", () => {
    const tree = migrate();
    const ids = tree.goals.map((g) => g.id).sort();
    // 三个目标全部作为顶层（扁平）目标存在。
    expect(ids).toEqual(["L1", "S1", "S2"]);

    const L1 = goalById(tree, "L1")!;
    expect(L1.kind).toBe("long");
    expect(L1.parentGoalId).toBeNull();

    const S1 = goalById(tree, "S1")!;
    expect(S1.kind).toBe("short");
    expect(S1.parentGoalId).toBe("L1");
    // S1 现在是 L1 的短期子目标。
    expect(shortGoalsOf(tree, "L1").map((s) => s.id)).toEqual(["S1"]);

    const S2 = goalById(tree, "S2")!;
    expect(S2.kind).toBe("long"); // 孤儿短期 → 提为 long
    expect(S2.parentGoalId).toBeNull();

    // 每个 goal 都有数组字段 + kind/parentGoalId（迁移 + normalize 兜底）。habits 已并入 tasks，不再单独存在。
    for (const g of tree.goals) {
      expect(Array.isArray(g.metrics)).toBe(true);
      expect(Array.isArray(g.tasks)).toBe(true);
      expect("habits" in g).toBe(false);
      expect(g.kind === "long" || g.kind === "short").toBe(true);
      expect("subgoals" in g).toBe(false);
    }
  });

  it("2) ids preserved: t1/h1/t2/h2 all resolve with correct kind + payload intact", () => {
    const tree = migrate();

    const t1 = findItem(tree, "t1");
    expect(t1).not.toBeNull();
    expect(t1!.kind).toBe("task");
    const t1task = t1!.item as Task;
    expect(t1task.scheduledDate).toBe("2026-06-20");
    expect(t1task.startTime).toBe("09:00");
    expect(t1task.durationMin).toBe(60);
    expect(t1task.done).toBe(false);
    // t1 挂在 L1（long）上。
    expect(t1!.goal!.id).toBe("L1");

    const h1 = findItem(tree, "h1");
    expect(h1).not.toBeNull();
    expect(h1!.kind).toBe("habit");
    expect((h1!.item as Task).repeat).toBe("daily");

    const t2 = findItem(tree, "t2");
    expect(t2).not.toBeNull();
    expect(t2!.kind).toBe("task");
    expect((t2!.item as Task).done).toBe(true);
    // t2 落在 S1（short，parentGoalId=L1）里。
    expect(t2!.goal!.id).toBe("S1");
    expect(goalById(tree, "S1")!.tasks.map((t) => t.id)).toEqual(["t2"]);

    const h2 = findItem(tree, "h2");
    expect(h2).not.toBeNull();
    expect(h2!.kind).toBe("habit");
    const h2habit = h2!.item as Task;
    expect(h2habit.repeat).toBe("weekly");
    expect(h2habit.repeatWeekday).toBe(1);
    // h2 在 S2（孤儿提为 long）里。
    expect(h2!.goal!.id).toBe("S2");
  });

  it("3) activity is untouched: deep-equals the legacy activity (ids still line up)", () => {
    const tree = migrate();
    expect(tree.activity).toEqual(legacyActivity);
  });

  it("4a) calendar.actionsOnDay(tree, '2026-06-20') includes t1 (scheduled history survives migration)", () => {
    const tree = migrate();
    const ids = actionsOnDay(tree, "2026-06-20").map((x) => x.item.id);
    expect(ids).toContain("t1");
  });

  it("4b) habits.habitStreak(tree, 'h1', today) returns the streak from the preserved activity", () => {
    const tree = migrate();
    expect(habitStreak(tree, "h1", "2026-06-20")).toBe(2);
    expect(habitStreak(tree, "h1", "2026-06-21")).toBe(2);
  });

  it("4c) daily completion state reads correctly through migration (t1 done=false, t2 done=true)", () => {
    const tree = migrate();
    const t1 = findItem(tree, "t1")!.item as Task;
    const t2 = findItem(tree, "t2")!.item as Task;
    expect(isActionDoneToday(tree, t1, "2026-06-20")).toBe(false);
    expect(isActionDoneToday(tree, t2, "2026-06-20")).toBe(true);
  });

  it("5) deadline→endDate; tags/pathId/status carried onto the migrated long Goal; old field gone", () => {
    const tree = migrate();
    const L1 = goalById(tree, "L1")!;
    expect(L1.endDate).toBe("2026-12-31");
    expect(L1.tags).toEqual(["career", "2026"]);
    expect(L1.pathId).toBe("p1");
    expect(L1.status).toBe("active");
    expect("deadline" in L1).toBe(false);
  });

  it("6) idempotent: re-running normalize on the migrated tree changes nothing", () => {
    const once = migrate();
    const again = normalizeLoadedTree(JSON.parse(JSON.stringify(once)))!;
    expect(again.goals).toEqual(once.goals);
    expect(again.activity).toEqual(once.activity);
    expect(findItem(again, "t1")!.kind).toBe("task");
    expect(findItem(again, "h2")!.kind).toBe("habit");
    expect((findItem(again, "h2")!.item as Task).repeatWeekday).toBe(1);
  });

  it("7) loose tasks/habits: missing tree-level arrays backfill to [] (idempotent; goal items untouched)", () => {
    const tree = migrate();
    // 旧数据无树级 tasks/habits → 补成空数组（散项容器；habits 已并入 tasks，无独立字段）。
    expect(tree.tasks).toEqual([]);
    expect("habits" in tree).toBe(false);
    // goal 自己的 tasks（含 habits，已并入、带 repeat）不受影响（L1 仍持 t1/h1）。
    expect(goalById(tree, "L1")!.tasks.map((t) => t.id).sort()).toEqual(["h1", "t1"]);
    // 幂等：已有散项时再 normalize 原样保留（旧 habits[] 输入仍应无损折进 tasks[]）。
    const withLoose = {
      ...tree,
      tasks: [{ id: "loose-t", text: "买菜", done: false }],
      habits: [{ id: "loose-h", text: "上班", repeat: "daily" }],
    };
    const again = normalizeLoadedTree(JSON.parse(JSON.stringify(withLoose)))!;
    expect(again.tasks.map((t) => t.id)).toEqual(["loose-t", "loose-h"]);
    expect(again.tasks.find((t) => t.id === "loose-h")?.repeat).toBe("daily");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// nested 嵌套形态（当前生产形态：goal 带 subgoals[]）→ 两级。
// ─────────────────────────────────────────────────────────────────────────────

// activity 引用 nested 内的 id（st1 任务 + sh1 习惯），迁移后 id 不变所以仍对得上。
const nestedActivity = [
  { date: "2026-06-19", plannedActionIds: [] as string[], completedActionIds: ["sh1"] },
  { date: "2026-06-20", plannedActionIds: ["st1"], completedActionIds: ["sh1"] },
];

function buildNestedTree() {
  return {
    id: "tree-2",
    profile,
    horizonYears: 20,
    paths: [path],
    decisions: [] as unknown[],
    goals: [
      {
        id: "G",
        area: "health",
        title: "获得健康的身体",
        why: "底气",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        pathId: "p1",
        tags: ["health"],
        metrics: [{ id: "gm1", label: "体脂", current: 25, target: 18, unit: "%" }],
        tasks: [{ id: "gt1", text: "体检", done: false }],
        habits: [{ id: "gh1", text: "每天走路", repeat: "daily" }],
        subgoals: [
          {
            id: "S1",
            title: "一个月减肥10斤",
            metrics: [{ id: "sm1", label: "体重", current: 80, target: 75, unit: "kg" }],
            tasks: [{ id: "st1", text: "称重", done: false, scheduledDate: "2026-06-20", startTime: "08:00", durationMin: 15 }],
            habits: [{ id: "sh1", text: "每天跑步", repeat: "daily" }],
          },
        ],
      },
    ],
    activity: nestedActivity,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
  };
}

describe("migration integration — nested 嵌套 → 两级（无损，subgoal id → short goal id）", () => {
  const migrate = (): LifeTree =>
    normalizeLoadedTree(JSON.parse(JSON.stringify(buildNestedTree())))!;

  it("1) nested goal G → long; subgoal S1 → short Goal with parentGoalId=G (subgoal id preserved as short-goal id)", () => {
    const tree = migrate();
    const ids = tree.goals.map((g) => g.id).sort();
    expect(ids).toEqual(["G", "S1"]);

    const G = goalById(tree, "G")!;
    expect(G.kind).toBe("long");
    expect(G.parentGoalId).toBeNull();
    expect(G.metrics.map((m) => m.id)).toEqual(["gm1"]);
    expect(G.tasks.map((t) => t.id)).toEqual(["gt1", "gh1"]);
    expect(G.tasks.find((t) => t.id === "gh1")?.repeat).toBe("daily");
    expect("subgoals" in G).toBe(false);

    const S1 = goalById(tree, "S1")!;
    expect(S1.kind).toBe("short");
    expect(S1.parentGoalId).toBe("G");
    expect(S1.area).toBe("health"); // 继承父 area
    expect(S1.startDate).toBe("2026-01-01");
    expect(S1.endDate).toBe("2026-12-31");
    expect(S1.pathId).toBeNull();
    // short 自带其原子目标 metrics/tasks（id 保留）；habits 无损并入 tasks（带 repeat）。
    expect(S1.metrics.map((m) => m.id)).toEqual(["sm1"]);
    expect(S1.tasks.map((t) => t.id)).toEqual(["st1", "sh1"]);
    expect(S1.tasks.find((t) => t.id === "sh1")?.repeat).toBe("daily");

    expect(shortGoalsOf(tree, "G").map((s) => s.id)).toEqual(["S1"]);
  });

  it("2) activity deep-equals the nested activity (ids still line up)", () => {
    const tree = migrate();
    expect(tree.activity).toEqual(nestedActivity);
  });

  it("3) calendar.actionsOnDay finds the scheduled subgoal task st1 on its day", () => {
    const tree = migrate();
    const ids = actionsOnDay(tree, "2026-06-20").map((x) => x.item.id);
    expect(ids).toContain("st1");
  });

  it("4) habitStreak on the subgoal habit sh1 survives migration", () => {
    const tree = migrate();
    expect(habitStreak(tree, "sh1", "2026-06-20")).toBe(2);
  });

  it("5) idempotent: re-running normalize on the migrated tree changes nothing", () => {
    const once = migrate();
    const again = normalizeLoadedTree(JSON.parse(JSON.stringify(once)))!;
    expect(again.goals).toEqual(once.goals);
    expect(again.activity).toEqual(once.activity);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// "每个输入 id 可达" 不变量 —— 一棵混入 legacy + nested + 边界（孤儿/自指/环）的脏树，
// 过 normalizeLoadedTree 后，所有输入 goal id 与 nested subgoal id 都仍能被解析到。
// ─────────────────────────────────────────────────────────────────────────────
function buildTreeWithGoals(goals: unknown[]) {
  return {
    id: "tree-x",
    profile,
    horizonYears: 20,
    paths: [path],
    decisions: [] as unknown[],
    goals,
    activity: [] as unknown[],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
  };
}
const norm = (goals: unknown[]): LifeTree =>
  normalizeLoadedTree(JSON.parse(JSON.stringify(buildTreeWithGoals(goals))))!;

describe("migration integration — every input id reachable on a messy fixture", () => {
  it("legacy(orphan/self-parent) + nested(2 subgoals) + already-two-tier → all ids resolve as goal ids", () => {
    const tree = norm([
      // legacy long + its short + an orphan short + a self-parent short
      { id: "L", area: "career", horizon: "long", title: "L", why: "", status: "active",
        createdAt: "2026-01-01T00:00:00.000Z", parentGoalId: null, pathId: null, actions: [] },
      { id: "Sc", area: "career", horizon: "short", title: "子", why: "", status: "active",
        createdAt: "2026-01-01T00:00:00.000Z", parentGoalId: "L", pathId: null,
        actions: [{ id: "a1", text: "干", done: false }] },
      { id: "orphan", area: "growth", horizon: "short", title: "孤儿", why: "", status: "active",
        createdAt: "2026-01-01T00:00:00.000Z", parentGoalId: "ghost", pathId: null, actions: [] },
      { id: "selfref", area: "growth", horizon: "short", title: "自指", why: "", status: "active",
        createdAt: "2026-01-01T00:00:00.000Z", parentGoalId: "selfref", pathId: null, actions: [] },
      // nested goal + 2 subgoals
      { id: "G", area: "health", title: "嵌套", why: "", status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        subgoals: [
          { id: "nsub1", title: "a", tasks: [{ id: "nt1", text: "做", done: false }] },
          { id: "nsub2", title: "b" },
        ] },
      // already two-tier short (parent L) — must pass through unchanged
      { id: "two", kind: "short", parentGoalId: "L", area: "career", title: "已两级", why: "",
        status: "active", createdAt: "2026-01-01T00:00:00.000Z", pathId: null,
        metrics: [], tasks: [] },
    ]);

    const present = new Set(tree.goals.map((g) => g.id));
    for (const id of ["L", "Sc", "orphan", "selfref", "G", "nsub1", "nsub2", "two"]) {
      expect(present.has(id)).toBe(true);
    }
    // 父子关系正确。
    expect(goalById(tree, "Sc")!.parentGoalId).toBe("L");
    expect(goalById(tree, "nsub1")!.parentGoalId).toBe("G");
    expect(goalById(tree, "two")!.parentGoalId).toBe("L");
    expect(goalById(tree, "orphan")!.kind).toBe("long");
    expect(goalById(tree, "selfref")!.kind).toBe("long");
    // 子目标 task id 仍解析。
    expect(findItem(tree, "a1")!.kind).toBe("task");
    expect(findItem(tree, "nt1")!.kind).toBe("task");
  });
});
