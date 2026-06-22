# Progress Log — Life Planner

## Session — 2026-06-19 (planning files initialized)
Set up planning-with-files working memory. The project build is complete through Phase 9; branch `feat/goal-planning-mainline` @ `92a603d`, unmerged.

### State snapshot
- Tests: 250 passing (vitest). `npx tsc --noEmit` clean. `npx next build` clean.
- All phases 1–9 in task_plan.md are complete.
- Most recent work (this session): calendar home, Griply-style sidebar IA + Habits/Areas/Insights sections, visual polish pass, then the Griply gap functions — Inbox (`554e29e`+`56639bd`), goal deadlines (`5c0d242`), tags (`92a603d`).

### Verified each step
Every feature went through implementer + review (spec/quality) + tsc/test/build. Key bugs caught & fixed in review: crisis-care overlay missing in new view branches; inbox-item resurrection via predictAndCommit snapshot; weekly streak label cadence; SVG export escaping/leakage.

### Next steps (see task_plan.md Backlog)
1. User: real-machine smoke (calendar drag + mobile especially), then merge `feat/goal-planning-mainline` → main.
2. Optional refinements: Supabase async wiring + auth UI; fold AI "suggest today" into calendar; nationality field for prediction realism; PNG export; delete orphaned DashboardScreen.tsx.

## Session — 2026-06-19 (cont.) Phase 10: first-run guide
User asked for "简单好上手 + 用户引导". Built «上手 3 步» first-run card (commit `0c6f273`): dismissible card on the home, 3 auto-checking steps (add long goal → schedule an action → complete it), `firstRunSteps` pure helper + tests, `guideDismissed` flag on tree. 255 tests, tsc/build clean.
- Still open from this thread: user originally asked "点日历直接添加目标" (click a calendar day to create directly) — deferred; in backlog (need to decide: quick-task vs full goal vs add-to-existing).

## Session — 2026-06-19 (cont.) Phase 11: calendar year/month/day + time blocks + AI arrange
Built to fix "事情堆一天太乱". 6 subtasks, each reviewed + tsc/test/build green (269 tests):
- 11.1 `d577447` data (GoalAction.startTime/durationMin, LifeTree.dayStart/dayEnd) + pure `schedule.ts` (arrangeDay greedy non-overlap, setActionTime, dayWindow) + tests.
- 11.2 `5e05c2c` /api/arrange-day (AI) + scheduleClient with local arrangeDay fallback (always works offline).
- 11.3 `973eec9` AppContext setActionTimeById/setDayWindowValues/arrangeDayWithAI (folds plan into one tree, reads treeRef at apply → no clobber).
- 11.4 `015d136` DayView timeline (PX_PER_MIN=0.8, time blocks, 未排时间 tray, 起床/睡觉 inputs, ✨AI 帮我排今天).
- 11.5 `165acb0` YearView (12 mini-months, density dots = scheduled one-shots + completions).
- 11.6 `617a30a` 年/月/日 toggle wired into CalendarPlannerScreen; month-day-click → day view; removed old inline day panel (cleaned unused imports).
- Final review (opus): ready to merge. KNOWN EDGES (accepted/backlog): (1) a recurring habit's startTime is a *daily* global time — intended for the 健身/学习 daily-timetable use case; re-running AI-arrange on another day can re-time habits globally. (2) degenerate 作息 window (睡觉<起床) renders a floored/empty timeline — add a guard later. Optional follow-up: per-day time storage if we want per-occurrence habit times.

## Session — 2026-06-21 Phase 13: nested goal architecture (from-scratch rewrite)
User drew the hierarchy Vision → Life Area → Goal Plan(time range) → Subgoal → {Metric/Task/Habit}, reported "没法删除任务" + "随便点一下就完成", wanted that interface. Chose 完整嵌套重构 → 从零重写类型. Spec + plan: docs/superpowers/specs|plans/2026-06-19-nested-goal-architecture*. Executed in 6 phases via subagents, each committed (WIP commits intentionally tsc-red between P1 and end-of-P5 — accepted cost of a from-scratch model rewrite):
- P1 `cf067da` new types (Metric/Task/Habit/Subgoal/Goal nested; Legacy types) + `migrateGoals` (id-preserving flat→nested) + `goalTree.ts` adapters + tests.
- P2a `4511a71` rewire daily/calendar/schedule/goals; P2b `ccb14be` rewire habits/areas/insights/weekly/guide/inbox/tree — whole domain green (299 tests). goalProgress = (doneTasks+achievedMetrics+completedSubgoals)/total.
- P3 `44583ff` AppContext + api/goals + goalClient (new method contract: addGoal/addGoalWithBranch/updateGoal/removeGoalById/addSubgoal/removeSubgoal/addTask/addHabit/removeItemById/setMetric/bumpMetric/removeMetric/promoteInboxToGoal{withBranch}...).
- P4 `75f21c0` PlanScreen nested UI (area→goal→subgoal→{metric/task/habit}, per-level CRUD, metric editor, date-range, checkbox-ONLY completion = fixes accidental-complete bug, delete at every level = fixes can't-delete bug).
- P5 `f0953c7` rewire remaining components; DELETED orphaned DashboardScreen.tsx — tsc 0 / build green.
- P6 `43c8a67` lossless-migration integration test + i18n audit (caught a 周{w} EN-only weekday regression).
- Review + fix `e816eb7`: code-reviewer found 3 CRITICAL migration data-loss bugs (grandchild/deep chain dropped; self-parent deleted; mixed/partial tree re-migrated → already-nested goals flattened) + arrange no try/catch + empty-subgoal caps progress + UTC weekday default. ALL fixed; added "every input id reachable in output" invariant test + grandchild/self-parent/mixed fixtures (confirmed they fail against old migrateGoals). 316 tests green.
- Net: storage key unchanged (lifeplanner.tree.v3); old data upgrades losslessly (ids preserved → activity/streak/schedule history intact); idempotent (no double-migration).
- STILL TO DO: user real-machine smoke (esp. existing data upgrade + nested CRUD + metrics→progress); then merge feat/goal-planning-mainline → main.

## Session — 2026-06-21 (cont.) Phase 14: A/B/C (导航重构 + 多日时间轴 + 选择面板)
User showed Griply sidebar ("这些都要有，除 inbox") + wanted a horizontal timeline, an 其他 area, and a 选择面板 (chose: independent panel integrated with the tree). `/goal`: tonight do A/B/C, spec→plan→build, morning review. Spec+plan: docs/superpowers/specs|plans/2026-06-21-griply-nav-timeline-choices*. 8 phases via subagents, each tsc+test+build green + committed:
- P1 `0b9d507` GoalArea(=LifeArea|"other", neutral: never feeds Profile.areas/prediction; completeGoal guards) + GOAL_AREAS/LABELS + Goal.favorite + Choice/ChoiceOption types + LifeTree.choices + normalize/createTree backfill + sidebar.ts (favoriteGoals/favoriteTimeLabel/sidebarTags) + tests.
- P2 `2ec51d0` AppContext: View += today/upcoming/alltasks/completed/choices/tag; openers + selectedTag/focusGoalId + toggleGoalFavorite.
- P3b `8088d09` PlanScreen favorite ⭐ + 其他 area picker/grouping + focusGoalId scroll; DayView area fix; AreasSection scoreless 其他 group (returned app to green).
- P3a `9abb1ff` AppShell grouped sidebar (🌳人生树 pinned top; 待办/我的人生/选择/收藏/标签; dynamic favorites+tags, empty groups hidden) + TodayView/AllTasksView/CompletedView/TagView + shared lib/areaMeta.ts + lib/taskGroups.tsx. (Package A done.)
- P4 `9daf503` UpcomingTimeline: 21-day horizontal strip, area-colored task bars + read-only habit ghost chips + 未排期 tray; desktop HTML5 drag + mobile/keyboard tap-select → scheduleAction; complete via toggleActionOn(id,date). (Package B done.)
- P5 `a7b0d28` choices.ts (pure, TDD, 22 tests): create/add/update/remove option, decide/reopen, removeChoice, linkOptionPath, findChoiceByOption, suggestOption(gut→two-way→fewer-cons).
- P6 `7439760` AppContext choice methods + predictOptionBranch (mirror addGoalWithBranch: addPath→linkOptionPath in same pre-predict snapshot→predictAndCommit) + decideChoice({makeGoal,area}) single-snapshot.
- P7 `a83b9f7` ChoicePanel UI (未决/已决, option compare cards: 利/弊/成本/可逆性/直觉星级, 推演这个选项→在树上看, 就选它→inline confirm+建成目标). Removed ComingSoon. (Package C done.)
- Review `a96623d` (code-reviewer) found 1 HIGH + 3 LOW. HIGH: predictAndCommit final commit spread the STALE workingTree → edits made while an option branch predicts get clobbered. Fixed `807050f`: re-read treeRef + overlay only paths (mirror regenerateAndCommit); traced onboarding/addBranch/addGoalWithBranch/predictOptionBranch — none drop path/goal/link. Also fixed LOW: AllTasks/Completed complete on task.scheduledDate (not today). LOW backlog: focusGoalId-hidden-by-tag-filter; addGoal id collision salt; optional /api/analyze-choice cut.
- Net: 342 tests, tsc 0, build ok. Storage key unchanged; choices/favorite/other all backfill losslessly + idempotent (reviewer-confirmed).

### Errors / gotchas log
| Issue | Resolution |
|-------|-----------|
| dev server dies between turns | launch detached via Start-Process; or user runs it |
| dev `/` 404 after a build | clear `.next`, restart dev |
| messages.ts Chinese-comma keys | must be quoted; ASCII delimiters; no smart quotes as delimiters |
| predictAndCommit clobbers concurrent patches | bake the mutation into the working-tree snapshot (e.g. promoteInboxToLongGoal) |
