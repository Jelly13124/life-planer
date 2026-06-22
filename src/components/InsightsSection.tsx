"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { localTodayStr } from "@/lib/dailyClient";
import { heatmap } from "@/domain/daily";
import { insightsSummary } from "@/domain/insights";
import { WeeklyReviewSheet } from "./WeeklyReviewSheet";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { SectionHeader } from "./ui/SectionHeader";
import { MetricCard } from "./ui/MetricCard";
import { IconFlame, IconCalendar } from "./ui/icons";

// ───────────────────────────────────────────────────────────────────────────
// Boot today once at module load; re-sync on visibility change (see effect).
// ───────────────────────────────────────────────────────────────────────────
const _bootToday = localTodayStr();

type TFn = (zh: string, vars?: Record<string, string | number>) => string;

// ─── HeatStrip: 90-day cell row, reusing the CalendarPlannerScreen idiom ───
function HeatStrip({ days, t }: { days: { date: string; count: number }[]; t: TFn }) {
  const shade = (c: number) =>
    c <= 0 ? "var(--line)" : c === 1 ? "var(--accent)" : "var(--c-fuchsia)";
  return (
    <span className="inline-flex flex-wrap items-end gap-[2px]" aria-label={t("最近完成情况")}>
      {days.map((d) => (
        <span
          key={d.date}
          title={`${d.date}: ${d.count}`}
          className="inline-block h-2.5 w-2.5 rounded-[2px] transition-colors"
          style={{ backgroundColor: shade(d.count), opacity: d.count > 0 ? 1 : 0.45 }}
        />
      ))}
    </span>
  );
}

// ─── InsightsSection ─────────────────────────────────────────────────────
export function InsightsSection() {
  const { tree, markDueGoalsReviewed, addBranch } = useApp();
  const { t } = useT();

  const [today, setToday] = useState(_bootToday);
  useEffect(() => {
    const update = () => setToday(localTodayStr());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const [weeklyOpen, setWeeklyOpen] = useState(false);

  const summary = useMemo(
    () =>
      tree
        ? insightsSummary(tree, today, 90)
        : { streak: 0, longestStreak: 0, completions: 0, activeDays: 0, consistency: 0, windowDays: 90 },
    [tree, today],
  );

  const hm = useMemo(() => (tree ? heatmap(tree, 90, today) : []), [tree, today]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Insights"
        title={t("洞察")}
        subtitle={t("过去 90 天的行动轨迹与坚持力量")}
      />

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 animate-fade">
        <MetricCard
          label={t("当前连续")}
          value={
            <span className="inline-flex items-center gap-1.5">
              <IconFlame className="h-5 w-5" />
              {t("{n} 天", { n: summary.streak })}
            </span>
          }
          accent="var(--c-amber)"
        />
        <MetricCard
          label={t("最长连续")}
          value={t("{n} 天", { n: summary.longestStreak })}
          accent="var(--c-fuchsia)"
        />
        <MetricCard
          label={t("近90天完成")}
          value={t("{n} 件", { n: summary.completions })}
        />
        <MetricCard
          label={t("活跃天数")}
          value={t("{n} 天", { n: summary.activeDays })}
        />
        <MetricCard
          label={t("坚持度")}
          value={`${summary.consistency}%`}
          accent={summary.consistency >= 50 ? "var(--c-emerald)" : undefined}
        />
      </div>

      {/* 90-day heatmap */}
      <Card pad="lg" className="mt-6 animate-fade">
        <div className="mb-3 text-[11px] uppercase tracking-wider text-[var(--fg-faint)]">
          {t("近 90 天完成热力图")}
        </div>
        {hm.length > 0 ? (
          <HeatStrip days={hm} t={t} />
        ) : (
          <p className="text-xs text-[var(--fg-faint)]">{t("还没有记录。完成一些行动，这里就会亮起来。")}</p>
        )}
        <div className="mt-3 flex items-center gap-3 text-[10px] text-[var(--fg-faint)]">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: "var(--line)", opacity: 0.45 }} />
            {t("无记录")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: "var(--accent)" }} />
            {t("1 件")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: "var(--c-fuchsia)" }} />
            {t("2 件+")}
          </span>
        </div>
      </Card>

      {/* Weekly Review button */}
      <div className="mt-6 animate-fade">
        <Button variant="subtle" onClick={() => setWeeklyOpen(true)} className="w-full sm:w-auto">
          <span className="inline-flex items-center gap-1.5">
            <IconCalendar className="h-4 w-4" />
            {t("本周回顾")}
          </span>
        </Button>
      </div>

      {/* WeeklyReviewSheet */}
      {weeklyOpen && tree && (
        <WeeklyReviewSheet
          tree={tree}
          today={today}
          onClose={() => setWeeklyOpen(false)}
          onReviewedGoals={markDueGoalsReviewed}
          onReplan={(label) => {
            addBranch(label);
            setWeeklyOpen(false);
          }}
        />
      )}
    </div>
  );
}
