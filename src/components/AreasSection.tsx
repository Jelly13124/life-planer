"use client";

import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { AREA_LABELS } from "@/domain/types";
import { areaSummaries, type AreaSummary } from "@/domain/areas";
import { goalProgress } from "@/domain/goals";
import type { Goal, LifeTree } from "@/domain/types";
import { Card } from "./ui/Card";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";

// 人生面各领域的色彩主题（内联 CSS 变量引用）
const AREA_COLORS: Record<string, string> = {
  career:        "var(--c-sky)",
  wealth:        "var(--c-amber)",
  relationships: "var(--c-rose)",
  health:        "var(--c-emerald)",
  growth:        "var(--accent)",
};

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="w-8 flex-shrink-0 text-right text-xs tabular-nums text-[var(--fg-dim)]">
        {score}
      </span>
    </div>
  );
}

function GoalProgressRow({
  goal,
  tree,
  color,
  onOpen,
}: {
  goal: Goal;
  tree: LifeTree;
  color: string;
  onOpen: () => void;
}) {
  const { t } = useT();
  const pct = Math.round(goalProgress(tree, goal) * 100);
  return (
    <button
      onClick={goal.pathId ? onOpen : undefined}
      className={`w-full text-left ${goal.pathId ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-[var(--fg)]">{goal.title}</span>
        <span className="flex-shrink-0 text-[10px] tabular-nums text-[var(--fg-faint)]">
          {t("进度 {pct}%", { pct })}
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </button>
  );
}

function AreaCard({ summary, tree }: { summary: AreaSummary; tree: LifeTree }) {
  const { openPlan, openPath } = useApp();
  const { t } = useT();
  const color = AREA_COLORS[summary.area] ?? "var(--accent)";
  const label = t(AREA_LABELS[summary.area]);

  return (
    <Card
      pad="md"
      className="flex flex-col gap-3"
      style={{ "--area-color": color } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-sm font-bold"
          style={{ color }}
        >
          {label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
          style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
        >
          {summary.score}
        </span>
      </div>

      {/* Score bar */}
      <ScoreBar score={summary.score} color={color} />

      {/* Active goals */}
      {summary.goals.length > 0 ? (
        <div className="space-y-2.5">
          {summary.goals.map((g) => (
            <GoalProgressRow
              key={g.id}
              goal={g}
              tree={tree}
              color={color}
              onOpen={() => g.pathId && openPath(g.pathId)}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--fg-faint)]">{t("还没有目标")}</span>
          <button
            onClick={openPlan}
            className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[10px] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {t("去规划")}
          </button>
        </div>
      )}

      {/* Habit count footer */}
      {summary.habitCount > 0 && (
        <p className="text-[10px] text-[var(--fg-faint)]">
          {t("{n} 个习惯", { n: summary.habitCount })}
        </p>
      )}
    </Card>
  );
}

export function AreasSection() {
  const { tree, openPlan } = useApp();
  const { t } = useT();

  if (!tree) return null;

  const summaries = areaSummaries(tree);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Life Areas"
        title={t("人生面")}
        subtitle={t("五个维度的现状与目标——看清自己在哪里，想去哪里。")}
      />

      {/* Area cards — 1 col on mobile, 2 on sm+ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {summaries.map((s) => (
          <AreaCard key={s.area} summary={s} tree={tree} />
        ))}
      </div>

      {/* Global CTA when no goals at all */}
      {summaries.every((s) => s.goals.length === 0) && (
        <EmptyState
          className="mt-8"
          icon="🧭"
          accent="var(--accent)"
          description={t("各个维度还没有目标，去规划一个吧。")}
          action={
            <button
              onClick={openPlan}
              className="rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-4 py-2 text-sm text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
            >
              {t("去规划")}
            </button>
          }
        />
      )}
    </div>
  );
}
