"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { isActionDoneToday } from "@/domain/daily";
import { recurringActions, habitStreak } from "@/domain/habits";
import { localTodayStr } from "@/lib/dailyClient";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";

const _bootToday = localTodayStr();

export function HabitsSection() {
  const { tree, toggleActionOn } = useApp();
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
          icon="🔁"
          accent="var(--accent)"
          description={t("还没有习惯。去「我的规划」把某条行动设成每天或每周重复。")}
        />
      ) : (
        <ul className="space-y-2">
          {habits.map(({ goal, action }) => {
            const done = isActionDoneToday(tree, action, today);
            const streak = habitStreak(tree, action, today);
            const repeatLabel = action.repeat === "daily" ? t("每天") : t("每周");
            const streakLabel =
              action.repeat === "weekly"
                ? t("🔥 连续 {n} 周", { n: streak })
                : t("🔥 连续 {n} 天", { n: streak });
            return (
              <li key={action.id}>
                <button
                  onClick={() => toggleActionOn(action.id, today)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 text-left transition hover:border-[var(--accent)]/50 hover:bg-[var(--bg-2)]"
                >
                  {/* Checkbox */}
                  <span
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] transition ${
                      done
                        ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]"
                        : "border-[var(--line)]"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </span>

                  {/* Action text */}
                  <span
                    className={`flex-1 truncate text-sm font-medium ${
                      done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"
                    }`}
                  >
                    {action.text}
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
                    <span className="flex-shrink-0 text-[11px] text-[var(--c-amber)]">
                      {streakLabel}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
