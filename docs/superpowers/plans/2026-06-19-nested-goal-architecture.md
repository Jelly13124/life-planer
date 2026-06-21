# Nested Goal Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Phase 1 is detailed below; Phases 2–6 are scoped task lists to be expanded just-in-time (each implementer reads current files + the spec docs/superpowers/specs/2026-06-19-nested-goal-architecture-design.md + the Phase-1 adapter API). Steps use `- [ ]`.

**Goal:** Rewrite goals into a true nested model — Goal(time range) ⊃ Subgoal ⊃ { Metric, Task, Habit } — losslessly migrating existing data (preserve action ids → history/streak/schedule stay aligned) and rewiring every consumer via flat adapters.

**Architecture:** New types in types.ts; `migrateGoals` (legacy flat → nested) invoked from `normalizeLoadedTree`; `goalTree.ts` adapters (`allTasks/allHabits/findItem/updateTask/...`) so read-heavy domain fns change minimally; consumers + UI rewired phase by phase. Determinism preserved (no Date.now/Math.random in domain; time injected). Dark theme; bilingual.

**Tech Stack:** Next.js 16 / React 19 / TS / Tailwind v4 / Vitest 4.

**Hard rule for this rewrite:** preserve `id`s during migration (old `GoalAction.id` → `Task.id`/`Habit.id`) so `activity` (keyed by id), scheduling, streaks, heatmap all keep working with no history recompute.

---

## Phase 1 — New types + lossless migration + adapters (foundation)

**Files:** Modify `src/domain/types.ts`; Create `src/domain/migrateGoals.ts`, `src/domain/goalTree.ts`; Modify `src/domain/repository/normalize.ts`, `src/domain/tree.ts`; Tests: `src/domain/__tests__/migrateGoals.test.ts`, `src/domain/__tests__/goalTree.test.ts`.

- [ ] **1.1 New types (types.ts)** — Replace `Goal`/`GoalAction`/`GoalHorizon`/`GoalInput` with the new model, but KEEP the old shapes as `LegacyGoal`/`LegacyGoalAction` (used only by migration). New:
```ts
export type LifeArea = "career" | "wealth" | "relationships" | "health" | "growth";
export interface Metric { id: string; label: string; current: number; target: number; unit: string }
export interface Task { id: string; text: string; done: boolean; scheduledDate?: string; startTime?: string; durationMin?: number }
export interface Habit { id: string; text: string; repeat: "daily" | "weekly"; repeatWeekday?: number; startTime?: string; durationMin?: number }
export interface Subgoal { id: string; title: string; metrics: Metric[]; tasks: Task[]; habits: Habit[] }
export interface Goal {
  id: string; area: LifeArea; title: string; why: string; status: "active" | "done";
  createdAt: string; startDate?: string; endDate?: string; pathId?: string | null; tags?: string[];
  metrics: Metric[]; subgoals: Subgoal[]; tasks: Task[]; habits: Habit[];
  completedAt?: string; lastReviewedAt?: string;
}
// Legacy (migration input only)
export interface LegacyGoalAction { id: string; text: string; done: boolean; repeat?: "daily" | "weekly"; repeatWeekday?: number; scheduledDate?: string; startTime?: string; durationMin?: number }
export interface LegacyGoal { id: string; area: LifeArea; horizon: "long" | "short"; title: string; why: string; status: "active" | "done"; createdAt: string; parentGoalId: string | null; pathId: string | null; actions: LegacyGoalAction[]; deadline?: string; tags?: string[]; completedAt?: string; lastReviewedAt?: string }
```
`LifeTree.goals: Goal[]` (unchanged field name). `activity`/`inbox`/`paths`/`decisions`/`dayStart`/`dayEnd` unchanged.

- [ ] **1.2 migrateGoals.ts (pure)** — `migrateGoals(legacy: LegacyGoal[]): Goal[]`:
  - Split each legacy goal's `actions` into `tasks` (no `repeat`) and `habits` (has `repeat`), PRESERVING ids; map fields (Task: text/done/scheduledDate/startTime/durationMin; Habit: text/repeat/repeatWeekday/startTime/durationMin).
  - Top-level goals = legacy goals with `horizon === "long"` OR `parentGoalId == null`. Each → new Goal: area/title/why/status/createdAt/pathId/tags/completedAt/lastReviewedAt copied; `endDate = deadline`; `metrics: []`; `tasks`/`habits` from its actions; `subgoals` = for each legacy goal whose `parentGoalId === this.id` → `Subgoal { id, title, metrics: [], tasks, habits }`.
  - Orphan short goals (parentGoalId set but parent missing) → treat as top-level Goal.
  - Helper `migrateActions(actions): { tasks: Task[]; habits: Habit[] }`.
- [ ] **1.3 migrateGoals test** — long+short+actions → nested; ids preserved (task/habit ids == old action ids); deadline→endDate; repeat action → habit, non-repeat → task; orphan short → top-level; tags/pathId/status/completedAt carried.

- [ ] **1.4 goalTree.ts (pure adapters)** — read + write by id over the nested structure:
```ts
// reads
allTasks(tree): { goal: Goal; subgoal: Subgoal | null; task: Task }[]
allHabits(tree): { goal: Goal; subgoal: Subgoal | null; habit: Habit }[]
findTask(tree, id) / findHabit(tree, id) / findItem(tree, id): {goal, subgoal|null, kind:"task"|"habit", item} | null
allMetrics(tree): { owner: Goal | Subgoal; metric: Metric }[]
// writes (return new tree; locate by id across goal-level + subgoal-level)
updateTask(tree, id, patch: Partial<Task>) / updateHabit(tree, id, patch: Partial<Habit>)
removeItem(tree, id)   // task or habit, anywhere; ALSO leaves activity cleanup to caller or do it here
addTask(tree, goalId, subgoalId: string | null, text, now): { tree, id }
addHabit(tree, goalId, subgoalId: string | null, text, repeat, weekday, now): { tree, id }
addSubgoal(tree, goalId, title, now): { tree, id }
setMetric(tree, ownerId, metric) / removeMetric(tree, ownerId, metricId) / bumpMetric(tree, metricId, delta)
addGoal(tree, input, now): { tree, id }   // input: { area, title, why, startDate?, endDate?, pathId? }
updateGoalById / removeGoalById (cascade subgoals/tasks/habits; prune activity ids; prune pathId branch via removePath if pathId)
```
  - All pure; ids via `hashSeed`. Determinism: `now` injected.
- [ ] **1.5 goalTree test** — add goal/subgoal/task/habit, find by id (goal-level + subgoal-level), update, removeItem prunes everywhere, metric set/bump, removeGoalById cascades.

- [ ] **1.6 normalize.ts migration hook** — in `normalizeLoadedTree`, after existing backfills, detect legacy goals: `if (Array.isArray(parsed.goals) && parsed.goals.some(g => "actions" in g || !("subgoals" in g))) parsed.goals = migrateGoals(parsed.goals as LegacyGoal[]);` Also backfill each new Goal's array fields if missing (metrics/subgoals/tasks/habits ??= []). createTree: `goals: []` unchanged.
- [ ] **1.7 Verify Phase 1**: `npx vitest run` for the new tests green; `npx tsc --noEmit` WILL fail in consumers (expected — they still use old Goal/actions). That's OK for Phase 1 — but to keep the repo building, EITHER (a) do Phase 1+2 before declaring build-green, or (b) temporarily keep old `Goal`/`GoalAction` exported as aliases so consumers compile until Phase 2. CHOSEN: keep a transitional `goals.ts` shim re-exporting nothing new yet — accept that full `tsc`/`build` go green only at end of Phase 2. Commit Phase 1 as "wip(model): nested types + migration + adapters (consumers rewired next)". Document in progress.md that tsc is red between 1 and 2.

> NOTE: Because a half-rewrite leaves tsc red, Phases 1 and 2 may be committed as WIP and the branch only returns to green at the end of Phase 2. This is the accepted cost of "from-scratch rewrite". Each commit still isolates a coherent chunk.

---

## Phase 2 — Rewire domain consumers (return to green)

Rewrite to use goalTree adapters; update their tests. Scope per file:
- `daily.ts`: completeAction/uncompleteAction/isActionDoneToday/recurringDueToday/todayItems/findAction/removeActionEverywhere → operate over tasks+habits via adapters (Task.done for one-shot; Habit completion via activity). `todayItems` returns tasks (manual) ∪ due habits.
- `calendar.ts`: actionsOnDay (tasks with scheduledDate that day + habits due that day) / unscheduledActions (tasks: !done && !scheduledDate) / setActionScheduledDate → updateTask.
- `schedule.ts`: setActionTime → updateTask/updateHabit; arrangeDay items unchanged (id+durationMin).
- `goals.ts`: goalProgress (metrics + tasks + subgoals composite); completeGoal area bump; dueGoalReviews; tags (addGoalTag/removeGoalTag/allTags) → operate on Goal.
- `habits.ts`: recurringActions → allHabits; habitStreak unchanged (by id + activity).
- `areas.ts`: areaSummaries (goals per area; habitCount via allHabits).
- `insights.ts`, `weekly.ts`, `guide.ts`, `inbox.ts` (promote → addGoal), `tree.ts` (createTree).
- Update all affected domain tests. Acceptance: `npx tsc --noEmit` + `npx vitest run` green again; `npx next build` may still fail on components → Phase 3-5.

## Phase 3 — AppContext rewrite
All goal/subgoal/task/habit/metric/schedule methods over adapters: addGoal/updateGoal/removeGoalById, addSubgoal, addTask/addHabit (goal- or subgoal-level), toggle/complete, setActionTime, scheduleAction, setMetric/bumpMetric, set time range, tags, inbox promote. Keep predict integration (long goal → branch via addPath + pathId). tsc green.

## Phase 4 — PlanScreen nested UI
领域 → 目标(进度+时间范围+指标) → 子目标 → {指标/任务/习惯}; add/edit/delete at each level; metric editor; goal date-range. Reuse ui components.

## Phase 5 — Adapt remaining components
CalendarPlannerScreen, DayView, MonthCalendar, HabitsSection, AreasSection, InsightsSection, WeeklyReviewSheet, InboxSection, GettingStarted, LifeMap markers → consume new adapters/shape. `next build` green.

## Phase 6 — i18n + full verification + smoke
EN for all new strings; `npx tsc --noEmit` + `npx vitest run` + `npx next build` green; manual smoke: old localStorage upgrades losslessly (history/streak/schedule intact); nested add/edit/delete; metrics drive progress; calendar/today/habits/insights/weekly all work.

---

## Self-Review
- Spec coverage: types(1.1), migration(1.2), adapters(1.4), consumers(2), state(3), nested UI(4), components(5), i18n+verify(6), metric progress(2 goals.ts), time range(1.1+3+4), id preservation(1.2). Covered.
- Risk: tsc/build red between Phase 1 and end of Phase 2 — explicitly accepted + documented; commit WIP per chunk.
- Type consistency: adapter names (allTasks/allHabits/findItem/updateTask/updateHabit/removeItem/addTask/addHabit/addSubgoal/addGoal/setMetric/bumpMetric/updateGoalById/removeGoalById) are the contract used by Phases 2–5.
