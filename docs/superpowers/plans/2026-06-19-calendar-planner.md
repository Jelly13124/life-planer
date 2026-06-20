# 日历规划首页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Each implementer subagent should READ the current target files first (the codebase shifted during prior work) and apply the changes; signatures below are current as of this plan.

**Goal:** Replace the home screen with a split view — left a navigable month calendar where actions get scheduled onto days (desktop drag + mobile tap-to-assign), right the existing goals progress + mini life-tree "you are here" + streak/heatmap.

**Architecture:** A pure `src/domain/calendar.ts` (month grid + which actions fall on a day) layered on the existing `daily.ts`; two new optional `GoalAction` fields (`scheduledDate`, `repeatWeekday`); AppContext gains `scheduleAction`/`toggleActionOn` and extends repeat-setting to anchor a weekday; a `MonthCalendar` component + a `CalendarPlannerScreen` that becomes the `dashboard` view. No new deps. No external calendar sync / push / time-blocking / complex recurrence / timezones.

**Tech Stack:** Next.js 16 / React 19 / TS / Tailwind v4 / Vitest 4. Constraints: domain pure (no Date.now/Math.random; today injected); render-time no `new Date()` (module boot value + effect refresh); Chinese strings contain no ASCII double quotes; new UI strings get EN in `src/i18n/messages.ts`.

---

## File Structure

- Modify `src/domain/types.ts` — `GoalAction` gets `scheduledDate?` + `repeatWeekday?` (optional → no migration).
- Create `src/domain/calendar.ts` — pure: `weekdayOf`, `monthGrid`, `actionsOnDay`, `unscheduledActions`, `setActionScheduledDate`.
- Create `src/domain/__tests__/calendar.test.ts`.
- Modify `src/state/AppContext.tsx` — `scheduleAction`, `toggleActionOn`; extend `setActionRepeatById` to set/clear `repeatWeekday`.
- Modify `src/domain/goals.ts` — `setActionRepeat` clears/sets `repeatWeekday` when toggling weekly (keep signature back-compatible).
- Create `src/components/MonthCalendar.tsx` — the left month grid (nav, cells, chips, desktop DnD drop, mobile tap-assign) + unscheduled tray + day panel.
- Create `src/components/CalendarPlannerScreen.tsx` — split-view home; left = MonthCalendar; right = goals progress + mini-tree markers + streak/heatmap (reuses LifeMap + daily fns).
- Modify `src/app/page.tsx` — render `CalendarPlannerScreen` for the `dashboard` view.
- Modify `src/i18n/messages.ts` — EN for new strings.

---

## Task 1: GoalAction gains scheduledDate + repeatWeekday

**Files:** Modify `src/domain/types.ts`

- [ ] **Step 1: Edit GoalAction**

Find `export interface GoalAction { ... }` (currently `{ id; text; done; repeat?: "daily" | "weekly" }`) and change to:
```ts
export interface GoalAction {
  id: string;
  text: string;
  done: boolean;
  repeat?: "daily" | "weekly";
  scheduledDate?: string;   // 一次性行动排到的本地日 YYYY-MM-DD（未排期则无）
  repeatWeekday?: number;   // 仅 weekly：锚定星期几 0=周日…6=周六（用于在月历上落位）
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` → clean (optional fields, no other change needed).
Run: `npx vitest run` → still green (current 182).
```bash
git add src/domain/types.ts
git commit -m "feat(calendar): GoalAction gains scheduledDate + repeatWeekday (optional)"
```

---

## Task 2: Pure calendar domain (TDD)

**Files:** Create `src/domain/calendar.ts`; Test `src/domain/__tests__/calendar.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  weekdayOf, monthGrid, actionsOnDay, unscheduledActions, setActionScheduledDate,
} from "@/domain/calendar";
import { createTree } from "@/domain/tree";
import { createGoal, upsertGoal, setGoalActions } from "@/domain/goals";
import { completeAction } from "@/domain/daily";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { LifeTree, Profile } from "@/domain/types";

const profile: Profile = {
  name: "小林", age: 30, education: "bachelor", major: "视觉传达", occupation: "设计师",
  salary: "5to10", hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "dating",
  location: "杭州", status: "工作5年", snapshot: "设计师", crossroad: "",
  areas: { career: 50, wealth: 45, relationships: 55, health: 60, growth: 50 },
};
const gen = new LocalPathGenerator();
const NOW = "2026-06-19T00:00:00.000Z";

// 一棵带一个短期目标(三条行动)的树
function withActions(): { tree: LifeTree; goalId: string; a: string[] } {
  let t = createTree(profile, gen, NOW);
  let g = createGoal({ area: "growth", horizon: "short", title: "找工作", why: "" }, NOW);
  g = setGoalActions(g, ["改简历", "投简历", "背单词"]);
  t = upsertGoal(t, g);
  return { tree: t, goalId: g.id, a: g.actions.map((x) => x.id) };
}

function setAction(tree: LifeTree, goalId: string, actionId: string, patch: Record<string, unknown>): LifeTree {
  return {
    ...tree,
    goals: tree.goals.map((g) =>
      g.id === goalId ? { ...g, actions: g.actions.map((x) => (x.id === actionId ? { ...x, ...patch } : x)) } : g,
    ),
  };
}

describe("calendar domain", () => {
  it("weekdayOf returns 0..6 (0=Sun) UTC-stable", () => {
    expect(weekdayOf("2026-06-21")).toBe(0); // Sunday
    expect(weekdayOf("2026-06-22")).toBe(1); // Monday
    expect(weekdayOf("2026-06-19")).toBe(5); // Friday
  });

  it("monthGrid covers the month, Monday-start, whole weeks", () => {
    const grid = monthGrid(2026, 6); // June 2026 (month is 1-based)
    expect(grid.length % 7).toBe(0);
    // first cell is a Monday
    expect(weekdayOf(grid[0].date)).toBe(1);
    // June 1 2026 is a Monday → first cell is exactly 2026-06-01, inMonth true
    expect(grid[0].date).toBe("2026-06-01");
    expect(grid.find((c) => c.date === "2026-06-30")?.inMonth).toBe(true);
    expect(grid.find((c) => c.date === "2026-07-01")?.inMonth).toBe(false);
  });

  it("actionsOnDay: scheduled one-shot only on its date", () => {
    let { tree, goalId, a } = withActions();
    tree = setActionScheduledDate(tree, a[0], "2026-06-22");
    expect(actionsOnDay(tree, "2026-06-22").map((x) => x.action.id)).toContain(a[0]);
    expect(actionsOnDay(tree, "2026-06-23").map((x) => x.action.id)).not.toContain(a[0]);
    expect(actionsOnDay(tree, "2026-06-22").find((x) => x.action.id === a[0])!.kind).toBe("scheduled");
  });

  it("actionsOnDay: daily every day; weekly only on its anchor weekday", () => {
    let { tree, goalId, a } = withActions();
    tree = setAction(tree, goalId, a[1], { repeat: "daily" });
    tree = setAction(tree, goalId, a[2], { repeat: "weekly", repeatWeekday: 1 }); // Monday
    expect(actionsOnDay(tree, "2026-06-22").map((x) => x.action.id)).toEqual(expect.arrayContaining([a[1], a[2]])); // Mon
    const tue = actionsOnDay(tree, "2026-06-23").map((x) => x.action.id);
    expect(tue).toContain(a[1]);      // daily still
    expect(tue).not.toContain(a[2]);  // weekly anchored to Monday
  });

  it("actionsOnDay: done flag reflects completion on that day", () => {
    let { tree, a } = withActions();
    tree = setActionScheduledDate(tree, a[0], "2026-06-22");
    tree = completeAction(tree, a[0], "2026-06-22");
    expect(actionsOnDay(tree, "2026-06-22").find((x) => x.action.id === a[0])!.done).toBe(true);
  });

  it("unscheduledActions: active one-shot, not done, no scheduledDate", () => {
    let { tree, goalId, a } = withActions();
    tree = setActionScheduledDate(tree, a[0], "2026-06-22"); // scheduled → excluded
    tree = setAction(tree, goalId, a[1], { repeat: "daily" }); // recurring → excluded
    expect(unscheduledActions(tree).map((x) => x.action.id)).toEqual([a[2]]);
  });

  it("setActionScheduledDate sets and clears", () => {
    let { tree, a } = withActions();
    tree = setActionScheduledDate(tree, a[0], "2026-06-22");
    expect(actionsOnDay(tree, "2026-06-22").length).toBe(1);
    tree = setActionScheduledDate(tree, a[0], null);
    expect(unscheduledActions(tree).map((x) => x.action.id)).toContain(a[0]);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

Run: `npx vitest run src/domain/__tests__/calendar.test.ts`
Expected: FAIL (`Cannot find module '@/domain/calendar'`).

- [ ] **Step 3: Implement `src/domain/calendar.ts`**

```ts
import type { Goal, GoalAction, LifeTree } from "./types";
import { addDays, isActionDoneToday } from "./daily";

// ───────────────────────────────────────────────────────────────────────────
// calendar —— 月历排程的纯函数。日期一律 "YYYY-MM-DD"，用 UTC 解析避免时区漂移
// （与 daily.ts 一致）。不用 Date.now/Math.random：年月/日期由 state/组件注入。
// ───────────────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0");

// 0=周日 … 6=周六（UTC，稳定）。
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// 覆盖整月的网格：周一起始、前后补齐到整周。month 为 1-based。
export function monthGrid(year: number, month: number): { date: string; inMonth: boolean }[] {
  const firstStr = `${year}-${pad2(month)}-01`;
  // 周一起始：把首日往前推到本周一。getUTCDay: 0=Sun..6=Sat → 距上一个周一的天数
  const lead = (weekdayOf(firstStr) + 6) % 7;
  const start = addDays(firstStr, -lead);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  const out: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < total; i++) {
    const date = addDays(start, i);
    out.push({ date, inMonth: date.slice(0, 7) === `${year}-${pad2(month)}` });
  }
  return out;
}

export type DayActionKind = "scheduled" | "daily" | "weekly";

// 某天要在月历上显示的行动（仅 active 目标）。
export function actionsOnDay(
  tree: LifeTree,
  date: string,
): { goal: Goal; action: GoalAction; kind: DayActionKind; done: boolean }[] {
  const wd = weekdayOf(date);
  const out: { goal: Goal; action: GoalAction; kind: DayActionKind; done: boolean }[] = [];
  for (const goal of tree.goals ?? []) {
    if (goal.status !== "active") continue;
    for (const action of goal.actions) {
      let kind: DayActionKind | null = null;
      if (action.repeat === "daily") kind = "daily";
      else if (action.repeat === "weekly") kind = action.repeatWeekday === wd ? "weekly" : null;
      else if (action.scheduledDate === date) kind = "scheduled";
      if (kind) out.push({ goal, action, kind, done: isActionDoneToday(tree, action, date) });
    }
  }
  return out;
}

// 未排期托盘：active 目标里 一次性、未完成、没排期 的行动。
export function unscheduledActions(tree: LifeTree): { goal: Goal; action: GoalAction }[] {
  const out: { goal: Goal; action: GoalAction }[] = [];
  for (const goal of tree.goals ?? []) {
    if (goal.status !== "active") continue;
    for (const action of goal.actions) {
      if (!action.repeat && !action.done && !action.scheduledDate) out.push({ goal, action });
    }
  }
  return out;
}

// 设/清 某行动的 scheduledDate（null = 清）。
export function setActionScheduledDate(tree: LifeTree, actionId: string, date: string | null): LifeTree {
  return {
    ...tree,
    goals: (tree.goals ?? []).map((g) =>
      g.actions.some((a) => a.id === actionId)
        ? {
            ...g,
            actions: g.actions.map((a) =>
              a.id === actionId ? { ...a, scheduledDate: date ?? undefined } : a,
            ),
          }
        : g,
    ),
  };
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run src/domain/__tests__/calendar.test.ts` → PASS.
Run: `npx vitest run` → all green. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain/calendar.ts src/domain/__tests__/calendar.test.ts
git commit -m "feat(calendar): pure month-grid + day actions + scheduling helpers (tested)"
```

---

## Task 3: AppContext — scheduleAction, toggleActionOn, weekly anchor

**Files:** Modify `src/state/AppContext.tsx`, `src/domain/goals.ts`

- [ ] **Step 1: goals.ts — setActionRepeat anchors a weekday for weekly**

Read `src/domain/goals.ts`. Change `setActionRepeat` so weekly carries an anchor weekday and non-weekly clears it. New signature adds an optional weekday:
```ts
export function setActionRepeat(
  goal: Goal,
  actionId: string,
  repeat: GoalAction["repeat"],
  weekday?: number,
): Goal {
  return {
    ...goal,
    actions: goal.actions.map((a) =>
      a.id === actionId
        ? { ...a, repeat, repeatWeekday: repeat === "weekly" ? (weekday ?? a.repeatWeekday ?? 1) : undefined }
        : a,
    ),
  };
}
```
(Existing callers pass 3 args — still valid; weekday defaults to Monday=1 if unknown.)

- [ ] **Step 2: AppContext — imports + methods**

Read `src/state/AppContext.tsx`. Add to the `@/domain/daily` import: `completeAction, uncompleteAction, isActionDoneToday, localDay` (some already imported — merge, don't duplicate). Add import:
```ts
import { setActionScheduledDate } from "@/domain/calendar";
```
In the `AppApi` interface add:
```ts
  scheduleAction: (actionId: string, date: string | null) => void;
  toggleActionOn: (actionId: string, date: string) => void;
```
In the api object (near the other goal/today methods) add:
```ts
      scheduleAction: (actionId, date) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: setActionScheduledDate(baseTree, actionId, date) });
      },
      toggleActionOn: (actionId, date) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const hit = (baseTree.goals ?? []).flatMap((g) => g.actions).find((a) => a.id === actionId);
        if (!hit) return;
        const done = isActionDoneToday(baseTree, hit, date);
        const next = done
          ? uncompleteAction(baseTree, actionId, date)
          : completeAction(baseTree, actionId, date);
        dispatch({ type: "patchTree", tree: next });
      },
```
Then update the existing `setActionRepeatById` so when setting weekly it passes today's weekday as the anchor. It currently calls `setActionRepeat(goal, actionId, repeat)`. Change to:
```ts
      setActionRepeatById: (goalId, actionId, repeat) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const goal = (baseTree.goals ?? []).find((g) => g.id === goalId);
        if (!goal) return;
        const weekday = new Date().getUTCDay(); // anchor weekly to today's weekday (state boundary)
        dispatch({ type: "patchTree", tree: upsertGoal(baseTree, setActionRepeat(goal, actionId, repeat, weekday)) });
      },
```
(`upsertGoal`, `setActionRepeat` are already imported from goals; if not, add them.)

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` → clean. `npx vitest run` → green (existing goals tests still pass; setActionRepeat 3-arg calls unaffected — but UPDATE `goals.test.ts` if a test asserts the exact action object shape and now sees `repeatWeekday`; the existing setActionRepeat test sets weekly then expects `repeat==="weekly"` — that still holds; if it deep-equals actions, adjust minimally).
```bash
git add src/state/AppContext.tsx src/domain/goals.ts
git commit -m "feat(calendar): scheduleAction + toggleActionOn + weekly weekday anchor"
```

---

## Task 4: MonthCalendar component (grid + nav + chips + DnD + tap-assign)

**Files:** Create `src/components/MonthCalendar.tsx`

- [ ] **Step 1: Implement the component**

```tsx
"use client";

import type { LifeTree } from "@/domain/types";
import { useT } from "@/prefs/PreferencesContext";
import { actionsOnDay, monthGrid, type DayActionKind } from "@/domain/calendar";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function MonthCalendar({
  tree,
  today,
  year,
  month,
  selectedDay,
  pendingActionId,
  onPrev,
  onNext,
  onToday,
  onSelectDay,
  onSchedule,
  onPlaceHere,
}: {
  tree: LifeTree;
  today: string;
  year: number;
  month: number; // 1-based
  selectedDay: string | null;
  pendingActionId: string | null;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectDay: (date: string) => void;
  onSchedule: (actionId: string, date: string) => void;   // desktop drop
  onPlaceHere: (date: string) => void;                    // mobile tap-assign target
}) {
  const { t } = useT();
  const grid = monthGrid(year, month);

  function cellClick(date: string) {
    if (pendingActionId) onPlaceHere(date);
    else onSelectDay(date);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold">{t("{y}年 {m}月", { y: year, m: month })}</div>
        <div className="flex items-center gap-1">
          <button onClick={onToday} className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--fg-dim)] transition hover:text-[var(--fg)]">{t("回到今天")}</button>
          <button onClick={onPrev} aria-label={t("上个月")} className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[var(--fg-dim)] transition hover:text-[var(--fg)]">‹</button>
          <button onClick={onNext} aria-label={t("下个月")} className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[var(--fg-dim)] transition hover:text-[var(--fg)]">›</button>
        </div>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-[var(--fg-faint)]">
        {WEEKDAYS.map((w) => <div key={w}>{t("周{w}", { w })}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const acts = actionsOnDay(tree, cell.date);
          const isToday = cell.date === today;
          const isSel = cell.date === selectedDay;
          return (
            <div
              key={cell.date}
              onClick={() => cellClick(cell.date)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) onSchedule(id, cell.date);
              }}
              className={`min-h-[52px] cursor-pointer rounded-md border p-1 transition ${
                isToday ? "border-[var(--accent)] bg-[var(--accent)]/10" : isSel ? "border-[var(--accent)]/60" : "border-[var(--line)]"
              } ${cell.inMonth ? "" : "opacity-40"} ${pendingActionId ? "hover:border-[var(--accent)]" : ""}`}
            >
              <div className={`text-[11px] ${isToday ? "font-bold text-[var(--accent)]" : "text-[var(--fg-faint)]"}`}>
                {Number(cell.date.slice(8, 10))}
              </div>
              <div className="mt-0.5 space-y-0.5">
                {acts.slice(0, 3).map(({ action, kind, done }) => (
                  <div
                    key={action.id}
                    draggable={kind === "scheduled"}
                    onDragStart={(e) => kind === "scheduled" && e.dataTransfer.setData("text/plain", action.id)}
                    className={`truncate rounded px-1 text-[10px] ${
                      done ? "text-[var(--fg-faint)] line-through" : kind === "scheduled" ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-[var(--fg-dim)]"
                    }`}
                    title={action.text}
                  >
                    {kind !== "scheduled" ? "🔁 " : ""}{action.text}
                  </div>
                ))}
                {acts.length > 3 && <div className="text-[10px] text-[var(--fg-faint)]">+{acts.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` → clean. `npx vitest run` → green. (No unit test for the component; it's covered via the screen + manual smoke.)
```bash
git add src/components/MonthCalendar.tsx
git commit -m "feat(calendar): MonthCalendar grid with chips, desktop drop, tap-assign target"
```

---

## Task 5: CalendarPlannerScreen (split view) + route as home

**Files:** Create `src/components/CalendarPlannerScreen.tsx`; Modify `src/app/page.tsx`

- [ ] **Step 1: Implement the screen**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Button } from "./ui/Button";
import { LifeMap } from "./LifeMap";
import { MonthCalendar } from "./MonthCalendar";
import { AREA_LABELS } from "@/domain/types";
import { branchPositionAge, currentStreak, isActionDoneToday } from "@/domain/daily";
import { actionsOnDay, unscheduledActions } from "@/domain/calendar";
import { goalProgress } from "@/domain/goals";
import { localTodayStr } from "@/lib/dailyClient";

const _bootToday = localTodayStr();

export function CalendarPlannerScreen() {
  const { tree, openPlan, openTree, openPath, scheduleAction, toggleActionOn } = useApp();
  const { t } = useT();

  const [today, setToday] = useState(_bootToday);
  useEffect(() => {
    const update = () => setToday(localTodayStr());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const [view, setView] = useState<{ year: number; month: number }>(() => ({
    year: Number(_bootToday.slice(0, 4)),
    month: Number(_bootToday.slice(5, 7)),
  }));
  const [selectedDay, setSelectedDay] = useState<string>(_bootToday);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const goals = tree?.goals ?? [];
  const activeLong = useMemo(() => goals.filter((g) => g.horizon === "long" && g.status === "active"), [goals]);
  const streak = useMemo(() => (tree ? currentStreak(tree, today) : 0), [tree, today]);
  const unsched = useMemo(() => (tree ? unscheduledActions(tree) : []), [tree]);
  const dayActs = useMemo(() => (tree ? actionsOnDay(tree, selectedDay) : []), [tree, selectedDay]);
  const markers = useMemo(() => {
    if (!tree) return [];
    return tree.goals
      .filter((g) => g.horizon === "long" && g.status === "active" && g.pathId)
      .map((g) => {
        const age = branchPositionAge(tree, g);
        return age == null ? null : { pathId: g.pathId as string, age, label: g.title };
      })
      .filter((m): m is { pathId: string; age: number; label: string } => m !== null);
  }, [tree]);

  if (!tree) return null;
  const hasChoicePaths = tree.paths.some((p) => p.kind === "choice");

  function prevMonth() {
    setView((v) => (v.month === 1 ? { year: v.year - 1, month: 12 } : { ...v, month: v.month - 1 }));
  }
  function nextMonth() {
    setView((v) => (v.month === 12 ? { year: v.year + 1, month: 1 } : { ...v, month: v.month + 1 }));
  }
  function goToday() {
    setView({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
    setSelectedDay(today);
  }
  function placeHere(date: string) {
    if (pendingActionId) {
      scheduleAction(pendingActionId, date);
      setPendingActionId(null);
      setSelectedDay(date);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4 animate-fade">
        <div>
          <div className="text-xs uppercase tracking-[3px] text-[var(--fg-faint)]">Life Planner</div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("规划")}</h1>
          <div className="mt-1 text-sm text-[var(--c-amber)]">🔥 {t("连续 {n} 天", { n: streak })}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={openPlan}>{t("🎯 我的规划")}</Button>
          <Button variant="ghost" onClick={openTree}>{t("看完整人生树 →")}</Button>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* LEFT: calendar */}
        <div className="lg:w-[60%]">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-3">
            <MonthCalendar
              tree={tree}
              today={today}
              year={view.year}
              month={view.month}
              selectedDay={selectedDay}
              pendingActionId={pendingActionId}
              onPrev={prevMonth}
              onNext={nextMonth}
              onToday={goToday}
              onSelectDay={setSelectedDay}
              onSchedule={(id, date) => scheduleAction(id, date)}
              onPlaceHere={placeHere}
            />
          </div>

          {/* unscheduled tray */}
          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-3">
            <div className="mb-2 text-[11px] text-[var(--fg-faint)]">
              {pendingActionId ? t("点一个日子放下它") : t("未排期 · 拖到某天，或点一下再点日子")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unsched.length === 0 && <span className="text-xs text-[var(--fg-faint)]">{t("没有未排期的行动")}</span>}
              {unsched.map(({ action }) => (
                <button
                  key={action.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", action.id)}
                  onClick={() => setPendingActionId((cur) => (cur === action.id ? null : action.id))}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    pendingActionId === action.id ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--line)] text-[var(--fg-dim)] hover:border-[var(--accent)]"
                  }`}
                >
                  {action.text}
                </button>
              ))}
            </div>
          </div>

          {/* selected-day panel */}
          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-3">
            <div className="mb-2 text-sm font-bold">{t("{d} 这天", { d: selectedDay })}</div>
            {dayActs.length === 0 ? (
              <p className="text-xs text-[var(--fg-faint)]">{t("这天还没有安排。把未排期的行动拖/点过来。")}</p>
            ) : (
              <ul className="space-y-1.5">
                {dayActs.map(({ goal, action, kind, done }) => (
                  <li key={action.id} className="flex items-center gap-2">
                    <button onClick={() => toggleActionOn(action.id, selectedDay)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[10px] ${done ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]" : "border-[var(--line)]"}`}>{done ? "✓" : ""}</span>
                      <span className={`truncate ${done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}`}>{kind !== "scheduled" ? "🔁 " : ""}{action.text}</span>
                      <span className="ml-1 flex-shrink-0 text-[10px] text-[var(--fg-faint)]">{t(AREA_LABELS[goal.area])}</span>
                    </button>
                    {kind === "scheduled" && (
                      <button onClick={() => scheduleAction(action.id, null)} aria-label={t("移回未排期")} title={t("移回未排期")} className="flex-shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--fg-faint)] transition hover:text-[var(--c-rose)]">✕</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT: goals + prediction */}
        <div className="flex flex-col gap-3 lg:w-[40%]">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-3">
            <div className="mb-2 text-sm font-bold text-[var(--fg-dim)]">{t("目标")}</div>
            {activeLong.length === 0 ? (
              <p className="text-xs text-[var(--fg-faint)]">{t("还没有长期目标。去「我的规划」加一个。")}</p>
            ) : (
              <div className="space-y-3">
                {activeLong.map((g) => {
                  const pct = Math.round(goalProgress(tree, g) * 100);
                  return (
                    <button key={g.id} onClick={() => g.pathId && openPath(g.pathId)} className="block w-full text-left">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate text-[var(--fg)]">{g.title}</span>
                        <span className="ml-2 flex-shrink-0 text-[11px] text-[var(--fg-faint)]">{t("进度 {pct}%", { pct })}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} /></div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-black/20 p-2">
            <div className="mb-1 px-1 text-[11px] text-[var(--fg-faint)]">{t("未来预测 ·「你在这里」随里程碑前进")}</div>
            {hasChoicePaths ? (
              <LifeMap tree={tree} compact markers={markers} onSelectPath={openPath} onForkAtNode={() => openTree()} />
            ) : (
              <p className="px-3 py-8 text-center text-xs text-[var(--fg-faint)]">{t("还没有路。去「我的规划」加一个长期目标，它会在树上长出一条路。")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Route it as the home**

In `src/app/page.tsx`: add `import { CalendarPlannerScreen } from "@/components/CalendarPlannerScreen";`. In the view switch, change the `dashboard` fallback branch to render `<CalendarPlannerScreen />` instead of `<DashboardScreen />`. (Keep the `DashboardScreen` import only if still referenced elsewhere; if it becomes unused, remove its import to satisfy lint.)

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` → clean. `npx vitest run` → green. `npx next build` → succeeds.
```bash
git add src/components/CalendarPlannerScreen.tsx src/app/page.tsx
git commit -m "feat(calendar): split-view calendar planner home (calendar + goals/prediction)"
```

---

## Task 6: i18n + full verification

**Files:** Modify `src/i18n/messages.ts`

- [ ] **Step 1: Add EN entries (only those not already present)**

```ts
  规划: "Plan",
  "{y}年 {m}月": "{y}-{m}",
  回到今天: "Today",
  上个月: "Previous month",
  下个月: "Next month",
  "周{w}": "{w}",
  "未排期 · 拖到某天，或点一下再点日子": "Unscheduled · drag to a day, or tap then tap a day",
  点一个日子放下它: "Tap a day to drop it",
  没有未排期的行动: "No unscheduled actions",
  "{d} 这天": "{d}",
  "这天还没有安排。把未排期的行动拖/点过来。": "Nothing on this day yet. Drag or tap an unscheduled action here.",
  移回未排期: "Move back to unscheduled",
  目标: "Goals",
  "还没有长期目标。去「我的规划」加一个。": "No long-term goals yet. Add one in My plan.",
  "进度 {pct}%": "{pct}% done",
  "未来预测 ·「你在这里」随里程碑前进": "Forecast · “you are here” advances with milestones",
```
Note: several keys (连续 {n} 天, 🎯 我的规划, 看完整人生树 →, 还没有路。…, etc.) already exist — do NOT duplicate. The weekday header uses `t("周{w}", { w })` with `w` ∈ 一..日; the EN value `"{w}"` keeps the Chinese char in EN mode (acceptable for a compact weekday header) — OR map each explicitly if you prefer English weekday letters (optional).

- [ ] **Step 2: Full verification**

Run: `npx tsc --noEmit` → clean.
Run: `npx vitest run` → all green.
Run: `npx next build` → succeeds (clear `.next` afterward if dev `/` 404s).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages.ts
git commit -m "feat(i18n): English strings for the calendar planner"
```

- [ ] **Step 4: Real-machine smoke (manual, with the user)**

- Home opens to the calendar planner; today highlighted.
- Drag an unscheduled chip onto a day (desktop) → it appears on that day; on mobile, tap the chip then tap a day → same.
- Click a day → day panel lists its actions; check one off → streak/heatmap/marker update (verify on the right + via 我的规划).
- A 🔁daily action shows on every day; a weekly action shows on its anchor weekday only.
- Prev/next month + 回到今天 work.
- Right pane: goal progress bars + mini-tree "you are here" render.
- Switch to English; new strings are English. Old localStorage data loads without loss.

---

## Self-Review

- **Spec coverage:** month grid + nav + today (Task 4/5); schedule one-shot to a day via drag + tap (Task 4 DnD + Task 5 pending/placeHere); daily/weekly display (Task 2 actionsOnDay + Task 4 chips); click day → day panel + complete (Task 5 + toggleActionOn Task 3); unscheduled tray (Task 5 + unscheduledActions Task 2); right pane goals/tree/streak (Task 5 reusing LifeMap + daily); data fields + no migration (Task 1); not-doing list honored (no sync/push/timeblock/recurrence-rules/timezone anywhere). i18n (Task 6). All covered.
- **Placeholder scan:** none — full code for domain + components; exact edits for AppContext/page/goals; explicit i18n list.
- **Type consistency:** `setActionScheduledDate`, `actionsOnDay` (kind: "scheduled"|"daily"|"weekly", done), `unscheduledActions`, `monthGrid(year,month)` 1-based, `weekdayOf` 0=Sun; `scheduleAction(id, date|null)`, `toggleActionOn(id,date)`, `setActionRepeat(goal,id,repeat,weekday?)` — names match across tasks and the existing daily.ts signatures (addDays/isActionDoneToday/completeAction/uncompleteAction/localDay). MonthCalendar props match CalendarPlannerScreen usage. `repeatWeekday` uses 0=Sun..6=Sat consistently (weekdayOf + setActionRepeat default 1=Mon + setActionRepeatById new Date().getUTCDay()).
