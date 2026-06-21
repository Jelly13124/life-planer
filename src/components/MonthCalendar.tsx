"use client";

import type { LifeTree } from "@/domain/types";
import { useT } from "@/prefs/PreferencesContext";
import { actionsOnDay, monthGrid } from "@/domain/calendar";

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
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold tracking-tight">{t("{y}年 {m}月", { y: year, m: month })}</div>
        <div className="flex items-center gap-1.5">
          <button onClick={onToday} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]">{t("回到今天")}</button>
          <button onClick={onPrev} aria-label={t("上个月")} className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]">‹</button>
          <button onClick={onNext} aria-label={t("下个月")} className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]">›</button>
        </div>
      </div>
      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-[var(--fg-faint)]">
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
              className={`min-h-[56px] cursor-pointer rounded-lg border p-1.5 transition ${
                isToday
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : isSel
                    ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.04]"
                    : "border-[var(--line)] hover:border-white/20"
              } ${cell.inMonth ? "" : "opacity-35"} ${pendingActionId ? "hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.06]" : ""}`}
            >
              <div className={`flex h-5 w-5 items-center justify-center text-[11px] ${isToday ? "rounded-full bg-[var(--accent)] font-bold text-[#11132a]" : isSel ? "font-semibold text-[var(--fg)]" : "text-[var(--fg-faint)]"}`}>
                {Number(cell.date.slice(8, 10))}
              </div>
              <div className="mt-1 space-y-1">
                {acts.slice(0, 3).map(({ item, kind, done }) => (
                  <div
                    key={item.id}
                    draggable={kind === "scheduled"}
                    onDragStart={(e) => kind === "scheduled" && e.dataTransfer.setData("text/plain", item.id)}
                    className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                      done ? "text-[var(--fg-faint)] line-through" : kind === "scheduled" ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-[var(--fg-dim)]"
                    }`}
                    title={item.text}
                  >
                    {kind !== "scheduled" ? "🔁 " : ""}{item.text}
                  </div>
                ))}
                {acts.length > 3 && <div className="px-1 text-[10px] text-[var(--fg-faint)]">+{acts.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
