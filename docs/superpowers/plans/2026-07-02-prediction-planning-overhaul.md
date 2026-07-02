# Prediction + Planning Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Large migration → the "sweep" tasks are **compiler-driven**: the gate command (tsc/vitest/build) enumerates every remaining site; fix until green.

**Goal:** Merge `Habit` into `Task` (recurrence = optional attribute) across core+web+mobile, make possibility AI-baseline + progress-climb, drop fake local fallbacks (keep persistence + geometry), add in-place scenario toggle, predicting animation, AI task suggestions, and a goal→month(day)→week(time) schedule flow.

**Architecture:** Shared pure core (`packages/core`, vitest, deterministic) is the linchpin — do the model + idempotent migration + `daily.ts` first and get BOTH platforms green before anything else. Then additive AI/UX workstreams, mostly mobile.

**Tech Stack:** TypeScript, React 19 / Next 16 (web), Expo/React Native (mobile), `@lifeplanner/core`, vitest.

**Spec:** `docs/superpowers/specs/2026-07-02-prediction-planning-overhaul-design.md`

**Global gates:** web = `npx tsc --noEmit && npx vitest run && npx next build && rm -rf .next` (the `/green` skill). mobile = `cd mobile && npx tsc --noEmit`. Commit per task. Do NOT OTA/deploy — leave that for the user in the morning.

---

## WS1 — Task absorbs Habit (core + both platforms). MUST end fully green before WS3+.

### Task 1: Core model — `Task.repeat`, remove `Habit`/`habits`

**Files:** Modify `packages/core/src/types.ts`

- [ ] **Step 1: Change the model**

In `packages/core/src/types.ts`:
- Add to `interface Task` (after `durationMin?`):
```ts
  repeat?: "daily" | "weekly"; // 有值 = 重复任务（按天完成，走 activity）；无值 = 一次性
  repeatWeekday?: number;      // 仅 weekly：0=周日…6=周六
```
- DELETE `interface Habit { ... }` entirely.
- In `interface Goal`, DELETE the `habits: Habit[]` field.
- In `interface LifeTree`, DELETE the `habits: Habit[]` field.
- Remove any now-unused `Habit` import references within `types.ts`.

- [ ] **Step 2: Verify it breaks the build (expected)**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: MANY errors referencing `Habit` / `.habits` across core/web. That's the migration surface. Do not fix here — subsequent tasks handle each layer.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core)!: Task gains repeat/repeatWeekday; remove Habit type + goal/tree habits"
```

### Task 2: Core migration — `habits[]` → repeating `tasks[]` (TDD, idempotent, lossless)

**Files:** Modify `packages/core/src/repository/normalize.ts`; Test `packages/core/src/__tests__/normalize-habits.test.ts` (create)

- [ ] **Step 1: Write the failing test** — create `packages/core/src/__tests__/normalize-habits.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeLoadedTree } from "../repository/normalize";

// A pre-migration tree shape (loose typing — simulates persisted old data with habits[]).
function oldTree(): any {
  return {
    id: "t1",
    profile: { name: "x", age: 30, areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 } },
    horizonYears: 15,
    paths: [],
    goals: [
      { id: "g1", kind: "long", parentGoalId: null, area: "health", title: "健身", status: "active", createdAt: "2026-01-01T00:00:00.000Z", metrics: [], tasks: [{ id: "tk1", text: "买装备", done: false }], habits: [{ id: "h1", text: "每天跑步", repeat: "daily", startTime: "07:00", durationMin: 30 }] },
    ],
    tasks: [],
    habits: [{ id: "h2", text: "每周复盘", repeat: "weekly", repeatWeekday: 0 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("normalizeLoadedTree — habits→tasks migration", () => {
  it("folds goal.habits into goal.tasks as repeating tasks (id + fields preserved)", () => {
    const t = normalizeLoadedTree(oldTree())!;
    const g = t.goals[0] as any;
    expect(g.habits).toBeUndefined();
    const h1 = g.tasks.find((x: any) => x.id === "h1");
    expect(h1).toMatchObject({ id: "h1", text: "每天跑步", repeat: "daily", startTime: "07:00", durationMin: 30, done: false });
    expect(g.tasks.find((x: any) => x.id === "tk1")).toBeTruthy(); // original task kept
  });

  it("folds tree.habits into tree.tasks and drops the habits field", () => {
    const t = normalizeLoadedTree(oldTree())! as any;
    expect(t.habits).toBeUndefined();
    expect(t.tasks.find((x: any) => x.id === "h2")).toMatchObject({ id: "h2", repeat: "weekly", repeatWeekday: 0, done: false });
  });

  it("is idempotent — re-normalizing already-migrated data is a no-op on tasks", () => {
    const once = normalizeLoadedTree(oldTree())!;
    const twice = normalizeLoadedTree(once as any)!;
    expect(twice.goals[0].tasks.length).toBe(once.goals[0].tasks.length);
    expect((twice as any).habits).toBeUndefined();
    expect(twice.tasks.length).toBe(once.tasks.length);
  });
});
```

- [ ] **Step 2: Run → fails.** `npx vitest run packages/core/src/__tests__/normalize-habits.test.ts` (habits still present / field not dropped).

- [ ] **Step 3: Implement migration in `normalize.ts`.** Add a helper and call it inside `normalizeLoadedTree` (after the goal array-field backfill, before `return t`):

```ts
// 习惯并入任务：把 legacy habits[] 转成带 repeat 的 tasks[]（保 id/字段），删除 habits 字段。幂等。
function foldHabits(tasks: unknown, habits: unknown): Task[] {
  const base: Task[] = Array.isArray(tasks) ? (tasks as Task[]) : [];
  const hs: any[] = Array.isArray(habits) ? (habits as any[]) : [];
  const seen = new Set(base.map((t) => t.id));
  const converted: Task[] = hs
    .filter((h) => h && typeof h === "object" && !seen.has(h.id))
    .map((h) => ({
      id: String(h.id),
      text: String(h.text ?? ""),
      done: false,
      repeat: h.repeat === "weekly" ? "weekly" : "daily",
      ...(typeof h.repeatWeekday === "number" ? { repeatWeekday: h.repeatWeekday } : {}),
      ...(h.startTime ? { startTime: String(h.startTime) } : {}),
      ...(typeof h.durationMin === "number" ? { durationMin: h.durationMin } : {}),
    }));
  return [...base, ...converted];
}
```
Then in the body: fold tree-level, and per-goal, and delete the `habits` fields. Where the code currently maps `t.goals = t.goals.map((g) => ({ ...g, metrics: ..., tasks: ..., habits: ... }))`, change it to fold habits into tasks and NOT re-emit `habits`:
```ts
  const anyT = t as any;
  anyT.tasks = foldHabits(anyT.tasks, anyT.habits);
  delete anyT.habits;
  t.goals = t.goals.map((g): Goal => {
    const ag = g as any;
    const tasks = foldHabits(ag.tasks, ag.habits);
    const { habits: _drop, ...rest } = ag;
    return { ...rest, metrics: Array.isArray(g.metrics) ? g.metrics : [], tasks, kind: g.kind ?? "long", parentGoalId: g.parentGoalId ?? null };
  });
```
(Adjust to preserve the existing `kind`/`parentGoalId` backfill already there; the key changes are `foldHabits` + `delete habits`.)

- [ ] **Step 4: Run → passes.** `npx vitest run packages/core/src/__tests__/normalize-habits.test.ts` (3 pass).

- [ ] **Step 5: Commit.** `git add packages/core/src/repository/normalize.ts packages/core/src/__tests__/normalize-habits.test.ts && git commit -m "feat(core): migrate habits[] into repeating tasks[] (idempotent, lossless)"`

### Task 3: Core `daily.ts` — streak/heatmap/todayItems read repeating tasks

**Files:** Modify `packages/core/src/daily.ts`; update `packages/core/src/__tests__/daily.test.ts`

- [ ] **Step 1:** Read `daily.ts` + `daily.test.ts`. Every place that reads `goal.habits` / `tree.habits` (or a `Habit`) must instead read repeating tasks: `tasksOf(goal).filter(t => t.repeat)` and `tree.tasks.filter(t => t.repeat)`. `todayItems` must include: one-off tasks with `scheduledDate === today` (unchanged) PLUS repeating tasks due today (daily always; weekly when `repeatWeekday === weekdayOf(today)`) — same rule the old habit logic used. `currentStreak`/`heatmap` completion still comes from `activity`/`ActivityDay` (unchanged), just the "which items are habits" source changes to repeating tasks.

- [ ] **Step 2:** Update `daily.test.ts` fixtures that used `habits:[...]` to use `tasks:[{...,repeat}]`. Run `npx vitest run packages/core/src/__tests__/daily.test.ts` → fails (compile/logic).

- [ ] **Step 3:** Implement the reads-from-repeating-tasks change in `daily.ts`. Keep function signatures identical.

- [ ] **Step 4:** `npx vitest run packages/core/src/__tests__/daily.test.ts` → pass.

- [ ] **Step 5:** Commit. `git add packages/core/src/daily.ts packages/core/src/__tests__/daily.test.ts && git commit -m "feat(core): daily streak/heatmap/todayItems derive from repeating tasks"`

### Task 4: Core consumer sweep — everything else green (compiler-driven)

**Files:** all remaining `packages/core/src/**` referencing `Habit`/`.habits` (from grep: `tree.ts`, `goals.ts`, `goalTree.ts`, `schedule.ts`, `calendar.ts`, `habits.ts`, `planShort.ts`, `quickParse.ts`, `areas.ts`, `migrateGoals.ts` + their `__tests__`).

- [ ] **Step 1:** `npx tsc --noEmit 2>&1 | grep -iE "habit|\.habits" | head -50` — enumerate remaining core references.
- [ ] **Step 2:** For each: apply the model rule — a "habit" is now a `Task` with `repeat`. Anywhere code created/read `habits`, use `tasks` (filter `t.repeat` when it specifically meant recurring). `habits.ts` (if it only managed habit CRUD): fold its functions into task CRUD or delete if superseded by `goalTree`/task ops; update its `__tests__` accordingly. `migrateGoals.ts` `MigratableGoal` may still reference `habits` for OLD input shapes — that's fine as INPUT typing, but its OUTPUT must not emit `habits` (route into tasks). `quickParse.ts` (parses "跑步 每天" → repeat) should now emit a Task with `repeat`, not a Habit.
- [ ] **Step 3:** Gate: `npx tsc --noEmit && npx vitest run 2>&1 | grep -E "Test Files|Tests "` → tsc clean, all vitest pass.
- [ ] **Step 4:** Commit. `git add packages/core && git commit -m "refactor(core): sweep remaining Habit references into repeating tasks"`

### Task 5: Web consumer sweep — `/green` (compiler-driven)

**Files:** web files from grep: `state/AppContext.tsx`, `components/{TodayView,DayView,AppShell,PlanScreen,UpcomingTimeline,HabitsSection,AreasSection}.tsx`, `app/page.tsx`, `app/api/{decompose-goal,plan-short-goal}/route.ts`, `lib/{planShortClient,goalClient,decompose}.ts`, `i18n/messages.ts` (+ their tests).

- [ ] **Step 1:** `npx tsc --noEmit 2>&1 | grep -iE "habit|\.habits" | head -80` — enumerate web references.
- [ ] **Step 2:** Apply the rule. Key UI decisions (keep minimal, do NOT restructure layouts):
  - `HabitsSection.tsx` → becomes a **"重复任务"** view: same layout, data source = repeating tasks (`t.repeat`) instead of habits; creating one = create a Task with `repeat`. Update its nav label/string via `t(...)` (add English entry in `messages.ts`, do not rewrite the dict). AppShell nav item stays but points to repeating-tasks.
  - `TodayView`/`DayView`/`UpcomingTimeline`: render repeating tasks where they rendered habits; completion still per-day via existing toggle.
  - `AppContext.tsx`: any `addHabit`/`habits` reducer/action → task-with-repeat; keep action names stable if possible or rename consistently (`addHabit`→`addRepeatingTask`) and update all call sites.
  - API routes/lib (`decompose-goal`, `plan-short-goal`, `decompose`, `goalClient`, `planShortClient`): if they returned/handled `habits`, return tasks-with-repeat.
- [ ] **Step 3:** Gate: run `/green` (`npx tsc --noEmit && npx vitest run && npx next build && rm -rf .next`). All must pass.
- [ ] **Step 4:** Commit. `git add -A && git commit -m "refactor(web): Habit→repeating Task across UI/state/api; HabitsSection = 重复任务 view"`

### Task 6: Mobile consumer sweep — `mobile tsc` (compiler-driven)

**Files:** `mobile/src/state/store.tsx`, `mobile/src/screens/{ScheduleScreen,GoalsScreen}.tsx`.

- [ ] **Step 1:** `cd mobile && npx tsc --noEmit 2>&1 | grep -iE "habit|\.habits" | head -40`.
- [ ] **Step 2:** Apply the rule:
  - store: `addHabitToGoal(goalId, text, repeat)` → `addTaskToGoal(goalId, text, { repeat, repeatWeekday? })` (or add optional `repeat` to the existing task-add); drop any `habits` derivations; repeating tasks flow through the same task paths. Keep `DayAction`/schedule logic working (it already treats habit vs scheduled via `kind`; now derive "repeating" from `task.repeat`).
  - `ScheduleScreen.tsx`: remove the daily/weekly split; one unified "任务" list; a repeating task shows a small "每天/每周" tag (not a separate section). The timeline `isHabit` check → `!!a.item.repeat`.
  - `GoalsScreen.tsx`: creating a task can optionally mark repeat; no separate "习惯" creation.
- [ ] **Step 3:** Gate: `cd mobile && npx tsc --noEmit` → clean.
- [ ] **Step 4:** Commit. `git add mobile && git commit -m "refactor(mobile): unify tasks — repeat is an attribute, no daily/weekly split"`

### Task 7 (WS1 gate): Full both-platform green checkpoint

- [ ] Run web `/green` AND `cd mobile && npx tsc --noEmit`. Both must be fully green. If not, fix before proceeding. Commit any fixups. **Do not start WS3 until this passes.**

---

## WS3 — AI baseline possibility + progress climb

### Task 8: `enriched` flag + odds only when AI-confirmed

**Files:** core `types.ts` (LifePath), core `feasibility.ts`/`scenarioOdds.ts` (no formula change), web `PathDetail.tsx` + mobile `app/path/[pathId].tsx`, enrich apply paths (`src/lib/enrichClient.ts` web, `mobile/src/lib/api.ts` `applyEnrichToPath`).

- [ ] **Step 1:** Add `LifePath.enriched?: boolean` (set true when an AI enrich result is applied; both `applyEnrichToPath` paths set it). TDD a tiny core test asserting a freshly locally-generated choice path has `enriched` falsy and applying an enrich result sets it true (if apply logic is in core; if in client, verify via tsc + manual).
- [ ] **Step 2:** Both detail screens: show the 3-scenario odds (`scenarioOdds(effectiveFeasibility)`) ONLY when `path.enriched`. When not enriched: show predicting (WS5) if enrich in-flight, else a "AI 暂时不可用 · 重试" affordance that re-triggers enrich. `effectiveFeasibility` still = AI baseline + progress bump (climb preserved).
- [ ] **Step 3:** Gate: `/green` + `mobile tsc`. Commit `feat: possibility shown only after AI confirms baseline; progress still climbs`.

---

## WS4 — In-place scenario toggle (mobile)

### Task 9: prefetch 3 scenarios + toggle without navigation

**Files:** `mobile/app/path/[pathId].tsx`, `mobile/src/state/store.tsx`, possibly core `tree.ts` scenario storage.

- [ ] **Step 1:** When a path is enriched, ensure all three scenario datasets (optimistic/likely/conservative curves+stories) are available on the path object (generate the two non-likely variants' display data at enrich time and store them keyed by scenario — reuse `addScenarioVariant` data but attach as `path.scenarios?: Record<Scenario, {summary, nodes, endValue}>` rather than sibling paths, OR keep sibling paths but resolve them without navigation).
- [ ] **Step 2:** `pickScenario` becomes local state (`const [scenario, setScenario] = useState(path.scenario)`); the curve/story/odds render from the selected scenario's data. REMOVE the `router.replace(/path/${v.id})` and the on-demand `addScenario` call from the toggle.
- [ ] **Step 3:** Gate: `mobile tsc`. Manual note: toggling is instant, no screen change. Commit `feat(mobile): in-place optimistic/neutral/conservative toggle (no navigation, no regen)`.

---

## WS2 — Remove fake local fallback + retry state; update rule

### Task 10: AI-only content with graceful retry

**Files:** `mobile/src/state/store.tsx` (`decomposePathIntoGoals`, `addChoiceBranch`, suggest), `mobile/app/path/[pathId].tsx`, `.claude/rules/ai-and-secrets.md`.

- [ ] **Step 1:** In `decomposePathIntoGoals`: when `!hasBackend()` or the AI call fails/returns empty → DO NOT call `localPathGoals`; instead set an error/retry flag the UI reads. Same for path enrich (keep the local CURVE from `layoutMap`/generator, but summary/nodes/feasibility come only from AI; on failure show retry, don't fabricate). Persisted paths stay untouched (offline-viewable).
- [ ] **Step 2:** UI: a "AI 暂时不可用，重试" affordance (button re-invokes the AI action). Add strings via `t(...)`/literal RN text.
- [ ] **Step 3:** Update `.claude/rules/ai-and-secrets.md`: replace the "every AI route MUST have an offline/local fallback" line with the new architecture — content-generating AI has NO fabricated fallback; on failure the client shows a retry state; already-persisted predictions remain readable offline; deterministic geometry/math (curves, scenarioOdds mapping, feasibility bump) stay local. Note this supersedes the prior rule per the 2026-07-02 overhaul.
- [ ] **Step 4:** Gate: `mobile tsc` + `/green` (rule doc only, but run to be safe). Commit `feat: drop fabricated local fallbacks; AI-only content + retry; keep persistence+geometry; update ai-and-secrets rule`.

---

## WS7 — Schedule flow: goal → month(day) → week(time) (mobile)

### Task 11: month assigns day, week assigns time

**Files:** `mobile/src/screens/ScheduleScreen.tsx` (the merged home with 周/月 toggle), `mobile/src/state/store.tsx`.

- [ ] **Step 1:** Month view: tapping an unscheduled task then a day (or a per-day "+ 排到这天") sets `scheduledDate` for that task (store already has scheduling; wire the month-cell tap to assign the selected unscheduled task). Week view: tapping a scheduled task opens `TimePickSheet` to set `startTime`/`durationMin` (already exists) — this is the "分配时段" step. Make the two zoom levels' roles explicit in copy ("月：排到哪天 · 周：排时段").
- [ ] **Step 2:** Goal screen (`GoalsScreen`) confirms created tasks land as unscheduled (appear in the home's unscheduled tray). Verify the loop: create in goal → appears unscheduled → month assigns day → week assigns time.
- [ ] **Step 3:** Gate: `mobile tsc`. Commit `feat(mobile): schedule flow — month assigns day, week assigns time slot`.

---

## WS6 — AI suggest tasks (mobile)

### Task 12: "AI 建议任务" on a goal

**Files:** `mobile/src/screens/GoalsScreen.tsx` (or goal detail), `mobile/src/state/store.tsx`, uses `fetchGoalActions` (`/api/goal-actions`, already in `mobile/src/lib/api.ts`).

- [ ] **Step 1:** Add a store action `suggestTasksForGoal(goalId): Promise<void>` → calls `fetchGoalActions({goalTitle, why, area, profileSummary})` → creates the returned tasks under the goal (`addTaskToGoal`). No fabricated fallback (WS2): failure → retry affordance.
- [ ] **Step 2:** Goal UI: a "AI 建议任务" button that calls it; show predicting state while running.
- [ ] **Step 3:** Gate: `mobile tsc`. Commit `feat(mobile): AI-suggested tasks under a goal`.

---

## WS5 — Predicting animation (mobile)

### Task 13: full-screen predicting overlay (mirror web)

**Files:** create `mobile/src/components/PredictingOverlay.tsx`; use it in `mobile/src/screens/TreeScreen.tsx` (and path enrich / suggest flows) in place of the "AI 推演中…" text + `SkeletonCard`.

- [ ] **Step 1:** Read web `src/components/PredictionOverlay.tsx` for the feel (progress + curve/labels). Build an RN equivalent (Animated) on the dark media panel aesthetic: a looping draw/pulse + "正在推演…" + the labels being predicted. Respect reduce-motion (like TreeScreen's `useReduceMotion`).
- [ ] **Step 2:** Show it while `enriching` (store already exposes `enriching`); also cover the decompose/suggest predicting states.
- [ ] **Step 3:** Gate: `mobile tsc`. Commit `feat(mobile): predicting animation overlay (mirrors web)`.

---

## Final

- [ ] Full both-platform green: web `/green` + `cd mobile && npx tsc --noEmit`. Dispatch a final code-review subagent over the whole diff (focus: migration completeness — no orphaned `habits`; completion semantics for repeating tasks; odds only when enriched; no fabricated fallbacks left).
- [ ] Update `task_plan.md` / `progress.md` (session log + phase rows). Push `feat/goal-planning-mainline` + ff `master`. **Do NOT `eas update` / deploy** — leave for user's morning confirmation (per spec).

## Self-Review

- **Spec coverage:** WS1(Task1-7), WS3(Task8), WS4(Task9), WS2(Task10), WS7(Task11), WS6(Task12), WS5(Task13), final wrap. All 7 workstreams + migration covered. Offline-persistence: Task10 Step1 ("persisted paths stay untouched"). Completion semantics: Task2/Task3. ✓
- **Placeholder scan:** linchpin (Task1-3) has complete code; sweeps (Task4-6) are explicitly compiler-driven with exact file lists + gate commands (correct for a large refactor); WS3-7 have precise specs + key snippets + gates. No lazy "handle edge cases".
- **Type consistency:** `Task.repeat`/`repeatWeekday` (Task1) used consistently in migration (Task2), daily (Task3), sweeps (Task4-6). `LifePath.enriched` (Task8) referenced by WS3/WS4 gating. `addTaskToGoal({repeat})` naming consistent across Task6/Task11/Task12.
