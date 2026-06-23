# 两级目标(长期/短期) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Pure domain is TDD'd; state/components verified via tsc+vitest+next build. Each implementer reads the spec `docs/superpowers/specs/2026-06-21-two-tier-goals-design.md` + current files + the Phase-1 adapter API. Steps use `- [ ]`.

**Goal:** Re-model goals into two tiers — long-term goals (grow a tree branch, identity-level) each containing several short-term goals (time-boxed, linked via parentGoalId, no branch) that hold tasks/habits/metrics. Losslessly migrate existing nested/legacy data (preserve ids). Then AI: decompose long→short, plan short within its time window; habits bounded to their goal's endDate.

**Architecture:** `Goal.kind: "long"|"short"` + `Goal.parentGoalId`; remove `Subgoal`/`Goal.subgoals` (subgoals migrate to short goals). `goals` stays a flat array; adapters in goalTree.ts traverse it. normalize handles 3 input shapes (legacy flat / nested / already two-tier), idempotent. Determinism preserved; Apple-white theme + line icons intact; bilingual.

**Tech Stack:** Next.js 16 / React 19 / TS / Tailwind v4 / Vitest 4 / DeepSeek.

---

## Phase 1 — types + 3-state migration + adapters (foundation, TDD)
**Files:** Modify `src/domain/types.ts`, `migrateGoals.ts`, `repository/normalize.ts`, `goalTree.ts`, `tree.ts`; Tests: `migrateGoals.test.ts`, `migration-integration.test.ts`, `goalTree.test.ts`.

- [ ] **1.1 types.ts** — add `export type GoalKind = "long" | "short";`. Add to `Goal`: `kind: GoalKind;` `parentGoalId?: string | null;`. REMOVE `Subgoal` interface + `Goal.subgoals`. (Keep `LegacyGoal`/`LegacyGoalAction` for legacy read; add a `NestedSubgoal` read-type if needed for the nested→two-tier migration, or read loosely.)
- [ ] **1.2 migrateGoals.ts** — produce TWO-TIER output. Accept loose input; per-goal:
  - legacy (`"actions" in g` or `"horizon" in g`): long (horizon==="long" or parentGoalId==null) → `kind:"long"`, parentGoalId:null; short → `kind:"short"`, keep parentGoalId (orphan short → long). actions split → tasks/habits (preserve ids). deadline→endDate.
  - nested (`"subgoals" in g`): the goal → long (drop subgoals, keep own metrics/tasks/habits/pathId/dates/id, kind:"long", parentGoalId:null); each subgoal S → short Goal `{id:S.id, kind:"short", parentGoalId:G.id, area:G.area, title:S.title, why:"", status:"active", createdAt:G.createdAt, startDate:G.startDate, endDate:G.endDate, metrics:S.metrics, tasks:S.tasks, habits:S.habits, pathId:null}`.
  - already two-tier (`"kind" in g`, no subgoals): pass through untouched.
  - SAFETY NET: every input goal id + subgoal id appears in output (as a goal id). Backfill `kind:"long"` if a goal somehow lacks it.
- [ ] **1.3 migrateGoals tests** — nested goal+subgoals → 1 long + N short (parentGoalId set, ids preserved, S.tasks/habits/metrics carried); legacy long/short/orphan; already-two-tier passthrough (idempotent); mixed.
- [ ] **1.4 normalize.ts** — detect & migrate: if any goal has `actions`/`horizon` OR `subgoals` OR lacks `kind` → `migrateGoals(goals)`. Backfill goal array fields (metrics/tasks/habits ??= []), `kind ??= "long"`, `parentGoalId ??= null`. choices/activity backfills unchanged. Keep `createTree` (tree.ts) goals:[] .
- [ ] **1.5 goalTree.ts** — rewrite for two tiers (no subgoal traversal):
  - reads: `allTasks(tree): {goal,task}[]`, `allHabits(tree): {goal,habit}[]`, `allMetrics(tree): {goal,metric}[]`, `findItem(tree,id)`, `findTask`, `findHabit`, `longGoals(tree)`, `shortGoalsOf(tree,longId)`, `goalById(tree,id)`.
  - writes: `addLongGoal(tree,input,now):{tree,id}`, `addShortGoal(tree,parentLongId,input,now):{tree,id}` (kind:"short", parentGoalId set), `updateGoalById`, `removeGoalById` (long → also remove its short children + prune all their activity ids + removePath if pathId; short → remove + prune activity), `addTask(tree,goalId,text,now)`, `addHabit(tree,goalId,text,repeat,weekday,now)`, `removeItem(tree,id)` (prunes activity), `setMetric(tree,goalId,metric)`, `removeMetric`, `bumpMetric`. (DROP addSubgoal/removeSubgoal; the old `addTask(goalId,subgoalId,...)` loses the subgoalId param.)
- [ ] **1.6 goalTree tests** — addLong/addShort(parent link), childGoals, find, update, removeGoalById long-cascades-shorts + prunes activity, removeItem, metric set/bump.
- [ ] **1.7 migration-integration.test.ts** — extend: a NESTED legacy tree (goal+subgoal+activity referencing their ids) through `normalizeLoadedTree` → two-tier; subgoal became a short goal (parentGoalId), ids preserved, activity intact, calendar.actionsOnDay still finds the scheduled task, habitStreak still computes. Idempotent on re-run. "every input id reachable" invariant.
- [ ] **1.8 Verify** — `npx vitest run` new/updated domain tests green; `npx tsc --noEmit` red only in consumers (daily/calendar/goals/habits/areas/insights/weekly/guide + AppContext + components) — expected. Commit `wip(model): two-tier goal types + 3-state migration + adapters` (--no-verify; tsc red until Phase 2/3).

## Phase 2 — domain consumers (return domain to green)
Rewrite over the new adapters; update tests:
- `goals.ts`: goalProgress (short = own tasks+metrics; long = own + child-short completion composite), completeGoal (area bump LONG-only, not "other"), dueGoalReviews (long-only, createdAt baseline), tags helpers, childGoals/achievedPathIds.
- `daily.ts` + `calendar.ts`: habit due respects owning goal's endDate (a habit doesn't appear on a date after its goal.endDate). recurringDueToday/actionsOnDay/todayItems via adapters.
- `habits.ts` (recurringActions/habitStreak), `areas.ts` (areaSummaries: long goals per area + their shorts), `insights.ts`, `weekly.ts`, `guide.ts`, `tree.ts`.
- Update all domain tests. Acceptance: tsc green except components; `npx vitest run` green.

## Phase 3 — AppContext
`addLongGoal({...,withBranch?})`, `addShortGoal(parentLongId, {...,startDate,endDate})`, `updateGoal`, `removeGoalById`, `addTask(goalId,text)`, `addHabit(goalId,...)`, `removeItemById`, `setMetric/bumpMetric/removeMetric`, toggle/complete, schedule/time, tags, favorite, choice decide→ addLongGoal. Habit add binds to goal endDate (no field needed; window enforced in domain). tsc green (only components red).

## Phase 4 — PlanScreen two-tier UI
领域 → 长期目标卡(进度=旗下综合;时间范围可选;⭐;只有长期有「成长为分支」;「AI 拆成短期目标」) → 短期目标卡(带起止时间;进度;自己的 指标/任务/习惯;「AI 规划这一段」) → {指标/任务/习惯}. Per-level add/edit/delete. Edit button top-left (already a pattern). Reuse line icons + white theme.

## Phase 5 — other components
CalendarPlannerScreen (目标列 = long goals, roll-up progress; short shown under), AreasSection (long per area + shorts), ChoicePanel decide→addLongGoal, Today/AllTasks/Completed/Tag/Upcoming/DayView/Month/Year (mostly via allTasks — verify shapes). `next build` green.

## Phase 6 — AI: decompose + plan-in-window + habit window
- `/api/decompose-goal` (rework) → long goal in, 3-4 short goals (each {title, why, metrics[], tasks[], habits[]}) out; offline fallback; PlanScreen preview → addShortGoal each in one snapshot.
- `/api/plan-short-goal` (new) → short goal + its tasks/habits + window + day-window → sensible-cadence schedule (scheduledDate per task; weekly habit weekdays), NOT every slot; offline local fallback (spread across N evenly-spaced days within [startDate,endDate]); preview → apply.
- Confirm habit-window (Phase 2) visibly works (habit stops after goal.endDate).
- AppContext methods + clients + rate limit + i18n.

## Phase 7 — finalize
i18n audit; full tsc/test/build green; adversarial review (migration data-loss + the two AI features + habit window); update task_plan/progress/findings; restart dev.

---

## Self-Review
- Coverage: model(1.1), migration 3-state+idpreserve(1.2-1.4,1.7), adapters(1.5-1.6), consumers(2), state(3), UI(4-5), AI+habit-window(6), verify(7). Covered.
- Ordering: 1→2 returns domain green; 3 state; 4-5 components; 6 AI; 7 finalize. tsc red between 1 and 3 (accepted, WIP commits).
- Type consistency: GoalKind, parentGoalId, removed Subgoal; adapters addLongGoal/addShortGoal/shortGoalsOf/longGoals/addTask(goalId,text)/setMetric(goalId,…)/removeGoalById; AppContext addLongGoal/addShortGoal. Consistent.
- Risk: 3rd goal-model migration; mitigated by 3-state idempotent migration + id-reachability invariant test + per-phase review + git revert.
