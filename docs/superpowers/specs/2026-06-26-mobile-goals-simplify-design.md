# Spec — 手机端目标简化:拍扁成 目标 → 任务(2 概念)

Date: 2026-06-26
Scope: **mobile only**, presentation/IA change. No domain data-model change; web untouched. Reuses `@lifeplanner/core`.

## Why
The 4-tier model (长期目标 → 短期目标 → 每日任务 + 习惯) is too heavy on a phone — too many layers, crowded screen, many creation steps, too many concepts. Route A positions this as a life-direction/prediction tool where daily execution is the *supporting* layer; deep goal nesting fights that. Simplify mobile to **2 concepts: 目标 / 任务**, keeping the loop (目标 → 任务 → 完成 → 进度 → 可行度 → 岔路) intact.

## Decisions (approved)
- **Drop short goals (阶段目标) from mobile UI.** Data model keeps `kind:"short"` (web still uses it; cloud sync round-trips it). Mobile simply does not show or create them.
- **Merge habits into "repeating tasks" (A1).** No separate 习惯 concept on mobile. Adding a task offers 重复:无 / 每天 / 每周. 无 → `Task`; 每天/每周 → `Habit` (existing types, unchanged). Lists show tasks + habits unified, repeating ones tagged 「每天/每周」.
- **Due date moves to the goal itself.** A (long) goal gets an optional `endDate`; calendar markers/day-list keep working (`goalsDueOn` already scans all goals' endDate).

## Mobile Goals screen (new shape)
Build-goal card (top):
- area chips + title input + optional 到期日 pill (native date picker, same modal pattern as onboarding) + 建立目标.
- 「AI 建议目标」unchanged.

Each goal card:
- Dot + title + progress% + `Progress` bar (`app.progressOf`).
- 到期日 pill: shows 「到期 M月D日」when set, else 「设到期日」; tap → date picker → `setGoalDueDate(goal.id, ymd)`. (Overdue past today → red.)
- why (if any).
- **Unified 任务 list** = `goal.tasks` (one-off) + `goal.habits` (repeating), rendered together:
  - row: `Checkbox`(complete) + text + repeat tag 「每天」/「每周」 for habits + 「今天」(one-off tasks only → `planTaskToday`) + 「删」(`removeItem`).
  - completion: tasks via `toggleTaskDone`; habits via `toggleTodayDone`/the existing per-day toggle (whatever the goal screen used before for habits — keep that path; habits were read-only before, now they get a checkbox that toggles today).
- Add-task row: `Input` + a 重复 segmented control (无 / 每天 / 每周) + ＋.
  - 无 → `addTaskToGoal(goal.id, text)`; 每天 → `addHabitToGoal(goal.id, text, "daily")`; 每周 → `addHabitToGoal(goal.id, text, "weekly")`.
- 完成目标 / 删除目标 (unchanged).
- **Removed:** the entire 阶段目标 (short-goal) section — its add-row, due picker, list, and the `shortInputs`/`shortDue`/`duePicker` state tied to shorts. (The goal-level due picker reuses a similar date-picker modal.)

## Store changes (`mobile/src/state/store.tsx`)
- `addLongGoal(area, title, why?, endDate?)` — pass `endDate` into `domainAddLongGoal(tree, { area, title, why, endDate }, now)`.
- `setGoalDueDate(goalId, endDate?: string)` — `updateGoalById(tree, goalId, { endDate })` (import `updateGoalById` from core goalTree). Passing `undefined` clears it.
- `addTaskToGoal`, `addHabitToGoal`, `toggleTaskDone`, `planTaskToday`, `removeItem`, `progressOf` — already exist, reused.
- `addShortGoalToLong` — keep in store (web parity / future) but **no longer called by mobile UI**. Same for `shortGoalsOf`/`standaloneShortGoals` (unused on mobile now; leave, low-risk).

## Calendar (no change needed)
`MonthScreen` already lists `goalsDueOn(tree, date)` and `MonthView` marks due days — these scan ALL goals' `endDate`, so long-goal due dates show automatically once goals carry `endDate`. Verify a long goal with a due date appears.

## Home timeline (tiny polish, optional)
The day timeline currently tags habit rows 「· 习惯」. To match the new vocabulary, change that meta to 「· 每天」/「· 每周」(read `a.item.repeat`). Optional; not required for the model change.

## Acceptance
- Goals screen shows only 目标 + a unified 任务 list; no 阶段目标 anywhere.
- Adding a task with 重复=每天/每周 creates a repeating task (Habit) shown with the right tag; 无 creates a one-off task.
- A goal can be given a 到期日 on create and via the pill later; it shows on the goal card and on the 月历 (marker + selected-day 「到期」, overdue red).
- Completing tasks still moves goal progress (loop intact). Existing data with short goals doesn't crash mobile (shorts just hidden).
- `cd mobile && npx tsc --noEmit` clean. (No core change ⇒ web `/green` not required, but run if any core file is touched.)

## Out of scope (explicit)
- Goal↔path linking (making a completed goal actually push a *specific* branch's feasibility on mobile) — separate discussion.
- Web client (keeps full nesting). Decision/计划 subsystem. Cloud login.
