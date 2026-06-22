# 导航重构 + 多日时间轴 + 选择面板 (A/B/C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Implement task-by-task. Pure domain modules are TDD'd (tests first); state/components are verified via `npx tsc --noEmit` + `npx vitest run` + `npx next build` (project convention — components are not unit-tested here). Each implementer reads the current file + the spec `docs/superpowers/specs/2026-06-21-griply-nav-timeline-choices-design.md` + the existing AppContext/adapter APIs. Steps use `- [ ]`.

**Goal:** Restructure the sidebar into grouped sections (life-tree pinned on top), add To-Do task views (Today / All Tasks / Completed / Tag) + Favorites + an "other" goal area, a multi-day horizontal drag timeline (Upcoming), and a tree-integrated Choice panel.

**Architecture:** Three cohesive packages built A→B→C. A = navigation + read-heavy task views + `GoalArea` ("other" isolated from prediction) + `Goal.favorite`. B = `UpcomingTimeline` reusing `calendar.setActionScheduledDate` (zero new data). C = new `Choice`/`ChoiceOption` model + pure `choices.ts` + tree-linkage (option→branch, decide→goal). All new tree fields backfilled in `normalizeLoadedTree` (no migration). Determinism + dark theme + bilingual preserved.

**Tech Stack:** Next.js 16 / React 19 / TS / Tailwind v4 / Vitest 4 / DeepSeek.

---

## File Structure

**Create:** `src/components/TodayView.tsx`, `AllTasksView.tsx`, `CompletedView.tsx`, `TagView.tsx`, `UpcomingTimeline.tsx`, `ChoicePanel.tsx`; `src/domain/choices.ts` + `src/domain/__tests__/choices.test.ts`; `src/domain/sidebar.ts` (pure helpers: favorite time-label, favorites list, tag list) + test; optional `src/app/api/analyze-choice/route.ts` + `src/lib/choiceClient.ts`.
**Modify:** `src/domain/types.ts` (GoalArea, Goal.favorite, LifeTree.choices), `tree.ts` (createTree), `repository/normalize.ts` (backfill choices), `goals.ts` (completeGoal other-guard + favorite helper), `state/AppContext.tsx` (View keys + openers + choice/favorite methods + tree linkage), `components/AppShell.tsx` (grouped sidebar), `app/page.tsx` (route new views), `components/PlanScreen.tsx` (⭐ favorite + GoalArea picker/grouping), `components/AreasSection.tsx` (keep 5 score areas; goal grouping uses GoalArea where it lists goals), `i18n/messages.ts`.

---

## Phase 1 — A: data + state foundation

**Files:** Modify `src/domain/types.ts`, `tree.ts`, `repository/normalize.ts`, `goals.ts`; Test: `src/domain/__tests__/goals.test.ts`, `src/domain/__tests__/sidebar.test.ts` (new), create `src/domain/sidebar.ts`.

- [ ] **1.1 types.ts** — add after the LifeArea block:
```ts
export type GoalArea = LifeArea | "other";
export const GOAL_AREAS: GoalArea[] = [...LIFE_AREAS, "other"];
export const GOAL_AREA_LABELS: Record<GoalArea, string> = { ...AREA_LABELS, other: "其他" };
```
Change `Goal.area: LifeArea` → `Goal.area: GoalArea`. Add `favorite?: boolean` to `Goal`. Add `choices: Choice[]` to `LifeTree` (define Choice/ChoiceOption now too — see 5.1; or add placeholder `choices: Choice[]` and define types in Phase 5. To keep Phase 1 compiling, DEFINE the Choice/ChoiceOption interfaces here in 1.1 per spec C1, and `LifeTree.choices: Choice[]`).
- [ ] **1.2 tree.ts** — `createTree` returns `choices: []` (+ keep existing fields).
- [ ] **1.3 normalize.ts** — backfill `parsed.choices ??= []` (array guard); `Goal.favorite` needs no backfill (optional). `Goal.area` widening is non-breaking.
- [ ] **1.4 goals.ts** — `completeGoal`: only apply the area +bump when `goal.area !== "other"` (other is neutral, never feeds Profile.areas/prediction). Add `toggleGoalFavorite` is a STATE method (Phase 2), but add a pure `favoriteGoals(tree): Goal[]` here or in sidebar.ts.
- [ ] **1.5 Create `src/domain/sidebar.ts` (pure)** — `favoriteGoals(tree): Goal[]` (goals where favorite, active first); `favoriteTimeLabel(goal, today): { kind: "due"|"overdue"|"created"; days: number }` (endDate→days-until / overdue; else days-since createdAt; time injected via `today`); `sidebarTags(tree): string[]` (= allTags). Pure, no `new Date`.
- [ ] **1.6 Tests** — `goals.test.ts`: completing an `other` goal does NOT change any Profile.areas score; completing a `career` goal still bumps. `sidebar.test.ts`: favoriteGoals filters+orders; favoriteTimeLabel returns due/overdue/created correctly for sample dates; sidebarTags dedups.
- [ ] **1.7 Verify** — `npx vitest run` green; `npx tsc --noEmit` (Phase-1 files clean; consumer errors expected where Goal.area widened / choices added — fix obvious ones, the rest in Phase 2/3). Commit: `feat(model): GoalArea(+other neutral) + Goal.favorite + LifeTree.choices + sidebar helpers`.

## Phase 2 — A: AppContext View keys + openers + methods

**Files:** Modify `src/state/AppContext.tsx`.

- [ ] **2.1** Extend `View` union with `today | upcoming | alltasks | completed | choices | tag`. Add reducer actions + state `selectedTag: string | null`, `focusGoalId: string | null`.
- [ ] **2.2** Add openers: `openToday/openUpcoming/openAllTasks/openCompleted/openChoices`, `openTag(tag)` (sets selectedTag), `openPlanFocused(goalId)` (view "plan" + focusGoalId), and `clearFocusGoal()`.
- [ ] **2.3** Add `toggleGoalFavorite(goalId)` (updateGoalById with favorite flip).
- [ ] **2.4** Add choice methods as STUBS that compile now (full impl Phase 6): `createChoice/addChoiceOption/updateChoiceOption/removeChoiceOption/removeChoice/decideChoice/predictOptionBranch`. (Implement createChoice/add/update/remove/decide fully here using Phase-5 domain `choices.ts` IF Phase 5 lands first; ordering note: do Phase 5 before 6. For Phase 2 just wire favorites + views; leave choice methods for Phase 6 — only add them when choices.ts exists.) → REVISED: Phase 2 adds ONLY view keys/openers + toggleGoalFavorite. Choice methods come in Phase 6.
- [ ] **2.5 Verify** — tsc: AppContext clean; remaining errors only in components (page.tsx/AppShell/PlanScreen) — Phase 3. vitest green. Commit: `feat(state): new view keys/openers + goal favorite`.

## Phase 3 — A: sidebar restructure + route new views + favorite/area in PlanScreen

**Files:** Modify `src/components/AppShell.tsx`, `app/page.tsx`, `PlanScreen.tsx`, `AreasSection.tsx`; Create `TodayView.tsx`, `AllTasksView.tsx`, `CompletedView.tsx`, `TagView.tsx`; Modify `i18n/messages.ts`.

- [ ] **3.1 AppShell.tsx** — replace the flat 6-item list with grouped sections per spec A1: pinned 🌳 我的人生树 on top; groups 待办(今天/即将到来/日历/全部任务/已完成) · 我的人生(人生面/目标/习惯/洞察) · 选择(选择面板) · 收藏(favoriteGoals → openPlanFocused, with favoriteTimeLabel small text) · 标签(sidebarTags → openTag). Add a small `NavSection` (label + items) component; empty dynamic groups hidden. Drawer reuses the same inner. Keep accessibility (buttons, aria-current, group aria-labels).
- [ ] **3.2 page.tsx** — route the new views: `today→TodayView`, `upcoming→UpcomingTimeline` (Phase 4; until then a placeholder "即将到来" empty state is fine but PREFER doing Phase 4 before shipping upcoming nav — wire it to a simple "敬请期待" only if needed), `alltasks→AllTasksView`, `completed→CompletedView`, `choices→ChoicePanel` (Phase 7; same note), `tag→TagView`. dashboard/plan/habits/areas/insights/tree unchanged.
- [ ] **3.3 TodayView.tsx** — `daily.todayItems(tree, today)` list (tasks + due habits), checkbox completes (`toggleTodayAction`), today via boot const + visibility effect. Empty state. Dark theme, reuse Card/SectionHeader/EmptyState.
- [ ] **3.4 AllTasksView.tsx** — `goalTree.allTasks(tree)` grouped by GoalArea→Goal; filter toggle 进行中/全部; row = checkbox(complete) + text + 删除(removeItemById) + 跳目标(openPlanFocused). Use GOAL_AREA_LABELS + area colors (extend AREA_COLORS map with other=slate/faint).
- [ ] **3.5 CompletedView.tsx** — done tasks (allTasks filter done) reverse order; uncheck to restore. Empty state.
- [ ] **3.6 TagView.tsx** — reads `selectedTag`; lists goals whose tags include it + their tasks (reuse AllTasks row rendering). Heading shows the tag.
- [ ] **3.7 PlanScreen.tsx** — (a) add ⭐ favorite toggle on each goal card (`toggleGoalFavorite`); (b) area picker + grouping use `GOAL_AREAS`/`GOAL_AREA_LABELS` (6 buckets incl. 其他) and the area emoji/color maps extended with `other`; (c) consume `focusGoalId` (auto-expand+scroll to that goal on mount, then `clearFocusGoal`).
- [ ] **3.8 AreasSection.tsx** — the 领域分数 page stays the 5 LifeArea (other has no score); where it lists goals per area, "other" goals simply don't appear under a score card (acceptable) OR show a scoreless "其他" group at the bottom listing those goals (preferred, no ScoreBar). Pick the preferred.
- [ ] **3.9 i18n** — EN for all new strings (今天/即将到来/全部任务/已完成/收藏/标签/选择/其他/距截止 {n} 天/已过期/{n} 天前/进行中/全部/收藏 toggle aria/empty states…). Additions-only.
- [ ] **3.10 Verify** — tsc 0 (except upcoming/choices placeholders if used); vitest green; `npx next build` ok (with placeholders for upcoming/choices acceptable this phase), `rm -rf .next`. Commit: `feat(nav): grouped sidebar + Today/AllTasks/Completed/Tag views + favorites + other area`.

## Phase 4 — B: multi-day horizontal timeline (Upcoming)

**Files:** Create `src/components/UpcomingTimeline.tsx`; Modify `app/page.tsx` (wire upcoming→UpcomingTimeline), `i18n/messages.ts`.

- [ ] **4.1 UpcomingTimeline.tsx** — horizontal strip of 14 day-columns from today (boot const + visibility effect for today; horizontal scroll for more). Per column: date header (weekday short + D, today highlighted), scheduled tasks (`calendar.actionsOnDay`) as area-colored bars with checkbox-complete, due habits as faint read-only ghost chips. Side/top tray = `calendar.unscheduledActions` draggable chips.
- [ ] **4.2 Desktop DnD** — HTML5 draggable on task chips; `onDragStart` sets the task id; day columns + tray are drop zones; drop on a day → `scheduleAction(id, date)`; drop on tray → `scheduleAction(id, null)`. Visual drop-hover state.
- [ ] **4.3 Mobile tap-select fallback** — tapping a chip selects it (highlight + a "已选：X，点某天放入" hint bar); tapping a day column schedules; tapping tray clears selection. (Mirror the month-calendar pattern.) Pointer/touch friendly; works without DnD.
- [ ] **4.4 a11y + empty** — chips/columns are buttons with aria-labels; empty tray + empty timeline states.
- [ ] **4.5 Verify** — tsc 0; vitest green; `next build` ok; `rm -rf .next`. Commit: `feat(timeline): multi-day horizontal Upcoming with drag + tap scheduling`.

## Phase 5 — C: Choice domain (pure, TDD)

**Files:** (types already in 1.1) Create `src/domain/choices.ts` + `src/domain/__tests__/choices.test.ts`.

- [ ] **5.1 (already in 1.1)** Confirm `ChoiceOption`/`Choice` types + `LifeTree.choices` exist per spec C1.
- [ ] **5.2 choices.ts (pure, ids via seed, now injected)** — `createChoice(tree, question, now): {tree,id}`; `addOption(tree, choiceId, label, now): {tree,id}`; `updateOption(tree, optionId, patch: Partial<ChoiceOption>): tree`; `removeOption(tree, optionId): tree`; `decideChoice(tree, choiceId, optionId, now): tree` (set chosenOptionId+decidedAt); `reopenChoice(tree, choiceId): tree` (clear chosen); `removeChoice(tree, choiceId): tree`; `linkOptionPath(tree, optionId, pathId): tree`; `findChoiceByOption(tree, optionId)`. Optional `suggestOption(choice): optionId | null` (highest gut, tiebreak two-way reversibility, then fewer cons lines).
- [ ] **5.3 Tests** — create choice; add/update/remove option (locate across choices); decide sets chosen+decidedAt; reopen clears; removeChoice; linkOptionPath sets pattId; suggestOption picks expected. Determinism (pass now).
- [ ] **5.4 Verify** — `npx vitest run` green. Commit: `feat(model): Choice domain (choices.ts) + tests`.

## Phase 6 — C: AppContext choice methods + tree linkage

**Files:** Modify `src/state/AppContext.tsx`.

- [ ] **6.1** Wire choice CRUD over `choices.ts`: `createChoice(question)`, `addChoiceOption(choiceId,label)`, `updateChoiceOption(optionId,patch)`, `removeChoiceOption(optionId)`, `removeChoice(choiceId)`, `decideChoice(choiceId,optionId,opts?)`, `reopenChoice(choiceId)`. Read treeRef at apply; one snapshot each.
- [ ] **6.2 predictOptionBranch(choiceId, optionId)** — `addPath`(choiceLabel = option.label, fork from now) → run the existing predict overlay (`predictAndCommit`) → on commit `linkOptionPath(optionId, newPathId)` folded into the same snapshot (avoid clobber, mirror promote/arrange pattern).
- [ ] **6.3 decideChoice(..., { makeGoal?, area? })** — set chosen; if `makeGoal`: `addGoal({ area: area ?? "growth", title: option.label, why: choice.question, pathId: option.pathId ?? null })` in the SAME snapshot. If option has a pathId, reuse it (link goal→branch).
- [ ] **6.4 Verify** — tsc: AppContext clean; only ChoicePanel (not yet created) referenced → fine. vitest green. Commit: `feat(state): choice methods + option→branch + decide→goal`.

## Phase 7 — C: ChoicePanel UI (+ optional AI analyze)

**Files:** Create `src/components/ChoicePanel.tsx`; Modify `app/page.tsx` (choices→ChoicePanel), `i18n/messages.ts`; Optional: `src/app/api/analyze-choice/route.ts` + `src/lib/choiceClient.ts`.

- [ ] **7.1 ChoicePanel.tsx** — list choices (未决/已决 sections); new-choice composer (question); per choice an options comparison (columns/cards): label, 利 pros, 弊 cons, 成本 cost, 可逆性 (单行道/可回头 toggle), 直觉 1-5 stars; add/edit/remove option; per option 「🌳 推演这个选项」(predictOptionBranch; once pathId set show 「在树上看」→ openPath) + 「✅ 就选它」(decideChoice with a light confirm offering "同时建成目标"). Decided choice highlights chosen + decidedAt + 重新打开 (reopenChoice). Dark theme, reuse ui components, a11y.
- [ ] **7.2 (optional, cuttable) AI analyze** — `/api/analyze-choice` (DeepSeek + offline local fallback + `allowRequest` rate limit) returning per-option {pros,cons,reversibility} suggestions; `choiceClient.fetchChoiceAnalysis`; a 「✨ AI 帮我分析」button that fills empty fields. If time-constrained, SKIP (panel must work fully without it).
- [ ] **7.3 i18n** — EN for all ChoicePanel strings. Additions-only.
- [ ] **7.4 Verify** — tsc 0; vitest green; `next build` ok; `rm -rf .next`. Commit: `feat(choices): decision panel UI integrated with the tree`.

## Phase 8 — finalize

- [ ] **8.1 i18n audit** — script-check every `t("…")` key in the new components has an EN entry (the Phase-6 nested-rewrite audit script is a template); fix leaks (esp. any `周{w}`-style or numeric-format strings).
- [ ] **8.2 Full verify** — `npx tsc --noEmit` 0; `npx vitest run` all green; `npx next build` ok; `rm -rf .next`.
- [ ] **8.3 Update planning files** — task_plan.md (add Phases 14 A/B/C done), progress.md (session entry), findings.md (new views/timeline/choices + GoalArea note).
- [ ] **8.4 Restart dev** — detached `Start-Process cmd /c "npm run dev"`; confirm `GET / 200`.
- [ ] **8.5 Commit** — `chore: i18n audit + planning files for A/B/C`.

---

## Self-Review
- **Spec coverage:** A1 sidebar→3.1; A2 views/openers→2.1-2.2,3.2; A3 today/all/completed→3.3-3.6; A4 favorite→1.5,2.3,3.1,3.7; A5 tags→1.5,3.1,3.6; A6 other area→1.1,1.4,3.7,3.8; B timeline→Phase 4; C model→1.1,5; C state/linkage→6; C UI→7; migration/normalize→1.2-1.3; i18n→3.9,7.3,8.1; tests→1.6,5.3. Covered.
- **Ordering fix:** Phase 5 (choices.ts) must precede Phase 6 (state uses it); Phase 6 precedes Phase 7 (UI uses methods). Phase 4 (timeline) before shipping the `upcoming` nav target; Phase 7 before `choices` nav target — Phase 3 may ship those two nav items pointing at lightweight placeholders, replaced in 4/7 (acceptable, build stays green).
- **Type consistency:** GoalArea/GOAL_AREAS/GOAL_AREA_LABELS, Goal.favorite, Choice/ChoiceOption (label/pros/cons/cost/reversibility/gut/pathId), LifeTree.choices, view keys (today/upcoming/alltasks/completed/choices/tag), methods (toggleGoalFavorite/openTag/openPlanFocused/createChoice/addChoiceOption/updateChoiceOption/removeChoiceOption/decideChoice/reopenChoice/predictOptionBranch) — consistent across tasks.
- **Risk:** large; built A→B→C, each phase tsc+test+build green + committed + rollback-able. "other" isolated from prediction. AI-analyze is cuttable.
