# Findings — Life Planner

## Architecture (current)
- Next.js 16 (App Router, Turbopack) + React 19 + TS + Tailwind v4 + Vitest 4. Default model deepseek-chat.
- Pure domain layer `src/domain/*` (types, tree, goals, daily, calendar, habits, areas, insights, inbox, decisions, safety, generator, repository, migrateGoals, goalTree). Seeded RNG; time injected. 316 tests.
- **Goal model is NESTED** (Phase 13): `Goal`(area, time range startDate/endDate, pathId, tags) ⊃ `Subgoal` ⊃ `{ Metric(label/current/target/unit), Task(done,scheduledDate,startTime,durationMin), Habit(repeat,repeatWeekday,startTime,durationMin) }`; goal-level metrics/tasks/habits too. Flat access via `goalTree.ts` adapters (allTasks/allHabits/findItem/updateTask/updateHabit/removeItem/addTask/addHabit/addSubgoal/addGoal/setMetric/bumpMetric/removeMetric/updateGoalById/removeGoalById). `migrateGoals.ts` losslessly converts old flat goals (horizon/parentGoalId/actions) → nested, PRESERVING action ids as task/habit ids (so activity/streak/schedule history stays aligned); runs from `normalizeLoadedTree`, idempotent, mixed-tree-safe, never drops a goal (invariant-tested). `goalProgress` = (doneTasks + achievedMetrics + completedSubgoals)/total, empty subgoals excluded.
- State: `src/state/AppContext.tsx` (useReducer + api via useMemo; `View` union routes screens; `treeRef` for async; `patchTree` updates tree without view change; `predictAndCommit` runs the "正在推演" overlay then commits).
- Persistence: `TreeRepository` (sync localStorage, key `lifeplanner.tree.v3`); shared `normalizeLoadedTree` backfills new optional fields (decisions/goals/activity/inbox) so old trees load — no migrations, optional fields only.
- AI routes (`src/app/api/*`): enrich, chat, assistant, suggest-paths, goals, goal-actions, today-plan — all DeepSeek + offline fallback + per-IP rate limit (`src/lib/rateLimit.ts`).
- UI shell: `AppShell.tsx` left sidebar (📥收件箱 / 📅日历 / 🎯目标 / 🔁习惯 / 🧭人生面 / 📊洞察 / 🌳人生树); shared ui: SectionHeader/Card/MetricCard/EmptyState. Home = CalendarPlannerScreen.

## Navigation & views (Phase 14 A/B/C)
- Sidebar `AppShell.tsx` is GROUPED: 🌳人生树 pinned top → 待办(今天 today / 即将到来 upcoming / 日历 dashboard / 全部任务 alltasks / 已完成 completed) → 我的人生(人生面/目标/习惯/洞察) → 选择(选择面板 choices) → 收藏(dynamic favoriteGoals) → 标签(dynamic sidebarTags). Empty dynamic groups hidden. View union now also: today|upcoming|alltasks|completed|choices|tag; AppContext has selectedTag/focusGoalId + openTag/openPlanFocused/openChoices etc.
- To-Do views: `TodayView` (daily.todayItems), `AllTasksView` (goalTree.allTasks grouped by GoalArea, 进行中/全部 filter), `CompletedView`, `TagView` (selectedTag). Shared `components/lib/areaMeta.ts` (AREA_COLOR/AREA_EMOJI by GoalArea) + `components/lib/taskGroups.tsx` (TaskRow/GroupedTasks). Favorites = `Goal.favorite` (⭐ in PlanScreen). 
- `GoalArea = LifeArea | "other"`: "other" is a NEUTRAL bucket — never writes Profile.areas / feeds prediction (completeGoal guards; areaSummaries/AreasSection score only the 5; AI routes coerce other→growth). The 5-area prediction model is unchanged.
- **B — Upcoming timeline** `UpcomingTimeline.tsx` (view upcoming): horizontal multi-day (21d) planner; tasks=draggable area-colored bars, habits=read-only ghost chips, 未排期 tray; desktop HTML5 drag + mobile/keyboard tap-select → scheduleAction; reuses calendar.actionsOnDay/unscheduledActions (zero new data).
- **C — Choice panel** `ChoicePanel.tsx` (view choices) + pure `domain/choices.ts` + `LifeTree.choices: Choice[]`. Choice{question,options[],chosenOptionId}; ChoiceOption{label,pros,cons,cost,reversibility,gut,pathId}. Flow: compare options → 「推演这个选项」(predictOptionBranch grows+predicts a tree branch, links option.pathId) → 「就选它」(decideChoice, optional →goal). Separate from the existing path-bound `Decision` log (not merged, by design).
- predictAndCommit final commit re-reads treeRef + overlays only `paths` (preserves concurrent goal/choice/task edits during the predict window) — same pattern as regenerateAndCommit.

## Predict ↔ planning integration (the differentiator)
- A long-term goal **= a branch on the prediction tree** (goal.pathId). Completing milestone actions advances a "你在这里" marker along the branch (goalProgress); completing the whole long goal bumps the area score (affects future predictions) + a 🏆 celebrate row → talk-to-future-self.
- Recurring habits feed streak/heatmap but DON'T move the marker (honesty: progress = real milestones only).
- Inbox capture → 设成长期目标 grows a branch (one-snapshot promote to avoid the predictAndCommit resurrection race).

## Key product decisions (locked)
- Positioning: believable "possible-life explorer" + motivation engine, NOT 算命. Dark theme only (light removed at user request).
- Direction evolved: prediction toy → decision companion → motivation-loop planner → Griply-parity planner with prediction as vision.
- IP boundary (declined, on purpose): will NOT pixel-clone griply.app's proprietary interface. Delivered Griply's FUNCTIONS + information architecture in our OWN visual identity. Confirmed with user; the /goal was redirected to "functions griply have, combine with predict" — fully delivered.

## Ops notes
- Background `npm run dev` via harness background-tasks gets reaped between turns. Use detached: `Start-Process cmd.exe -ArgumentList '/c','npm run dev' -WindowStyle Hidden` (logs → %TEMP%\lpdev.out.log). After `next build`, clear `.next` before dev to avoid dev `/` 404.
- guard-env hook blocks reading `.env*`; the user edits the key manually.

## Execution method
- subagent-driven: per task → implementer subagent → spec-review + code-review (two-stage for risky/complex; single combined for mechanical) → commit. TDD on all pure domain modules.

## Specs/plans on disk
- docs/superpowers/specs/ + docs/superpowers/plans/ (dated). docs/MORNING-REVIEW-2026-06-18.md. docs/supabase-setup.md.
