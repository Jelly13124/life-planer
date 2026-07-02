import { describe, expect, it } from "vitest";
import { migrateActions, migrateGoals } from "../migrateGoals";
import { shortGoalsOf } from "../goalTree";
import type { Goal, LegacyGoal, LifeTree, NestedGoal } from "../types";

// 把一组迁好的 Goal[] 包成最小 LifeTree，便于复用 goalTree 的访问器（shortGoalsOf 等）。
const treeOf = (goals: Goal[]): LifeTree =>
  ({ goals } as unknown as LifeTree);

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

// ──────────────────────────────────────────────────────────────────────────
// 三态迁移 → 两级目标（扁平 Goal[]，kind/parentGoalId 区分）。
// ──────────────────────────────────────────────────────────────────────────

describe("migrateGoals — legacy 扁平 → 两级", () => {
  it("turns a long legacy goal into a flat long Goal, repeat→habit non-repeat→task (both land in tasks[])", () => {
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
    expect(g.kind).toBe("long");
    expect(g.parentGoalId).toBeNull();
    expect(g.tasks.map((t) => t.id)).toEqual(["a1", "a2"]);
    expect(g.tasks.find((t) => t.id === "a2")?.repeat).toBe("daily");
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

  it("a short legacy goal with a valid parent → short Goal keeping parentGoalId (ids preserved)", () => {
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
    expect(out).toHaveLength(2);
    const long = out.find((g) => g.id === "long1")!;
    const short = out.find((g) => g.id === "short1")!;
    expect(long.kind).toBe("long");
    expect(long.parentGoalId).toBeNull();
    expect(short.kind).toBe("short");
    expect(short.parentGoalId).toBe("long1");
    expect(short.title).toBe("本季冲刺");
    expect(short.tasks.map((t) => t.id)).toEqual(["s-a1", "s-a2"]);
    expect(short.tasks.find((t) => t.id === "s-a2")?.repeat).toBe("weekly");
    // short 不上树。
    expect(short.pathId).toBeNull();
  });

  it("promotes an orphan short goal (parent missing) to a long Goal", () => {
    const out = migrateGoals([
      legacyGoal({ id: "short-orphan", horizon: "short", parentGoalId: "ghost", title: "孤儿" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("short-orphan");
    expect(out[0].kind).toBe("long");
    expect(out[0].parentGoalId).toBeNull();
  });

  it("treats a short legacy goal with parentGoalId==null as a long Goal", () => {
    const out = migrateGoals([
      legacyGoal({ id: "short-top", horizon: "short", parentGoalId: null, title: "独立短期" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("short-top");
    expect(out[0].kind).toBe("long");
  });

  it("self-parent short legacy goal becomes a long Goal, action preserved", () => {
    const out = migrateGoals([
      legacyGoal({
        id: "Z",
        horizon: "short",
        parentGoalId: "Z",
        title: "自指目标",
        actions: [{ id: "az", text: "干活", done: false }],
      }),
    ]);
    expect(out.map((g) => g.id)).toEqual(["Z"]);
    expect(out[0].kind).toBe("long");
    expect(out[0].tasks.map((t) => t.id)).toEqual(["az"]);
  });

  it("legacy grandchild (short→short→long) parents to the NEAREST long and stays UI-reachable", () => {
    // long1 ⊃ child(short) ⊃ grandchild(short)。两级化后 short→short 在 UI 不可达，
    // 故 grandchild 必须挂到最近的 long 祖先 long1，且能被 shortGoalsOf(long1) 取到。
    const out = migrateGoals([
      legacyGoal({ id: "long1", horizon: "long", title: "长期" }),
      legacyGoal({ id: "child", horizon: "short", parentGoalId: "long1", title: "短期" }),
      legacyGoal({ id: "grandchild", horizon: "short", parentGoalId: "child", title: "孙级" }),
    ]);

    const grandchild = out.find((g) => g.id === "grandchild")!;
    expect(grandchild.kind).toBe("short");
    expect(grandchild.parentGoalId).toBe("long1"); // 不是 "child"（那是个 short，UI 不可达）

    // 关键：可达性 —— grandchild 真的能从顶层 long 的 shortGoalsOf 里被取到。
    const tree = treeOf(out);
    const shortsUnderLong1 = shortGoalsOf(tree, "long1").map((g) => g.id);
    expect(shortsUnderLong1).toContain("grandchild");
    expect(shortsUnderLong1).toContain("child");
    // 反证：没有任何 short 的 parentGoalId 指向另一个 short。
    const shortIds = new Set(out.filter((g) => g.kind === "short").map((g) => g.id));
    for (const g of out) {
      if (g.kind === "short") expect(shortIds.has(g.parentGoalId ?? "")).toBe(false);
    }
  });
});

describe("migrateGoals — nested 嵌套 → 两级", () => {
  const nested: NestedGoal = {
    id: "G",
    area: "health",
    title: "获得健康的身体",
    why: "底气",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    pathId: "path-9",
    tags: ["health"],
    metrics: [{ id: "gm1", label: "体脂", current: 25, target: 18, unit: "%" }],
    tasks: [{ id: "gt1", text: "体检", done: false }],
    habits: [{ id: "gh1", text: "每天走路", repeat: "daily" }],
    subgoals: [
      {
        id: "S1",
        title: "一个月减肥10斤",
        metrics: [{ id: "sm1", label: "体重", current: 80, target: 75, unit: "kg" }],
        tasks: [{ id: "st1", text: "称重", done: false }],
        habits: [{ id: "sh1", text: "每周三跑步", repeat: "weekly", repeatWeekday: 3 }],
      },
      {
        id: "S2",
        title: "睡眠达标",
        metrics: [],
        tasks: [],
        habits: [{ id: "sh2", text: "每天23点睡", repeat: "daily" }],
      },
    ],
  };

  it("a nested goal with 2 subgoals → 1 long + 2 short (ids preserved, parentGoalId set)", () => {
    const out = migrateGoals([nested]);
    expect(out).toHaveLength(3);

    const long = out.find((g) => g.id === "G")!;
    expect(long.kind).toBe("long");
    expect(long.parentGoalId).toBeNull();
    // long 保留自身 metrics/tasks/pathId/dates/id；不再带 subgoals；habits 无损并入 tasks（带 repeat）。
    expect(long.metrics.map((m) => m.id)).toEqual(["gm1"]);
    expect(long.tasks.map((t) => t.id)).toEqual(["gt1", "gh1"]);
    expect(long.tasks.find((t) => t.id === "gh1")?.repeat).toBe("daily");
    expect(long.pathId).toBe("path-9");
    expect(long.startDate).toBe("2026-01-01");
    expect(long.endDate).toBe("2026-12-31");
    expect("subgoals" in long).toBe(false);

    const s1 = out.find((g) => g.id === "S1")!;
    expect(s1.kind).toBe("short");
    expect(s1.parentGoalId).toBe("G");
    expect(s1.area).toBe("health"); // 继承父 area
    expect(s1.title).toBe("一个月减肥10斤");
    expect(s1.why).toBe("");
    expect(s1.status).toBe("active");
    expect(s1.createdAt).toBe("2026-01-01T00:00:00.000Z"); // 继承父 createdAt
    expect(s1.startDate).toBe("2026-01-01"); // 继承父窗口
    expect(s1.endDate).toBe("2026-12-31");
    expect(s1.pathId).toBeNull(); // 短期不上树
    // 每个 short 自带其 metrics/tasks（id 保留）；habits 无损并入 tasks（带 repeat）。
    expect(s1.metrics.map((m) => m.id)).toEqual(["sm1"]);
    expect(s1.tasks.map((t) => t.id)).toEqual(["st1", "sh1"]);
    expect(s1.tasks.find((t) => t.id === "sh1")?.repeat).toBe("weekly");
    expect(s1.tasks.find((t) => t.id === "sh1")?.repeatWeekday).toBe(3);

    const s2 = out.find((g) => g.id === "S2")!;
    expect(s2.kind).toBe("short");
    expect(s2.parentGoalId).toBe("G");
    expect(s2.metrics).toEqual([]);
    expect(s2.tasks.map((t) => t.id)).toEqual(["sh2"]);
    expect(s2.tasks.find((t) => t.id === "sh2")?.repeat).toBe("daily");
  });

  it("nested subgoal with missing metrics/tasks/habits arrays defaults to []", () => {
    const out = migrateGoals([
      {
        id: "G2",
        area: "growth",
        title: "成长",
        why: "",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        subgoals: [{ id: "Sx", title: "缺数组" }],
      } as NestedGoal,
    ]);
    const sx = out.find((g) => g.id === "Sx")!;
    expect(sx.metrics).toEqual([]);
    expect(sx.tasks).toEqual([]);
  });
});

describe("migrateGoals — 已是两级（幂等透传）", () => {
  const long: Goal = {
    id: "L", kind: "long", parentGoalId: null, area: "career", title: "长期", why: "",
    status: "active", createdAt: "2026-01-01T00:00:00.000Z", pathId: "p1", tags: ["x"],
    metrics: [{ id: "m1", label: "存款", current: 1, target: 10, unit: "k" }],
    tasks: [
      { id: "lt1", text: "目标级任务", done: true },
      { id: "lh1", text: "每天", done: false, repeat: "daily" },
    ],
  };
  const short: Goal = {
    id: "S", kind: "short", parentGoalId: "L", area: "career", title: "短期", why: "",
    status: "active", createdAt: "2026-01-01T00:00:00.000Z", startDate: "2026-01-01",
    endDate: "2026-03-31", pathId: null,
    metrics: [], tasks: [{ id: "st1", text: "做事", done: false }],
  };

  it("passes already-two-tier goals through byte-for-byte (not rebuilt)", () => {
    const out = migrateGoals([long, short]);
    expect(out).toHaveLength(2);
    expect(out.find((g) => g.id === "L")).toEqual(long);
    expect(out.find((g) => g.id === "S")).toEqual(short);
  });

  it("is idempotent: migrate(migrate(x)) deep-equals migrate(x)", () => {
    const once = migrateGoals([long, short]);
    const twice = migrateGoals(once);
    expect(twice).toEqual(once);
  });

  it("mixed input: legacy + nested + two-tier all coexist", () => {
    const out = migrateGoals([
      long, // two-tier long
      legacyGoal({ id: "legacy1", horizon: "long", actions: [{ id: "la", text: "迁移", done: false }] }),
      {
        id: "G", area: "health", title: "嵌套", why: "", status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        subgoals: [{ id: "Snest", title: "子" }],
      } as NestedGoal,
    ]);
    const ids = out.map((g) => g.id).sort();
    expect(ids).toEqual(["G", "L", "Snest", "legacy1"]);
    // two-tier 原样；legacy 迁成 long；nested 展平成 long + short。
    expect(out.find((g) => g.id === "L")).toEqual(long);
    expect(out.find((g) => g.id === "legacy1")!.kind).toBe("long");
    expect(out.find((g) => g.id === "G")!.kind).toBe("long");
    const snest = out.find((g) => g.id === "Snest")!;
    expect(snest.kind).toBe("short");
    expect(snest.parentGoalId).toBe("G");
  });

  it("mixed: a legacy short pointing at a two-tier long stays a real short under it (not orphaned/promoted)", () => {
    // L 是 two-tier long；legacy short 的 parentGoalId 指向 L（跨形态父）。
    // 旧逻辑只查 legacy 批 → 误判孤儿 → 提为 long，切断真实链接。修复后应保留为 L 下的 short。
    const out = migrateGoals([
      long, // two-tier long L
      legacyGoal({ id: "legShort", horizon: "short", parentGoalId: "L", title: "挂在两级 long 下" }),
    ]);

    const legShort = out.find((g) => g.id === "legShort")!;
    expect(legShort.kind).toBe("short");
    expect(legShort.parentGoalId).toBe("L"); // 没被提为 long

    // 可达性：能从 shortGoalsOf(L) 取到。
    expect(shortGoalsOf(treeOf(out), "L").map((g) => g.id)).toContain("legShort");
  });
});

describe("migrateGoals — 无损不变量 + 边界", () => {
  it("returns [] for empty input", () => {
    expect(migrateGoals([])).toEqual([]);
  });

  it("invariant — every input goal id AND every nested subgoal id appears as an output goal id (messy fixture)", () => {
    const input: Array<LegacyGoal | NestedGoal | Goal> = [
      legacyGoal({ id: "long1", horizon: "long" }),
      legacyGoal({ id: "short-top", horizon: "short", parentGoalId: null }),
      legacyGoal({ id: "orphan", horizon: "short", parentGoalId: "ghost" }),
      legacyGoal({ id: "child", horizon: "short", parentGoalId: "long1" }),
      legacyGoal({ id: "grandchild", horizon: "short", parentGoalId: "child" }),
      legacyGoal({ id: "selfref", horizon: "short", parentGoalId: "selfref" }),
      // 两节点互指环：A←→B。安全网必须仍把两者都落到输出。
      legacyGoal({ id: "cycleA", horizon: "short", parentGoalId: "cycleB" }),
      legacyGoal({ id: "cycleB", horizon: "short", parentGoalId: "cycleA" }),
      // nested：顶层 + 两个子目标，全部 id 都得在输出。
      {
        id: "nest", area: "growth", title: "嵌套", why: "", status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        subgoals: [{ id: "nsub1", title: "a" }, { id: "nsub2", title: "b" }],
      } as NestedGoal,
      // 已两级直接透传。
      {
        id: "two", kind: "long", parentGoalId: null, area: "career", title: "已两级", why: "",
        status: "active", createdAt: "2026-01-01T00:00:00.000Z",
        metrics: [], tasks: [],
      } as Goal,
    ];

    const out = migrateGoals(input);

    // 每个输入 goal id + nested subgoal id 都作为输出 goal id 出现。
    const present = new Set(out.map((g) => g.id));
    const expectedIds = [
      "long1", "short-top", "orphan", "child", "grandchild", "selfref",
      "cycleA", "cycleB", "nest", "nsub1", "nsub2", "two",
    ];
    for (const id of expectedIds) {
      expect(present.has(id)).toBe(true);
    }

    // 没有任何 id 在输出里出现两次。
    const all = out.map((g) => g.id);
    expect(all.length).toBe(new Set(all).size);

    // 每条输出都带 kind（无损 + 形状完整）。
    for (const g of out) {
      expect(g.kind === "long" || g.kind === "short").toBe(true);
    }
  });
});
