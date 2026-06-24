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

## Session — 2026-06-22→23 Phases 15/16/17 (UI re-skin, two-tier+loose goals, six core-gap overnight)
- **Phase 15 (UI re-skin)**: Apple-white minimal theme (light tokens, system SF, drop Fraunces serif; tree/predict on intentional dark "media panel"); app-wide emoji → minimal line-icon set (ui/icons.tsx + lib/areaMeta AreaIcon); edit-button to goal top-left; 待安排 vertical; new goals not instantly "due for review" (createdAt baseline). Sidebar grouped earlier. User confirmed white direction.
- **Phase 16 (two-tier goals)**: Goal.kind(long/short)+parentGoalId, dropped Subgoal (→short goals), 3-state lossless migration (legacy/nested/two-tier, idempotent, id-reachability invariant; review fixed grandchild/mixed-array mis-parent `af85254`); long-only branch + area-bump; progress roll-up; habit bound to owning goal endDate. THEN goal-less items: standalone short goals (parentGoalId null) + LOOSE tree-level tasks/habits (LifeTree.tasks/habits, goal:null, neutral "无目标" group) + create-in-calendar (＋任务/＋日常) + unified 「建立目标」 composer (choose long/short; long no startDate, short defaults today).
- **Phase 17 (six core-gap overnight, /goal)**: from the honest competitor gap analysis (we win on meaning/prediction, lose on sync/reminders/capture/calendar — the daily-retention basics). Built the no-creds-needed parts of all six: P1 quick-capture + NL parse (`70324b0`); P2 AI 规划这一段 plan-short-in-window + offline fallback (`27b6242`); P3 reminders engine + 今日提醒 + Notification API (while open) + offline SW + installable PWA (`8adfe9d`); P4 read-only ICS calendar import (url + file, proxy /api/ics) (`7e63ddd`); P5 Supabase cloud sync + magic-link auth BEHIND flag, off by default = no-op (`a7e6b81`). 447 tests green / tsc 0 / build ok. Morning checklist: docs/MORNING-2026-06-23.md (user enables Supabase w/ creds; VAPID push + Google 2-way + route A/B decision still pending).
- Honest threads: 4 goal-model iterations flagged as prioritization risk (internal structure vs user-visible value); told user bluntly the differentiator is the low-frequency "meaning" layer and can't replace the daily-loop basics. localStorage key still `lifeplanner.tree.v3`; all migrations lossless + idempotent.

### Errors / gotchas log
| Issue | Resolution |
|-------|-----------|
| dev server dies between turns | launch detached via Start-Process; or user runs it |
| dev `/` 404 after a build | clear `.next`, restart dev |
| messages.ts Chinese-comma keys | must be quoted; ASCII delimiters; no smart quotes as delimiters |
| predictAndCommit clobbers concurrent patches | bake the mutation into the working-tree snapshot (e.g. promoteInboxToLongGoal) |

## Session — 2026-06-23 (cont.) Expo Phase 2: mobile state layer + first real screens
Continued the app port (`docs/superpowers/plans/2026-06-23-expo-migration.md` Phase 2) while keeping web green. All new code lives under `mobile/` — `packages/core` and the web app are untouched by construction, so the web can't regress.
- **Dep**: `@react-native-async-storage/async-storage` via `npx expo install` (SDK 56-compatible, hoisted to root node_modules).
- **`mobile/src/lib/storage.ts`**: AsyncStorage tree repo (load/save/clear → Promise). Reuses core `normalizeLoadedTree` (校验 + 旧数据迁移) + same storage key `lifeplanner.tree.v3` as web → same jsonb shape for future Supabase sync.
- **`mobile/src/lib/api.ts`**: base-URL API client. Reads `EXPO_PUBLIC_API_BASE_URL`; `postJson` + `fetchGoalSuggestions`/`fetchGoalActions`; any failure/no-base → null/[] (offline-tolerant). RN never calls DeepSeek directly — always via Next `/api/*`.
- **`mobile/src/state/store.tsx`**: AppProvider + useApp (精简版 AppContext). Loads tree, bootstraps a starter tree (default Profile, areas=50) if none, persists on every change via treeRef snapshot. Mutators all reuse shared domain (`addLongGoal`/`addTask`/`addHabit`/`addLooseTask`/`completeAction`/`uncompleteAction`/`planToday`/`removeItem`/`removeGoalById`/`completeGoal`). Time (now/today) injected here — domain stays pure. `today` refreshes on AppState→active.
- **Screens**: `theme.ts` (Apple-white tokens + area colors) + `ui.tsx` (Card/Checkbox/Button/Input/Progress/Dot/Spinner, line-style, no emoji) + `TodayScreen` (today items + streak + toggle) + `GoalsScreen` (build long goal, area chips, add/complete/delete tasks, +今天, habits read-only, short-goals list, loose tasks, AI 建议目标 via backend). `App.tsx` = AppProvider + 今日/目标 bottom tabs + loading state.
- **Verify**: mobile `npx tsc --noEmit` clean + `npx expo export --platform ios` bundles 592 modules (proves shared TS core resolves through Metro). Web re-verified GREEN: tsc 0 / 464 vitest / next build ok / .next cleared.
- STILL TODO (Phase 3): expo-router nav; 人生树(react-native-svg)/选择面板/日历 screens; NativeWind; onboarding (replace bootstrap default Profile); Supabase auth+sync on RN. Bundling caveat: `@lifeplanner/core` ships raw `.ts` via the package `"./*"` exports map — Metro/babel-preset-expo transpiles it fine (confirmed).

## Session — 2026-06-23 (cont.) Expo Phase 3a: expo-router + prediction-tree screen (emulator-verified)
Continued the port; **verified live on the Android emulator (AVD `trippin`)**, not just tsc/bundle — user asked to use the emulator + TestFlight for testing.
- **Deps** (`npx expo install`): expo-router ~56.2.11 + react-native-safe-area-context + react-native-screens + react-native-svg + expo-linking + expo-constants. expo install auto-added the `expo-router` config plugin to app.json.
- **expo-router migration**: `main` → `expo-router/entry`; app.json `scheme: "lifeplanner"`; deleted old `index.ts` + `App.tsx`. New `app/` route tree: `app/_layout.tsx` (SafeAreaProvider + AppProvider + ready-gate Spinner + Stack), `app/(tabs)/_layout.tsx` (3 Tabs 今日/目标/人生树, line-dot icons, no emoji), `app/(tabs)/{index,goals,tree}.tsx` just re-export the screen components from `src/screens/` (components stay out of app/ per the building-native-ui skill). Screens gained `useSafeAreaInsets()` top padding (headers off).
- **`src/screens/TreeScreen.tsx`** (NEW, react-native-svg): read-only 人生树 on a dark media panel. Draws each LifePath as a composite-index-vs-age curve (averages the 5 area metrics per age — real data, not faked); 维持现状 = gray dashed, choice paths = colored + endpoint dot + feasibility %; gridlines 0/50/100 + age axis. Empty state when only status-quo. Adding branches (needs AI predictAndCommit) deferred — noted in UI.
- **Dropped NativeWind**: the building-native-ui skill says CSS/Tailwind unsupported, prefer inline styles → kept the existing StyleSheet/theme approach (lower risk).
- **Emulator verification** (screencap + adb): all 3 tabs render correctly — Today (title/date/streak/empty), Goals (area chips, composer, AI suggest, loose tasks), Tree (SVG dashed status-quo curve + 25/33/40岁 axis). Live interaction test: tapped into goal input, typed, hit 建立目标 → goal card appeared (violet 事业 dot, 0% bar, task input, 标记完成/删除目标) → proves store mutation + re-render + AsyncStorage persist on-device. (adb `input text` truncates at spaces — cosmetic, not an app bug.)
- **Verify**: mobile tsc clean + emulator render/interaction; web re-verified GREEN (tsc 0 / 464 vitest / next build ok / .next cleared). Note: an Expo dev server (Metro :8081) may be left running in background from this session.
- STILL TODO (Phase 3b+): 选择面板 + 日历 + 今日提醒 screens; onboarding (replace bootstrap default Profile); branch-add via AI on mobile; Supabase auth/sync on RN; reanimated/gesture drag; then EAS build → TestFlight.

## Session — 2026-06-23 (cont.) Expo Phase 3b: onboarding (real profile → tree)
User: "一个一个慢慢做" (do remaining Phase-3 pieces one at a time). First piece = onboarding so the tree has a real start instead of the bootstrap default.
- **store refactor**: dropped the auto-bootstrap default tree; `load` now leaves tree=null when no save (→ onboarding). Added `onboard(inputs: ProfileInputs)` = derive areas/snapshot via core `deriveAreas`/`buildSnapshot` → `createTree` → persist. `reset()` now clears + sets tree=null (back to onboarding). Exposed `ProfileInputs = Omit<Profile,"areas"|"snapshot">`. Fixed a pre-existing lint (writing `treeRef.current` during render → moved to an effect; check-edit hook caught it).
- **`src/screens/OnboardingScreen.tsx`** (NEW): 先认识一下你 form — name/age inputs, 学历/月收入/感情状态 option chips (from core profile option arrays), occupation/location/hobbies/crossroad; "生成我的人生树" (disabled until name+age valid). Rendered directly by the root gate when tree is null (not a route).
- **TreeScreen**: added a 重置全部数据 footer link (Alert confirm → reset) — real "start over" + lets onboarding be re-reached.
- **ui fix**: `Muted` style prop typed ViewStyle but renders Text → changed to TextStyle (textAlign now allowed).
- **Verify**: mobile tsc clean. Emulator: confirmed onboarding RENDERS (all fields/chips) and RESET routes tree→null→onboarding (proves gate + reset). The final 生成→regenerate I did NOT capture visually — adb couldn't reliably focus this RN multi-field form (text piled into the name field; age field tap missed). onboard() is a trivial createTree (tsc-checked, mirrors the proven Phase-2 bootstrap) → low risk; user can do the 10-sec fill+生成 themselves. Web re-verified GREEN (tsc 0 / 464 vitest / build ok). Note: Expo Metro (:8081) left running in background. (User then onboarded for real — confirmed age-22 tree generated, so onboard() works.)

## Session — 2026-06-23 (cont.) Expo Phase 3c: add life-choice branches on mobile (emulator-verified)
User on the tree screen: "点不开人生树啊" — it only showed 维持现状 because add-branch wasn't on mobile yet. Built it.
- **store**: import `addPath`/`removePath` from core tree; added `addChoiceBranch(label)` = `addPath(tree, label, localGenerator, now)` (offline, deterministic, no backend) + `removeBranch(pathId)` = `removePath`. Both via the single-snapshot `commit`.
- **TreeScreen**: "加一条人生选择" composer (Input + 推演这条路) → addChoiceBranch + clear; each choice card got a 删除这条路 (Alert confirm → removeBranch); updated empty-state copy (offline now grows branches; AI enrichment later).
- **Emulator verified LIVE**: typed "Go-startup" → submitted via keyboard ✓ → tree grew a pink rise-steep curve above the gray status-quo dashed line + a choice card "Go-startup · 约 50%" with summary "公司活下来了，J 成了真正的创始人" (localGenerator personalized with profile name initial) + feasibility note + delete link. Composer cleared. The differentiator (multi-path tree) now works on mobile.
- Note: localGenerator DOES set feasibility (50% here) — offline branches show 约 X%.
- **Verify**: mobile tsc clean; emulator live add-branch works; only mobile/ changed (web untouched), web tsc clean. (Full web green ran for 3b just prior.)
- STILL TODO: AI-enriched branches (call /api/enrich when backend set, replacing the generic local prediction); 选择面板 + 日历 screens; Supabase auth/sync on RN; EAS→TestFlight.
