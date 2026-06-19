"use client";

import { useState } from "react";
import type { Decision, LifeTree } from "@/domain/types";
import { useT } from "@/prefs/PreferencesContext";
import { weeklyRecap } from "@/domain/weekly";
import { ReviewSheet } from "./ReviewSheet";
import { Button } from "./ui/Button";

interface WeeklyReviewSheetProps {
  tree: LifeTree;
  today: string;
  onClose: () => void;
  onReviewedGoals: () => void;
  onReplan?: (label: string) => void;
}

export function WeeklyReviewSheet({
  tree,
  today,
  onClose,
  onReviewedGoals,
  onReplan,
}: WeeklyReviewSheetProps) {
  const { t } = useT();
  const recap = weeklyRecap(tree, today);
  const [reviewing, setReviewing] = useState<Decision | null>(null);

  if (reviewing) {
    return (
      <ReviewSheet
        decision={reviewing}
        onClose={() => setReviewing(null)}
        onReplan={onReplan}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-lg rounded-t-3xl border border-[var(--line)] bg-[var(--bg-1)] p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{t("本周回顾")}</h3>
            <p className="mt-0.5 text-xs text-[var(--fg-faint)]">
              {recap.weekStart} — {recap.weekEnd}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-faint)] transition hover:bg-[var(--line)] hover:text-[var(--fg)]"
            aria-label={t("关闭")}
          >
            ✕
          </button>
        </div>

        {/* Stats row */}
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--bg-0)] px-4 py-3 text-sm">
          {t("本周完成 {n} 件 · 活跃 {d} 天 · 🔥连续 {s} 天", {
            n: recap.completions,
            d: recap.activeDays,
            s: recap.streak,
          })}
        </div>

        {/* Milestones this week */}
        {recap.milestonesThisWeek.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
              🏆 {t("本周达成")}
            </h4>
            <ul className="mt-2 space-y-1.5">
              {recap.milestonesThisWeek.map((g) => (
                <li
                  key={g.id}
                  className="rounded-xl border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/10 px-3 py-2 text-sm text-[var(--fg)]"
                >
                  {g.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Due goal reviews */}
        {recap.dueGoals.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
              {t("该回看的目标")}
            </h4>
            <ul className="mt-2 space-y-1.5">
              {recap.dueGoals.map((g) => (
                <li
                  key={g.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--fg)]"
                >
                  {g.title}
                </li>
              ))}
            </ul>
            <Button
              variant="subtle"
              onClick={() => {
                onReviewedGoals();
                onClose();
              }}
              className="mt-3 w-full"
            >
              {t("我都回看过了")}
            </Button>
          </div>
        )}

        {/* Due decision reviews */}
        {recap.dueDecisions.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
              {t("该复盘的决定")}
            </h4>
            <ul className="mt-2 space-y-1.5">
              {recap.dueDecisions.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-0)] px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--fg)]">
                    {d.choiceLabel}
                  </span>
                  <Button
                    variant="subtle"
                    onClick={() => setReviewing(d)}
                    className="flex-shrink-0 !py-1 !text-xs"
                  >
                    {t("去复盘")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reflection line */}
        <p className="mt-5 text-center text-xs italic text-[var(--fg-faint)]">
          {t("停下来看看走过的一周，比一直往前更重要。")}
        </p>
      </div>
    </div>
  );
}
