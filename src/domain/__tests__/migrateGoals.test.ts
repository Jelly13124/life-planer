import { describe, expect, it } from "vitest";
import { migrateActions, migrateGoals } from "../migrateGoals";
import type { LegacyGoal } from "../types";

const legacyGoal = (over: Partial<LegacyGoal> = {}): LegacyGoal => ({
  id: "g1",
  area: "career",
  horizon: "long",
  title: "成为资深工程师",
  why: "影响力",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  parentGoalId: null,
  pathId: null,
  actions: [],
  ...over,
});

describe("migrateActions", () => {
  it("splits actions into tasks (no repeat) and habits (has repeat), preserving ids", () => {
    const { tasks, habits } = migrateActions([
      { id: "a1", text: "投简历", done: false },
      { id: "a2", text: "每天刷题", done: false, repeat: "daily" },
      { id: "a3", text: "周复盘", done: false, repeat: "weekly", repeatWeekday: 0 },
    ]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: "a1", text: "投简历", done: false });
    expect(habits).toHaveLength(2);
    expect(habits[0]).toMatchObject({ id: "a2", repeat: "daily" });
    expect(habits[1]).toMatchObject({ id: "a3", repeat: "weekly", repeatWeekday: 0 });
  });

  it("carries scheduledDate/startTime/durationMin onto tasks and startTime/durationMin onto habits", () => {
    const { tasks, habits } = migrateActions([
      { id: "t", text: "面试", done: true, scheduledDate: "2026-02-01", startTime: "09:00", durationMin: 90 },
      { id: "h", text: "晨跑", done: false, repeat: "daily", startTime: "07:00", durationMin: 30 },
    ]);
    expect(tasks[0]).toMatchObject({ scheduledDate: "2026-02-01", startTime: "09:00", durationMin: 90 });
    expect(habits[0]).toMatchObject({ startTime: "07:00", durationMin: 30 });
  });

  it("handles missing/empty input", () => {
    expect(migrateActions([])).toEqual({ tasks: [], habits: [] });
  });
});

describe("migrateGoals", () => {
  it("turns a long goal with actions into a top-level nested Goal, repeat→habit non-repeat→task", () => {
    const out = migrateGoals([
      legacyGoal({
        actions: [
          { id: "a1", text: "里程碑", done: true },
          { id: "a2", text: "每天写作", done: false, repeat: "daily" },
        ],
      }),
    ]);
    expect(out).toHaveLength(1);
    const g = out[0];
    expect(g.tasks).toHaveLength(1);
    expect(g.tasks[0].id).toBe("a1");
    expect(g.habits).toHaveLength(1);
    expect(g.habits[0].id).toBe("a2");
    expect(g.subgoals).toEqual([]);
    expect(g.metrics).toEqual([]);
  });

  it("preserves goal id and copies area/title/why/status/createdAt/pathId/tags/completedAt/lastReviewedAt", () => {
    const out = migrateGoals([
      legacyGoal({
        id: "keep-me",
        area: "wealth",
        title: "存够首付",
        why: "安全感",
        status: "done",
        pathId: "path-7",
        tags: ["finance", "2026"],
        completedAt: "2026-06-01T00:00:00.000Z",
        lastReviewedAt: "2026-05-20T00:00:00.000Z",
      }),
    ]);
    const g = out[0];
    expect(g.id).toBe("keep-me");
    expect(g.area).toBe("wealth");
    expect(g.title).toBe("存够首付");
    expect(g.why).toBe("安全感");
    expect(g.status).toBe("done");
    expect(g.pathId).toBe("path-7");
    expect(g.tags).toEqual(["finance", "2026"]);
    expect(g.completedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(g.lastReviewedAt).toBe("2026-05-20T00:00:00.000Z");
  });

  it("maps deadline → endDate", () => {
    const out = migrateGoals([legacyGoal({ deadline: "2026-12-31" })]);
    expect(out[0].endDate).toBe("2026-12-31");
  });

  it("nests a short goal with a valid parent as a Subgoal (id + actions preserved)", () => {
    const out = migrateGoals([
      legacyGoal({ id: "long1", horizon: "long" }),
      legacyGoal({
        id: "short1",
        horizon: "short",
        parentGoalId: "long1",
        title: "本季冲刺",
        actions: [
          { id: "s-a1", text: "一次性", done: false },
          { id: "s-a2", text: "每周复盘", done: false, repeat: "weekly", repeatWeekday: 5 },
        ],
      }),
    ]);
    expect(out).toHaveLength(1);
    const parent = out[0];
    expect(parent.id).toBe("long1");
    expect(parent.subgoals).toHaveLength(1);
    const sub = parent.subgoals[0];
    expect(sub.id).toBe("short1");
    expect(sub.title).toBe("本季冲刺");
    expect(sub.metrics).toEqual([]);
    expect(sub.tasks.map((t) => t.id)).toEqual(["s-a1"]);
    expect(sub.habits.map((h) => h.id)).toEqual(["s-a2"]);
  });

  it("promotes an orphan short goal (parent missing) to a top-level Goal", () => {
    const out = migrateGoals([
      legacyGoal({ id: "short-orphan", horizon: "short", parentGoalId: "ghost", title: "孤儿" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("short-orphan");
    expect(out[0].title).toBe("孤儿");
    expect(out[0].subgoals).toEqual([]);
  });

  it("does not duplicate a short goal both as subgoal and top-level", () => {
    const out = migrateGoals([
      legacyGoal({ id: "long1", horizon: "long" }),
      legacyGoal({ id: "short1", horizon: "short", parentGoalId: "long1", title: "子" }),
    ]);
    const allIds = out.flatMap((g) => [g.id, ...g.subgoals.map((s) => s.id)]);
    expect(allIds).toEqual(["long1", "short1"]);
  });

  it("treats a short goal with parentGoalId==null as top-level", () => {
    const out = migrateGoals([
      legacyGoal({ id: "short-top", horizon: "short", parentGoalId: null, title: "独立短期" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("short-top");
  });

  it("returns [] for empty input", () => {
    expect(migrateGoals([])).toEqual([]);
  });

  // ── 边界：之前会无声丢目标的三种情形（bug 1/2/3） ──────────────────────────

  it("bug 1 — grandchild chain: deep nesting flattens, NOTHING dropped (Sp & Sc both become subgoals of L)", () => {
    const out = migrateGoals([
      legacyGoal({ id: "L", horizon: "long" }),
      legacyGoal({
        id: "Sp",
        horizon: "short",
        parentGoalId: "L",
        title: "中层",
        actions: [{ id: "a1", text: "一次性", done: false }],
      }),
      legacyGoal({
        id: "Sc",
        horizon: "short",
        parentGoalId: "Sp", // 父是另一个短期目标（祖孙链）
        title: "孙层",
        actions: [{ id: "a2", text: "再一次性", done: false }],
      }),
    ]);
    // L 是唯一顶层；Sp 与 Sc 都展平成 L 的子目标（单层新模型）。
    expect(out.map((g) => g.id)).toEqual(["L"]);
    const L = out[0];
    expect(L.subgoals.map((s) => s.id).sort()).toEqual(["Sc", "Sp"]);
    // a1（在 Sp）与 a2（在 Sc）都保留——id 不丢。
    const allTaskIds = L.subgoals.flatMap((s) => s.tasks.map((t) => t.id)).sort();
    expect(allTaskIds).toEqual(["a1", "a2"]);
  });

  it("bug 2 — self-parent: parentGoalId === id is treated as top-level, action preserved", () => {
    const out = migrateGoals([
      legacyGoal({
        id: "Z",
        horizon: "short",
        parentGoalId: "Z", // 自指父
        title: "自指目标",
        actions: [{ id: "az", text: "干活", done: false }],
      }),
    ]);
    expect(out.map((g) => g.id)).toEqual(["Z"]);
    expect(out[0].subgoals).toEqual([]);
    expect(out[0].tasks.map((t) => t.id)).toEqual(["az"]);
  });

  it("invariant — every input goal id appears as a goal-id or subgoal-id (messy fixture)", () => {
    const input: LegacyGoal[] = [
      legacyGoal({ id: "long1", horizon: "long" }),
      legacyGoal({ id: "short-top", horizon: "short", parentGoalId: null }),
      legacyGoal({ id: "orphan", horizon: "short", parentGoalId: "ghost" }),
      legacyGoal({ id: "child", horizon: "short", parentGoalId: "long1" }),
      legacyGoal({ id: "grandchild", horizon: "short", parentGoalId: "child" }),
      legacyGoal({ id: "selfref", horizon: "short", parentGoalId: "selfref" }),
      // 两节点互指环：A←→B（都非长期、互为父）。兜底网必须仍把两者都落到输出。
      legacyGoal({ id: "cycleA", horizon: "short", parentGoalId: "cycleB" }),
      legacyGoal({ id: "cycleB", horizon: "short", parentGoalId: "cycleA" }),
    ];
    const out = migrateGoals(input);
    const present = new Set<string>();
    for (const g of out) {
      present.add(g.id);
      for (const s of g.subgoals) present.add(s.id);
    }
    for (const g of input) {
      expect(present.has(g.id)).toBe(true);
    }
    // 没有 id 在输出里出现两次（既不重复成顶层又成子目标）。
    const all: string[] = [];
    for (const g of out) {
      all.push(g.id);
      for (const s of g.subgoals) all.push(s.id);
    }
    expect(all.length).toBe(new Set(all).size);
  });

  // ── pass-through：已是新形状的目标原样透传（bug 3） ─────────────────────────

  it("bug 3 — pass-through: an already-NEW nested goal is returned untouched (not rebuilt/flattened)", () => {
    const newGoal: import("../types").Goal = {
      id: "new1",
      area: "career",
      title: "已是新形状",
      why: "",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      pathId: null,
      tags: ["x"],
      endDate: "2026-12-31",
      metrics: [{ id: "m1", label: "存款", current: 1, target: 10, unit: "k" }],
      subgoals: [
        {
          id: "sub1",
          title: "子目标",
          metrics: [{ id: "sm1", label: "次数", current: 0, target: 3, unit: "次" }],
          tasks: [{ id: "st1", text: "做事", done: false }],
          habits: [],
        },
      ],
      tasks: [{ id: "gt1", text: "目标级任务", done: true }],
      habits: [{ id: "gh1", text: "每天", repeat: "daily" }],
    };
    // 混入一个旧目标，确认混合输入也走透传 + 迁移。
    const out = migrateGoals([
      newGoal,
      legacyGoal({ id: "legacy1", horizon: "long", actions: [{ id: "la", text: "迁移任务", done: false }] }),
    ]);
    const got = out.find((g) => g.id === "new1")!;
    // 字节级保留：与原对象深等价（没有被重建或展平）。
    expect(got).toEqual(newGoal);
    // 旧目标照样迁移过来。
    expect(out.find((g) => g.id === "legacy1")).toBeTruthy();
  });
});
