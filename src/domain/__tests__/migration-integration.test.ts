import { describe, expect, it } from "vitest";
import { normalizeLoadedTree } from "../repository/normalize";
import { findItem } from "../goalTree";
import { actionsOnDay } from "../calendar";
import { habitStreak } from "../habits";
import { isActionDoneToday } from "../daily";
import type { Habit, LifeTree, Profile, Task } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// 迁移集成测试 —— 旧→新 localStorage 升级的"无损契约"。
// 构造一棵真实的 OLD 形状树（goals 是 LegacyGoal 扁平数组，带 horizon/parentGoalId/actions），
// 过一遍 normalizeLoadedTree（迁移入口），证明：嵌套结构正确、id 全保留、activity 原样不动、
// 历史经由 calendar/habits/daily 适配器仍然对得上。
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

// 旧形状（扁平 goals + horizon/parentGoalId/actions）。刻意不带 subgoals 字段。
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

describe("migration integration — lossless old→new localStorage upgrade", () => {
  // 每个测试都从深拷贝重新迁移（normalizeLoadedTree 收到的是 JSON.parse 的结果）。
  const migrate = (): LifeTree =>
    normalizeLoadedTree(JSON.parse(JSON.stringify(buildLegacyTree())))!;

  it("returns a non-null tree", () => {
    expect(migrate()).not.toBeNull();
  });

  it("1) goals are NESTED: L1 top-level with subgoal S1; orphan S2 promoted to top-level; every goal has metrics/subgoals/tasks/habits arrays", () => {
    const tree = migrate();
    const ids = tree.goals.map((g) => g.id);
    // L1 与 S2 顶层；S1 不在顶层（它是 L1 的子目标）。
    expect(ids).toContain("L1");
    expect(ids).toContain("S2");
    expect(ids).not.toContain("S1");

    const L1 = tree.goals.find((g) => g.id === "L1")!;
    expect(L1.subgoals.map((s) => s.id)).toEqual(["S1"]);

    const S2 = tree.goals.find((g) => g.id === "S2")!;
    expect(S2.subgoals).toEqual([]); // 孤儿提为顶层，自身无子目标

    // 每个 goal 都有四个数组字段（迁移 + normalize 兜底）。
    for (const g of tree.goals) {
      expect(Array.isArray(g.metrics)).toBe(true);
      expect(Array.isArray(g.subgoals)).toBe(true);
      expect(Array.isArray(g.tasks)).toBe(true);
      expect(Array.isArray(g.habits)).toBe(true);
    }
    // 子目标层同样齐备。
    for (const s of L1.subgoals) {
      expect(Array.isArray(s.metrics)).toBe(true);
      expect(Array.isArray(s.tasks)).toBe(true);
      expect(Array.isArray(s.habits)).toBe(true);
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

    const h1 = findItem(tree, "h1");
    expect(h1).not.toBeNull();
    expect(h1!.kind).toBe("habit");
    expect((h1!.item as Habit).repeat).toBe("daily");

    const t2 = findItem(tree, "t2");
    expect(t2).not.toBeNull();
    expect(t2!.kind).toBe("task");
    expect((t2!.item as Task).done).toBe(true);
    // t2 落在 S1（现为 L1 的子目标）里。
    const L1 = tree.goals.find((g) => g.id === "L1")!;
    expect(L1.subgoals[0].tasks.map((t) => t.id)).toEqual(["t2"]);

    const h2 = findItem(tree, "h2");
    expect(h2).not.toBeNull();
    expect(h2!.kind).toBe("habit");
    const h2habit = h2!.item as Habit;
    expect(h2habit.repeat).toBe("weekly");
    expect(h2habit.repeatWeekday).toBe(1);
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
    // h1 在 2026-06-19 与 2026-06-20 都完成；daily streak 从 today=06-20 往前连续两天 = 2。
    expect(habitStreak(tree, "h1", "2026-06-20")).toBe(2);
    // 宽限：today=06-21 未完成 → 从昨天起算，仍连续两天 = 2。
    expect(habitStreak(tree, "h1", "2026-06-21")).toBe(2);
  });

  it("4c) daily completion state reads correctly through migration (t1 done=false, t2 done=true)", () => {
    const tree = migrate();
    const t1 = findItem(tree, "t1")!.item as Task;
    const t2 = findItem(tree, "t2")!.item as Task;
    expect(isActionDoneToday(tree, t1, "2026-06-20")).toBe(false);
    expect(isActionDoneToday(tree, t2, "2026-06-20")).toBe(true);
  });

  it("5) deadline→endDate; tags/pathId/status carried onto the migrated Goal", () => {
    const tree = migrate();
    const L1 = tree.goals.find((g) => g.id === "L1")!;
    expect(L1.endDate).toBe("2026-12-31");
    expect(L1.tags).toEqual(["career", "2026"]);
    expect(L1.pathId).toBe("p1");
    expect(L1.status).toBe("active");
    // 旧 deadline 字段不应泄漏到新 Goal 上。
    expect("deadline" in L1).toBe(false);
  });
});

describe("migration integration — idempotent on already-new trees", () => {
  it("a tree already in the new nested shape passes through unchanged (no double migration)", () => {
    const tree = normalizeLoadedTree(JSON.parse(JSON.stringify(buildLegacyTree())))!;
    // 把已迁移好的新树再过一遍 normalize，应当深等价（不会被当成旧结构再迁一次）。
    const again = normalizeLoadedTree(JSON.parse(JSON.stringify(tree)))!;
    expect(again.goals).toEqual(tree.goals);
    expect(again.activity).toEqual(tree.activity);
    // id 仍解析得到，且仍是同样的 kind/payload。
    expect(findItem(again, "t1")!.kind).toBe("task");
    expect(findItem(again, "h2")!.kind).toBe("habit");
    expect((findItem(again, "h2")!.item as Habit).repeatWeekday).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 回归：迁移的"无损契约"在三种之前会无声丢目标的边界下仍成立（bug 1/2/3）。
// 都走真正的入口 normalizeLoadedTree，再用 findItem 证明 id 仍解析得到（历史对得上）。
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

describe("migration integration — lossless on nesting/self-parent/mixed edge cases", () => {
  it("bug 1 — grandchild chain: L top-level, Sp+Sc both subgoals of L, a1 AND a2 resolve", () => {
    const tree = norm([
      {
        id: "L", area: "career", horizon: "long", title: "L", why: "", status: "active",
        createdAt: "2026-01-01T00:00:00.000Z", parentGoalId: null, pathId: null, actions: [],
      },
      {
        id: "Sp", area: "career", horizon: "short", title: "中层", why: "", status: "active",
        createdAt: "2026-01-01T00:00:00.000Z", parentGoalId: "L", pathId: null,
        actions: [{ id: "a1", text: "一次性", done: false }],
      },
      {
        id: "Sc", area: "career", horizon: "short", title: "孙层", why: "", status: "active",
        createdAt: "2026-01-01T00:00:00.000Z", parentGoalId: "Sp", pathId: null,
        actions: [{ id: "a2", text: "再一次性", done: false }],
      },
    ]);
    const ids = tree.goals.map((g) => g.id);
    expect(ids).toContain("L");
    expect(ids).not.toContain("Sp");
    expect(ids).not.toContain("Sc");
    const L = tree.goals.find((g) => g.id === "L")!;
    expect(L.subgoals.map((s) => s.id).sort()).toEqual(["Sc", "Sp"]);
    // 两个 action id 都仍解析得到 → 历史/排期/连续天数全保住。
    expect(findItem(tree, "a1")).not.toBeNull();
    expect(findItem(tree, "a2")).not.toBeNull();
    expect(findItem(tree, "a1")!.kind).toBe("task");
    expect(findItem(tree, "a2")!.kind).toBe("task");
  });

  it("bug 2 — self-parent: Z is top-level, az resolves", () => {
    const tree = norm([
      {
        id: "Z", area: "growth", horizon: "short", title: "自指", why: "", status: "active",
        createdAt: "2026-01-01T00:00:00.000Z", parentGoalId: "Z", pathId: null,
        actions: [{ id: "az", text: "干活", done: false }],
      },
    ]);
    expect(tree.goals.map((g) => g.id)).toEqual(["Z"]);
    expect(tree.goals[0].subgoals).toEqual([]);
    expect(findItem(tree, "az")).not.toBeNull();
    expect(findItem(tree, "az")!.kind).toBe("task");
  });

  it("bug 3 — mixed tree: an already-NEW nested goal is byte-for-byte preserved AND the legacy goal is migrated", () => {
    const newGoal = {
      id: "new1", area: "career", title: "已是新形状", why: "", status: "active",
      createdAt: "2026-01-01T00:00:00.000Z", pathId: null, tags: ["x"], endDate: "2026-12-31",
      metrics: [{ id: "m1", label: "存款", current: 1, target: 10, unit: "k" }],
      subgoals: [
        {
          id: "sub1", title: "子目标",
          metrics: [{ id: "sm1", label: "次数", current: 0, target: 3, unit: "次" }],
          tasks: [{ id: "st1", text: "做事", done: false }],
          habits: [],
        },
      ],
      tasks: [{ id: "gt1", text: "目标级任务", done: true }],
      habits: [{ id: "gh1", text: "每天", repeat: "daily" }],
    };
    const legacy = {
      id: "legacy1", area: "wealth", horizon: "long", title: "旧目标", why: "", status: "active",
      createdAt: "2026-01-01T00:00:00.000Z", parentGoalId: null, pathId: null,
      actions: [{ id: "la", text: "迁移任务", done: false }],
    };
    const tree = norm([newGoal, legacy]);
    // 新目标字节级保留（注：normalize 兜底只会补缺失的数组字段，这里都已齐备故不变）。
    const got = tree.goals.find((g) => g.id === "new1")!;
    expect(got).toEqual(newGoal);
    // 旧目标被迁移：endDate 来自 deadline 缺省（无）、id 保留、la 仍解析。
    const mig = tree.goals.find((g) => g.id === "legacy1")!;
    expect(mig).toBeTruthy();
    expect("actions" in mig).toBe(false); // 不再带旧字段
    expect(findItem(tree, "la")).not.toBeNull();
    expect(findItem(tree, "la")!.kind).toBe("task");
    // 新目标的内部结构没被展平：子目标/指标/任务都还在。
    expect(got.subgoals[0].id).toBe("sub1");
    expect(got.subgoals[0].metrics[0].id).toBe("sm1");
    expect(got.subgoals[0].tasks[0].id).toBe("st1");
    expect(findItem(tree, "st1")!.kind).toBe("task");
  });
});
