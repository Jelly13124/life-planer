# Life Decision Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the planning spine (选定 → 落地 → 复盘) onto the existing prediction app, so a user can turn an opened path into a 30/90-day plan and later review it against reality.

**Architecture:** Decisions live on `LifeTree.decisions` (localStorage, backward-compatible — no DB reset). Pure domain functions in `src/domain/decisions.ts` (time injected, no `Date.now`/`Math.random`). Two DeepSeek routes (`/api/plan`, `/api/review`) with local fallbacks. New `DecisionSheet` / `ReviewSheet` components reuse the `AddBranchSheet` visual language. All new copy goes through the existing `t()` i18n with English added to `messages.ts`.

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19, TypeScript, Tailwind v4, Vitest 4 (node env), zod 4, DeepSeek (OpenAI-compatible).

**Decisions locked from spec review:** confidence = 0–100% slider (step 10, default 60); review nudge = in-app only; plan horizon = user picks, default 90d; a decision must attach to a `choice` path; no storage-version bump (migrate in place).

---

### Task 1: Domain types + tree init

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/tree.ts` (createTree)

- [ ] **Step 1: Add the decision types to `src/domain/types.ts`**

Append after the `LifePath` interface (before `LifeTree`):

```ts
export type Reversibility = "one-way" | "two-way"; // 单行道 / 可回头
export type PlanHorizon = "30d" | "90d";

export interface PlanStep {
  id: string;
  text: string;
  done: boolean;
}
export interface Experiment {
  id: string;
  text: string;
  done: boolean;
}
export interface Plan {
  horizon: PlanHorizon;
  steps: PlanStep[];
  experiments: Experiment[];
  generatedByAI: boolean;
}

export type ReviewOutcome = 1 | 2 | 3 | 4 | 5; // 1 远差于预期 … 5 远好于预期
export interface Review {
  reviewedAt: string;
  whatHappened: string;
  outcome: ReviewOutcome;
  lesson: string;
}

export interface Decision {
  id: string;
  pathId: string;
  choiceLabel: string;
  createdAt: string;
  rationale: string;
  expectation: string;
  confidence: number; // 0-100
  reversibility: Reversibility;
  reviewDate: string; // ISO = createdAt + horizon
  plan: Plan;
  review: Review | null;
}
```

- [ ] **Step 2: Add `decisions` to `LifeTree`**

In the `LifeTree` interface, add the field:

```ts
export interface LifeTree {
  id: string;
  profile: Profile;
  horizonYears: number;
  paths: LifePath[];
  decisions: Decision[]; // 决策日志（看见→追问→选定→落地→复盘）
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 3: Initialize `decisions: []` in `createTree`**

In `src/domain/tree.ts`, in the object returned by `createTree`, add `decisions: []`:

```ts
  return {
    id,
    profile,
    horizonYears,
    paths,
    decisions: [],
    createdAt: now,
    updatedAt: now,
  };
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: type errors in `localStorageRepo`/`AppContext`/tests that construct `LifeTree` without `decisions` are acceptable for now IF any appear; otherwise clean. (Existing tree fixtures use `createTree`, so they inherit the new field. The mapLayout/tree test fixtures build `LifePath` not `LifeTree`, so they are unaffected.)

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/tree.ts
git commit -m "feat(decisions): add Decision/Plan/Review types + tree.decisions"
```

---

### Task 2: Pure domain functions `decisions.ts` (TDD)

**Files:**
- Create: `src/domain/decisions.ts`
- Test: `src/domain/__tests__/decisions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/__tests__/decisions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTree } from "@/domain/tree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import {
  createDecision,
  upsertDecision,
  setPlan,
  togglePlanItem,
  recordReview,
  activeDecisionFor,
  dueDecisions,
  calibrationNote,
  addDays,
  type DecisionInput,
} from "@/domain/decisions";
import type { Profile } from "@/domain/types";

const profile = {
  name: "小测", age: 28, education: "bachelor", major: "", occupation: "",
  salary: "5to10", hasSideHustle: false, sideHustle: "", hobbies: "",
  relationship: "single", location: "", status: "", snapshot: "", crossroad: "读研",
  areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 },
} as Profile;

const gen = new LocalPathGenerator();
const NOW = "2026-06-16T00:00:00.000Z";

function baseInput(over: Partial<DecisionInput> = {}): DecisionInput {
  return {
    pathId: "p1", choiceLabel: "去读研", rationale: "想转行", expectation: "两年后进大厂",
    confidence: 70, reversibility: "two-way", horizon: "90d", ...over,
  };
}

describe("decisions domain", () => {
  it("createDecision sets reviewDate = createdAt + horizon and clamps confidence", () => {
    const d = createDecision(baseInput({ confidence: 140 }), NOW);
    expect(d.createdAt).toBe(NOW);
    expect(d.confidence).toBe(100);
    expect(d.reviewDate).toBe(addDays(NOW, 90));
    expect(d.review).toBeNull();
    expect(d.plan.horizon).toBe("90d");
    expect(d.id.startsWith("dec-")).toBe(true);
  });

  it("upsertDecision replaces the active (unreviewed) decision for the same path", () => {
    let tree = createTree(profile, gen, NOW);
    const d1 = createDecision(baseInput(), NOW);
    tree = upsertDecision(tree, d1);
    const d2 = createDecision(baseInput({ rationale: "改主意了" }), "2026-06-17T00:00:00.000Z");
    tree = upsertDecision(tree, d2);
    const forPath = tree.decisions.filter((d) => d.pathId === "p1");
    expect(forPath.length).toBe(1);
    expect(forPath[0].rationale).toBe("改主意了");
  });

  it("setPlan + togglePlanItem build and flip items", () => {
    const d = setPlan(createDecision(baseInput(), NOW), ["第一步", "第二步"], ["小试验"], true);
    expect(d.plan.steps.length).toBe(2);
    expect(d.plan.experiments.length).toBe(1);
    expect(d.plan.generatedByAI).toBe(true);
    const toggled = togglePlanItem(d, d.plan.steps[0].id);
    expect(toggled.plan.steps[0].done).toBe(true);
    expect(toggled.plan.steps[1].done).toBe(false);
  });

  it("recordReview attaches the review; dueDecisions respects today and review state", () => {
    let tree = createTree(profile, gen, NOW);
    const d = createDecision(baseInput(), NOW); // reviewDate = NOW + 90d
    tree = upsertDecision(tree, d);
    expect(dueDecisions(tree, "2026-07-01T00:00:00.000Z")).toHaveLength(0); // before reviewDate
    const due = dueDecisions(tree, addDays(NOW, 91));
    expect(due).toHaveLength(1);
    const reviewed = recordReview(d, {
      reviewedAt: addDays(NOW, 91), whatHappened: "成了", outcome: 4, lesson: "还行",
    });
    tree = upsertDecision(tree, reviewed);
    expect(dueDecisions(tree, addDays(NOW, 91))).toHaveLength(0); // reviewed -> not due
    expect(activeDecisionFor(tree, "p1")).toBeNull();
  });

  it("calibrationNote reacts to confidence vs outcome", () => {
    expect(calibrationNote(80, 1)).toContain("高");
    expect(calibrationNote(30, 5)).toContain("低估");
    expect(calibrationNote(50, 3)).toContain("挺准");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run -s test -- decisions`
Expected: FAIL — `Cannot find module '@/domain/decisions'`.

- [ ] **Step 3: Write `src/domain/decisions.ts`**

```ts
import type { Decision, LifeTree, PlanHorizon, Review, Reversibility } from "./types";
import { hashSeed } from "./seed";

const DAY_MS = 86_400_000;
const HORIZON_DAYS: Record<PlanHorizon, number> = { "30d": 30, "90d": 90 };

export interface DecisionInput {
  pathId: string;
  choiceLabel: string;
  rationale: string;
  expectation: string;
  confidence: number;
  reversibility: Reversibility;
  horizon: PlanHorizon;
}

const clampConfidence = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// 注入 ISO 字符串做日期运算（解析既定字符串是确定性的，不用 Date.now）。
export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

export function createDecision(input: DecisionInput, now: string): Decision {
  const id = `dec-${hashSeed(`${input.pathId}|${now}`)}`;
  return {
    id,
    pathId: input.pathId,
    choiceLabel: input.choiceLabel,
    createdAt: now,
    rationale: input.rationale.trim(),
    expectation: input.expectation.trim(),
    confidence: clampConfidence(input.confidence),
    reversibility: input.reversibility,
    reviewDate: addDays(now, HORIZON_DAYS[input.horizon]),
    plan: { horizon: input.horizon, steps: [], experiments: [], generatedByAI: false },
    review: null,
  };
}

// 覆盖同一条路上"未复盘"的旧决定；按 id 去重后追加。
export function upsertDecision(tree: LifeTree, decision: Decision): LifeTree {
  const kept = tree.decisions.filter(
    (d) =>
      d.id !== decision.id &&
      !(d.pathId === decision.pathId && d.review === null),
  );
  return { ...tree, decisions: [...kept, decision] };
}

export function setPlan(
  decision: Decision,
  steps: string[],
  experiments: string[],
  generatedByAI: boolean,
): Decision {
  return {
    ...decision,
    plan: {
      horizon: decision.plan.horizon,
      steps: steps.map((text, i) => ({ id: `${decision.id}-s${i}`, text, done: false })),
      experiments: experiments.map((text, i) => ({ id: `${decision.id}-e${i}`, text, done: false })),
      generatedByAI,
    },
  };
}

export function togglePlanItem(decision: Decision, itemId: string): Decision {
  const flip = <T extends { id: string; done: boolean }>(arr: T[]): T[] =>
    arr.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
  return {
    ...decision,
    plan: {
      ...decision.plan,
      steps: flip(decision.plan.steps),
      experiments: flip(decision.plan.experiments),
    },
  };
}

export function recordReview(decision: Decision, review: Review): Decision {
  return { ...decision, review };
}

export function activeDecisionFor(tree: LifeTree, pathId: string): Decision | null {
  return tree.decisions.find((d) => d.pathId === pathId && d.review === null) ?? null;
}

export function dueDecisions(tree: LifeTree, today: string): Decision[] {
  return tree.decisions.filter((d) => d.review === null && d.reviewDate <= today);
}

// 本地兜底的一句校准（AI 版在 /api/review 生成更好的）。
export function calibrationNote(confidence: number, outcome: Review["outcome"]): string {
  if (outcome >= 4 && confidence <= 40) return "结果比你当时预想的好——你也许低估了自己。";
  if (outcome <= 2 && confidence >= 70) return "结果比预期差——当时的信心也许高了点，下次多想想会怎么出错。";
  if (outcome === 3) return "和预期差不多——这次判断挺准。";
  return "把这次的预期和真实对照记下来，你的判断会越来越准。";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run -s test -- decisions`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/decisions.ts src/domain/__tests__/decisions.test.ts
git commit -m "feat(decisions): pure domain fns (create/upsert/plan/review/due) + tests"
```

---

### Task 3: localStorage backward-compatible migration (TDD)

**Files:**
- Modify: `src/domain/repository/localStorageRepo.ts`
- Modify: `src/domain/__tests__/tree.test.ts` (add one test)

- [ ] **Step 1: Export the storage key + write the failing test**

In `src/domain/__tests__/tree.test.ts`, add to the existing `LocalStorageRepository` describe block:

```ts
  it("backfills decisions: [] for old trees missing the field", () => {
    const store = makeStore();
    const t = createTree(profile, gen, NOW);
    const legacy = { ...t } as Record<string, unknown>;
    delete legacy.decisions; // 模拟旧版没有 decisions 的树
    store.setItem("lifeplanner.tree.v3", JSON.stringify(legacy));
    const repo = new LocalStorageRepository(store);
    const loaded = repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.decisions).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run -s test -- tree`
Expected: FAIL — `loaded.decisions` is `undefined`, not `[]`.

- [ ] **Step 3: Add the backfill in `load()`**

In `src/domain/repository/localStorageRepo.ts`, change the parse block in `load()`:

```ts
    try {
      const parsed = JSON.parse(raw) as LifeTree;
      if (!parsed || !Array.isArray(parsed.paths) || !parsed.profile) return null;
      if (!Array.isArray(parsed.decisions)) parsed.decisions = []; // 旧树兼容：补字段，不清库
      return parsed;
    } catch {
      return null;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run -s test -- tree`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/repository/localStorageRepo.ts src/domain/__tests__/tree.test.ts
git commit -m "feat(decisions): backfill tree.decisions on load (no storage reset)"
```

---

### Task 4: `/api/plan` route (落地)

**Files:**
- Create: `src/app/api/plan/route.ts`

- [ ] **Step 1: Write the route**

```ts
// 服务端：把一个选择落地成 30/90 天计划 + 低成本试错。无 key/失败 → 空数组，前端本地兜底。
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface Body {
  profileSummary: string;
  choiceLabel: string;
  summary: string;
  rationale: string;
  expectation: string;
  horizon: "30d" | "90d";
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

export async function POST(request: Request) {
  const key = getKey();
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ steps: [], experiments: [] }, { status: 400 });
  }
  if (!key) return Response.json({ steps: [], experiments: [] });

  const days = body.horizon === "30d" ? 30 : 90;
  const system = [
    "你是一个清醒、务实的人生规划助手。把用户选定的一条人生路，落地成接下来一段时间的具体计划。",
    `给出 3-6 条「近期行动」（steps）：动词开头、具体、可勾选、能在未来 ${days} 天内真正动手。`,
    "再给 2-3 个「低成本试错」（experiments）：花费小、时间短、可证伪，用来验证这条路是否真适合 TA（参考 Designing Your Life 的原型试错）。",
    "务实、不画饼、不喊口号；扎根 TA 的真实处境。",
    body.profileSummary ? `TA 的现状：${body.profileSummary}。` : "",
    `TA 选定的路：「${body.choiceLabel}」${body.summary ? `（${body.summary}）` : ""}。`,
    body.rationale ? `选它的原因：${body.rationale}。` : "",
    body.expectation ? `TA 的预期：${body.expectation}。` : "",
    body.lang === "en"
      ? "LANGUAGE: write every step and experiment in natural, fluent English."
      : "语言：steps 和 experiments 一律用简体中文。",
    "只输出如下 json，不要解释或代码块：",
    '{"steps":["近期行动"],"experiments":["低成本试错"]}',
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
          { role: "user", content: "把它落地成计划。" },
        ],
        response_format: MODEL.includes("reasoner") ? undefined : { type: "json_object" },
        max_tokens: 700,
        temperature: 0.7,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[plan] DeepSeek ${res.status}`);
      return Response.json({ steps: [], experiments: [] });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json({ steps: [], experiments: [] });
    const parsed = JSON.parse(json) as { steps?: unknown; experiments?: unknown };
    return Response.json({
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      experiments: Array.isArray(parsed.experiments) ? parsed.experiments : [],
    });
  } catch (e) {
    console.error("[plan] failed:", e);
    return Response.json({ steps: [], experiments: [] });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/plan/route.ts
git commit -m "feat(api): /api/plan — turn a choice into a 30/90-day plan + experiments"
```

---

### Task 5: `/api/review` route (复盘校准)

**Files:**
- Create: `src/app/api/review/route.ts`

- [ ] **Step 1: Write the route**

```ts
// 服务端：复盘——对照"当时预期/信心"与"真实发生"，给一句校准。无 key/失败 → null，前端本地兜底。
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface Body {
  choiceLabel: string;
  rationale: string;
  expectation: string;
  confidence: number;
  whatHappened: string;
  outcome: number; // 1-5
  lang?: "zh" | "en";
}

function getKey(): string | null {
  const k = process.env.DEEPSEEK_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

export async function POST(request: Request) {
  const key = getKey();
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ lesson: null }, { status: 400 });
  }
  if (!key) return Response.json({ lesson: null });

  const system = [
    "你在帮用户复盘一个人生决定。对照 TA 当时的预期与信心、以及真实发生的，给一句温暖、诚实、可迁移的教训/校准。",
    "不说教、不打鸡血、不算命。≤2 句。",
    `选择：「${body.choiceLabel}」。当时原因：${body.rationale || "（未填）"}。`,
    `当时预期：${body.expectation || "（未填）"}。当时信心：${body.confidence}%。`,
    `真实发生：${body.whatHappened}。结果对比预期（1 远差—5 远好）：${body.outcome}。`,
    body.lang === "en" ? "LANGUAGE: reply in natural, fluent English, ≤2 sentences." : "语言：用简体中文，≤2 句。",
    "只输出这一句话本身，不要前缀、不要引号、不要解释。",
  ].join("\n");

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: "给我一句复盘校准。" },
        ],
        max_tokens: 200,
        temperature: 0.7,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[review] DeepSeek ${res.status}`);
      return Response.json({ lesson: null });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const lesson = data.choices?.[0]?.message?.content?.trim() || null;
    return Response.json({ lesson });
  } catch (e) {
    console.error("[review] failed:", e);
    return Response.json({ lesson: null });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/review/route.ts
git commit -m "feat(api): /api/review — one-line calibration from reality vs expectation"
```

---

### Task 6: `planClient.ts` (client wrapper + local fallback, TDD on pure helpers)

**Files:**
- Create: `src/lib/planClient.ts`
- Test: `src/lib/__tests__/planClient.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { sanitizePlan, localPlanTemplate } from "@/lib/planClient";

describe("planClient helpers", () => {
  it("localPlanTemplate has steps and experiments", () => {
    const t = localPlanTemplate();
    expect(t.steps.length).toBeGreaterThanOrEqual(2);
    expect(t.experiments.length).toBeGreaterThanOrEqual(1);
  });

  it("sanitizePlan trims, drops blanks, caps lengths", () => {
    const p = sanitizePlan({
      steps: ["  做第一步 ", "", "第二步", "三", "四", "五", "六", "七"],
      experiments: ["  试一下 ", "  ", "再试"],
    });
    expect(p.steps).toEqual(["做第一步", "第二步", "三", "四", "五", "六"]); // cap 6, trimmed, no blanks
    expect(p.experiments).toEqual(["试一下", "再试"]); // cap 3
  });

  it("sanitizePlan tolerates non-arrays", () => {
    expect(sanitizePlan({})).toEqual({ steps: [], experiments: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run -s test -- planClient`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/planClient.ts`**

```ts
// 客户端安全：调 /api/plan 与 /api/review，失败/无 key 时本地兜底。
import { currentLocale } from "@/i18n/locale";
import type { Decision, LifePath, LifeTree, PlanHorizon } from "@/domain/types";

export interface PlanResult {
  steps: string[];
  experiments: string[];
}

function sanitizeList(x: unknown, max: number): string[] {
  return (Array.isArray(x) ? x : [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

export function sanitizePlan(raw: { steps?: unknown; experiments?: unknown }): PlanResult {
  return { steps: sanitizeList(raw.steps, 6), experiments: sanitizeList(raw.experiments, 3) };
}

// 没接 AI / 失败时的通用模板（仍可用、可编辑）。
export function localPlanTemplate(): PlanResult {
  return {
    steps: [
      "把这个选择拆成最近两周能动手的第一步",
      "找一个已经走过这条路的人，聊 30 分钟",
      "估一估走这条路需要的钱、时间和条件",
    ],
    experiments: [
      "用一个周末做一次最小尝试，记下真实感受",
      "设一个一个月的检查点，到点问自己还想继续吗",
    ],
  };
}

interface PlanRequest {
  rationale: string;
  expectation: string;
  horizon: PlanHorizon;
}

// 返回计划 + 是否由 AI 生成（false = 本地兜底）。
export async function fetchPlan(
  tree: LifeTree,
  path: LifePath,
  req: PlanRequest,
): Promise<{ result: PlanResult; ai: boolean }> {
  try {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileSummary: tree.profile.snapshot || "",
        choiceLabel: path.choiceLabel,
        summary: path.summary || "",
        rationale: req.rationale,
        expectation: req.expectation,
        horizon: req.horizon,
        lang: currentLocale(),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { steps?: unknown; experiments?: unknown };
      const p = sanitizePlan(data ?? {});
      if (p.steps.length >= 1) return { result: p, ai: true };
    }
  } catch {
    /* 落到本地兜底 */
  }
  return { result: localPlanTemplate(), ai: false };
}

interface ReviewRequest {
  whatHappened: string;
  outcome: number;
}

// 返回 AI 校准句；失败返回 null（调用方用 calibrationNote 兜底）。
export async function fetchReviewLesson(
  decision: Decision,
  req: ReviewRequest,
): Promise<string | null> {
  try {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        choiceLabel: decision.choiceLabel,
        rationale: decision.rationale,
        expectation: decision.expectation,
        confidence: decision.confidence,
        whatHappened: req.whatHappened,
        outcome: req.outcome,
        lang: currentLocale(),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lesson?: string | null };
    return data.lesson ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run -s test -- planClient`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/planClient.ts src/lib/__tests__/planClient.test.ts
git commit -m "feat(decisions): planClient (fetchPlan/fetchReviewLesson) + local fallback + tests"
```

---

### Task 7: AppContext wiring

**Files:**
- Modify: `src/state/AppContext.tsx`

- [ ] **Step 1: Add imports**

Near the other domain imports:

```ts
import {
  createDecision,
  upsertDecision,
  type DecisionInput,
} from "@/domain/decisions";
import type { Decision } from "@/domain/types";
```

(`LifePath` is already imported; `Decision` may already be transitively available via types — add it to the existing `@/domain/types` import line instead of a new line if one exists.)

- [ ] **Step 2: Extend `AppApi` with three methods**

In the `AppApi` interface add:

```ts
  makeDecision: (input: DecisionInput) => Decision;
  commitDecision: (decision: Decision) => void; // 新建/覆盖同路活跃决定
  updateDecision: (decision: Decision) => void; // 按 id 原地更新（勾选/复盘）
```

- [ ] **Step 3: Implement them in the `api` useMemo object**

Add alongside `addBranch` etc.:

```ts
      makeDecision: (input) => createDecision(input, new Date().toISOString()),
      commitDecision: (decision) => {
        const base = treeRef.current;
        if (!base) return;
        dispatch({ type: "setTree", tree: upsertDecision(base, decision) });
      },
      updateDecision: (decision) => {
        const base = treeRef.current;
        if (!base) return;
        dispatch({
          type: "setTree",
          tree: {
            ...base,
            decisions: base.decisions.map((d) => (d.id === decision.id ? decision : d)),
          },
        });
      },
```

(`setTree` already sets `view: "tree"`. That is acceptable: decisions are committed from PathDetail/TreeScreen which are tree-side; the active view is restored by the caller if needed. If this causes a view jump from the detail page, instead add a dedicated reducer action `patchTree` that updates `tree` WITHOUT changing `view`:)

```ts
// in Action union:
  | { type: "patchTree"; tree: LifeTree }
// in reducer:
    case "patchTree":
      return { ...state, tree: action.tree };
```

Then use `dispatch({ type: "patchTree", tree: ... })` in `commitDecision` and `updateDecision` so the detail view stays put. Implement the `patchTree` action.

- [ ] **Step 4: Add the three methods to the `useMemo` dependency array** (they only use `dispatch`/`treeRef`, which are stable — no dep changes needed, but keep the array as-is).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/state/AppContext.tsx
git commit -m "feat(decisions): AppContext makeDecision/commitDecision/updateDecision (patchTree keeps view)"
```

---

### Task 8: i18n — add English for all new strings

**Files:**
- Modify: `src/i18n/messages.ts`

- [ ] **Step 1: Append these pairs to the `EN` object** (a new `// ── 决策闭环 ──` block). Keep exact Chinese keys; later UI tasks call `t()` with these exact strings.

```ts
  // ── 决策闭环（选定/落地/复盘） ──
  把这条路变成计划: "Turn this path into a plan",
  你的决定: "Your decision",
  "为什么选它": "Why this choice",
  "你预期会发生什么": "What do you expect to happen",
  信心几成: "How confident are you",
  "这个决定可逆吗？": "Is this reversible?",
  单行道: "One-way door",
  可回头: "Two-way door",
  多久后回看: "When to review",
  "30 天": "30 days",
  "90 天": "90 days",
  "生成计划 →": "Generate plan →",
  "正在为你制定计划…": "Building your plan…",
  近期行动: "Next actions",
  低成本试错: "Cheap experiments",
  "（没接上 AI，先用本地模板生成的计划）": "(No AI — generated a local template plan)",
  "距复盘还有 {n} 天": "{n} days until review",
  "有 {n} 个决定该复盘了": "{n} decision(s) ready to review",
  去复盘: "Review",
  "复盘：{label}": "Review: {label}",
  "实际发生了什么？": "What actually happened?",
  比预期差很多: "Much worse than expected",
  比预期好很多: "Much better than expected",
  "当时你预期：{exp}": "You expected: {exp}",
  "当时信心 {n}%": "Confidence was {n}%",
  完成复盘: "Finish review",
  "用真实情况再推演一条": "Re-run a prediction from reality",
  想清楚这个决定: "Think this decision through",
  "后悔最小化：80 岁回头看，哪个更不后悔？": "Regret minimization: at 80, which will I regret less?",
  "预演失败：三年后它失败了，最可能因为什么？": "Pre-mortem: if it fails in 3 years, why?",
  "可逆性：这是单行道还是可回头？": "Reversibility: one-way or two-way door?",
```

- [ ] **Step 2: Typecheck (catches stray ASCII-quote-in-Chinese parse errors)**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages.ts
git commit -m "i18n(decisions): English for decision-loop strings"
```

---

### Task 9: `DecisionSheet` component (选定 → 落地)

**Files:**
- Create: `src/components/DecisionSheet.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import type { LifePath, LifeTree, PlanHorizon, Reversibility } from "@/domain/types";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { setPlan } from "@/domain/decisions";
import { fetchPlan } from "@/lib/planClient";
import { Button } from "./ui/Button";

// 选定一条路 + AI 落地成计划（确认优先：填完点生成，计划出来再保存）。
export function DecisionSheet({
  tree,
  path,
  onClose,
}: {
  tree: LifeTree;
  path: LifePath;
  onClose: () => void;
}) {
  const { t } = useT();
  const { makeDecision, commitDecision } = useApp();
  const [rationale, setRationale] = useState("");
  const [expectation, setExpectation] = useState("");
  const [confidence, setConfidence] = useState(60);
  const [reversibility, setReversibility] = useState<Reversibility>("two-way");
  const [horizon, setHorizon] = useState<PlanHorizon>("90d");
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (busy) return;
    setBusy(true);
    const decision = makeDecision({
      pathId: path.id,
      choiceLabel: path.choiceLabel,
      rationale,
      expectation,
      confidence,
      reversibility,
      horizon,
    });
    const { result, ai } = await fetchPlan(tree, path, { rationale, expectation, horizon });
    commitDecision(setPlan(decision, result.steps, result.experiments, ai));
    setBusy(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-lg rounded-t-3xl border border-[var(--line)] bg-[var(--bg-1)] p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">{t("把这条路变成计划")}</h3>
        <p className="mt-1 text-sm text-[var(--fg-dim)]">{path.choiceLabel}</p>

        <label className="mt-4 block text-xs uppercase tracking-wider text-[var(--fg-faint)]">
          {t("为什么选它")}
        </label>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none px-4 py-3 text-base"
        />

        <label className="mt-3 block text-xs uppercase tracking-wider text-[var(--fg-faint)]">
          {t("你预期会发生什么")}
        </label>
        <textarea
          value={expectation}
          onChange={(e) => setExpectation(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none px-4 py-3 text-base"
        />

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
              {t("信心几成")}
            </span>
            <span className="text-sm font-semibold text-[var(--accent)]">{confidence}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </div>

        <div className="mt-4">
          <span className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
            {t("这个决定可逆吗？")}
          </span>
          <div className="mt-2 flex gap-2">
            <Button
              variant={reversibility === "one-way" ? "primary" : "subtle"}
              onClick={() => setReversibility("one-way")}
            >
              {t("单行道")}
            </Button>
            <Button
              variant={reversibility === "two-way" ? "primary" : "subtle"}
              onClick={() => setReversibility("two-way")}
            >
              {t("可回头")}
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <span className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
            {t("多久后回看")}
          </span>
          <div className="mt-2 flex gap-2">
            <Button
              variant={horizon === "30d" ? "primary" : "subtle"}
              onClick={() => setHorizon("30d")}
            >
              {t("30 天")}
            </Button>
            <Button
              variant={horizon === "90d" ? "primary" : "subtle"}
              onClick={() => setHorizon("90d")}
            >
              {t("90 天")}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {t("取消")}
          </Button>
          <Button variant="primary" disabled={busy} onClick={generate}>
            {busy ? t("正在为你制定计划…") : t("生成计划 →")}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (`Button` supports `variant="subtle"` — confirm in `src/components/ui/Button.tsx`; it is already used by Onboarding's 有/没有 buttons.)

- [ ] **Step 3: Commit**

```bash
git add src/components/DecisionSheet.tsx
git commit -m "feat(decisions): DecisionSheet — 选定 form + AI 落地 into a plan"
```

---

### Task 10: PathDetail integration (entry + show decision/plan)

**Files:**
- Modify: `src/components/PathDetail.tsx`

- [ ] **Step 1: Add imports + state**

At the top imports add:

```ts
import { DecisionSheet } from "./DecisionSheet";
import { activeDecisionFor, togglePlanItem } from "@/domain/decisions";
```

Inside the component, after `const [chatting, setChatting] = useState(false);` add:

```ts
  const [deciding, setDeciding] = useState(false);
  const { updateDecision } = useApp(); // merge into the existing useApp() destructure instead of a 2nd call
```

(Practically: extend the existing `const { addScenario, addBranch, openPath } = useApp();` to `const { addScenario, addBranch, openPath, updateDecision } = useApp();`.)

After `const path = tree.paths.find(...)` guard, compute:

```ts
  const decision = activeDecisionFor(tree, path.id);
```

- [ ] **Step 2: Render the decision/plan block + entry button**

Immediately after the header `</div>` that contains the "✨ 和 X 岁的你聊聊" button block, insert:

```tsx
      {/* 选定 → 落地：把这条路变成计划 */}
      {path.kind === "choice" && (
        <div className="mt-6">
          {decision ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
                  {t("你的决定")}
                </span>
                <span className="text-xs text-[var(--fg-faint)]">
                  {t("距复盘还有 {n} 天", {
                    n: Math.max(
                      0,
                      Math.ceil(
                        (new Date(decision.reviewDate).getTime() - Date.now()) / 86400000,
                      ),
                    ),
                  })}
                </span>
              </div>
              {!decision.plan.generatedByAI && (
                <p className="mt-2 text-xs text-[var(--fg-faint)]">
                  {t("（没接上 AI，先用本地模板生成的计划）")}
                </p>
              )}
              <div className="mt-3 text-xs font-semibold text-[var(--fg-dim)]">{t("近期行动")}</div>
              <ul className="mt-1 space-y-1">
                {decision.plan.steps.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => updateDecision(togglePlanItem(decision, s.id))}
                      className="flex w-full items-start gap-2 text-left text-sm"
                    >
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                          s.done
                            ? "border-[var(--c-emerald)] text-[var(--c-emerald)]"
                            : "border-[var(--line)] text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className={s.done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}>
                        {s.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-xs font-semibold text-[var(--fg-dim)]">{t("低成本试错")}</div>
              <ul className="mt-1 space-y-1">
                {decision.plan.experiments.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => updateDecision(togglePlanItem(decision, s.id))}
                      className="flex w-full items-start gap-2 text-left text-sm"
                    >
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                          s.done
                            ? "border-[var(--c-emerald)] text-[var(--c-emerald)]"
                            : "border-[var(--line)] text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className={s.done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}>
                        {s.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Button variant="primary" onClick={() => setDeciding(true)}>
              {t("把这条路变成计划")}
            </Button>
          )}
        </div>
      )}
```

- [ ] **Step 3: Mount the sheet near the `FutureSelfChat` mount at the bottom**

```tsx
      {deciding && (
        <DecisionSheet tree={tree} path={path} onClose={() => setDeciding(false)} />
      )}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run -s build`
Expected: clean; `/api/plan` and `/api/review` appear in the route list.

- [ ] **Step 5: Commit**

```bash
git add src/components/PathDetail.tsx
git commit -m "feat(decisions): PathDetail entry + decision/plan checklist"
```

---

### Task 11: `ReviewSheet` component (复盘)

**Files:**
- Create: `src/components/ReviewSheet.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import type { Decision, ReviewOutcome } from "@/domain/types";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { recordReview, calibrationNote } from "@/domain/decisions";
import { fetchReviewLesson } from "@/lib/planClient";
import { Button } from "./ui/Button";

export function ReviewSheet({
  decision,
  onClose,
  onReplan,
}: {
  decision: Decision;
  onClose: () => void;
  onReplan?: (label: string) => void; // 用真实情况再推演一条（复用 addBranch）
}) {
  const { t } = useT();
  const { updateDecision } = useApp();
  const [whatHappened, setWhatHappened] = useState("");
  const [outcome, setOutcome] = useState<ReviewOutcome>(3);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function finish() {
    if (busy || !whatHappened.trim()) return;
    setBusy(true);
    const lesson =
      (await fetchReviewLesson(decision, { whatHappened, outcome })) ??
      calibrationNote(decision.confidence, outcome);
    updateDecision(
      recordReview(decision, {
        reviewedAt: new Date().toISOString(),
        whatHappened: whatHappened.trim(),
        outcome,
        lesson,
      }),
    );
    setBusy(false);
    setDone(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-lg rounded-t-3xl border border-[var(--line)] bg-[var(--bg-1)] p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">{t("复盘：{label}", { label: decision.choiceLabel })}</h3>
        <p className="mt-1 text-sm text-[var(--fg-dim)]">
          {t("当时你预期：{exp}", { exp: decision.expectation || "—" })} ·{" "}
          {t("当时信心 {n}%", { n: decision.confidence })}
        </p>

        {!done ? (
          <>
            <label className="mt-4 block text-xs uppercase tracking-wider text-[var(--fg-faint)]">
              {t("实际发生了什么？")}
            </label>
            <textarea
              value={whatHappened}
              onChange={(e) => setWhatHappened(e.target.value)}
              rows={3}
              autoFocus
              className="mt-1 w-full resize-none px-4 py-3 text-base"
            />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-[var(--fg-faint)]">{t("比预期差很多")}</span>
              <span className="text-xs text-[var(--fg-faint)]">{t("比预期好很多")}</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={outcome}
              onChange={(e) => setOutcome(Number(e.target.value) as ReviewOutcome)}
              className="mt-1 w-full"
            />

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={onClose}>
                {t("取消")}
              </Button>
              <Button variant="primary" disabled={busy || !whatHappened.trim()} onClick={finish}>
                {t("完成复盘")}
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-4 text-sm text-[var(--fg)]">
              {decision.review?.lesson /* updated copy lives in store; show local lesson */ ||
                calibrationNote(decision.confidence, outcome)}
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              {onReplan && (
                <Button
                  variant="subtle"
                  onClick={() => {
                    onReplan(decision.choiceLabel);
                    onClose();
                  }}
                >
                  {t("用真实情况再推演一条")}
                </Button>
              )}
              <Button variant="primary" onClick={onClose}>
                {t("完成")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

Note: after `finish()` the `decision` prop is stale (store updated by id), so the success panel falls back to `calibrationNote(...)` which equals the stored lesson when AI is off; when AI is on, the lesson is already persisted and visible on the path. This is acceptable for the first slice. (`t("完成")` key: add `完成: "Done"` to messages.ts in Task 8 — included there.)

- [ ] **Step 2: Add the missing `完成` key**

Confirm `完成: "Done"` exists in `messages.ts`; if not, add it. (Add now if Task 8 omitted it.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/ReviewSheet.tsx src/i18n/messages.ts
git commit -m "feat(decisions): ReviewSheet — 复盘 form + AI/local calibration"
```

---

### Task 12: TreeScreen due-review nudge

**Files:**
- Modify: `src/components/TreeScreen.tsx`

- [ ] **Step 1: Add imports + state + due computation**

Add imports:

```ts
import { dueDecisions } from "@/domain/decisions";
import { ReviewSheet } from "./ReviewSheet";
import type { Decision } from "@/domain/types";
```

In the component, add:

```ts
  const [reviewing, setReviewing] = useState<Decision | null>(null);
  const due = tree ? dueDecisions(tree, new Date().toISOString()) : [];
```

(Place after the existing `useState` lines; `tree` is already in scope.)

- [ ] **Step 2: Render the nudge under the header description**

Right after the `{aiEnabled ? (...) : null}` block in the header, add:

```tsx
          {due.length > 0 && (
            <button
              onClick={() => setReviewing(due[0])}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--c-amber)]/50 bg-[var(--c-amber)]/10 px-3 py-1 text-xs text-[var(--c-amber)] transition hover:bg-[var(--c-amber)]/20"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--c-amber)]" />
              {t("有 {n} 个决定该复盘了", { n: due.length })} · {t("去复盘")}
            </button>
          )}
```

- [ ] **Step 3: Mount the ReviewSheet near the AddBranchSheet mounts**

```tsx
      {reviewing && (
        <ReviewSheet
          decision={reviewing}
          onClose={() => setReviewing(null)}
          onReplan={(label) => addBranch(label)}
        />
      )}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run -s build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/TreeScreen.tsx
git commit -m "feat(decisions): TreeScreen due-review nudge -> ReviewSheet"
```

---

### Task 13: Decision-framework presets in future-self chat (追问)

**Files:**
- Modify: `src/lib/chatClient.ts`
- Modify: `src/components/FutureSelfChat.tsx`

- [ ] **Step 1: Add framework presets to `chatClient.ts`**

After `QUICK_PROMPTS`, add:

```ts
// 决策框架预设：点一下即把这个"想清楚"的问题抛给未来的自己。
export const FRAMEWORK_PROMPTS: string[] = [
  "后悔最小化：80 岁回头看，哪个更不后悔？",
  "预演失败：三年后它失败了，最可能因为什么？",
  "可逆性：这是单行道还是可回头？",
];
```

- [ ] **Step 2: Render them in `FutureSelfChat.tsx`**

Add `FRAMEWORK_PROMPTS` to the import from `@/lib/chatClient`. In the quick-prompts block (the `{messages.length === 0 && (...)}` area), under the existing `QUICK_PROMPTS` row, add a labeled framework row:

```tsx
        {messages.length === 0 && (
          <div className="px-5 pb-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--fg-faint)]">
              {t("想清楚这个决定")}
            </div>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={thinking}
                  className="rounded-full border border-[var(--c-fuchsia)]/40 bg-[var(--c-fuchsia)]/5 px-3 py-1.5 text-xs text-[var(--c-fuchsia)] transition hover:bg-[var(--c-fuchsia)]/10 disabled:opacity-40"
                >
                  {t(q)}
                </button>
              ))}
            </div>
          </div>
        )}
```

Place this BELOW the existing `QUICK_PROMPTS` block (do not remove the existing one). Both render only when `messages.length === 0`.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run -s build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/chatClient.ts src/components/FutureSelfChat.tsx
git commit -m "feat(decisions): decision-framework presets in future-self chat"
```

---

### Task 14: Full verification + live smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `npm run -s test`
Expected: all green (existing 64 + new decisions/planClient/tree tests).

- [ ] **Step 2: Typecheck + production build**

Run: `npx tsc --noEmit && npm run -s build`
Expected: clean; routes include `/api/plan` and `/api/review`.

- [ ] **Step 3: Live smoke (dev)**

```bash
# clear stale prod cache so dev serves correctly, then start
# (PowerShell) Remove-Item .next -Recurse -Force; npm run dev
```
Manually: open a tree → open a path → 把这条路变成计划 → fill + 生成计划 → confirm steps/experiments render and persist on reload → toggle a step → in future-self chat see the three framework chips → (to test the nudge without waiting) temporarily set a decision's `reviewDate` in the past via devtools localStorage, reload, confirm the 复盘 nudge → 去复盘 → 完成复盘 → lesson shows.

- [ ] **Step 4: Final commit (if any smoke fixes)**

```bash
git add -A && git commit -m "fix(decisions): smoke-test fixes"
```

---

## Self-Review

**Spec coverage:** 看见 (existing) · 追问 frameworks → Task 13 · 选定 → Tasks 1,2,9,10 · 落地 → Tasks 4,6,9 · 复盘 → Tasks 5,6,11,12 · data model → Task 1 · pure fns → Task 2 · migration (no reset) → Task 3 · AI routes + fallback → Tasks 4,5,6 · i18n → Task 8 (+ used in 9–13) · determinism (injected now/today, hashSeed) → Task 2 · tests → Tasks 2,3,6 · loop-back (再推演) → Task 11/12 `onReplan`. All spec sections map to a task.

**Placeholder scan:** No "TBD"/"add error handling"/"similar to". Every code step shows full code; routes/components are complete.

**Type consistency:** `Decision`/`Plan`/`PlanStep`/`Experiment`/`Review`/`ReviewOutcome`/`Reversibility`/`PlanHorizon` defined in Task 1 and used identically in 2,6,9,11. `makeDecision`/`commitDecision`/`updateDecision` defined in Task 7 and consumed in 9,10,11. `fetchPlan`/`fetchReviewLesson`/`sanitizePlan`/`localPlanTemplate` defined in Task 6 and consumed in 9,11. `togglePlanItem`/`activeDecisionFor`/`dueDecisions`/`recordReview`/`setPlan`/`createDecision` defined in Task 2 and consumed in 9,10,11,12. `patchTree` added in Task 7 and used by commit/update. Consistent.
</content>
