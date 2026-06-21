"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";
import { LifeMap } from "./LifeMap";
import { GettingStarted } from "./GettingStarted";
import { WeeklyReviewSheet } from "./WeeklyReviewSheet";
import { MonthCalendar } from "./MonthCalendar";
import { YearView } from "./YearView";
import { DayView } from "./DayView";
import { addDays, branchPositionAge, currentStreak, heatmap } from "@/domain/daily";
import { unscheduledActions } from "@/domain/calendar";
import { goalProgress } from "@/domain/goals";
import { localTodayStr } from "@/lib/dailyClient";

const _bootToday = localTodayStr();

export function CalendarPlannerScreen() {
  const { tree, openTree, openPath, openPlan, scheduleAction, markDueGoalsReviewed, addBranch } = useApp();
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
  const [calView, setCalView] = useState<"year" | "month" | "day">("month");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [weeklyOpen, setWeeklyOpen] = useState(false);

  const goals = tree?.goals ?? [];
  const activeLong = useMemo(() => goals.filter((g) => g.horizon === "long" && g.status === "active"), [goals]);
  const streak = useMemo(() => (tree ? currentStreak(tree, today) : 0), [tree, today]);
  const hm = useMemo(() => (tree ? heatmap(tree, 30, today) : []), [tree, today]);
  const doneLong = useMemo(() => (tree ? tree.goals.filter((g) => g.horizon === "long" && g.status === "done") : []), [tree]);
  const unsched = useMemo(() => (tree ? unscheduledActions(tree) : []), [tree]);
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
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Life Planner"
        title={t("规划")}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-[var(--c-amber)]">🔥 {t("连续 {n} 天", { n: streak })}</span>
            <HeatStrip days={hm} t={t} />
          </span>
        }
        actions={<Button variant="subtle" onClick={() => setWeeklyOpen(true)}>{t("📅 本周回顾")}</Button>}
      />

      {!tree.guideDismissed && <GettingStarted tree={tree} />}

      {doneLong.length > 0 && (
        <div className="mb-6 space-y-2">
          {doneLong.map((g) => (
            <div key={g.id} className="flex items-center gap-2.5 rounded-2xl border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/10 px-4 py-3 text-sm">
              <span aria-hidden="true">🏆</span>
              <span className="min-w-0 text-[var(--fg)]">{t("你真的做到了：{title}", { title: g.title })}</span>
              {g.pathId && (
                <button onClick={() => openPath(g.pathId as string)} className="ml-auto flex-shrink-0 rounded-full border border-[var(--accent)]/50 px-3 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15">
                  {t("和未来的你说一声")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* LEFT: calendar */}
        <div className="flex flex-col gap-4 lg:w-[60%]">
          <Card pad="sm">
            {/* 年/月/日 segmented toggle */}
            <div className="mb-3 inline-flex rounded-full border border-[var(--line)] p-0.5">
              {(["year", "month", "day"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  className={`rounded-full px-3.5 py-1 text-[12px] font-medium transition ${
                    calView === v
                      ? "bg-[var(--accent)] text-[#11132a]"
                      : "text-[var(--fg-dim)] hover:text-[var(--fg)]"
                  }`}
                >
                  {v === "year" ? t("年") : v === "month" ? t("月") : t("日")}
                </button>
              ))}
            </div>

            {calView === "year" && (
              <YearView
                tree={tree}
                year={view.year}
                today={today}
                onPrevYear={() => setView((v) => ({ ...v, year: v.year - 1 }))}
                onNextYear={() => setView((v) => ({ ...v, year: v.year + 1 }))}
                onPickMonth={(m) => {
                  setView({ year: view.year, month: m });
                  setCalView("month");
                }}
                onPickDay={(d) => {
                  setSelectedDay(d);
                  setCalView("day");
                }}
              />
            )}

            {calView === "month" && (
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
                onSelectDay={(d) => {
                  setSelectedDay(d);
                  setCalView("day");
                }}
                onSchedule={(id, date) => scheduleAction(id, date)}
                onPlaceHere={placeHere}
              />
            )}

            {calView === "day" && (
              <DayView
                tree={tree}
                date={selectedDay}
                onPrevDay={() => setSelectedDay(addDays(selectedDay, -1))}
                onNextDay={() => setSelectedDay(addDays(selectedDay, 1))}
                onToday={() => setSelectedDay(today)}
              />
            )}
          </Card>

          {/* unscheduled tray — drag source, only in month view */}
          {calView === "month" && (
            <Card pad="sm">
              <div className="mb-2.5 text-[11px] text-[var(--fg-faint)]">
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
            </Card>
          )}
        </div>

        {/* RIGHT: goals + prediction */}
        <div className="flex flex-col gap-4 lg:w-[40%]">
          <Card pad="md">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">{t("目标")}</div>
            {activeLong.length === 0 ? (
              <EmptyState
                size="inline"
                icon="🎯"
                description={t("还没有长期目标。去「我的规划」加一个。")}
                action={
                  <button onClick={openPlan} className="rounded-full border border-[var(--accent)]/50 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15">
                    {t("去规划")}
                  </button>
                }
              />
            ) : (
              <div className="space-y-3.5">
                {activeLong.map((g) => {
                  const pct = Math.round(goalProgress(tree, g) * 100);
                  return (
                    <button key={g.id} onClick={() => g.pathId && openPath(g.pathId)} className="block w-full text-left">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate text-[var(--fg)]">{g.title}</span>
                        <span className="ml-2 flex-shrink-0 text-[11px] tabular-nums text-[var(--fg-faint)]">{t("进度 {pct}%", { pct })}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} /></div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card pad="sm" sunken>
            <div className="mb-2 px-1 text-[11px] text-[var(--fg-faint)]">{t("未来预测 ·「你在这里」随里程碑前进")}</div>
            {hasChoicePaths ? (
              <LifeMap tree={tree} compact markers={markers} onSelectPath={openPath} onForkAtNode={() => openTree()} />
            ) : (
              <EmptyState
                size="inline"
                icon="🌳"
                description={t("还没有路。去「我的规划」加一个长期目标，它会在树上长出一条路。")}
                action={
                  <button onClick={openPlan} className="rounded-full border border-[var(--accent)]/50 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15">
                    {t("去规划")}
                  </button>
                }
              />
            )}
          </Card>
        </div>
      </div>

      {weeklyOpen && (
        <WeeklyReviewSheet
          tree={tree}
          today={today}
          onClose={() => setWeeklyOpen(false)}
          onReviewedGoals={markDueGoalsReviewed}
          onReplan={(label) => { addBranch(label); setWeeklyOpen(false); }}
        />
      )}
    </div>
  );
}

type TFn = (zh: string, vars?: Record<string, string | number>) => string;

function HeatStrip({ days, t }: { days: { date: string; count: number }[]; t: TFn }) {
  const shade = (c: number) => (c <= 0 ? "var(--line)" : c === 1 ? "var(--accent)" : "var(--c-fuchsia)");
  return (
    <span className="inline-flex items-end gap-[3px]" aria-label={t("最近完成情况")}>
      {days.map((d) => (
        <span key={d.date} title={`${d.date}: ${d.count}`} className="inline-block h-3 w-1.5 rounded-[2px]" style={{ backgroundColor: shade(d.count), opacity: d.count > 0 ? 1 : 0.45 }} />
      ))}
    </span>
  );
}
