"use client";

import type { LifeTree } from "@/domain/types";
import { useT } from "@/prefs/PreferencesContext";
import { monthGrid } from "@/domain/calendar";
import { allTasks } from "@/domain/goalTree";

// 年视图：12 个迷你月，每天一个密度点。点 = 排期的一次性行动 + 当天完成数；
// 刻意不计每日重复习惯（否则每天都会被点满）。年/今天由 props 注入，渲染期不取 new Date。
export function YearView({
  tree,
  year,
  today,
  pendingActionId,
  onPrevYear,
  onNextYear,
  onPickMonth,
  onPickDay,
  onSchedule,
  onScheduleGoal,
  onPlaceHere,
}: {
  tree: LifeTree;
  year: number;
  today: string;
  pendingActionId: string | null;
  onPrevYear: () => void;
  onNextYear: () => void;
  onPickMonth: (month: number) => void;
  onPickDay: (date: string) => void;
  onSchedule: (actionId: string, date: string) => void;   // desktop drop (task)
  onScheduleGoal: (goalId: string, date: string) => void; // desktop drop (goal → startDate)
  onPlaceHere: (date: string) => void;                    // mobile tap-assign target
}) {
  const { t } = useT();

  // 一次性遍历排期任务 + 活动，按天累计密度（不是 365 次循环）。
  // 密度 = 排期的一次性 Task（按 scheduledDate）+ 当天完成数；重复习惯不计（否则天天满）。
  const counts = new Map<string, number>();
  for (const { task } of allTasks(tree)) {
    if (task.scheduledDate && task.scheduledDate.startsWith(`${year}-`)) {
      counts.set(task.scheduledDate, (counts.get(task.scheduledDate) ?? 0) + 1);
    }
  }
  for (const d of tree.activity ?? []) {
    if (d.date.startsWith(`${year}-`) && d.completedActionIds.length) {
      counts.set(d.date, (counts.get(d.date) ?? 0) + d.completedActionIds.length);
    }
  }

  // 与 HeatStrip 同一套配色：无=很淡的线，少=accent，多=fuchsia。
  const shade = (c: number) => (c <= 0 ? "var(--line)" : c === 1 ? "var(--accent)" : "var(--c-fuchsia)");

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <div>
      <div className="mb-5 flex items-center justify-center gap-3">
        <button
          onClick={onPrevYear}
          aria-label={t("上一年")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]"
        >
          ‹
        </button>
        <div className="text-base font-semibold tracking-tight tabular-nums">{t("{year} 年", { year })}</div>
        <button
          onClick={onNextYear}
          aria-label={t("下一年")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {months.map((m) => {
          const grid = monthGrid(year, m);
          return (
            <div key={m} className="rounded-xl border border-[var(--line)] p-2.5">
              <button
                onClick={() => onPickMonth(m)}
                className="mb-2 w-full text-left text-[13px] font-medium tracking-tight text-[var(--fg-dim)] transition hover:text-[var(--accent)]"
              >
                {t("{m}月", { m })}
              </button>
              <div className="grid grid-cols-7 gap-[3px]">
                {grid.map((cell) => {
                  if (!cell.inMonth) {
                    return <div key={cell.date} className="h-4" aria-hidden="true" />;
                  }
                  const count = counts.get(cell.date) ?? 0;
                  const isToday = cell.date === today;
                  return (
                    <button
                      key={cell.date}
                      onClick={() => (pendingActionId ? onPlaceHere(cell.date) : onPickDay(cell.date))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain");
                        if (!id) return;
                        const kind = e.dataTransfer.getData("application/x-lp-kind") || "task";
                        if (kind === "goal") onScheduleGoal(id, cell.date);
                        else onSchedule(id, cell.date);
                      }}
                      title={count > 0 ? `${cell.date} · ${t("{n} 件", { n: count })}` : cell.date}
                      className={`flex h-4 w-full items-center justify-center rounded-[3px] text-[8px] leading-none transition hover:ring-1 hover:ring-[var(--accent)]/60 ${
                        isToday ? "ring-1 ring-[var(--accent)]" : ""
                      }`}
                      style={{
                        backgroundColor: shade(count),
                        opacity: count > 0 ? 1 : 0.35,
                        color: count > 0 ? "#11132a" : "var(--fg-faint)",
                      }}
                    >
                      {Number(cell.date.slice(8, 10))}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
