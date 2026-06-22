"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { isActionDoneToday } from "@/domain/daily";
import { recurringActions, habitStreak } from "@/domain/habits";
import { localTodayStr } from "@/lib/dailyClient";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";
import { IconRepeat, IconFlame } from "./ui/icons";

const _bootToday = localTodayStr();

export function HabitsSection() {
  const { tree, toggleActionOn, removeActionById } = useApp();
  const { t } = useT();

  const [today, setToday] = useState(_bootToday);
  useEffect(() => {
    const update = () => setToday(localTodayStr());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  if (!tree) return null;

  const habits = recurringActions(tree);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Habits"
        title={t("习惯")}
        subtitle={t("坚持重复，构成你真正的生活方式。")}
      />

      {habits.length === 0 ? (
        <EmptyState
          icon={<IconRepeat className="h-7 w-7" />}
          accent="var(--accent)"
          description={t("还没有习惯。去「我的规划」把某条行动设成每天或每周重复。")}
        />
      ) : (
        <ul className="space-y-2">
          {habits.map(({ goal, habit }) => {
            const done = isActionDoneToday(tree, habit, today);
            const streak = habitStreak(tree, habit.id, today);
            const repeatLabel = habit.repeat === "daily" ? t("每天") : t("每周");
            const streakLabel =
              habit.repeat === "weekly"
                ? t("连续 {n} 周", { n: streak })
                : t("连续 {n} 天", { n: streak });
            return (
              <li key={habit.id}>
                <div className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 transition hover:border-[var(--accent)]/50 hover:bg-[var(--bg-2)]">
                  {/* Checkbox — only this toggles completion */}
                  <button
                    onClick={() => toggleActionOn(habit.id, today)}
                    aria-label={done ? t("标记未完成") : t("标记完成")}
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] transition ${
                      done
                        ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]"
                        : "border-[var(--line)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </button>

                  {/* Habit text */}
                  <span
                    className={`flex-1 truncate text-sm font-medium ${
                      done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"
                    }`}
                  >
                    {habit.text}
                  </span>

                  {/* Repeat badge */}
                  <span className="flex-shrink-0 rounded-full border border-[var(--accent)]/30 px-2 py-0.5 text-[10px] text-[var(--accent)]">
                    {repeatLabel}
                  </span>

                  {/* Goal title */}
                  <span className="hidden flex-shrink-0 text-[11px] text-[var(--fg-faint)] sm:block">
                    {goal.title}
                  </span>

                  {/* Streak */}
                  {streak > 0 && (
                    <span className="flex flex-shrink-0 items-center gap-1 text-[11px] text-[var(--c-amber)]">
                      <IconFlame className="h-3 w-3" />
                      {streakLabel}
                    </span>
                  )}

                  {/* Delete — removes the recurring habit everywhere */}
                  <button
                    onClick={() => removeActionById(habit.id)}
                    aria-label={t("删除任务")}
                    title={t("删除任务")}
                    className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[12px] text-[var(--fg-faint)] transition hover:text-[var(--c-rose)]"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
