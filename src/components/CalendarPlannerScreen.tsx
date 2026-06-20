"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Button } from "./ui/Button";
import { LifeMap } from "./LifeMap";
import { WeeklyReviewSheet } from "./WeeklyReviewSheet";
import { MonthCalendar } from "./MonthCalendar";
import { AREA_LABELS } from "@/domain/types";
import { branchPositionAge, currentStreak, heatmap } from "@/domain/daily";
import { actionsOnDay, unscheduledActions } from "@/domain/calendar";
import { goalProgress } from "@/domain/goals";
import { localTodayStr } from "@/lib/dailyClient";

const _bootToday = localTodayStr();

export function CalendarPlannerScreen() {
  const { tree, openTree, openPath, scheduleAction, toggleActionOn, markDueGoalsReviewed, addBranch } = useApp();
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
  const [weeklyOpen, setWeeklyOpen] = useState(false);

  const goals = tree?.goals ?? [];
  const activeLong = useMemo(() => goals.filter((g) => g.horizon === "long" && g.status === "active"), [goals]);
  const streak = useMemo(() => (tree ? currentStreak(tree, today) : 0), [tree, today]);
  const hm = useMemo(() => (tree ? heatmap(tree, 30, today) : []), [tree, today]);
  const doneLong = useMemo(() => (tree ? tree.goals.filter((g) => g.horizon === "long" && g.status === "done") : []), [tree]);
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
          <div className="mt-1 flex items-center gap-3 text-sm text-[var(--fg-dim)]">
            <span className="inline-flex items-center gap-1 text-[var(--c-amber)]">🔥 {t("连续 {n} 天", { n: streak })}</span>
            <HeatStrip days={hm} t={t} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="subtle" onClick={() => setWeeklyOpen(true)}>{t("📅 本周回顾")}</Button>
        </div>
      </header>

      {doneLong.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {doneLong.map((g) => (
            <div key={g.id} className="flex items-center gap-2 rounded-2xl border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/10 px-4 py-2.5 text-sm">
              <span>🏆</span>
              <span className="text-[var(--fg)]">{t("你真的做到了：{title}", { title: g.title })}</span>
              {g.pathId && (
                <button onClick={() => openPath(g.pathId as string)} className="ml-auto flex-shrink-0 rounded-full border border-[var(--accent)]/50 px-3 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15">
                  {t("和未来的你说一声")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
    <span className="inline-flex items-end gap-0.5" aria-label={t("最近完成情况")}>
      {days.map((d) => (
        <span key={d.date} title={`${d.date}: ${d.count}`} className="inline-block h-3 w-1.5 rounded-[1px]" style={{ backgroundColor: shade(d.count), opacity: d.count > 0 ? 1 : 0.5 }} />
      ))}
    </span>
  );
}
