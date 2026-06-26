# Mobile Depth Pass Implementation Plan

> **For agentic workers:** implement task-by-task; each task ends green (`cd mobile && npx tsc --noEmit`; web `/green` when core is touched) + a commit. Steps use `- [ ]`.

**Goal:** Add to the mobile app: a full path-detail page (metrics + 3 scenarios with odds + timeline + feasibility + chat), tap-node-to-fork, a duration slider, a calendar day-schedule list, and short-goal due dates shown on the calendar.

**Architecture:** Reuse the shared pure core (`@lifeplanner/core`) for all data/geometry/odds; mobile renders with react-native-svg + expo-router. Two new pure core helpers (scenario odds, goals-due-on) are TDD'd. Mobile screens/components consume them.

**Tech Stack:** Expo SDK 56, react-native-svg, @react-native-community/datetimepicker (already in deps), @react-native-community/slider (NEW), expo-router.

Source spec: `docs/superpowers/specs/2026-06-26-mobile-tree-depth-calendar-design.md`.

## File structure
- `packages/core/src/scenarioOdds.ts` (NEW, pure) + `__tests__/scenarioOdds.test.ts`
- `packages/core/src/goals.ts` (MODIFY: add `goalsDueOn`) + extend `__tests__/goals.test.ts`
- `mobile/src/state/store.tsx` (MODIFY: `addScenario`, `addChoiceBranchAt`, extend `addShortGoalToLong`)
- `mobile/src/components/MetricChart.tsx` (NEW)
- `mobile/app/path/[pathId].tsx` (NEW — detail page)
- `mobile/src/screens/TreeScreen.tsx` (MODIFY: curve→detail, node→fork sheet)
- `mobile/src/components/TimePickSheet.tsx` (MODIFY: duration slider)
- `mobile/src/screens/MonthScreen.tsx` + `mobile/src/components/calendar.tsx` (MODIFY: day list + due markers)
- `mobile/src/screens/GoalsScreen.tsx` (MODIFY: short-goal due date)

---

### Task 1 — Core: scenario odds (F1b)
**Files:** Create `packages/core/src/scenarioOdds.ts`, `packages/core/src/__tests__/scenarioOdds.test.ts`

- [ ] Test: `scenarioOdds(f)` returns ints summing to 100, 中性 dominant; `scenarioOdds(50)→{optimistic:20,likely:60,conservative:20}`, `scenarioOdds(80)→{optimistic:30,likely:60,conservative:10}`, `scenarioOdds(20)→{optimistic:10,likely:60,conservative:30}`; clamps out-of-range; `undefined`→treat as 50.
- [ ] Implement:
```ts
import type { Scenario } from "./types";
export type ScenarioOdds = Record<Scenario, number>; // optimistic+likely+conservative=100
const round5 = (n: number) => Math.round(n / 5) * 5;
export function scenarioOdds(feasibility?: number): ScenarioOdds {
  const f = Math.max(0, Math.min(100, feasibility ?? 50)) / 100;
  const optimistic = round5(40 * f);
  const conservative = round5(40 * (1 - f));
  const likely = 100 - optimistic - conservative; // 中性吃舍入余量,始终占大头
  return { optimistic, likely, conservative };
}
```
- [ ] Verify: `npx vitest run scenarioOdds` PASS. Commit `feat(core): scenarioOdds (3 scenarios sum to 100, 中性 dominant)`.

### Task 2 — Core: goalsDueOn (F5)
**Files:** Modify `packages/core/src/goals.ts` (+ test)

- [ ] Test: `goalsDueOn(tree, "2026-07-26")` returns goals whose `endDate === date`; ignores goals without endDate; returns `[]` for none.
- [ ] Implement (append to goals.ts), using existing `goalsOf`/tree.goals:
```ts
export function goalsDueOn(tree: LifeTree, date: string): Goal[] {
  return (tree.goals ?? []).filter((g) => g.endDate === date);
}
```
- [ ] Verify vitest + **web `/green`** (core touched). Commit `feat(core): goalsDueOn(tree,date)`.

### Task 3 — Store methods (mobile)
**Files:** Modify `mobile/src/state/store.tsx`

- [ ] Import `addScenarioVariant` from core tree; import `scenarioOdds`-not-needed-here. Add to interface + impl + value + deps:
```ts
const addScenario = useCallback((basePathId: string, scenario: Scenario) => {
  const cur = treeRef.current; if (!cur) return;
  commit(addScenarioVariant(cur, basePathId, scenario, localGenerator, nowISO()));
}, [commit]);

const addChoiceBranchAt = useCallback((parentPathId: string, forkAge: number, label: string) => {
  const cur = treeRef.current; if (!cur || !label.trim()) return;
  const next = addPath(cur, label.trim(), localGenerator, nowISO(), { parentId: parentPathId, forkAge });
  const np = next.paths[next.paths.length - 1];
  commit(next);
  if (hasBackend()) { setEnriching(true); void enrichPath(next, np).then(r => { if(!r) return; const t=treeRef.current; if(!t) return; commit({...t, paths: t.paths.map(p=>p.id===np.id?applyEnrichToPath(p,r):p)}); }).catch(()=>{}).finally(()=>setEnriching(false)); }
}, [commit]);
```
- [ ] Extend `addShortGoalToLong(longId, title, endDate?)` → pass `endDate` into `domainAddShortGoal(cur, longId, { area, title, endDate }, nowISO())`. Update interface signature.
- [ ] Verify `mobile tsc`. Commit `feat(mobile/store): addScenario, addChoiceBranchAt, short-goal endDate`.

### Task 4 — MetricChart (F1)
**Files:** Create `mobile/src/components/MetricChart.tsx`

- [ ] Small RN-svg line chart: props `{ label: string; points: {age,value}[]; color: string }`. Card (white, radii.md), label, a ~64px-tall svg line (value 0-100 → y), min/max age → x. No animation. Empty points → flat baseline.
- [ ] Verify mobile tsc. Commit `feat(mobile): MetricChart mini area-line`.

### Task 5 — Path detail page (F1 + F1b)
**Files:** Create `mobile/app/path/[pathId].tsx`; Modify `TreeScreen.tsx` (curve tap → `/path/`+id)

- [ ] Detail page: `useLocalSearchParams` pathId; `useApp()` tree + `addScenario`; find path; not-found guard.
  - Header: color dot + choiceLabel + summary + endValue/100 + disclaimer.
  - Feasibility (choice only): `effectiveFeasibility(tree,path)` from `@lifeplanner/core/feasibility` → 约X% + note + 起步/你的行动+bump + AI 粗估.
  - Scenario toggle (choice only): segmented 乐观/中性/保守, each with `scenarioOdds(effFeas?.value ?? path.feasibility)` % under label + 「概率为 AI 粗估」. onPress: if variant exists (match choiceLabel+parentId+scenario) → `router.replace('/path/'+variant.id)`; else `addScenario(path.id, scenario)`.
  - Metrics: `LIFE_AREAS.map` → `<MetricChart label={AREA_LABELS[a]} points={path.metrics[a]} color={path.color}/>`.
  - Timeline: `path.nodes.map` → 年龄 + mood 徽标(MOOD_COLOR/LABEL) + title + story + dimensions(DIMENSION_LABELS).
  - Footer: 「和 {futureAgeOf(path)} 岁的你聊聊」→ `router.push('/chat/'+path.id)`.
- [ ] TreeScreen: change the curve hit `onPress` from `router.push('/chat/'+p.id)` to `router.push('/path/'+p.id)`.
- [ ] Verify mobile tsc + emulator (tap curve → detail renders, scenario switch works). Commit `feat(mobile): path detail page (metrics+scenarios+odds+timeline+chat)`.

### Task 6 — Tap node to fork (F2)
**Files:** Modify `mobile/src/screens/TreeScreen.tsx`

- [ ] Give each non-first node `Circle` an `onPress` → `setForkSheet({ parentId: p.id, age: n.age })`.
- [ ] Add a small Modal: title「在这里加一条岔路({age} 岁)」+ Input + 确定 → `app.addChoiceBranchAt(forkSheet.parentId, forkSheet.age, text)` + close.
- [ ] Verify mobile tsc + emulator (tap node → sheet → new branch forks at that node). Commit `feat(mobile): tap tree node to fork a branch there`.

### Task 7 — Duration slider (F3)
**Files:** Modify `mobile/src/components/TimePickSheet.tsx`; add dep

- [ ] `npx expo install @react-native-community/slider`; then `npx expo install --check` (must stay clean).
- [ ] Replace the `DURATIONS` chips block with `<Slider minimumValue={15} maximumValue={240} step={15} value={dur} onValueChange={setDur} minimumTrackTintColor={colors.accent} .../>` + label「时长 {dur>=60?`${dur/60} 小时`:`${dur} 分钟`}」. Keep the wheel + 确定.
- [ ] Verify mobile tsc + emulator. Commit `feat(mobile): duration slider in time picker`.

### Task 8 — Calendar day list + due markers (F4 + F5 display)
**Files:** Modify `mobile/src/screens/MonthScreen.tsx`, `mobile/src/components/calendar.tsx`

- [ ] `MonthView`: add optional `dueOf?: (date:string)=>boolean` prop; render a distinct marker (amber ring/dot) on due days, alongside the density dot. `onPickDay` keeps firing (selection).
- [ ] `MonthScreen`: local `selected` state (default today). `onPickDay` → `setSelected(d)` (NOT navigate). Below the grid render the selected day's list:
  - timed: `app.actionsOn(selected).filter(a=>a.item.startTime).sort` → time + AreaTile + title.
  - due goals: `goalsDueOn(tree, selected)` → 「『title』到期」(red if `selected < today`).
  - empty → 「这天还没有安排」.
  - 「在这天安排 ＋」→ `app.setViewDate(selected); router.navigate('/')`.
  - pass `dueOf={(d)=> goalsDueOn(app.tree, d).length>0}` to MonthView.
- [ ] Verify mobile tsc + emulator. Commit `feat(mobile): calendar lists selected-day schedule + goal-due markers`.

### Task 9 — Short-goal due date (F5 set)
**Files:** Modify `mobile/src/screens/GoalsScreen.tsx`

- [ ] In the 阶段目标 add-row: a「到期日」pill → opens a `DateTimePicker` (mode="date", Modal popup like onboarding); store `shortDue` per goal id (or a single transient). On submit pass to `app.addShortGoalToLong(goal.id, title, due)`. Clear after.
- [ ] Existing shorts display: append「· 到期 M月D日」when `s.endDate` set.
- [ ] Verify mobile tsc + emulator. Commit `feat(mobile): set short-goal due date`.

### Task 10 — Verify + build
- [ ] `cd mobile && npx tsc --noEmit` clean; web `/green` (core was touched in T1/T2).
- [ ] Emulator smoke: detail page, scenario odds sum 100, node-fork, slider, calendar day list + due marker, short-goal due date.
- [ ] `eas build -p ios --profile production --auto-submit --non-interactive --no-wait`; monitor; report build number + morning-style note.

## Self-review
- Spec coverage: F1=T4+T5, F1b=T1+T5, F2=T6, F3=T7, F4=T8, F5=T2+T8+T9. ✓ all mapped.
- Placeholders: none — code shown for the non-trivial bits.
- Type consistency: `addChoiceBranchAt(parentPathId, forkAge, label)`, `addScenario(basePathId, scenario)`, `addShortGoalToLong(longId, title, endDate?)`, `scenarioOdds(feasibility?)→Record<Scenario,number>`, `goalsDueOn(tree,date)→Goal[]` used consistently across tasks.
