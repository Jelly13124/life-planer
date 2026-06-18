# 规划主线（目标即分支）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给「人生树」加一条目标驱动的规划主线——新树单线起手，AI 建议目标，一个长期目标在树上长出一条分支，短期目标与可勾选行动推进它，达成后给相关人生面加分并标里程碑，并能和这条分支的未来自我对话。

**Architecture:** 纯领域逻辑放 `src/domain/goals.ts`（注入时间、可测）。AI 只新增两条带本地兜底的路由（`/api/goals`、`/api/goal-actions`）；长期目标的"分支"和"未来自我对话"复用现有 `predictAndCommit` + `FutureSelfChat`，不新增路由。状态层在 `AppContext` 加 `plan` 视图与目标方法。UI 集中在新组件 `PlanScreen`。

**Tech Stack:** Next.js 16 App Router（route handlers + `Response.json`）、React 19、TypeScript、Tailwind v4、Vitest 4（node 环境，仅测纯函数）、zod 4、DeepSeek（OpenAI 兼容）。

> 约束（全程遵守）：领域代码不用 `Date.now`/`Math.random`（时间由调用方注入字符串；`new Date(isoString)` 这种确定性解析可用）。React 渲染期不调用无参 `new Date()`（purity lint）——用模块级 boot 值 + effect 刷新。中文字符串里绝不出现 ASCII 直引号。所有新中文 UI 文案都要在 `src/i18n/messages.ts` 补英文。提交信息按约定加 Co-Authored-By 尾注。

---

## File Structure

新增：
- `src/domain/goals.ts` — 目标领域纯函数
- `src/domain/__tests__/goals.test.ts` — 上面的测试
- `src/app/api/goals/route.ts` — AI 建议目标
- `src/app/api/goal-actions/route.ts` — AI 把目标拆成行动
- `src/lib/goalClient.ts` — 上两条路由的客户端封装（含类型）
- `src/components/PlanScreen.tsx` — 「我的规划」视图

修改：
- `src/domain/types.ts` — Goal/GoalAction/枚举 + `LifeTree.goals`
- `src/domain/tree.ts` — `createTree` 单线起手；`removePath` 连带清理 goals
- `src/domain/__tests__/tree.test.ts` — 改/加 createTree 与 removePath 的断言
- `src/domain/repository/localStorageRepo.ts` — load 回填 `goals: []`
- `src/state/AppContext.tsx` — `plan` 视图 + 目标方法
- `src/app/page.tsx` — 路由 `plan` → PlanScreen
- `src/components/TreeScreen.tsx` — 头部「🎯 我的规划」入口
- `src/components/LifeMap.tsx` — 已达成分支的轻量高亮
- `src/i18n/messages.ts` — 新文案英文

---

## Task 1: 领域类型 Goal + LifeTree.goals

**Files:**
- Modify: `src/domain/types.ts`（在 `Decision` 与 `LifeTree` 之间插入）

- [ ] **Step 1: 在 `src/domain/types.ts` 的 `Decision` 接口之后、`LifeTree` 接口之前插入目标类型**

```ts
// ───────── 规划主线：目标（一个长期目标 = 树上一条分支） ─────────
export type GoalHorizon = "short" | "long";
export type GoalStatus = "active" | "done";

export interface GoalAction {
  id: string;
  text: string;
  done: boolean;
}

export interface Goal {
  id: string;
  area: LifeArea; // 事业/财富/关系/健康/成长
  horizon: GoalHorizon;
  title: string;
  why: string;
  status: GoalStatus;
  createdAt: string;
  parentGoalId: string | null; // 短期目标挂到某个长期目标；长期目标为 null
  pathId: string | null; // 仅长期目标：它在树上长出的那条分支 id
  actions: GoalAction[];
  completedAt?: string;
  lastReviewedAt?: string;
}

// 新建目标的入参（id/status/createdAt/actions 由 createGoal 补全）
export interface GoalInput {
  area: LifeArea;
  horizon: GoalHorizon;
  title: string;
  why: string;
  parentGoalId?: string | null;
  pathId?: string | null;
}
```

- [ ] **Step 2: 在 `LifeTree` 接口里加 `goals` 字段**

把：

```ts
export interface LifeTree {
  id: string;
  profile: Profile;
  horizonYears: number; // 推演跨度
  paths: LifePath[]; // 含 1 条 status-quo + N 条 choice
  decisions: Decision[]; // 决策日志（看见→追问→选定→落地→复盘）
  createdAt: string;
  updatedAt: string;
}
```

改为（在 `decisions` 后加一行 `goals`）：

```ts
export interface LifeTree {
  id: string;
  profile: Profile;
  horizonYears: number; // 推演跨度
  paths: LifePath[]; // 含 1 条 status-quo + N 条 choice
  decisions: Decision[]; // 决策日志（看见→追问→选定→落地→复盘）
  goals: Goal[]; // 规划主线：长期/短期目标
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 3: 编译校验**

Run: `npx tsc --noEmit`
Expected: 报错集中在"`goals` 缺失"的地方（`createTree`、测试等）——这些将在后续任务补齐。先确认 `types.ts` 本身无语法错误（不出现指向 `types.ts` 的错误）。

- [ ] **Step 4: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(types): add Goal model + LifeTree.goals for planning mainline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: createTree 单线起手 + removePath 清理 goals

**Files:**
- Modify: `src/domain/tree.ts`
- Test: `src/domain/__tests__/tree.test.ts`

- [ ] **Step 1: 改测试——createTree 只画维持现状一条线**

在 `src/domain/__tests__/tree.test.ts` 把这个用例：

```ts
  it("createTree has status-quo + one crossroad choice", () => {
    const t = createTree(profile, gen, NOW);
    expect(t.paths.length).toBe(2);
    expect(t.paths[0].kind).toBe("status-quo");
    expect(t.paths[1].kind).toBe("choice");
    expect(t.createdAt).toBe(NOW);
  });
```

替换为：

```ts
  it("createTree starts single-line: only status-quo even if a crossroad is filled", () => {
    const t = createTree(profile, gen, NOW); // profile.crossroad = "要不要换城市"
    expect(t.paths.length).toBe(1);
    expect(t.paths[0].kind).toBe("status-quo");
    expect(t.createdAt).toBe(NOW);
    expect(t.goals).toEqual([]);
  });
```

- [ ] **Step 2: 加测试——removePath 连带清理指向该分支的 goals**

在 `src/domain/__tests__/tree.test.ts` 顶部 import 里加入 `Goal`：

```ts
import type { Goal, Profile } from "@/domain/types";
```

在 `describe("tree operations", ...)` 内、`removePath also prunes decisions...` 用例之后加：

```ts
  it("removePath also prunes a long-term goal attached to the removed branch", () => {
    let t = addPath(createTree(profile, gen, NOW), "去读研", gen, NOW);
    const choice = t.paths.find((p) => p.kind === "choice")!;
    const goal: Goal = {
      id: "goal-x",
      area: "career",
      horizon: "long",
      title: "读完研换赛道",
      why: "",
      status: "active",
      createdAt: NOW,
      parentGoalId: null,
      pathId: choice.id,
      actions: [],
    };
    t = { ...t, goals: [goal] };
    const t2 = removePath(t, choice.id, NOW);
    expect(t2.goals).toHaveLength(0); // 分支没了，挂在它上面的长期目标也清掉
  });
```

- [ ] **Step 3: 运行测试，确认它们失败**

Run: `npx vitest run src/domain/__tests__/tree.test.ts`
Expected: FAIL —「createTree starts single-line」断言 `paths.length` 应为 1 实为 2；removePath 用例 `goals` 仍为 1。

- [ ] **Step 4: 改 `createTree` 只生成 status-quo，并初始化 `goals: []`**

在 `src/domain/tree.ts` 把 `createTree` 函数体里"用当前岔路生成第一条 choice 路径"那段删掉，并在返回对象里加 `goals: []`：

```ts
export function createTree(
  profile: Profile,
  generator: PathGenerator,
  now: string,
  horizonYears: number = DEFAULT_HORIZON_YEARS,
): LifeTree {
  const id = `tree-${hashSeed(`${profile.name}|${now}`)}`;

  // 单线起手：一开始只有"维持现状"。分叉只从长期目标或手动加的选择长出来。
  const statusQuo: LifePath = generator.generate({
    profile,
    choiceLabel: "",
    kind: "status-quo",
    horizonYears,
    index: 0,
  });

  return {
    id,
    profile,
    horizonYears,
    paths: [statusQuo],
    decisions: [],
    goals: [],
    createdAt: now,
    updatedAt: now,
  };
}
```

注意：删掉了 `const crossroad = profile.crossroad.trim();` 那整段 `if (crossroad) { paths.push(...) }`。`inferForkAge` 的 import 若不再被本文件其它函数使用，保留即可（`addPath` 仍在用它），不要误删。

- [ ] **Step 5: 让 `removePath` 连带清理 goals**

在 `src/domain/tree.ts` 的 `removePath` 返回对象里加一行 `goals`：

```ts
  return {
    ...tree,
    paths: tree.paths.filter((p) => !toRemove.has(p.id)),
    decisions: tree.decisions.filter((d) => !toRemove.has(d.pathId)),
    goals: (tree.goals ?? []).filter((g) => !(g.pathId && toRemove.has(g.pathId))),
    updatedAt: now,
  };
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `npx vitest run src/domain/__tests__/tree.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 7: Commit**

```bash
git add src/domain/tree.ts src/domain/__tests__/tree.test.ts
git commit -m "feat(tree): single-line start; removePath prunes goals on removed branch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: localStorage 迁移——回填 goals: []

**Files:**
- Modify: `src/domain/repository/localStorageRepo.ts`
- Test: `src/domain/__tests__/tree.test.ts`（沿用其中的 `LocalStorageRepository` describe）

- [ ] **Step 1: 加测试——旧树缺 goals 字段时回填 []**

在 `src/domain/__tests__/tree.test.ts` 的 `describe("LocalStorageRepository", ...)` 内，`backfills decisions: []...` 用例之后加：

```ts
  it("backfills goals: [] for old trees missing the field", () => {
    const store = makeStore();
    const t = createTree(profile, gen, NOW);
    const legacy = { ...t } as Record<string, unknown>;
    delete legacy.goals; // 模拟旧版没有 goals 的树
    store.setItem("lifeplanner.tree.v3", JSON.stringify(legacy));
    const repo = new LocalStorageRepository(store);
    const loaded = repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.goals).toEqual([]);
  });
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/domain/__tests__/tree.test.ts -t "backfills goals"`
Expected: FAIL —`loaded!.goals` 为 `undefined`。

- [ ] **Step 3: 在 `load()` 里回填 goals**

在 `src/domain/repository/localStorageRepo.ts` 的 `load()` 中，紧跟 decisions 回填那行之后加一行：

```ts
      if (!Array.isArray(parsed.decisions)) parsed.decisions = []; // 旧树兼容：补字段，不清库
      if (!Array.isArray(parsed.goals)) parsed.goals = []; // 旧树兼容：补 goals
      return parsed;
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/domain/__tests__/tree.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/domain/repository/localStorageRepo.ts src/domain/__tests__/tree.test.ts
git commit -m "feat(repo): backfill goals: [] for old trees (no data reset)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 目标领域纯函数 goals.ts（TDD）

**Files:**
- Create: `src/domain/goals.ts`
- Test: `src/domain/__tests__/goals.test.ts`

- [ ] **Step 1: 写失败测试 `src/domain/__tests__/goals.test.ts`**

```ts
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
    let kid2 = createGoal({ area: "career", horizon: "short", title: "做季度复盘", why: "", parentGoalId: long.id }, NOW);
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
    let long = createGoal({ area: "career", horizon: "long", title: "读研", why: "" }, NOW);
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
    let long = createGoal({ area: "career", horizon: "long", title: "读研", why: "", pathId: branch.id }, NOW);
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
    let g = createGoal({ area: "career", horizon: "short", title: "G", why: "" }, "2026-05-01T00:00:00.000Z");
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
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/domain/__tests__/goals.test.ts`
Expected: FAIL —`@/domain/goals` 模块不存在。

- [ ] **Step 3: 写实现 `src/domain/goals.ts`**

```ts
import type { Goal, GoalAction, GoalInput, LifeTree } from "./types";
import { hashSeed } from "./seed";
import { removePath } from "./tree";

// 达成一个长期目标，给它所属人生面加的分（影响之后新生成的路）。
export const AREA_BUMP = 8;
const REVIEW_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

function goals(tree: LifeTree): Goal[] {
  return tree.goals ?? [];
}

// 不用 Date.now/Math.random：id 由 标题+时间戳 散列而来（确定性）。
export function createGoal(input: GoalInput, now: string): Goal {
  return {
    id: `goal-${hashSeed(`${input.title}|${now}`)}`,
    area: input.area,
    horizon: input.horizon,
    title: input.title.trim(),
    why: input.why.trim(),
    status: "active",
    createdAt: now,
    parentGoalId: input.parentGoalId ?? null,
    pathId: input.pathId ?? null,
    actions: [],
  };
}

export function goalById(tree: LifeTree, id: string): Goal | undefined {
  return goals(tree).find((g) => g.id === id);
}

export function upsertGoal(tree: LifeTree, goal: Goal): LifeTree {
  const list = goals(tree);
  const exists = list.some((g) => g.id === goal.id);
  return {
    ...tree,
    goals: exists ? list.map((g) => (g.id === goal.id ? goal : g)) : [...list, goal],
  };
}

export function linkGoalPath(tree: LifeTree, goalId: string, pathId: string): LifeTree {
  return { ...tree, goals: goals(tree).map((g) => (g.id === goalId ? { ...g, pathId } : g)) };
}

export function setGoalActions(goal: Goal, texts: string[]): Goal {
  const actions: GoalAction[] = texts
    .map((t, i) => ({ id: `${goal.id}-a${i}`, text: t.trim(), done: false }))
    .filter((a) => a.text);
  return { ...goal, actions };
}

export function toggleGoalAction(goal: Goal, actionId: string): Goal {
  return {
    ...goal,
    actions: goal.actions.map((a) => (a.id === actionId ? { ...a, done: !a.done } : a)),
  };
}

// 某个长期目标下的短期子目标（按创建时间）。
export function childGoals(tree: LifeTree, longGoalId: string): Goal[] {
  return goals(tree)
    .filter((g) => g.parentGoalId === longGoalId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// 进度 0–1：长期目标 = (done 子目标 + done 行动) / (子目标 + 行动)；短期 = done 行动比例。
export function goalProgress(tree: LifeTree, goal: Goal): number {
  if (goal.horizon === "long") {
    const kids = childGoals(tree, goal.id);
    const total = kids.length + goal.actions.length;
    if (total === 0) return 0;
    const done = kids.filter((k) => k.status === "done").length + goal.actions.filter((a) => a.done).length;
    return done / total;
  }
  if (goal.actions.length === 0) return 0;
  return goal.actions.filter((a) => a.done).length / goal.actions.length;
}

// 达成目标：标 done + 时间戳；长期目标顺带给它的人生面加分（影响之后的预测）。
export function completeGoal(tree: LifeTree, goalId: string, now: string): LifeTree {
  const goal = goalById(tree, goalId);
  if (!goal || goal.status === "done") return tree;
  const updated = goals(tree).map((g) =>
    g.id === goalId ? { ...g, status: "done" as const, completedAt: now } : g,
  );
  let profile = tree.profile;
  if (goal.horizon === "long") {
    const cur = profile.areas[goal.area] ?? 50;
    profile = { ...profile, areas: { ...profile.areas, [goal.area]: clamp100(cur + AREA_BUMP) } };
  }
  return { ...tree, goals: updated, profile, updatedAt: now };
}

// 移除目标：连同它的短期子目标；若是长期目标，连同它在树上的分支一起删。
export function dropGoal(tree: LifeTree, goalId: string, now: string): LifeTree {
  const goal = goalById(tree, goalId);
  if (!goal) return tree;
  const removeIds = new Set<string>([goalId, ...childGoals(tree, goalId).map((g) => g.id)]);
  let next: LifeTree = {
    ...tree,
    goals: goals(tree).filter((g) => !removeIds.has(g.id)),
    updatedAt: now,
  };
  if (goal.horizon === "long" && goal.pathId) {
    next = removePath(next, goal.pathId, now); // 删分支（removePath 也会再清一遍 goals，幂等）
  }
  return next;
}

// 已达成的长期目标对应的分支 id 集合（供人生树高亮里程碑）。
export function achievedPathIds(tree: LifeTree): Set<string> {
  const ids = goals(tree)
    .filter((g) => g.status === "done" && g.horizon === "long" && g.pathId)
    .map((g) => g.pathId as string);
  return new Set(ids);
}

// 该回看的目标：active 且（从没复盘过 或 距上次复盘 ≥ 7 天）。today 注入，便于测试。
export function dueGoalReviews(tree: LifeTree, today: string): Goal[] {
  const t = new Date(today).getTime();
  return goals(tree).filter(
    (g) =>
      g.status === "active" &&
      (!g.lastReviewedAt || t - new Date(g.lastReviewedAt).getTime() >= REVIEW_INTERVAL_MS),
  );
}

export function recordGoalReview(tree: LifeTree, goalId: string, now: string): LifeTree {
  return {
    ...tree,
    goals: goals(tree).map((g) => (g.id === goalId ? { ...g, lastReviewedAt: now } : g)),
  };
}
```

- [ ] **Step 4: 运行测试，确认全部通过**

Run: `npx vitest run src/domain/__tests__/goals.test.ts`
Expected: PASS（13 个用例）。

- [ ] **Step 5: 全量测试 + 类型检查**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 测试全绿；tsc 仅可能在 `AppContext`/`page` 等尚未改的地方因 `goals` 报错（后续任务处理），`domain` 与本任务文件无错。

- [ ] **Step 6: Commit**

```bash
git add src/domain/goals.ts src/domain/__tests__/goals.test.ts
git commit -m "feat(goals): pure domain functions for goal-driven planning mainline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: /api/goals 路由 + 客户端封装

**Files:**
- Create: `src/app/api/goals/route.ts`
- Create: `src/lib/goalClient.ts`

- [ ] **Step 1: 写路由 `src/app/api/goals/route.ts`（参照 `suggest-paths/route.ts`，输出带 area+horizon 的目标，无 key 时给非空通用兜底）**

```ts
// 服务端：从用户现状建议几个值得追的目标（含长期/短期）。无 key 时给通用兜底，
// 让规划主线离线也能用。带限流。
import { allowRequest } from "@/lib/rateLimit";
import { LIFE_AREAS, type GoalHorizon, type LifeArea } from "@/domain/types";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface Body {
  profileSummary: string;
  choices: string[];
  lang?: "zh" | "en";
}

export interface GoalSuggestionDTO {
  area: LifeArea;
  horizon: GoalHorizon;
  title: string;
  why: string;
}

const FALLBACK: GoalSuggestionDTO[] = [
  { area: "career", horizon: "long", title: "在本行做到能独当一面", why: "三年内成为团队里靠得住的人" },
  { area: "wealth", horizon: "long", title: "攒够半年生活的应急金", why: "有底气才敢做选择" },
  { area: "growth", horizon: "short", title: "每周留 5 小时学新技能", why: "为长期目标攒底气" },
  { area: "health", horizon: "short", title: "每周运动三次", why: "状态是一切的本钱" },
];

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

function normalize(raw: { area?: unknown; horizon?: unknown; title?: unknown; why?: unknown }[]): GoalSuggestionDTO[] {
  return raw
    .map((g) => {
      const area = String(g.area ?? "") as LifeArea;
      const horizon = (g.horizon === "short" ? "short" : "long") as GoalHorizon;
      return {
        area: LIFE_AREAS.includes(area) ? area : "growth",
        horizon,
        title: String(g.title ?? "").trim(),
        why: String(g.why ?? "").trim(),
      };
    })
    .filter((g) => g.title)
    .slice(0, 5);
}

export async function POST(request: Request) {
  if (!allowRequest(request, Date.now())) {
    return Response.json({ goals: FALLBACK }, { status: 429 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ goals: FALLBACK }, { status: 400 });
  }
  const key = getKey();
  if (!key) return Response.json({ goals: FALLBACK });

  const system = [
    "你在帮一个想认真规划人生的人，提炼几个值得追的目标。",
    "给出 3-5 个目标：至少 1 个长期目标（horizon=long，跨度数年的方向），其余短期目标（horizon=short，几周到几个月能推进）。",
    "每个目标：area 从 career/wealth/relationships/health/growth 里选一个最贴的；title 是一个具体、可执行的短语（≤12字）；why 一句话点出为什么值得他追（≤25字）。",
    "彼此方向不同，扣住他的现状，别空泛（不要“走上人生巅峰”这种）。",
    body.profileSummary ? `这个人的现状：${body.profileSummary}。` : "",
    body.choices?.length ? `他正在考虑的路：${body.choices.join("、")}。` : "",
    body.lang === "en"
      ? "LANGUAGE: write title and why in natural English (title ≤ 6 words, why ≤ 12 words). Keep area/horizon values in English exactly as specified."
      : "语言：title 与 why 用简体中文。area 与 horizon 用给定的英文枚举值。",
    "只输出如下 json，不要任何解释或代码块：",
    '{"goals":[{"area":"career","horizon":"long","title":"短语","why":"一句话理由"}]}',
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
          { role: "user", content: "给我几个值得追的目标。" },
        ],
        response_format: MODEL.includes("reasoner") ? undefined : { type: "json_object" },
        max_tokens: 800,
        temperature: 0.9,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[goals] DeepSeek ${res.status}`);
      return Response.json({ goals: FALLBACK });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json({ goals: FALLBACK });
    const parsed = JSON.parse(json) as { goals?: { area?: unknown; horizon?: unknown; title?: unknown; why?: unknown }[] };
    const out = normalize(parsed.goals || []);
    return Response.json({ goals: out.length ? out : FALLBACK });
  } catch (e) {
    console.error("[goals] failed:", e);
    return Response.json({ goals: FALLBACK });
  }
}
```

- [ ] **Step 2: 写客户端 `src/lib/goalClient.ts`（先放 suggestions 部分，actions 部分在 Task 6 追加）**

```ts
// 客户端安全：规划主线两条 AI 路由的网络封装。
import type { Goal, GoalHorizon, LifeArea, LifeTree } from "@/domain/types";
import { currentLocale } from "@/i18n/locale";

export interface GoalSuggestion {
  area: LifeArea;
  horizon: GoalHorizon;
  title: string;
  why: string;
}

// 让 AI 从现状建议几个目标（前端确认后才加入）。
export async function fetchGoalSuggestions(tree: LifeTree): Promise<GoalSuggestion[]> {
  try {
    const choices = Array.from(
      new Set(tree.paths.filter((p) => p.kind === "choice").map((p) => p.choiceLabel)),
    );
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileSummary: tree.profile.snapshot || "", choices, lang: currentLocale() }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { goals?: GoalSuggestion[] };
    return Array.isArray(data.goals) ? data.goals : [];
  } catch {
    return [];
  }
}

// 把一个目标拆成几条可勾选的近期行动。
export async function fetchGoalActions(goal: Goal, profileSummary: string): Promise<string[]> {
  try {
    const res = await fetch("/api/goal-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goalTitle: goal.title,
        why: goal.why,
        area: goal.area,
        horizon: goal.horizon,
        profileSummary,
        lang: currentLocale(),
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { actions?: string[] };
    return Array.isArray(data.actions) ? data.actions.filter((a) => typeof a === "string" && a.trim()) : [];
  } catch {
    return [];
  }
}
```

> 说明：`fetchGoalActions` 现在就一起写好（它依赖的 `/api/goal-actions` 在 Task 6 创建；在此之前调用会走 catch 返回 `[]`，不报错）。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 不出现指向 `src/app/api/goals/route.ts` 或 `src/lib/goalClient.ts` 的错误（其它未改文件的 `goals` 错误仍可能存在，后续任务处理）。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/goals/route.ts src/lib/goalClient.ts
git commit -m "feat(api): /api/goals suggestions + goalClient (offline fallback + rate limit)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: /api/goal-actions 路由

**Files:**
- Create: `src/app/api/goal-actions/route.ts`

- [ ] **Step 1: 写路由 `src/app/api/goal-actions/route.ts`**

```ts
// 服务端：把一个目标拆成 3-5 条可勾选的近期行动。无 key 时给通用兜底。带限流。
import { allowRequest } from "@/lib/rateLimit";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface Body {
  goalTitle: string;
  why?: string;
  area?: string;
  horizon?: "short" | "long";
  profileSummary?: string;
  lang?: "zh" | "en";
}

const FALLBACK_ZH = ["把目标拆成这周能动手的第一步", "找一个已经做到的人聊 20 分钟", "定个能检验进展的小里程碑"];
const FALLBACK_EN = [
  "Break it into a first step you can do this week",
  "Talk 20 minutes with someone who already did it",
  "Set a small milestone to check your progress",
];

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

export async function POST(request: Request) {
  const fb = (lang?: string) => (lang === "en" ? FALLBACK_EN : FALLBACK_ZH);
  if (!allowRequest(request, Date.now())) {
    return Response.json({ actions: fb() }, { status: 429 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ actions: fb() }, { status: 400 });
  }
  const key = getKey();
  if (!key || !body.goalTitle?.trim()) return Response.json({ actions: fb(body?.lang) });

  const system = [
    `把目标「${body.goalTitle.trim()}」拆成 3-5 条具体、可勾选、近期就能动手的行动。`,
    body.why ? `这个目标对他的意义：${body.why}。` : "",
    body.profileSummary ? `他的现状：${body.profileSummary}。` : "",
    "每条以动词开头、足够具体（能判断做没做完），别空泛。",
    body.lang === "en"
      ? "LANGUAGE: write each action in natural English, starting with a verb (≤ 12 words)."
      : "语言：每条用简体中文，动词开头，≤20字。",
    "只输出如下 json，不要任何解释或代码块：",
    '{"actions":["第一条","第二条"]}',
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
          { role: "user", content: "拆成行动。" },
        ],
        response_format: MODEL.includes("reasoner") ? undefined : { type: "json_object" },
        max_tokens: 500,
        temperature: 0.8,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[goal-actions] DeepSeek ${res.status}`);
      return Response.json({ actions: fb(body.lang) });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json({ actions: fb(body.lang) });
    const parsed = JSON.parse(json) as { actions?: unknown[] };
    const actions = (parsed.actions || [])
      .map((a) => String(a ?? "").trim())
      .filter(Boolean)
      .slice(0, 5);
    return Response.json({ actions: actions.length ? actions : fb(body.lang) });
  } catch (e) {
    console.error("[goal-actions] failed:", e);
    return Response.json({ actions: fb(body.lang) });
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 不出现指向 `src/app/api/goal-actions/route.ts` 的错误。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/goal-actions/route.ts
git commit -m "feat(api): /api/goal-actions breaks a goal into actions (offline fallback)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: AppContext —— plan 视图 + 目标方法

**Files:**
- Modify: `src/state/AppContext.tsx`

> 这是状态层，无单元测试（沿用本仓库惯例：仅纯函数测）。靠 `tsc` + 后续真机冒烟验证。`addLongTermGoal` 复用 `predictAndCommit`：会播放「正在推演」动画并在完成后落到人生树上（你能看着分支长出来）。其余目标操作走 `patchTree`，停在规划页。

- [ ] **Step 1: 扩展 View、Action、import**

把：

```ts
export type View = "onboarding" | "tree" | "detail";
```

改为：

```ts
export type View = "onboarding" | "tree" | "detail" | "plan";
```

在顶部 import 区，给 types 的 import 加上 `Goal` 类型，并引入 goals 域函数：

```ts
import type { Decision, Goal, LifePath, LifeTree, Profile, Scenario } from "@/domain/types";
```

并在 `import { applyEnrichment, ... } from "@/lib/enrichClient";` 之后新增一行：

```ts
import {
  completeGoal,
  createGoal,
  dropGoal,
  dueGoalReviews,
  recordGoalReview,
  setGoalActions,
  toggleGoalAction,
  upsertGoal,
} from "@/domain/goals";
```

在 `type Action =` 联合里加一个开屏动作（放在 `| { type: "backToTree" }` 之后）：

```ts
  | { type: "openPlan" }
```

- [ ] **Step 2: reducer 加 openPlan 分支**

在 `case "backToTree":` 之后插入：

```ts
    case "openPlan":
      return { ...state, activePathId: null, view: "plan" };
```

- [ ] **Step 3: 扩展 AppApi 接口**

在 `interface AppApi { ... }` 里，`regeneratePath` 那行之后加：

```ts
  openPlan: () => void;
  addLongTermGoal: (input: { area: Goal["area"]; title: string; why: string }) => void;
  addShortTermGoal: (input: { area: Goal["area"]; title: string; why: string; parentGoalId?: string | null }) => void;
  setGoalActionTexts: (goalId: string, texts: string[]) => void;
  toggleGoalActionById: (goalId: string, actionId: string) => void;
  completeGoalById: (goalId: string) => void;
  dropGoalById: (goalId: string) => void;
  markDueGoalsReviewed: () => void;
```

- [ ] **Step 4: 在 `api = useMemo(...)` 的返回对象里实现这些方法**

在 `regeneratePath: (pathId, note) => { ... },` 之后插入：

```ts
      openPlan: () => dispatch({ type: "openPlan" }),
      addLongTermGoal: ({ area, title, why }) => {
        if (predictingRef.current) return;
        const baseTree = treeRef.current;
        if (!baseTree || !title.trim()) return;
        const ts = new Date().toISOString();
        // 1) 在树上长出这条目标的分支（根分支，分叉年龄按选择推测，AI 可重定）
        const working = addPath(baseTree, title, generator, ts);
        if (working === baseTree) return;
        const newPath = working.paths[working.paths.length - 1];
        // 2) 建长期目标并关联这条分支
        const goal = createGoal(
          { area, horizon: "long", title, why, pathId: newPath.id },
          ts,
        );
        const withGoal = upsertGoal(working, goal);
        // 3) 推演这条分支（播动画、落到树上）。withGoal 含 goals，predictAndCommit 会保留。
        void predictAndCommit(withGoal, [newPath], "branch");
      },
      addShortTermGoal: ({ area, title, why, parentGoalId }) => {
        const baseTree = treeRef.current;
        if (!baseTree || !title.trim()) return;
        const goal = createGoal(
          { area, horizon: "short", title, why, parentGoalId: parentGoalId ?? null },
          new Date().toISOString(),
        );
        dispatch({ type: "patchTree", tree: upsertGoal(baseTree, goal) });
      },
      setGoalActionTexts: (goalId, texts) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const goal = (baseTree.goals ?? []).find((g) => g.id === goalId);
        if (!goal) return;
        dispatch({ type: "patchTree", tree: upsertGoal(baseTree, setGoalActions(goal, texts)) });
      },
      toggleGoalActionById: (goalId, actionId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const goal = (baseTree.goals ?? []).find((g) => g.id === goalId);
        if (!goal) return;
        dispatch({ type: "patchTree", tree: upsertGoal(baseTree, toggleGoalAction(goal, actionId)) });
      },
      completeGoalById: (goalId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: completeGoal(baseTree, goalId, new Date().toISOString()) });
      },
      dropGoalById: (goalId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: dropGoal(baseTree, goalId, new Date().toISOString()) });
      },
      markDueGoalsReviewed: () => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const now = new Date().toISOString();
        // 折叠到一棵树上单次 dispatch（逐条 dispatch 会因 treeRef 滞后只生效一条）。
        let tt = baseTree;
        for (const g of dueGoalReviews(baseTree, now)) tt = recordGoalReview(tt, g.id, now);
        dispatch({ type: "patchTree", tree: tt });
      },
```

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: `AppContext.tsx` 无错误（依赖项数组无需改：新方法只用到已在依赖里的 `generator`/`predictAndCommit` 与 `dispatch`；`dispatch` 恒定）。

- [ ] **Step 6: Commit**

```bash
git add src/state/AppContext.tsx
git commit -m "feat(state): plan view + goal methods (long goal grows a branch)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: 路由 plan 视图 + 人生树入口按钮

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/TreeScreen.tsx`

- [ ] **Step 1: page.tsx 引入并路由 PlanScreen**

在 `src/app/page.tsx` 顶部 import 区加：

```ts
import { PlanScreen } from "@/components/PlanScreen";
```

把渲染主体：

```tsx
      {view === "detail" && activePathId ? (
        <PathDetail tree={tree} pathId={activePathId} onBack={backToTree} />
      ) : (
        <TreeScreen />
      )}
```

改为：

```tsx
      {view === "detail" && activePathId ? (
        <PathDetail tree={tree} pathId={activePathId} onBack={backToTree} />
      ) : view === "plan" ? (
        <PlanScreen />
      ) : (
        <TreeScreen />
      )}
```

> 注意：`PlanScreen` 在 Task 9 创建。在此之前 `tsc`/构建会因找不到模块报错——这两步请和 Task 9 一起做完再验证、再提交（见 Task 9 的验证步）。

- [ ] **Step 2: TreeScreen 头部加「🎯 我的规划」入口**

在 `src/components/TreeScreen.tsx` 中，从 `useApp()` 解构里加上 `openPlan`：

```ts
  const { tree, openPath, addBranch, reset, aiEnabled, openPlan } = useApp();
```

把头部按钮组：

```tsx
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setAdding(true)}>
            {t("＋ 添加岔路")}
          </Button>
          <Button variant="ghost" onClick={reset} title={t("清空并重新开始")}>
            {t("↺ 重置")}
          </Button>
        </div>
```

改为（在最前面加「我的规划」）：

```tsx
        <div className="flex gap-2">
          <Button variant="ghost" onClick={openPlan}>
            {t("🎯 我的规划")}
          </Button>
          <Button variant="primary" onClick={() => setAdding(true)}>
            {t("＋ 添加岔路")}
          </Button>
          <Button variant="ghost" onClick={reset} title={t("清空并重新开始")}>
            {t("↺ 重置")}
          </Button>
        </div>
```

- [ ] **Step 3: 暂不单独验证/提交**（与 Task 9 合并验证提交）

---

## Task 9: PlanScreen 组件

**Files:**
- Create: `src/components/PlanScreen.tsx`

> 交互：顶部「✨ 帮我想几个目标」→ 候选卡片（标长期/短期 + 领域 + why）→「加入」；长期目标加入即在树上长分支（复用 `addLongTermGoal`，会播推演动画并落到树上）。每个长期目标卡：进度条、「在树上看这条路」（`openPath(pathId)` 进入它的详情页，那里就有未来自我对话）、短期子目标、可勾选行动、「拆成行动」、「已达成」、「移除」。到期复盘提醒、已达成里程碑区、crossroad chip、手动加目标。
> 渲染期不可调用无参 `new Date()`：用模块级 `_bootISO` + effect 刷新 `todayISO`（与 TreeScreen 同款）。

- [ ] **Step 1: 写 `src/components/PlanScreen.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Button } from "./ui/Button";
import { AREA_LABELS, type Goal } from "@/domain/types";
import { childGoals, dueGoalReviews, goalProgress } from "@/domain/goals";
import { fetchGoalActions, fetchGoalSuggestions, type GoalSuggestion } from "@/lib/goalClient";

// 导入时取一次"今天"作初值（render 内不可调用 new Date）；挂载后用 effect 刷新。
const _bootISO = new Date().toISOString();

export function PlanScreen() {
  const { tree, backToTree, openPath, addLongTermGoal, addShortTermGoal, setGoalActionTexts, toggleGoalActionById, completeGoalById, dropGoalById, markDueGoalsReviewed } = useApp();
  const { t } = useT();

  const [todayISO, setTodayISO] = useState(_bootISO);
  useEffect(() => {
    const update = () => setTodayISO(new Date().toISOString());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [added, setAdded] = useState<string[]>([]); // 已加入的候选 title
  const [busyActions, setBusyActions] = useState<string | null>(null); // 正在拆行动的 goalId

  const goals = useMemo(() => tree?.goals ?? [], [tree]);
  const longGoals = goals.filter((g) => g.horizon === "long");
  const orphanShort = goals.filter((g) => g.horizon === "short" && !g.parentGoalId);
  const activeLong = longGoals.filter((g) => g.status === "active");
  const doneLong = longGoals.filter((g) => g.status === "done");
  const due = tree ? dueGoalReviews(tree, todayISO) : [];

  if (!tree) return null;

  async function suggest() {
    if (suggesting || !tree) return;
    setSuggesting(true);
    const list = await fetchGoalSuggestions(tree);
    setSuggesting(false);
    setSuggestions(list);
  }

  function addSuggestion(s: GoalSuggestion) {
    if (added.includes(s.title)) return;
    if (s.horizon === "long") addLongTermGoal({ area: s.area, title: s.title, why: s.why });
    else addShortTermGoal({ area: s.area, title: s.title, why: s.why });
    setAdded((a) => [...a, s.title]);
  }

  async function breakIntoActions(goal: Goal) {
    if (busyActions) return;
    setBusyActions(goal.id);
    const texts = await fetchGoalActions(goal, tree!.profile.snapshot || "");
    setBusyActions(null);
    if (texts.length) setGoalActionTexts(goal.id, texts);
  }

  const crossroad = tree.profile.crossroad?.trim();
  const showCrossroadChip = Boolean(crossroad) && goals.length === 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8 sm:px-8">
      <header className="animate-fade">
        <button onClick={backToTree} className="text-sm text-[var(--fg-dim)] transition hover:text-[var(--fg)]">
          {t("← 返回人生树")}
        </button>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("我的规划")}</h1>
        <p className="mt-1 text-sm text-[var(--fg-dim)]">
          {t("先定长期目标——它会在你的人生树上长出一条路；用短期目标和行动一步步逼近它。")}
        </p>
      </header>

      {/* 到期复盘提醒 */}
      {due.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--c-amber)]/50 bg-[var(--c-amber)]/10 px-4 py-3 text-sm text-[var(--c-amber)]">
          <span>{t("该回看目标了：有 {n} 个目标一周没动过了。", { n: due.length })}</span>
          <button onClick={markDueGoalsReviewed} className="flex-shrink-0 rounded-full border border-[var(--c-amber)]/60 px-3 py-1 text-xs transition hover:bg-[var(--c-amber)]/20">
            {t("我回看过了")}
          </button>
        </div>
      )}

      {/* AI 建议目标 */}
      <div className="mt-5">
        <Button variant="primary" onClick={suggest} disabled={suggesting}>
          {suggesting ? t("正在想几个适合你的目标…") : t("✨ 帮我想几个目标")}
        </Button>
        {showCrossroadChip && (
          <button
            onClick={() => addLongTermGoal({ area: "career", title: crossroad!, why: "" })}
            className="ml-2 rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
          >
            {t("把「{label}」设成第一个长期目标", { label: crossroad! })}
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] p-3">
          <div className="text-xs font-semibold text-[var(--fg)]">
            {t("点「加入」才会进规划（长期目标会在树上长出一条路）")}
          </div>
          {suggestions.map((s) => {
            const isAdded = added.includes(s.title);
            return (
              <div key={s.title} className="flex items-start justify-between gap-2 rounded-xl border border-[var(--line)] bg-white/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--fg)]">
                    <span className="mr-1.5 rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-[var(--fg-dim)]">
                      {s.horizon === "long" ? t("长期") : t("短期")} · {t(AREA_LABELS[s.area])}
                    </span>
                    {s.title}
                  </div>
                  {s.why && <div className="mt-0.5 text-xs text-[var(--fg-dim)]">{s.why}</div>}
                </div>
                <button
                  onClick={() => addSuggestion(s)}
                  disabled={isAdded}
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] transition ${isAdded ? "text-[var(--c-emerald)]" : "border border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent)]/15"}`}
                >
                  {isAdded ? t("✓ 已加入") : t("加入")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 进行中的长期目标 */}
      {activeLong.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-bold text-[var(--fg-dim)]">{t("长期目标")}</h2>
          {activeLong.map((g) => (
            <LongGoalCard
              key={g.id}
              goal={g}
              progress={goalProgress(tree, g)}
              kids={childGoals(tree, g.id)}
              breaking={busyActions === g.id}
              t={t}
              onOpenPath={() => g.pathId && openPath(g.pathId)}
              onBreak={() => breakIntoActions(g)}
              onToggle={(aid) => toggleGoalActionById(g.id, aid)}
              onComplete={() => completeGoalById(g.id)}
              onDrop={() => {
                if (confirm(t("确定移除这个目标？长期目标会连同它在树上的分支一起删除。"))) dropGoalById(g.id);
              }}
              onAddShort={(title) => addShortTermGoal({ area: g.area, title, why: "", parentGoalId: g.id })}
            />
          ))}
        </section>
      )}

      {/* 未挂靠的短期目标 */}
      {orphanShort.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-bold text-[var(--fg-dim)]">{t("短期目标")}</h2>
          {orphanShort.map((g) => (
            <ShortGoalRow
              key={g.id}
              goal={g}
              breaking={busyActions === g.id}
              t={t}
              onBreak={() => breakIntoActions(g)}
              onToggle={(aid) => toggleGoalActionById(g.id, aid)}
              onComplete={() => completeGoalById(g.id)}
              onDrop={() => dropGoalById(g.id)}
            />
          ))}
        </section>
      )}

      {/* 已达成里程碑 */}
      {doneLong.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold text-[var(--fg-dim)]">{t("已达成的里程碑")}</h2>
          <div className="mt-2 space-y-1.5">
            {doneLong.map((g) => (
              <div key={g.id} className="flex items-center gap-2 rounded-xl border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/10 px-3 py-2 text-sm">
                <span>🏆</span>
                <span className="text-[var(--fg)]">{g.title}</span>
                <span className="ml-auto text-xs text-[var(--c-emerald)]">{t("已达成 · {area}+", { area: t(AREA_LABELS[g.area]) })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {goals.length === 0 && suggestions.length === 0 && (
        <p className="mt-10 text-center text-sm text-[var(--fg-faint)]">
          {t("还没有目标。让 AI 帮你想几个，看着它们在你的人生树上长出来。")}
        </p>
      )}
    </div>
  );
}

type TFn = (zh: string, vars?: Record<string, string | number>) => string;

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

function Actions({ goal, t, onToggle }: { goal: Goal; t: TFn; onToggle: (actionId: string) => void }) {
  if (goal.actions.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {goal.actions.map((a) => (
        <li key={a.id}>
          <button onClick={() => onToggle(a.id)} className="flex w-full items-center gap-2 text-left text-sm text-[var(--fg)]">
            <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] ${a.done ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]" : "border-[var(--line)]"}`}>
              {a.done ? "✓" : ""}
            </span>
            <span className={a.done ? "text-[var(--fg-faint)] line-through" : ""}>{a.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function LongGoalCard({
  goal, progress, kids, breaking, t, onOpenPath, onBreak, onToggle, onComplete, onDrop, onAddShort,
}: {
  goal: Goal; progress: number; kids: Goal[]; breaking: boolean; t: TFn;
  onOpenPath: () => void; onBreak: () => void; onToggle: (actionId: string) => void;
  onComplete: () => void; onDrop: () => void; onAddShort: (title: string) => void;
}) {
  const [newKid, setNewKid] = useState("");
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-bold text-[var(--fg)]">{goal.title}</div>
          {goal.why && <div className="mt-0.5 text-xs text-[var(--fg-dim)]">{goal.why}</div>}
        </div>
        <span className="flex-shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--fg-dim)]">
          {t(AREA_LABELS[goal.area])}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <ProgressBar value={progress} />
        <span className="flex-shrink-0 text-xs text-[var(--fg-faint)]">{t("进度 {pct}%", { pct: Math.round(progress * 100) })}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {goal.pathId && (
          <button onClick={onOpenPath} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--fg-dim)] transition hover:text-[var(--fg)]">
            {t("📈 在树上看这条路")}
          </button>
        )}
        {goal.pathId && (
          <button onClick={onOpenPath} className="rounded-full border border-[var(--accent)]/50 px-3 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15">
            {t("✨ 和达成目标的未来的你聊聊")}
          </button>
        )}
      </div>

      {/* 短期子目标 */}
      {kids.length > 0 && (
        <ul className="mt-3 space-y-1 border-l border-[var(--line)] pl-3">
          {kids.map((k) => (
            <li key={k.id} className="text-sm">
              <span className={k.status === "done" ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}>· {k.title}</span>
            </li>
          ))}
        </ul>
      )}

      {/* 自身行动 */}
      <Actions goal={goal} t={t} onToggle={onToggle} />

      {/* 加一个短期子目标 */}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={newKid}
          onChange={(e) => setNewKid(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && newKid.trim()) { onAddShort(newKid.trim()); setNewKid(""); } }}
          placeholder={t("加一个短期目标（踏脚石）")}
          className="flex-1 rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-3 py-1.5 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3 text-xs">
        <button onClick={onBreak} disabled={breaking} className="rounded-full border border-[var(--accent)]/50 px-3 py-1 text-[var(--accent)] transition hover:bg-[var(--accent)]/15 disabled:opacity-50">
          {breaking ? t("正在拆解…") : t("✨ 拆成行动")}
        </button>
        <button onClick={onComplete} className="rounded-full border border-[var(--c-emerald)]/50 px-3 py-1 text-[var(--c-emerald)] transition hover:bg-[var(--c-emerald)]/10">
          {t("✅ 已达成")}
        </button>
        <button onClick={onDrop} className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 text-[var(--fg-faint)] transition hover:text-[var(--c-rose)]">
          {t("移除")}
        </button>
      </div>
    </div>
  );
}

function ShortGoalRow({
  goal, breaking, t, onBreak, onToggle, onComplete, onDrop,
}: {
  goal: Goal; breaking: boolean; t: TFn;
  onBreak: () => void; onToggle: (actionId: string) => void; onComplete: () => void; onDrop: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-[var(--fg)]">{goal.title}</div>
          {goal.why && <div className="mt-0.5 text-xs text-[var(--fg-dim)]">{goal.why}</div>}
        </div>
        <span className="flex-shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--fg-dim)]">
          {t(AREA_LABELS[goal.area])}
        </span>
      </div>
      <Actions goal={goal} t={t} onToggle={onToggle} />
      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3 text-xs">
        <button onClick={onBreak} disabled={breaking} className="rounded-full border border-[var(--accent)]/50 px-3 py-1 text-[var(--accent)] transition hover:bg-[var(--accent)]/15 disabled:opacity-50">
          {breaking ? t("正在拆解…") : t("✨ 拆成行动")}
        </button>
        <button onClick={onComplete} className="rounded-full border border-[var(--c-emerald)]/50 px-3 py-1 text-[var(--c-emerald)] transition hover:bg-[var(--c-emerald)]/10">
          {t("✅ 已达成")}
        </button>
        <button onClick={onDrop} className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 text-[var(--fg-faint)] transition hover:text-[var(--c-rose)]">
          {t("移除")}
        </button>
      </div>
    </div>
  );
}
```

> `AREA_LABELS[s.area]` 是中文常量；用 `t(...)` 包一层，英文界面下查字典（Task 11 会补 5 个领域词的英文）。`confirm(...)` 是浏览器原生确认框，组件标了 `"use client"`，可用。`t` 的第二参数 `useT()` 已支持 `{var}` 插值。

- [ ] **Step 2: 类型检查（含 Task 8 的改动）**

Run: `npx tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 3: 构建验证**

Run: `npx next build`
Expected: 构建成功（出现 `/api/goals`、`/api/goal-actions` 两条新路由）。
若随后 `npm run dev` 访问 `/` 出现 404，清掉 `.next` 再起：`rm -rf .next` 然后重启 dev（本仓库已知现象）。

- [ ] **Step 4: Commit（合并 Task 8 + Task 9）**

```bash
git add src/app/page.tsx src/components/TreeScreen.tsx src/components/PlanScreen.tsx
git commit -m "feat(plan): PlanScreen + plan view route + tree entry button

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: 人生树上的已达成里程碑高亮（轻量）

**Files:**
- Modify: `src/components/LifeMap.tsx`
- Modify: `src/components/TreeScreen.tsx`

> 让已达成的长期目标对应的分支在树上有"做到了"的观感：终点标签前加 🏆、终点圆点更亮。范围刻意小。

- [ ] **Step 1: TreeScreen 计算 achieved 集合并传给 LifeMap**

在 `src/components/TreeScreen.tsx` 顶部 import 加：

```ts
import { achievedPathIds } from "@/domain/goals";
```

在 `const due = dueDecisions(tree, todayISO);` 之后加：

```ts
  const achieved = achievedPathIds(tree);
```

把 `<LifeMap tree={tree} onSelectPath={openPath} onForkAtNode={...} />` 改为传入 `achievedIds`：

```tsx
          <LifeMap
            tree={tree}
            achievedIds={achieved}
            onSelectPath={openPath}
            onForkAtNode={(parentId, forkAge, atLabel) =>
              setFork({ parentId, forkAge, atLabel })
            }
          />
```

- [ ] **Step 2: LifeMap 接收并下传 achieved 标记**

在 `src/components/LifeMap.tsx` 的 `LifeMap` props 解构与类型里加 `achievedIds`：

```tsx
export function LifeMap({
  tree,
  onSelectPath,
  onForkAtNode,
  achievedIds,
}: {
  tree: LifeTree;
  onSelectPath: (id: string) => void;
  onForkAtNode: (parentId: string, forkAge: number, atLabel: string) => void;
  achievedIds?: Set<string>;
}) {
```

在渲染 `layout.items.map(...)` 的 `<PathCurve ... />` 上加一个 `achieved` 属性：

```tsx
            <PathCurve
              key={p.id}
              p={p}
              index={i}
              reduced={reduced}
              achieved={Boolean(achievedIds?.has(p.id))}
              dim={Boolean(focusId) && !litChain.has(p.id)}
              active={focusId === p.id}
```

- [ ] **Step 3: PathCurve 接收 achieved 并加视觉**

在 `function PathCurve({ ... })` 的解构与类型里加 `achieved`（放在 `reduced` 之后）：

```tsx
function PathCurve({
  p,
  index,
  reduced,
  achieved,
  dim,
  active,
```

类型块里加：

```tsx
  reduced: boolean;
  achieved: boolean;
  dim: boolean;
```

把终点圆点的 `r` 与发光略微增强（已达成时），并在标签前加 🏆。找到终点那段：

```tsx
        <circle
          cx={p.end.x}
          cy={p.end.y}
          r={active ? 7.5 : 5.5}
          fill={color}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "r .15s ease" }}
        />
        <text
          x={p.end.x + 14}
          y={p.end.y - 3}
          fontSize={15}
          fontWeight={700}
          fill={isSq ? "var(--fg-dim)" : "var(--fg)"}
        >
          {truncate(t(p.choiceLabel), 12)}
        </text>
```

改为：

```tsx
        <circle
          cx={p.end.x}
          cy={p.end.y}
          r={achieved ? (active ? 8.5 : 7) : active ? 7.5 : 5.5}
          fill={color}
          style={{ filter: `drop-shadow(0 0 ${achieved ? 11 : 6}px ${color})`, transition: "r .15s ease" }}
        />
        <text
          x={p.end.x + 14}
          y={p.end.y - 3}
          fontSize={15}
          fontWeight={700}
          fill={isSq ? "var(--fg-dim)" : "var(--fg)"}
        >
          {(achieved ? "🏆 " : "") + truncate(t(p.choiceLabel), 12)}
        </text>
```

- [ ] **Step 4: 类型检查 + 构建**

Run: `npx tsc --noEmit && npx next build`
Expected: 0 错误，构建成功。

- [ ] **Step 5: Commit**

```bash
git add src/components/LifeMap.tsx src/components/TreeScreen.tsx
git commit -m "feat(map): highlight achieved-goal branches with a milestone marker

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: i18n 英文 + 全量验证

**Files:**
- Modify: `src/i18n/messages.ts`

- [ ] **Step 1: 在 `EN` 字典里新增规划主线相关条目**

在 `src/i18n/messages.ts` 的 `EN` 对象里追加一段（放在文件中已有条目之后、对象闭合 `}` 之前）：

```ts
  // ── 规划主线 PlanScreen ──
  "🎯 我的规划": "🎯 My Plan",
  我的规划: "My Plan",
  "← 返回人生树": "← Back to life tree",
  "先定长期目标——它会在你的人生树上长出一条路；用短期目标和行动一步步逼近它。":
    "Set a long-term goal — it grows a path on your life tree; close in on it with short-term goals and actions.",
  "该回看目标了：有 {n} 个目标一周没动过了。":
    "Time to review: {n} goal(s) haven’t moved in a week.",
  我回看过了: "I’ve reviewed",
  "✨ 帮我想几个目标": "✨ Suggest some goals",
  "正在想几个适合你的目标…": "Thinking of goals that fit you…",
  "把「{label}」设成第一个长期目标": "Make “{label}” your first long-term goal",
  "点「加入」才会进规划（长期目标会在树上长出一条路）":
    "Tap “Add” to put it in your plan (a long-term goal grows a path on the tree)",
  长期: "Long-term",
  短期: "Short-term",
  "✓ 已加入": "✓ Added",
  加入: "Add",
  长期目标: "Long-term goals",
  短期目标: "Short-term goals",
  "进度 {pct}%": "{pct}% done",
  "📈 在树上看这条路": "📈 See this path on the tree",
  "✨ 和达成目标的未来的你聊聊": "✨ Talk to the future you who got there",
  "加一个短期目标（踏脚石）": "Add a short-term goal (stepping stone)",
  "正在拆解…": "Breaking it down…",
  "✨ 拆成行动": "✨ Break into actions",
  "✅ 已达成": "✅ Achieved",
  移除: "Remove",
  "确定移除这个目标？长期目标会连同它在树上的分支一起删除。":
    "Remove this goal? A long-term goal also deletes its branch on the tree.",
  已达成的里程碑: "Milestones reached",
  "已达成 · {area}+": "Achieved · {area}+",
  "还没有目标。让 AI 帮你想几个，看着它们在你的人生树上长出来。":
    "No goals yet. Let the AI suggest some, and watch them grow on your life tree.",
  // 领域词（PlanScreen 用 t(AREA_LABELS[area])）——若已存在同名键可不重复
  事业: "Career",
  财富: "Wealth",
  关系: "Relationships",
  健康: "Health",
  成长: "Growth",
```

> 提交前在该文件内搜索 `事业:` / `财富:` 等，若已存在重复键，删掉本段里重复的那几行（重复键会触发编译/lint 报错）。

- [ ] **Step 2: 全量验证**

Run: `npx tsc --noEmit && npx vitest run && npx next build`
Expected: tsc 0 错误；测试全绿（含新增 goals 与 tree 用例）；构建成功。

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages.ts
git commit -m "feat(i18n): English strings for the planning mainline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 真机冒烟（早上和用户一起过）

清掉旧构建产物再起 dev：`rm -rf .next && npm run dev`，然后在 `localhost:3000`：

1. **单线起手**：清空重置后重新走 onboarding（即使填了"当前岔路"），进树只有一条"维持现状"虚线。
2. **建长期目标长分支**：进「🎯 我的规划」→「✨ 帮我想几个目标」→ 选一个长期目标「加入」→ 看到「正在推演」动画 → 落回人生树，多出一条分支。
3. **拆行动 + 进度**：回规划页，给该长期目标「拆成行动」→ 勾几条 → 进度条上升。
4. **达成 + 影响人生**：点「✅ 已达成」→ 该目标进"已达成里程碑"，树上这条分支终点带 🏆；之后新加的路里相关人生面起点更高（达成给该 area +8）。
5. **未来自我对话**：长期目标卡「✨ 和达成目标的未来的你聊聊」→ 进入这条分支详情页的对话。
6. **手动加选择仍能分叉**：人生树「＋ 添加岔路」照常工作。
7. **双语**：切到英文，PlanScreen 文案为英文。

## 验收对照（spec → 任务）

- 单线起手 → Task 2；分叉来源=长期目标/手动选择 → Task 7（addLongTermGoal）+ 既有 addBranch
- 两级目标 + 进度 → Task 1/4 + Task 9
- 长期目标=分支、达成后的未来=分支未来、未来自我对话复用 → Task 7 + Task 9（openPath 进详情页）
- AI 建议目标 / 拆行动（带兜底+限流）→ Task 5/6
- 达成→领域+分 + 里程碑 → Task 4（completeGoal/AREA_BUMP）+ Task 9/10
- 每周复盘提醒 → Task 4（dueGoalReviews）+ Task 9
- crossroad chip → Task 9
- 旧库兼容 → Task 3
- 双语 / 确定性 / 测试 → Task 11 / 全程 / Task 2-4
