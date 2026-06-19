# 激励闭环 Planner（v2）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把重心从"看见多重人生"挪到"每天真的去走"：新增合并仪表盘首页（今日计划 + 连续天数 + 完成热力图 + 缩略人生树 + "你在这里"标记），勾掉任务当场看见标记沿分支前进；做完整条长期目标才真实加领域分。最小"重复行动"让今日清单不断粮。

**Architecture:** 纯领域层 `daily.ts`（在已有 `goals.ts`/`tree.ts` 之上，操作 `LifeTree.activity`）+ 一条轻 AI 路由 `/api/today-plan`（带本地兜底+限流）+ `AppContext` 加 `dashboard` 视图与今日方法 + `LifeMap` 加 `markers`/`compact` + 新 `DashboardScreen`。复用现有 `goalProgress`、`FutureSelfChat`（开分支详情）、`cubicYAtX`。

**Tech Stack:** Next.js 16 App Router（`POST(request: Request)` + `Response.json`）、React 19、Tailwind v4、Vitest 4（node env）。DeepSeek 经 `/api/*`，无 key 时本地兜底。

**约束（项目铁律）：** 领域层不用 `Date.now`/`Math.random`（时间/today 注入）；渲染期不调用 `new Date()`（模块级 boot 值 + effect 刷新）；中文串里绝不出现英文直引号；新中文文案都要在 `src/i18n/messages.ts` 补英文；只在被明确要求时提交。

---

## File Structure

- Create: `src/domain/daily.ts` / `src/domain/__tests__/daily.test.ts`
- Create: `src/app/api/today-plan/route.ts` / `src/lib/dailyClient.ts`
- Create: `src/components/DashboardScreen.tsx`
- Modify: `src/domain/types.ts`（`ActivityDay` + `LifeTree.activity`；`GoalAction.repeat?`）
- Modify: `src/domain/goals.ts`（`goalProgress` 排除重复行动；新增 `setActionRepeat`）+ `src/domain/__tests__/goals.test.ts`
- Modify: `src/domain/tree.ts`（`createTree` 初始化 `activity: []`）
- Modify: `src/domain/repository/localStorageRepo.ts`（load 回填 `activity ??= []`）
- Modify: `src/state/AppContext.tsx`（`dashboard` 视图 + 默认落点 + 今日方法 + `setActionRepeatById`）
- Modify: `src/components/LifeMap.tsx`（`markers` + `compact`）
- Modify: `src/app/page.tsx`（路由 `dashboard`）
- Modify: `src/components/TreeScreen.tsx`（头部加"今日/我的规划"入口）
- Modify: `src/components/PlanScreen.tsx`（每条行动加「＋今天」+ 🔁 重复开关，跳转改 openDashboard）
- Modify: `src/i18n/messages.ts`（新文案英文）

---

## Task 1: 数据模型 ActivityDay + GoalAction.repeat + 迁移

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/tree.ts`（`createTree`，约 32-42 行）
- Modify: `src/domain/repository/localStorageRepo.ts`（`load`，约 57-59 行）
- Test: `src/domain/__tests__/tree.test.ts`

- [ ] **Step 1: GoalAction 加 repeat?**

在 `src/domain/types.ts` 把 `GoalAction` 接口（约 184-188 行）改为：

```ts
export interface GoalAction {
  id: string;
  text: string;
  done: boolean;
  repeat?: "daily" | "weekly"; // 缺省=一次性（里程碑，计入进度）；重复行动=日常纪律，不计入进度
}
```

- [ ] **Step 2: ActivityDay + LifeTree.activity**

在 `Goal` 与 `LifeTree` 接口之间插入：

```ts
// ───────── 每日激励闭环：今日计划 / 连续天数 / 完成热力图 ─────────
// 一天的活动：当天挑进"今天"的行动 id + 当天勾掉完成的行动 id。date 用本地日 YYYY-MM-DD。
export interface ActivityDay {
  date: string; // 本地日期 YYYY-MM-DD（由 state 层注入，不在领域层取 new Date）
  plannedActionIds: string[];
  completedActionIds: string[];
}
```

把 `LifeTree` 的 `goals: Goal[];` 之后加：

```ts
  goals: Goal[]; // 规划主线：长期/短期目标
  activity: ActivityDay[]; // 每日激励闭环：今日计划/完成记录
```

- [ ] **Step 3: createTree 初始化 activity**

`src/domain/tree.ts` 的 `createTree` 返回对象里，`goals: [],` 后加 `activity: [],`：

```ts
    decisions: [],
    goals: [],
    activity: [],
    createdAt: now,
```

- [ ] **Step 4: localStorage 回填 activity**

`src/domain/repository/localStorageRepo.ts` 的 `load()` 中，`if (!Array.isArray(parsed.goals)) parsed.goals = [];` 后加：

```ts
      if (!Array.isArray(parsed.goals)) parsed.goals = []; // 旧树兼容：补 goals
      if (!Array.isArray(parsed.activity)) parsed.activity = []; // 旧树兼容：补 activity
```

- [ ] **Step 5: tree.test.ts 追加一条**

```ts
  it("createTree starts with empty activity", () => {
    const t = createTree(profile, gen, NOW);
    expect(t.activity).toEqual([]);
  });
```
（用该文件已有的 `profile`/`gen`/`NOW` 同义变量。）

- [ ] **Step 6: 类型 + 测试**

Run: `npx tsc --noEmit`
Expected: 无报错（若有别处用字面量构造 `LifeTree` 的测试报缺 `activity`，给该字面量补 `activity: []`）。

Run: `npx vitest run src/domain/__tests__/tree.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/tree.ts src/domain/repository/localStorageRepo.ts src/domain/__tests__/tree.test.ts
git commit -m "feat(domain): ActivityDay + GoalAction.repeat + migration-safe load"
```

---

## Task 2: goals.ts 进度排除重复 + setActionRepeat（TDD）

**Files:**
- Modify: `src/domain/goals.ts`
- Test: `src/domain/__tests__/goals.test.ts`

- [ ] **Step 1: 给 goals.test.ts 追加两条失败测试**

在 `goals.test.ts` 顶部 import 里追加 `setActionRepeat`：

```ts
import {
  createGoal, upsertGoal, linkGoalPath, setGoalActions, toggleGoalAction,
  goalById, childGoals, goalProgress, completeGoal, dropGoal, achievedPathIds,
  dueGoalReviews, recordGoalReview, setActionRepeat, AREA_BUMP,
} from "@/domain/goals";
```

在最外层 `describe` 内追加：

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/domain/__tests__/goals.test.ts`
Expected: FAIL（`setActionRepeat` 未导出；progress 仍把重复算进去）。

- [ ] **Step 3: 改 goalProgress + 加 setActionRepeat**

在 `src/domain/goals.ts` 把 `goalProgress`（约 72-82 行）改为只数一次性行动：

```ts
// 进度 0–1：只数"一次性行动(里程碑)"+子目标；重复行动是日常纪律，不计入进度。
export function goalProgress(tree: LifeTree, goal: Goal): number {
  const milestones = goal.actions.filter((a) => !a.repeat);
  if (goal.horizon === "long") {
    const kids = childGoals(tree, goal.id);
    const total = kids.length + milestones.length;
    if (total === 0) return 0;
    const done = kids.filter((k) => k.status === "done").length + milestones.filter((a) => a.done).length;
    return done / total;
  }
  if (milestones.length === 0) return 0;
  return milestones.filter((a) => a.done).length / milestones.length;
}
```

在 `toggleGoalAction`（约 57-62 行）之后加：

```ts
// 设置/清除某行动的重复标记（关→每天→每周→关 由 UI 决定）。
export function setActionRepeat(
  goal: Goal,
  actionId: string,
  repeat: GoalAction["repeat"],
): Goal {
  return {
    ...goal,
    actions: goal.actions.map((a) => (a.id === actionId ? { ...a, repeat } : a)),
  };
}
```

确认文件顶部 import 含 `GoalAction`：把第 1 行

```ts
import type { Goal, GoalAction, GoalInput, LifeTree } from "./types";
```
（已包含 `GoalAction`，无需改；若没有则补上。）

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/domain/__tests__/goals.test.ts`
Expected: PASS（新 2 条 + 原有全绿；原有进度测试不受影响，因为它们的行动都没有 repeat）。

- [ ] **Step 5: Commit**

```bash
git add src/domain/goals.ts src/domain/__tests__/goals.test.ts
git commit -m "feat(domain): goalProgress counts milestones only; setActionRepeat"
```

---

## Task 3: 领域纯函数 daily.ts（含重复行动，TDD）

**Files:**
- Create: `src/domain/daily.ts`
- Test: `src/domain/__tests__/daily.test.ts`

- [ ] **Step 1: 写失败测试 daily.test.ts**

```ts
import { describe, it, expect } from "vitest";
import {
  localDay, addDays, dayEntry, planToday, unplanToday,
  completeAction, uncompleteAction, isActionDoneToday, recurringDueToday,
  todayItems, currentStreak, heatmap, branchPositionAge,
} from "@/domain/daily";
import { createTree, addPath } from "@/domain/tree";
import { createGoal, upsertGoal, setGoalActions, setActionRepeat, linkGoalPath } from "@/domain/goals";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { LifeTree, Profile } from "@/domain/types";

const profile: Profile = {
  name: "小林", age: 30, education: "bachelor", major: "视觉传达", occupation: "设计师",
  salary: "5to10", hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "dating",
  location: "杭州", status: "工作5年", snapshot: "设计师", crossroad: "",
  areas: { career: 50, wealth: 45, relationships: 55, health: 60, growth: 50 },
};
const gen = new LocalPathGenerator();
const NOW = "2026-06-18T00:00:00.000Z";
const T = "2026-06-18";

function withShortGoal(): { tree: LifeTree; goalId: string; a0: string; a1: string } {
  let t = createTree(profile, gen, NOW);
  let g = createGoal({ area: "growth", horizon: "short", title: "学英语", why: "" }, NOW);
  g = setGoalActions(g, ["写完简历", "看一集美剧"]);
  t = upsertGoal(t, g);
  return { tree: t, goalId: g.id, a0: g.actions[0].id, a1: g.actions[1].id };
}

describe("daily domain", () => {
  it("addDays steps calendar days (UTC-stable)", () => {
    expect(addDays("2026-06-18", -1)).toBe("2026-06-17");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("localDay slices a Date to YYYY-MM-DD", () => {
    expect(localDay(new Date("2026-06-18T15:30:00"))).toBe("2026-06-18");
  });

  it("planToday adds (deduped); unplanToday removes", () => {
    const { tree, a0 } = withShortGoal();
    let t = planToday(tree, a0, T);
    t = planToday(t, a0, T);
    expect(dayEntry(t, T).plannedActionIds).toEqual([a0]);
    t = unplanToday(t, a0, T);
    expect(dayEntry(t, T).plannedActionIds).toEqual([]);
  });

  it("completeAction (one-shot): marks done, records day, backfills planned", () => {
    const { tree, goalId, a0 } = withShortGoal();
    const t = completeAction(tree, a0, T);
    const goal = t.goals.find((g) => g.id === goalId)!;
    expect(goal.actions.find((a) => a.id === a0)!.done).toBe(true);
    expect(dayEntry(t, T).completedActionIds).toEqual([a0]);
    expect(dayEntry(t, T).plannedActionIds).toContain(a0);
  });

  it("uncompleteAction (one-shot): reverses done and removes from day", () => {
    const { tree, goalId, a0 } = withShortGoal();
    let t = completeAction(tree, a0, T);
    t = uncompleteAction(t, a0, T);
    const goal = t.goals.find((g) => g.id === goalId)!;
    expect(goal.actions.find((a) => a.id === a0)!.done).toBe(false);
    expect(dayEntry(t, T).completedActionIds).toEqual([]);
  });

  it("completeAction (recurring): records the day but does NOT set permanent done", () => {
    let { tree, goalId, a1 } = withShortGoal();
    let g = tree.goals.find((x) => x.id === goalId)!;
    tree = upsertGoal(tree, setActionRepeat(g, a1, "daily"));
    const t = completeAction(tree, a1, T);
    const action = t.goals.find((x) => x.id === goalId)!.actions.find((a) => a.id === a1)!;
    expect(action.done).toBe(false); // 重复行动不写永久 done
    expect(dayEntry(t, T).completedActionIds).toContain(a1);
    expect(isActionDoneToday(t, action, T)).toBe(true); // 但今天算完成
    expect(isActionDoneToday(t, action, "2026-06-19")).toBe(false); // 次日重新可做
  });

  it("recurringDueToday: daily always shows; weekly hides once done this week", () => {
    let { tree, goalId, a0, a1 } = withShortGoal();
    let g = tree.goals.find((x) => x.id === goalId)!;
    g = setActionRepeat(g, a0, "daily");
    g = setActionRepeat(g, a1, "weekly");
    tree = upsertGoal(tree, g);
    expect(recurringDueToday(tree, T).map((x) => x.action.id).sort()).toEqual([a0, a1].sort());
    const t = completeAction(tree, a1, T); // 完成 weekly
    expect(recurringDueToday(t, T).map((x) => x.action.id)).toEqual([a0]); // weekly 本周隐藏，daily 仍在
  });

  it("todayItems = manual one-shot ∪ recurring-due, each with doneToday", () => {
    let { tree, goalId, a0, a1 } = withShortGoal();
    let g = tree.goals.find((x) => x.id === goalId)!;
    g = setActionRepeat(g, a1, "daily"); // a1 重复, a0 一次性
    tree = upsertGoal(tree, g);
    let t = planToday(tree, a0, T); // 手动挑一次性
    t = completeAction(t, a1, T); // 完成重复
    const items = todayItems(t, T);
    expect(items.map((i) => i.action.id).sort()).toEqual([a0, a1].sort());
    expect(items.find((i) => i.action.id === a1)!.doneToday).toBe(true);
    expect(items.find((i) => i.action.id === a0)!.doneToday).toBe(false);
  });

  it("currentStreak counts consecutive completed days, grace for today", () => {
    const { tree, a0, a1 } = withShortGoal();
    let t = completeAction(tree, a0, "2026-06-16");
    t = completeAction(t, a1, "2026-06-17");
    expect(currentStreak(t, "2026-06-18")).toBe(2); // 今天没做但 17/16 连着 → 宽限
    let t2 = completeAction(t, a0, "2026-06-18");
    expect(currentStreak(t2, "2026-06-18")).toBe(3);
    const t3 = completeAction(withShortGoal().tree, a0, "2026-06-15");
    expect(currentStreak(t3, "2026-06-18")).toBe(0); // 缺 16/17，今/昨都没 → 0
  });

  it("heatmap returns N days ending today with counts", () => {
    const { tree, a0, a1 } = withShortGoal();
    let t = completeAction(tree, a0, "2026-06-18");
    t = completeAction(t, a1, "2026-06-18");
    const hm = heatmap(t, 3, "2026-06-18");
    expect(hm.map((d) => d.date)).toEqual(["2026-06-16", "2026-06-17", "2026-06-18"]);
    expect(hm[2].count).toBe(2);
    expect(hm[0].count).toBe(0);
  });

  it("branchPositionAge walks the branch by progress; null for short/no-path", () => {
    let t = addPath(createTree(profile, gen, NOW), "去读研", gen, NOW);
    const branch = t.paths.find((p) => p.kind === "choice")!;
    let long = createGoal({ area: "career", horizon: "long", title: "读研", why: "", pathId: branch.id }, NOW);
    long = setGoalActions(long, ["a", "b", "c", "d"]);
    t = upsertGoal(t, long);
    t = linkGoalPath(t, long.id, branch.id);
    const g0 = t.goals.find((g) => g.id === long.id)!;
    const endAge = branch.nodes.length ? branch.nodes[branch.nodes.length - 1].age : branch.forkAge + t.horizonYears;
    expect(branchPositionAge(t, g0)).toBeCloseTo(branch.forkAge, 5);
    let t2 = completeAction(t, g0.actions[0].id, T);
    t2 = completeAction(t2, g0.actions[1].id, T);
    const g1 = t2.goals.find((g) => g.id === long.id)!;
    expect(branchPositionAge(t2, g1)).toBeCloseTo(branch.forkAge + 0.5 * (endAge - branch.forkAge), 5);
    const short = createGoal({ area: "health", horizon: "short", title: "S", why: "" }, NOW);
    expect(branchPositionAge(upsertGoal(t, short), short)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/domain/__tests__/daily.test.ts`
Expected: FAIL（`Cannot find module '@/domain/daily'`）

- [ ] **Step 3: 实现 daily.ts**

```ts
import type { ActivityDay, Goal, GoalAction, LifeTree } from "./types";
import { goalProgress } from "./goals";

// ───────────────────────────────────────────────────────────────────────────
// daily —— 每日激励闭环纯函数：今日计划 / 重复行动 / 连续天数 / 热力图 / 分支位置。
// 一律操作本地日 "YYYY-MM-DD"，日差用 UTC 解析避免时区漂移。
// 不用 Date.now/Math.random：today 由 state 层注入。
// ───────────────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0");

// 把 Date 切成本地日 YYYY-MM-DD（state 层用 new Date() 调它，是唯一不纯的边界）。
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dayNum(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function addDays(day: string, delta: number): string {
  const d = new Date((dayNum(day) + delta) * 86_400_000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function activity(tree: LifeTree): ActivityDay[] {
  return tree.activity ?? [];
}

export function dayEntry(tree: LifeTree, today: string): ActivityDay {
  return (
    activity(tree).find((a) => a.date === today) ?? {
      date: today,
      plannedActionIds: [],
      completedActionIds: [],
    }
  );
}

function putDay(tree: LifeTree, entry: ActivityDay): LifeTree {
  const list = activity(tree);
  const exists = list.some((a) => a.date === entry.date);
  return {
    ...tree,
    activity: exists ? list.map((a) => (a.date === entry.date ? entry : a)) : [...list, entry],
  };
}

const addUniq = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id]);

export function findAction(
  tree: LifeTree,
  actionId: string,
): { goal: Goal; action: GoalAction } | null {
  for (const goal of tree.goals ?? []) {
    const action = goal.actions.find((a) => a.id === actionId);
    if (action) return { goal, action };
  }
  return null;
}

function setActionDone(tree: LifeTree, actionId: string, done: boolean): LifeTree {
  return {
    ...tree,
    goals: (tree.goals ?? []).map((g) =>
      g.actions.some((a) => a.id === actionId)
        ? { ...g, actions: g.actions.map((a) => (a.id === actionId ? { ...a, done } : a)) }
        : g,
    ),
  };
}

export function planToday(tree: LifeTree, actionId: string, today: string): LifeTree {
  const e = dayEntry(tree, today);
  return putDay(tree, { ...e, plannedActionIds: addUniq(e.plannedActionIds, actionId) });
}

export function unplanToday(tree: LifeTree, actionId: string, today: string): LifeTree {
  const e = dayEntry(tree, today);
  return putDay(tree, { ...e, plannedActionIds: e.plannedActionIds.filter((x) => x !== actionId) });
}

// 完成：记进当天 completed。重复行动不写永久 done（次日/下周重新可做）；
// 一次性行动顺带写 done 并补进 planned（"勾了就算今天计划过"）。
export function completeAction(tree: LifeTree, actionId: string, today: string): LifeTree {
  const hit = findAction(tree, actionId);
  if (!hit) return tree;
  const recurring = Boolean(hit.action.repeat);
  const t = recurring ? tree : setActionDone(tree, actionId, true);
  const e = dayEntry(t, today);
  return putDay(t, {
    ...e,
    plannedActionIds: recurring ? e.plannedActionIds : addUniq(e.plannedActionIds, actionId),
    completedActionIds: addUniq(e.completedActionIds, actionId),
  });
}

// 取消完成：从当天 completed 移除；一次性行动同时 done=false。
export function uncompleteAction(tree: LifeTree, actionId: string, today: string): LifeTree {
  const hit = findAction(tree, actionId);
  const recurring = Boolean(hit?.action.repeat);
  const t = recurring ? tree : setActionDone(tree, actionId, false);
  const e = dayEntry(t, today);
  return putDay(t, { ...e, completedActionIds: e.completedActionIds.filter((x) => x !== actionId) });
}

// 某行动今天是否算"已完成"：一次性=done；daily=今天记过；weekly=最近 7 天内记过。
export function isActionDoneToday(tree: LifeTree, action: GoalAction, today: string): boolean {
  if (!action.repeat) return action.done;
  if (action.repeat === "daily") return dayEntry(tree, today).completedActionIds.includes(action.id);
  for (let i = 0; i < 7; i++) {
    if (dayEntry(tree, addDays(today, -i)).completedActionIds.includes(action.id)) return true;
  }
  return false;
}

// 今天该出现的重复行动：daily 永远在；weekly 仅在"本周未完成"时出现（完成后隐藏一周）。
export function recurringDueToday(
  tree: LifeTree,
  today: string,
): { goal: Goal; action: GoalAction }[] {
  const out: { goal: Goal; action: GoalAction }[] = [];
  for (const goal of tree.goals ?? []) {
    if (goal.status !== "active") continue;
    for (const action of goal.actions) {
      if (!action.repeat) continue;
      if (action.repeat === "weekly" && isActionDoneToday(tree, action, today)) continue;
      out.push({ goal, action });
    }
  }
  return out;
}

// 今日清单：手动挑的一次性行动 ∪ 今天该做的重复行动；每条带 doneToday。
export function todayItems(
  tree: LifeTree,
  today: string,
): { goal: Goal; action: GoalAction; doneToday: boolean }[] {
  const e = dayEntry(tree, today);
  const seen = new Set<string>();
  const out: { goal: Goal; action: GoalAction; doneToday: boolean }[] = [];
  // 手动（一次性）：planned ∪ completed，按加入顺序
  for (const id of [...e.plannedActionIds, ...e.completedActionIds]) {
    if (seen.has(id)) continue;
    const hit = findAction(tree, id);
    if (!hit || hit.action.repeat) continue; // 重复行动走下面那段，避免重复
    seen.add(id);
    out.push({ goal: hit.goal, action: hit.action, doneToday: isActionDoneToday(tree, hit.action, today) });
  }
  // 重复行动（自动回今日）
  for (const { goal, action } of recurringDueToday(tree, today)) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    out.push({ goal, action, doneToday: isActionDoneToday(tree, action, today) });
  }
  return out;
}

function completedOn(tree: LifeTree, day: string): number {
  return dayEntry(tree, day).completedActionIds.length;
}

// 连续天数：从 today 往前数连续"完成≥1"的天；宽限——今天没完成则从昨天起算。
export function currentStreak(tree: LifeTree, today: string): number {
  let cursor = completedOn(tree, today) > 0 ? today : addDays(today, -1);
  let streak = 0;
  while (completedOn(tree, cursor) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// 最近 N 天（含今天）每天完成数，升序。
export function heatmap(
  tree: LifeTree,
  sinceDays: number,
  today: string,
): { date: string; count: number }[] {
  const out: { date: string; count: number }[] = [];
  for (let i = sinceDays - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push({ date, count: completedOn(tree, date) });
  }
  return out;
}

// "你在这里"：长期目标分支上按进度落在 forkAge→endAge 之间的年龄；短期/无分支返回 null。
export function branchPositionAge(tree: LifeTree, goal: Goal): number | null {
  if (goal.horizon !== "long" || !goal.pathId) return null;
  const path = tree.paths.find((p) => p.id === goal.pathId);
  if (!path) return null;
  const endAge = path.nodes.length
    ? path.nodes[path.nodes.length - 1].age
    : path.forkAge + tree.horizonYears;
  return path.forkAge + goalProgress(tree, goal) * (endAge - path.forkAge);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/domain/__tests__/daily.test.ts`
Expected: PASS（全绿）

- [ ] **Step 5: Commit**

```bash
git add src/domain/daily.ts src/domain/__tests__/daily.test.ts
git commit -m "feat(domain): daily.ts — today plan, recurring actions, streak, heatmap, marker"
```

---

## Task 4: /api/today-plan 路由 + dailyClient

**Files:**
- Create: `src/app/api/today-plan/route.ts`
- Create: `src/lib/dailyClient.ts`

- [ ] **Step 1: 写路由（镜像 goal-actions：本地兜底 + 限流）**

`src/app/api/today-plan/route.ts`：

```ts
// 服务端：从"还没完成的行动"里挑今天最该做的≤3条。无 key/限流时本地兜底。
import { allowRequest } from "@/lib/rateLimit";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface PendingItem {
  id: string;
  text: string;
  goalTitle: string;
}
interface Body {
  profileSummary?: string;
  pending?: PendingItem[];
  lang?: "zh" | "en";
}

function getKey(): string | null {
  const k = process.env.DEEPSEEK_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

function extractJson(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const s = body.indexOf("{");
  const e = body.lastIndexOf("}");
  return s === -1 || e === -1 || e < s ? null : body.slice(s, e + 1);
}

// 兜底：跨不同目标各取第一条、最多 3 条，给通用理由。
function localPick(pending: PendingItem[], lang?: string): { id: string; why: string }[] {
  const why = lang === "en" ? "A small step you can finish today" : "今天就能推进的一小步";
  const seen = new Set<string>();
  const spread: PendingItem[] = [];
  for (const p of pending) {
    if (!seen.has(p.goalTitle)) {
      seen.add(p.goalTitle);
      spread.push(p);
    }
  }
  return (spread.length ? spread : pending).slice(0, 3).map((p) => ({ id: p.id, why }));
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ pick: [] }, { status: 400 });
  }
  const pending = Array.isArray(body.pending) ? body.pending.filter((p) => p?.id && p?.text) : [];
  if (!pending.length) return Response.json({ pick: [] });

  const key = getKey();
  if (!allowRequest(request, Date.now()) || !key) {
    return Response.json({ pick: localPick(pending, body.lang) });
  }

  const list = pending.map((p) => `- [${p.id}] ${p.text}（来自目标：${p.goalTitle}）`).join("\n");
  const system = [
    "从下面这些还没完成的行动里，挑出今天最值得做的最多 3 条，帮一个人把今天过得有进展。",
    "优先：能马上动手的、能解锁后续的、跨不同目标平衡推进。",
    body.profileSummary ? `他的现状：${body.profileSummary}。` : "",
    "每条给出它的 id 和一句话理由（≤20字）。只能从给定 id 里选，不要编新行动。",
    body.lang === "en"
      ? "LANGUAGE: write each why in natural English (≤ 12 words)."
      : "语言：理由用简体中文。",
    "只输出如下 json，不要解释或代码块：",
    '{"pick":[{"id":"行动id","why":"一句话理由"}]}',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `这些是待办行动：\n${list}` },
        ],
        response_format: MODEL.includes("reasoner") ? undefined : { type: "json_object" },
        max_tokens: 400,
        temperature: 0.6,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[today-plan] DeepSeek ${res.status}`);
      return Response.json({ pick: localPick(pending, body.lang) });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json({ pick: localPick(pending, body.lang) });
    const parsed = JSON.parse(json) as { pick?: { id?: unknown; why?: unknown }[] };
    const valid = new Set(pending.map((p) => p.id));
    const pick = (parsed.pick || [])
      .map((x) => ({ id: String(x.id ?? "").trim(), why: String(x.why ?? "").trim() }))
      .filter((x) => valid.has(x.id))
      .slice(0, 3);
    return Response.json({ pick: pick.length ? pick : localPick(pending, body.lang) });
  } catch (e) {
    console.error("[today-plan] failed:", e);
    return Response.json({ pick: localPick(pending, body.lang) });
  }
}
```

- [ ] **Step 2: 写 dailyClient.ts**

```ts
// 客户端安全：今日计划网络封装 + 本地"今天"日串。
import type { LifeTree } from "@/domain/types";
import { localDay } from "@/domain/daily";
import { currentLocale } from "@/i18n/locale";

export interface TodayPick {
  id: string;
  why: string;
}

export function localTodayStr(): string {
  return localDay(new Date());
}

export async function fetchTodayPlan(
  tree: LifeTree,
  pending: { id: string; text: string; goalTitle: string }[],
): Promise<TodayPick[]> {
  if (!pending.length) return [];
  try {
    const res = await fetch("/api/today-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileSummary: tree.profile.snapshot || "", pending, lang: currentLocale() }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { pick?: TodayPick[] };
    return Array.isArray(data.pick) ? data.pick.filter((p) => p && typeof p.id === "string") : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/today-plan/route.ts src/lib/dailyClient.ts
git commit -m "feat(api): /api/today-plan picks today's actions (offline fallback) + dailyClient"
```

---

## Task 5: AppContext —— dashboard 视图 + 今日方法 + 重复开关

**Files:**
- Modify: `src/state/AppContext.tsx`

- [ ] **Step 1: 扩 View 与 import**

第 42 行改：
```ts
export type View = "onboarding" | "tree" | "detail" | "plan" | "dashboard";
```

`from "@/domain/goals"` 的 import 块里追加 `setActionRepeat`；并新增 daily 的 import：

```ts
import {
  completeGoal, createGoal, dropGoal, dueGoalReviews, recordGoalReview,
  setActionRepeat, setGoalActions, toggleGoalAction, upsertGoal,
} from "@/domain/goals";
import { completeAction, planToday, uncompleteAction, unplanToday, localDay } from "@/domain/daily";
```

- [ ] **Step 2: action 类型 + reducer 分支**

`type Action` 里 `| { type: "openPlan" }` 后加：
```ts
  | { type: "openPlan" }
  | { type: "openDashboard" }
```
reducer 里 `case "openPlan":` 后加：
```ts
    case "openDashboard":
      return { ...state, activePathId: null, view: "dashboard" };
```

- [ ] **Step 3: hydrate 默认落 dashboard**

`case "hydrate":` 里把 `view: action.tree ? "tree" : "onboarding",` 改为：
```ts
        view: action.tree ? "dashboard" : "onboarding",
```

- [ ] **Step 4: 扩 AppApi 接口**

`markDueGoalsReviewed: () => void;` 后加：
```ts
  openDashboard: () => void;
  openTree: () => void;
  planActionToday: (actionId: string) => void;
  unplanActionToday: (actionId: string) => void;
  toggleTodayAction: (actionId: string) => void;
  setActionRepeatById: (goalId: string, actionId: string, repeat: "daily" | "weekly" | undefined) => void;
```

- [ ] **Step 5: 实现方法（api 对象里，`markDueGoalsReviewed` 之后）**

```ts
      openDashboard: () => dispatch({ type: "openDashboard" }),
      openTree: () => dispatch({ type: "backToTree" }),
      planActionToday: (actionId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: planToday(baseTree, actionId, localDay(new Date())) });
      },
      unplanActionToday: (actionId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: unplanToday(baseTree, actionId, localDay(new Date())) });
      },
      toggleTodayAction: (actionId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const today = localDay(new Date());
        const e = (baseTree.activity ?? []).find((a) => a.date === today);
        const hit = (baseTree.goals ?? []).flatMap((g) => g.actions).find((a) => a.id === actionId);
        // 重复行动看"今天是否记过"；一次性看 done。
        const doneNow = hit?.repeat ? Boolean(e?.completedActionIds.includes(actionId)) : Boolean(hit?.done);
        const next = doneNow
          ? uncompleteAction(baseTree, actionId, today)
          : completeAction(baseTree, actionId, today);
        dispatch({ type: "patchTree", tree: next });
      },
      setActionRepeatById: (goalId, actionId, repeat) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const goal = (baseTree.goals ?? []).find((g) => g.id === goalId);
        if (!goal) return;
        dispatch({ type: "patchTree", tree: upsertGoal(baseTree, setActionRepeat(goal, actionId, repeat)) });
      },
```

- [ ] **Step 6: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 7: Commit**

```bash
git add src/state/AppContext.tsx
git commit -m "feat(state): dashboard view (default landing) + today/repeat methods"
```

---

## Task 6: LifeMap —— markers + compact

**Files:**
- Modify: `src/components/LifeMap.tsx`

- [ ] **Step 1: import cubicYAtX + 扩 props**

第 14 行改：
```ts
import { cubicYAtX, layoutMap, type MapLayout, type MapNode, type PathLayout } from "./mapLayout";
```

`export function LifeMap({...})` 参数块（约 47-57 行）改为：
```ts
export function LifeMap({
  tree,
  onSelectPath,
  onForkAtNode,
  achievedIds,
  markers,
  compact = false,
}: {
  tree: LifeTree;
  onSelectPath: (id: string) => void;
  onForkAtNode: (parentId: string, forkAge: number, atLabel: string) => void;
  achievedIds?: Set<string>;
  markers?: { pathId: string; age: number; label?: string }[];
  compact?: boolean;
}) {
```

- [ ] **Step 2: compact 影响布局**

`layout` 的 useMemo（约 62-65 行）改为：
```ts
  const layout: MapLayout = useMemo(
    () => layoutMap(tree.paths, tree.profile.age, tree.horizonYears, compact ? { height: 380 } : {}),
    [tree.paths, tree.profile.age, tree.horizonYears, compact],
  );
```

- [ ] **Step 3: 计算 marker 坐标**

`const { width: W, height: H, origin } = layout;`（约 193 行）之后加：
```ts
  const markerPts = useMemo(() => {
    if (!markers?.length) return [];
    const byId = new Map(layout.items.map((it) => [it.id, it]));
    return markers
      .map((m) => {
        const it = byId.get(m.pathId);
        if (!it) return null;
        const x = layout.xFor(m.age);
        const y = cubicYAtX(it.start, it.c1, it.c2, it.end, x);
        return { x, y, color: it.color, label: m.label };
      })
      .filter((p): p is { x: number; y: number; color: string; label?: string } => p !== null);
  }, [markers, layout]);
```

- [ ] **Step 4: 渲染标记（origin 那组 `</g>` 之后、外层变换 `</g>` 之前，约 325-326 行之间）**

```tsx
          {markerPts.map((m, i) => (
            <g key={`marker-${i}`} aria-hidden>
              <circle
                cx={m.x}
                cy={m.y}
                r={6}
                fill={m.color}
                stroke="#fff"
                strokeWidth={2}
                className={reduced ? undefined : "lp-origin"}
                style={{ filter: `drop-shadow(0 0 8px ${m.color})` }}
              />
              <text
                x={m.x}
                y={m.y - 12}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill="var(--fg)"
                style={{ paintOrder: "stroke", stroke: "var(--bg-0)", strokeWidth: 3 }}
              >
                {m.label ?? t("你在这里")}
              </text>
            </g>
          ))}
```

- [ ] **Step 5: compact 隐藏底部提示**

底部提示那段（约 346-349 行）包条件：
```tsx
      {!compact && (
        <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-[var(--fg-faint)]">
          {t("拖动平移 · 滚轮缩放 · 点曲线看那段人生 · 点节点在那里加岔路")}
        </div>
      )}
```

- [ ] **Step 6: 类型 + 既有地图测试**

Run: `npx tsc --noEmit` → 无报错。
Run: `npx vitest run src/domain/__tests__/mapLayout.test.ts` → PASS。

- [ ] **Step 7: Commit**

```bash
git add src/components/LifeMap.tsx
git commit -m "feat(map): LifeMap position markers + compact mode"
```

---

## Task 7: DashboardScreen（合并仪表盘）

**Files:**
- Create: `src/components/DashboardScreen.tsx`

- [ ] **Step 1: 写组件**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Button } from "./ui/Button";
import { LifeMap } from "./LifeMap";
import { AREA_LABELS } from "@/domain/types";
import { branchPositionAge, currentStreak, heatmap, todayItems } from "@/domain/daily";
import { fetchTodayPlan, localTodayStr, type TodayPick } from "@/lib/dailyClient";

const _bootToday = localTodayStr();

export function DashboardScreen() {
  const { tree, openPlan, openTree, openPath, toggleTodayAction, planActionToday } = useApp();
  const { t } = useT();

  const [today, setToday] = useState(_bootToday);
  useEffect(() => {
    const update = () => setToday(localTodayStr());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const [picks, setPicks] = useState<TodayPick[]>([]);
  const [picking, setPicking] = useState(false);
  const [addedPick, setAddedPick] = useState<string[]>([]);

  const items = useMemo(() => (tree ? todayItems(tree, today) : []), [tree, today]);
  const streak = useMemo(() => (tree ? currentStreak(tree, today) : 0), [tree, today]);
  const hm = useMemo(() => (tree ? heatmap(tree, 30, today) : []), [tree, today]);

  const markers = useMemo(() => {
    if (!tree) return [];
    return tree.goals
      .filter((g) => g.horizon === "long" && g.status === "active" && g.pathId)
      .map((g) => {
        const age = branchPositionAge(tree, g);
        return age == null ? null : { pathId: g.pathId as string, age };
      })
      .filter((m): m is { pathId: string; age: number } => m !== null);
  }, [tree]);

  const doneLong = useMemo(
    () => (tree ? tree.goals.filter((g) => g.horizon === "long" && g.status === "done") : []),
    [tree],
  );

  if (!tree) return null;

  const hasChoicePaths = tree.paths.some((p) => p.kind === "choice");
  const todayIds = new Set(items.map((i) => i.action.id));
  // 待 AI 建议的池：活跃目标里未完成、且今天清单里还没有的"一次性"行动（重复行动会自动出现，不进建议池）
  const pending = tree.goals
    .filter((g) => g.status === "active")
    .flatMap((g) =>
      g.actions
        .filter((a) => !a.repeat && !a.done && !todayIds.has(a.id))
        .map((a) => ({ id: a.id, text: a.text, goalTitle: g.title })),
    );
  const pendingById = new Map(pending.map((p) => [p.id, p]));

  async function suggestToday() {
    if (picking) return;
    setPicking(true);
    const list = await fetchTodayPlan(tree, pending);
    setPicking(false);
    setPicks(list);
  }

  function addPick(id: string) {
    if (addedPick.includes(id)) return;
    planActionToday(id);
    setAddedPick((a) => [...a, id]);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 animate-fade">
        <div>
          <div className="text-xs uppercase tracking-[3px] text-[var(--fg-faint)]">Life Planner</div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("今天")}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-[var(--fg-dim)]">
            <span className="inline-flex items-center gap-1 text-[var(--c-amber)]">🔥 {t("连续 {n} 天", { n: streak })}</span>
            <HeatStrip days={hm} t={t} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={openPlan}>{t("🎯 我的规划")}</Button>
          <Button variant="ghost" onClick={openTree}>{t("看完整人生树 →")}</Button>
        </div>
      </header>

      {doneLong.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {doneLong.map((g) => (
            <div key={g.id} className="flex items-center gap-2 rounded-2xl border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/10 px-4 py-2.5 text-sm">
              <span>🏆</span>
              <span className="text-[var(--fg)]">{t("你真的做到了：{title}", { title: g.title })}</span>
              {g.pathId && (
                <button onClick={() => openPath(g.pathId as string)} className="ml-auto flex-shrink-0 rounded-full border border-[var(--accent)]/50 px-3 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15">
                  {t("和未来的你说一声")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--fg-dim)]">{t("今日计划")}</h2>
          <button onClick={suggestToday} disabled={picking || pending.length === 0} className="rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-3 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:opacity-40">
            {picking ? t("正在想…") : t("✨ 建议今天做什么")}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-6 text-center text-sm text-[var(--fg-faint)]">
            {t("今天还没安排。让 AI 建议，或去「我的规划」把目标的行动挑进今天。")}
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {items.map(({ goal, action, doneToday }) => (
              <li key={action.id}>
                <button onClick={() => toggleTodayAction(action.id)} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 text-left transition hover:border-[var(--accent)]/50">
                  <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] ${doneToday ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]" : "border-[var(--line)]"}`}>
                    {doneToday ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`text-sm ${doneToday ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}`}>{action.text}</span>
                    {action.repeat && <span className="ml-1.5 text-[11px] text-[var(--accent)]">🔁</span>}
                    <span className="ml-2 text-[11px] text-[var(--fg-faint)]">{t(AREA_LABELS[goal.area])} · {goal.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {picks.length > 0 && (
          <div className="mt-3 space-y-2 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] p-3">
            <div className="text-xs font-semibold text-[var(--fg)]">{t("建议今天做这几件（点「加入今天」）")}</div>
            {picks.map((p) => {
              const item = pendingById.get(p.id);
              if (!item) return null;
              const isAdded = addedPick.includes(p.id) || todayIds.has(p.id);
              return (
                <div key={p.id} className="flex items-start justify-between gap-2 rounded-xl border border-[var(--line)] bg-white/5 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--fg)]">{item.text}</div>
                    {p.why && <div className="mt-0.5 text-xs text-[var(--fg-dim)]">{p.why}</div>}
                  </div>
                  <button onClick={() => addPick(p.id)} disabled={isAdded} className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] transition ${isAdded ? "text-[var(--c-emerald)]" : "border border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent)]/15"}`}>
                    {isAdded ? t("✓ 已加入") : t("＋ 加入今天")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--fg-dim)]">{t("你的人生树")}</h2>
          <button onClick={openTree} className="text-xs text-[var(--fg-dim)] transition hover:text-[var(--fg)]">{t("看完整人生树 →")}</button>
        </div>
        <div className="mt-2 overflow-hidden rounded-3xl border border-[var(--line)] bg-black/20 p-2">
          {hasChoicePaths ? (
            <LifeMap tree={tree} compact markers={markers} onSelectPath={openPath} onForkAtNode={() => openTree()} />
          ) : (
            <p className="px-4 py-10 text-center text-sm text-[var(--fg-faint)]">
              {t("还没有路。去「我的规划」加一个长期目标，它会在树上长出一条路。")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

type TFn = (zh: string, vars?: Record<string, string | number>) => string;

function HeatStrip({ days, t }: { days: { date: string; count: number }[]; t: TFn }) {
  const shade = (c: number) => (c <= 0 ? "var(--line)" : c === 1 ? "var(--accent)" : "var(--c-fuchsia)");
  return (
    <span className="inline-flex items-end gap-0.5" aria-label={t("最近完成情况")}>
      {days.map((d) => (
        <span key={d.date} title={`${d.date}: ${d.count}`} className="inline-block h-3 w-1.5 rounded-[1px]" style={{ backgroundColor: shade(d.count), opacity: d.count > 0 ? 1 : 0.5 }} />
      ))}
    </span>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit` → 无报错。

- [ ] **Step 3: Commit**

```bash
git add src/components/DashboardScreen.tsx
git commit -m "feat(dashboard): merged home — today plan + streak/heatmap + mini tree markers"
```

---

## Task 8: 接线 + PlanScreen「＋今天」/🔁重复

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/TreeScreen.tsx`
- Modify: `src/components/PlanScreen.tsx`

- [ ] **Step 1: page.tsx 渲染 dashboard**

顶部 import 加 `import { DashboardScreen } from "@/components/DashboardScreen";`。
返回分支（约 44-51 行）改为：
```tsx
      {view === "detail" && activePathId ? (
        <PathDetail tree={tree} pathId={activePathId} onBack={backToTree} />
      ) : view === "plan" ? (
        <PlanScreen />
      ) : view === "tree" ? (
        <TreeScreen />
      ) : (
        <DashboardScreen />
      )}
```

- [ ] **Step 2: TreeScreen 头部入口**

`const { tree, openPath, addBranch, reset, aiEnabled } = useApp();`（约 17 行）改为：
```ts
  const { tree, openPath, addBranch, reset, aiEnabled, openDashboard, openPlan } = useApp();
```
按钮组（约 66-73 行）改为：
```tsx
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={openDashboard}>{t("← 今日")}</Button>
          <Button variant="ghost" onClick={openPlan}>{t("🎯 我的规划")}</Button>
          <Button variant="primary" onClick={() => setAdding(true)}>{t("＋ 添加岔路")}</Button>
          <Button variant="ghost" onClick={reset} title={t("清空并重新开始")}>{t("↺ 重置")}</Button>
        </div>
```

- [ ] **Step 3: PlanScreen 解构 + 顶部返回改今日**

`useApp()` 解构（约 15 行）改为（去掉 backToTree、加 openDashboard / planActionToday / setActionRepeatById）：
```ts
  const { tree, openDashboard, openPath, addLongTermGoal, addShortTermGoal, setGoalActionTexts, toggleGoalActionById, completeGoalById, dropGoalById, markDueGoalsReviewed, planActionToday, setActionRepeatById } = useApp();
```
顶部返回按钮（约 70-72 行）改为：
```tsx
        <button onClick={openDashboard} className="text-sm text-[var(--fg-dim)] transition hover:text-[var(--fg)]">
          {t("← 今日")}
        </button>
```

- [ ] **Step 4: Actions 子组件加「＋今天」+ 🔁 重复**

把 `Actions`（约 209-225 行）整体替换为：
```tsx
const REPEAT_LABEL = (t: TFn, r: "daily" | "weekly" | undefined) =>
  r === "daily" ? t("🔁每天") : r === "weekly" ? t("🔁每周") : t("🔁重复");
const NEXT_REPEAT = (r: "daily" | "weekly" | undefined): "daily" | "weekly" | undefined =>
  r === undefined ? "daily" : r === "daily" ? "weekly" : undefined;

function Actions({
  goal, t, onToggle, onPlanToday, onSetRepeat,
}: {
  goal: Goal; t: TFn;
  onToggle: (actionId: string) => void;
  onPlanToday: (actionId: string) => void;
  onSetRepeat: (actionId: string, repeat: "daily" | "weekly" | undefined) => void;
}) {
  if (goal.actions.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {goal.actions.map((a) => (
        <li key={a.id} className="flex items-center gap-2">
          <button onClick={() => onToggle(a.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-[var(--fg)]">
            <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] ${a.done ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]" : "border-[var(--line)]"}`}>
              {a.done ? "✓" : ""}
            </span>
            <span className={a.done ? "text-[var(--fg-faint)] line-through" : ""}>{a.text}</span>
          </button>
          <button
            onClick={() => onSetRepeat(a.id, NEXT_REPEAT(a.repeat))}
            className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] transition ${a.repeat ? "border-[var(--accent)]/60 text-[var(--accent)]" : "border-[var(--line)] text-[var(--fg-faint)] hover:text-[var(--fg-dim)]"}`}
          >
            {REPEAT_LABEL(t, a.repeat)}
          </button>
          {!a.repeat && !a.done && (
            <button onClick={() => onPlanToday(a.id)} className="flex-shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
              {t("＋今天")}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: 把两处 `<Actions .../>` 与两个卡片组件的 props 接上**

`LongGoalCard` 的 props 类型加：
```ts
  onPlanToday: (actionId: string) => void; onSetRepeat: (actionId: string, repeat: "daily" | "weekly" | undefined) => void;
```
其解构参数同名加上；其内部 `<Actions goal={goal} t={t} onToggle={onToggle} />` 改为：
```tsx
      <Actions goal={goal} t={t} onToggle={onToggle} onPlanToday={onPlanToday} onSetRepeat={onSetRepeat} />
```

`ShortGoalRow` 同样：props 类型与解构加 `onPlanToday`、`onSetRepeat`；内部 `<Actions .../>` 同上接齐。

PlanScreen 渲染 `<LongGoalCard ... />`（约 137-153 行）和 `<ShortGoalRow ... />`（约 161-170 行）各加：
```tsx
              onPlanToday={(aid) => planActionToday(aid)}
              onSetRepeat={(aid, r) => setActionRepeatById(g.id, aid, r)}
```

- [ ] **Step 6: 类型 + 全量测试**

Run: `npx tsc --noEmit` → 无报错（确认 PlanScreen 不再引用已移除的 `backToTree`）。
Run: `npx vitest run` → 全绿。

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/components/TreeScreen.tsx src/components/PlanScreen.tsx
git commit -m "feat(nav): dashboard route + cross-page entries + PlanScreen +今天/🔁repeat"
```

---

## Task 9: i18n 英文 + 全套验证 + 真机冒烟

**Files:**
- Modify: `src/i18n/messages.ts`

- [ ] **Step 1: 在 `export const EN` 对象内追加**

```ts
  // ── 激励闭环 / 仪表盘 v2 ──
  今天: "Today",
  "连续 {n} 天": "{n}-day streak",
  最近完成情况: "Recent activity",
  "🎯 我的规划": "🎯 My plan",
  "看完整人生树 →": "See full life tree →",
  "你真的做到了：{title}": "You actually did it: {title}",
  和未来的你说一声: "Tell your future self",
  今日计划: "Today's plan",
  "✨ 建议今天做什么": "✨ Suggest today's focus",
  "正在想…": "Thinking…",
  "今天还没安排。让 AI 建议，或去「我的规划」把目标的行动挑进今天。":
    "Nothing planned yet. Let AI suggest, or pick actions into today from My plan.",
  "建议今天做这几件（点「加入今天」）": "Suggested for today (tap “Add to today”)",
  "＋ 加入今天": "+ Add to today",
  "✓ 已加入": "✓ Added",
  你的人生树: "Your life tree",
  "还没有路。去「我的规划」加一个长期目标，它会在树上长出一条路。":
    "No paths yet. Add a long-term goal in My plan and it grows a branch here.",
  你在这里: "You are here",
  "← 今日": "← Today",
  "＋今天": "+ Today",
  "🔁重复": "🔁 Repeat",
  "🔁每天": "🔁 Daily",
  "🔁每周": "🔁 Weekly",
```
（`AREA_LABELS` 的领域名已在既有 EN 字典；`{n}`/`{title}` 占位与中文一致。）

- [ ] **Step 2: 全套验证**

Run: `npx tsc --noEmit` → 无报错。
Run: `npx vitest run` → 全绿。
Run: `npx next build` → 成功（构建后若 dev `/` 404，清 `.next` 再 `npm run dev`）。

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages.ts
git commit -m "feat(i18n): English strings for motivation-loop dashboard + repeat"
```

- [ ] **Step 4: 真机冒烟（人工，早上一起）**

- 打开默认落"仪表盘"；空态引导去加目标。
- 「我的规划」给某行动点 🔁 设每天 → 回仪表盘，它**自动出现在今日**；勾掉 → 🔥连续+1、热力图点亮；次日它**重新出现**（可改设备日期或造数据验证）。
- weekly 行动完成后本周从今日消失。
- 「建议今天做什么」给≤3 条一次性行动；「加入今天」进清单。
- 完成长期目标的一次性里程碑 → 缩略树「你在这里」前移；重复行动来回勾不挪标记（进度只认里程碑）。
- 做完整条长期目标 → 🏆 报喜 + 领域加分 + 「和未来的你说一声」开 FutureSelfChat。
- 切英文，新文案均英文；旧树升级不丢、不报错。

---

## Self-Review（对照 spec）

- **spec 覆盖**：合并仪表盘默认首页=Task5+7+8；今日手动挑+AI建议=Task3/4/7；连续+热力图=Task3/7；标记沿分支=Task3(branchPositionAge)+Task6+Task7；做完长期目标真实加分=已有 completeGoal（Task7 展示报喜）；最小重复行动=Task1(type)+Task2(progress 排除)+Task3(daily 逻辑)+Task5(toggle/repeat 方法)+Task7(badge)+Task8(🔁 开关)；热力图非排程日历=Task3/7；迁移安全=Task1；i18n=Task9；确定性=daily 注入 today，`localDay(new Date())` 仅在 state/client 边界。
- **明确不做**：日历同步/推送/时间块/到期日/Griply 习惯统计与提醒/对话调目标——计划未出现。✅
- **类型一致性**：`GoalAction.repeat`、`ActivityDay`、`LifeTree.activity`；daily 导出 `localDay/addDays/dayEntry/findAction/planToday/unplanToday/completeAction/uncompleteAction/isActionDoneToday/recurringDueToday/todayItems/currentStreak/heatmap/branchPositionAge`；goals 导出 `setActionRepeat` 且 `goalProgress` 改为只数里程碑；AppContext `openDashboard/openTree/planActionToday/unplanActionToday/toggleTodayAction/setActionRepeatById`；`fetchTodayPlan/localTodayStr/TodayPick`；`LifeMap` `markers/compact`；`View` 新值 `dashboard` 在 reducer/page 覆盖；`todayItems` 返回 `{goal,action,doneToday}` 与 Dashboard 用法一致。
- **占位符扫描**：无 TBD/"类似上面"；每个代码步骤含完整代码或精确锚点。
- **诚实红线复核**：`goalProgress` 排除 `repeat` → 重复行动来回勾不动"你在这里"标记；标记只由里程碑/子目标推进；完成不改预测本身。
