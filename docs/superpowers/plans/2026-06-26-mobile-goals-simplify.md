# Mobile Goals Simplification Implementation Plan

> **For agentic workers:** implement task-by-task; each ends green (`cd mobile && npx tsc --noEmit`) + a commit. Steps use `- [ ]`.

**Goal:** Flatten the mobile goals UI to 2 concepts — 目标 / 任务 — by dropping the short-goal tier, merging habits into "repeating tasks", and moving the due date to the goal itself. Domain unchanged.

**Architecture:** Mobile presentation/IA change only. Tasks+Habits render in one list; the add-task row offers 重复(无/每天/每周) mapping to the existing `Task`/`Habit` types. Short-goal UI removed (data kept for web). Goal gets an optional `endDate` (already a field) via `addLongGoal`/`updateGoalById`.

**Tech Stack:** Expo RN, @lifeplanner/core, @react-native-community/datetimepicker.

Source spec: `docs/superpowers/specs/2026-06-26-mobile-goals-simplify-design.md`.

## File structure
- `mobile/src/state/store.tsx` — `addLongGoal` gains `endDate?`; new `setGoalDueDate`; import `updateGoalById`.
- `mobile/src/screens/GoalsScreen.tsx` — unified task list + repeat toggle + goal-level due; remove short-goal section.
- `mobile/src/screens/ScheduleScreen.tsx` (optional, T3) — timeline habit meta 「习惯」→「每天/每周」.

---

### Task 1 — Store: goal-level due date
**Files:** `mobile/src/state/store.tsx`

- [ ] Import `updateGoalById` from core tree adapters: add `updateGoalById as domainUpdateGoalById,` to the existing `from "@lifeplanner/core/goalTree"` import block.
- [ ] Extend `addLongGoal` signature + impl:
```ts
// interface:
addLongGoal: (area: GoalArea, title: string, why?: string, endDate?: string) => void;
// impl:
const addLongGoal = useCallback(
  (area: GoalArea, title: string, why?: string, endDate?: string) => {
    const cur = treeRef.current;
    if (!cur || !title.trim()) return;
    const { tree: next } = domainAddLongGoal(cur, { area, title: title.trim(), why, endDate }, nowISO());
    commit(next);
  },
  [commit],
);
```
- [ ] Add `setGoalDueDate` (after addLongGoal): interface `setGoalDueDate: (goalId: string, endDate?: string) => void;`, impl:
```ts
const setGoalDueDate = useCallback(
  (goalId: string, endDate?: string) => {
    const cur = treeRef.current;
    if (!cur) return;
    commit(domainUpdateGoalById(cur, goalId, { endDate }));
  },
  [commit],
);
```
- [ ] Add `setGoalDueDate` to the value object and the deps array (next to `addLongGoal`).
- [ ] Verify: `cd mobile && npx tsc --noEmit` → clean. Commit `feat(mobile/store): goal-level due date (addLongGoal endDate + setGoalDueDate)`.

### Task 2 — GoalsScreen: 2-concept rewrite
**Files:** `mobile/src/screens/GoalsScreen.tsx`

The screen keeps: build-goal card (area chips + title + AI suggest), goal cards (dot+title+progress, why, complete/delete). Changes below.

- [ ] **Build-goal due date:** add a 到期日 pill next to 建立目标 that opens the date picker (reuse the existing `duePicker`/`shortDue` date-picker machinery, but keyed to a special id e.g. `"__new__"`); on 建立目标 pass it: `app.addLongGoal(area, title, undefined, newDue)` then clear. (Keep the existing native date-picker modal block; it already handles Android dialog + iOS spinner.)
- [ ] **Per-goal due pill:** in each goal card header row, after the title/percent, add a pill showing `goal.endDate ? \`到期 ${fmtMD(goal.endDate)}\` : "设到期日"` (red if `goal.endDate < app.today`); tap → open date picker keyed to `goal.id`; onChange → `app.setGoalDueDate(goal.id, ymd(dt))`. (Reuse fmtMD/ymd already in the file.)
- [ ] **Unified task list (merge habits):** replace the separate `goal.tasks.map(...)` and `goal.habits.map(...)` blocks with ONE section "任务":
  - tasks (one-off): `Checkbox`(checked=task.done, onPress=toggleTaskDone) + text(strikethrough if done) + `今天`(planTaskToday, if !done) + `删`(removeItem).
  - habits (repeating): a small 「每天」/「每周」tag (from `habit.repeat`) + text + `删`(removeItem). NO completion checkbox here (recurring → checked off on 首页). Keep a left dot/indicator for visual parity.
  - Render tasks first, then habits, in the same list container.
- [ ] **Add-task row with repeat toggle:** the existing add-row (Input + ＋) gains a 重复 segmented control (无/每天/每周) — three small pills before ＋. State: `taskRepeat: Record<string,"none"|"daily"|"weekly">` default "none". On ＋ / submit:
```ts
const submitTask = (goalId: string) => {
  const text = (taskInputs[goalId] ?? "").trim();
  if (!text) return;
  const rep = taskRepeat[goalId] ?? "none";
  if (rep === "none") app.addTaskToGoal(goalId, text);
  else app.addHabitToGoal(goalId, text, rep);
  setTaskInput(goalId, "");
};
```
- [ ] **Remove short goals:** delete the entire 阶段目标 block (the `<View style={styles.shortsWrap}>…` with shorts list + add-row + due pill) and the now-unused state `shortInputs`, `shortDue` (keep `duePicker`/`ymd`/`fmtMD` — reused for goal due dates), `setShortInput`, `submitShort`. Remove the `shorts`/`app.shortGoalsOf` usage in the card. Remove unused styles (shortsWrap/shortsLabel/shortRow/shortText/shortDueText) if no longer referenced.
- [ ] **Date-picker reuse:** the `onPickDue` handler now writes to either the new-goal due (`__new__`) or a goal's due (`setGoalDueDate`). Keep a single `duePicker: string | null` (holds the goal id or `"__new__"`) + a `newDue` string state; `onPickDue` sets `newDue` when `duePicker === "__new__"`, else calls `app.setGoalDueDate(duePicker, ymd(dt))`.
- [ ] Verify: `mobile tsc` clean + emulator: goals screen shows only 目标 + unified 任务 list; adding 重复=每天 makes a tagged repeating task; goal due pill sets a date. Commit `feat(mobile): flatten goals to 目标→任务 (drop short goals, merge habits, goal due date)`.

### Task 3 — Home timeline meta (optional polish)
**Files:** `mobile/src/screens/ScheduleScreen.tsx`
- [ ] In the timeline row meta, change the `habit ? " · 习惯"` suffix to read the repeat: `habit ? (a.item.repeat === "weekly" ? " · 每周" : " · 每天") : ""`. (Confirm `a.item` is a Habit with `.repeat` in that branch; if not typed, guard.)
- [ ] Verify mobile tsc. Commit `polish(mobile): timeline shows 每天/每周 instead of 习惯`.

### Task 4 — Verify + build
- [ ] `cd mobile && npx tsc --noEmit` clean. (No core change → web /green not required.)
- [ ] Emulator smoke: create a goal with a due date; add a one-off task (checkbox) + a 每天 repeating task (tag); confirm no 阶段目标 anywhere; 月历 shows the goal's due marker + 「到期」.
- [ ] `eas build -p ios --profile production --auto-submit --non-interactive --no-wait`; monitor; report build number.

## Self-review
- Spec coverage: drop short goals = T2; merge habits = T2 (list + repeat toggle); goal-level due = T1+T2; calendar unchanged (verified T4); home polish = T3 (optional). ✓
- Placeholders: none — code shown for store + submit + handlers.
- Type consistency: `addLongGoal(area,title,why?,endDate?)`, `setGoalDueDate(goalId, endDate?)`, `addHabitToGoal(goalId,text,"daily"|"weekly")` (existing), `taskRepeat` values "none"|"daily"|"weekly", `duePicker: string|null` holds goal id or `"__new__"`. Consistent.
