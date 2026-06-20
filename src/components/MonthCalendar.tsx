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
