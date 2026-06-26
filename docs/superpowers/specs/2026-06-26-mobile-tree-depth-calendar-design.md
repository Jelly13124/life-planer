# Spec — 手机端深度 pass:岔路详情 / 节点加岔路 / 时长滑块 / 日历当日安排 / 短期目标到期

Date: 2026-06-26
Scope: **mobile only** (Expo app). Reuses the shared pure core (`@lifeplanner/core`); no web changes except possibly hoisting a pure helper. No login/cloud work.

## Goal
Bring the mobile app to parity-depth on the prediction loop + calendar:
1. Tap a tree path → a full **prediction detail** page (metrics + 3 scenarios + timeline + feasibility + chat).
2. Tap a tree **node** → add a fork there.
3. Time picker: duration via **slider** (not chips).
4. Calendar (月历) lists the **selected day's schedule**.
5. Short goals get a **due date** that shows on the calendar.

Constraints (repo rules): domain stays pure/deterministic (no `Date.now`/`Math.random`/argless `new Date` in `src/domain`/core; time injected at the state/screen layer). Every user-facing string via existing zh copy. Theme via tokens (`colors`, `radii`, `AREA_COLORS`). Icons = MaterialCommunityIcons, no emoji. Verify gate: `cd mobile && npx tsc --noEmit` (+ web `/green` if core touched).

---

## F1 — 岔路详情页(完整预测展示)

New route: `mobile/app/path/[pathId].tsx` (expo-router), pushed from the tree.

**Navigation change**: in `TreeScreen`, tapping a path **curve** now `router.push('/path/'+id)` (was `/chat/`). The detail page has the chat entry inside it.

**Content** (mirror web `src/components/PathDetail.tsx`, prediction parts only):
- Header: color dot + `choiceLabel` + `summary` + 综合人生指数 `path.endValue`/100 + disclaimer line「这是一种可能的人生,不是预测…」.
- 现实可行度: `effectiveFeasibility(tree, path)` from `@lifeplanner/core/feasibility` → 约 X%(round to 5)+ `feasibilityNote` + 起步 baseline% + 你的行动 +bump%(if >0)+「AI 粗估,非精确概率」. Only for `kind==="choice"` with a value.
- 三情景切换(see F1b).
- 五领域指标小曲线: new RN `MetricChart` (see below), one per `LIFE_AREAS`, fed `path.metrics[area]`.
- 关键时刻时间线: `path.nodes` → 年龄 + 心情徽标(high高光/mid平稳/low低谷,颜色 MOOD_COLOR)+ 标题 + 故事 + 维度标签(`DIMENSION_LABELS`).
- 底部:「和 {futureAgeOf(path)} 岁的你聊聊」→ `router.push('/chat/'+id)`.
- **Out of scope this round**: 把这条路变成计划/决定/复盘、补充信息重推。

**New component** `mobile/src/components/MetricChart.tsx`: small react-native-svg line chart of `{age,value}[]` (one area), path color, ~ compact card. Deterministic, no animation required.

**Edge**: path not found → 「这条路找不到了」+ 返回. status-quo path → no feasibility / no scenarios (still show metrics + timeline).

## F1b — 三情景可能性比率(和 = 100%)

New: each scenario shows a likelihood % and the three sum to 100. Deterministic + honest (not a precise probability claim).

**Source formula** (pure helper, e.g. add to core `feasibility.ts` or a new pure module `scenarioOdds.ts`, TDD'd):
- `f = clamp(effectiveFeasibility.value ?? path.feasibility ?? 50, 0, 100) / 100`
- raw: **中性 = 60**(占大头), 乐观 = 40·f, 保守 = 40·(1−f)
- round each to nearest 5; adjust 中性 by the rounding remainder so the three sum to exactly 100.
- Returns `{ optimistic, likely, conservative }` integers summing to 100. 中性 is always the largest.
- Examples: f=.5 → 乐观20·中性60·保守20; f=.8 → 乐观30·中性60·保守10; f=.2 → 乐观10·中性60·保守30.

**UI**: the scenario toggle (segmented 乐观/中性/保守) shows each label with its % under it. A line「概率为 AI 粗估,非精确」. Switching: if a variant for that scenario exists (match by choiceLabel+parentId+scenario) → open it; else generate via `addScenarioVariant` (store method, local-instant).

> Tunable: 中性 base = 60 (most-likely dominates; the other 40 splits by feasibility). Easy to change later.

## F2 — 点关键节点加岔路

In `TreeScreen` map: **curve tap = open detail (F1); node tap = fork here.**
- Each node circle gets its own `onPress` (separate hit target from the curve's transparent hit-path). First node (the fork origin) is not tappable for fork.
- Tapping a node opens a small input sheet (Modal): 「在这里加一条岔路({age} 岁)」 + text input + 确定.
- Confirm → `store.addChoiceBranchAt(parentPathId, forkAge, label)` → `addPath(tree, label, localGenerator, now, { parentId: parentPathId, forkAge })` (core already supports `opts.parentId`/`opts.forkAge`). If backend, async enrich like `addChoiceBranch` (reuse the same `.catch()`-guarded enrich path).
- The composer「加一条人生选择」(forks from now) stays.

## F3 — 时长滑块

In `TimePickSheet`: replace the `DURATIONS` chips row with a slider.
- Dep: `@react-native-community/slider` (install via `npx expo install`; then run `expo install --check` per the dep-alignment rule before any EAS build).
- Range 15–240 min, step 15. Value label「时长 {fmt}」(分钟 / 小时, e.g. 1.5 小时).
- Start-time wheel unchanged. `onConfirm(start, durationMin)` unchanged.

## F4 — 日历列出当天安排

`MonthScreen`:
- Tapping a day in `MonthView` now **selects** it (state in MonthScreen), does NOT navigate home.
- Below the grid: a list for the selected day —
  - timed actions: `actionsOn(date)` filtered to those with `startTime`, sorted, showing time + title (+ area tile).
  - untimed scheduled actions for that day (if any): listed under「未定时」.
  - goal deadlines that day (F5): 「『目标名』到期」(overdue past days shown red).
  - empty → 「这天还没有安排」.
- A 「在这天安排 ＋」button → `setViewDate(date)` + `router.navigate('/')` (so adding still routes to the home timeline for that day).
- Default selected day = `today`. Selecting a day in another month via `onShiftMonth` keeps behavior.

## F5 — 短期目标到期日 + 上日历

- **Set**: `GoalsScreen` 阶段目标 add-row gains an optional 到期日 control (a small「到期日」pill → native date picker, same `DateTimePicker` modal pattern as onboarding wake/sleep; `mode="date"`). Clears to「无」.
- **Store**: `addShortGoalToLong(longId, title, endDate?)` passes `endDate` into domain `addShortGoal(tree, longId, { area, title, endDate }, now)` (input already supports `endDate`).
- **Domain helper** (pure, in core `goals.ts` or `calendar.ts`, TDD'd): `goalsDueOn(tree, date) → Goal[]` (goals with `endDate === date`). Optionally `goalsDueInMonth` for the grid markers.
- **Calendar display**:
  - `MonthView` marks days with a due goal using a distinct marker (e.g., a small ring/amber dot separate from the density dot) — pass a `dueOf(date)→boolean` (or count) prop, mirroring `densityOf`.
  - Selected-day list shows the due goals (overdue = red).
- Existing short goals display in GoalsScreen also shows「· 到期 M月D日」when `endDate` set.

---

## New / changed surface

**New files**
- `mobile/app/path/[pathId].tsx` — detail page (F1).
- `mobile/src/components/MetricChart.tsx` — RN per-area mini line chart (F1).
- (maybe) `packages/core/src/scenarioOdds.ts` + test — 3-scenario odds (F1b). Or fold into `feasibility.ts`.

**Store (`mobile/src/state/store.tsx`) new methods**
- `addScenario(basePathId, scenario)` → `addScenarioVariant(tree, basePathId, scenario, localGenerator, now)`; commit; (optional) enrich.
- `addChoiceBranchAt(parentPathId, forkAge, label)` → `addPath(..., {parentId, forkAge})` + guarded enrich.
- `addShortGoalToLong(longId, title, endDate?)` — extend existing signature with `endDate`.

**Core (pure, TDD)**
- `goalsDueOn(tree, date)` (+ month variant) — F5.
- scenario-odds helper — F1b. (Touching core → run web `/green`.)

**Deps**
- `@react-native-community/slider` (Expo-managed). Re-run `expo install --check`.

## Acceptance
- Tap curve → detail page renders header/feasibility/scenarios(with %)/5 metric charts/timeline/chat; status-quo degrades gracefully.
- Scenario switch generates/opens variants; the three %s sum to 100 and shift with feasibility.
- Tap node → fork sheet → new branch forks at that node's age; appears on the tree.
- Time picker duration is a slider; confirm still schedules correctly.
- Month tab: tap day → inline schedule list (timed + due goals); 「在这天安排」routes home to that day.
- Short goal with a due date shows on the calendar (grid marker + selected-day list, overdue red) and in the goal card.
- `mobile tsc` clean; web `/green` if core touched; verified on emulator; lands in the next TestFlight build.

## Out of scope (explicit)
Decision/计划/复盘 subsystem, 补充信息重推, cloud login/sync, web mobile-responsive, mobile habits-management/insights/我-settings. (Backlog.)
