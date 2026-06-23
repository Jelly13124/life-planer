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
import { longGoals, shortGoalsOf } from "@/domain/goalTree";
import { localTodayStr } from "@/lib/dailyClient";
import { parseQuickInput } from "@/domain/quickParse";
import { IconFlame, IconCalendar, IconTrophy, IconTarget, IconTree, IconPlus } from "./ui/icons";

const _bootToday = localTodayStr();

// 周几全称（0=周日…6=周六），用于「每周X」习惯的快速添加回显。
const WEEKDAY_FULL = ["每周日", "每周一", "每周二", "每周三", "每周四", "每周五", "每周六"];

export function CalendarPlannerScreen() {
  const { tree, openTree, openPath, openPlan, scheduleAction, updateGoal, markDueGoalsReviewed, addBranch, addLooseTask, quickAdd } = useApp();
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
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [quickText, setQuickText] = useState("");
  const [quickEcho, setQuickEcho] = useState<string | null>(null); // 刚添加内容的简短回显（短暂显示）

  // 目标列只列「长期目标」（方向/身份级、上树那一层）；短期目标归在其长期父目标下。
  const activeLongGoals = useMemo(
    () => (tree ? longGoals(tree).filter((g) => g.status === "active") : []),
    [tree],
  );
  const streak = useMemo(() => (tree ? currentStreak(tree, today) : 0), [tree, today]);
  const hm = useMemo(() => (tree ? heatmap(tree, 30, today) : []), [tree, today]);
  const doneGoals = useMemo(() => (tree ? tree.goals.filter((g) => g.status === "done") : []), [tree]);
  const unsched = useMemo(() => (tree ? unscheduledActions(tree) : []), [tree]);
  const markers = useMemo(() => {
    if (!tree) return [];
    return tree.goals
      .filter((g) => g.status === "active" && g.pathId)
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
  // 提交快速添加：先用同一口径解析出回显（标题 · 日期/重复 · 时间），再 quickAdd 落库。
  function submitQuick() {
    const raw = quickText.trim();
    if (!raw) return;
    const id = quickAdd(raw);
    setQuickText("");
    if (!id) return;
    const p = parseQuickInput(raw, today);
    const parts = [p.text];
    if (p.repeat === "daily") parts.push(t("每天"));
    else if (p.repeat === "weekly") parts.push(t(WEEKDAY_FULL[p.repeatWeekday ?? 1]));
    else if (p.scheduledDate) parts.push(p.scheduledDate === today ? t("今天") : p.scheduledDate);
    if (p.startTime) parts.push(p.startTime);
    setQuickEcho(t("已添加：{summary}", { summary: parts.join(" · ") }));
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Life Planner"
        title={t("规划")}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-[var(--c-amber)]"><IconFlame className="h-3.5 w-3.5" /> {t("连续 {n} 天", { n: streak })}</span>
            <HeatStrip days={hm} t={t} />
          </span>
        }
        actions={<Button variant="subtle" onClick={() => setWeeklyOpen(true)}><span className="inline-flex items-center gap-1.5"><IconCalendar className="h-4 w-4" />{t("本周回顾")}</span></Button>}
      />

      {/* 快速添加：一行自然语言 → 散任务/散习惯（日期/时间/重复/标签自动解析）。回车提交，保持聚焦以便连记。 */}
      <Card pad="sm" className="mb-6">
        <label htmlFor="quick-add" className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">
          {t("快速添加")}
        </label>
        <div className="flex items-center gap-2">
          <input
            id="quick-add"
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submitQuick();
              } else if (e.key === "Escape") {
                setQuickText("");
              }
            }}
            placeholder={t("跑步 明天 7点  /  喝水 每天  /  开会 周三 14:00")}
            aria-label={t("快速添加")}
            className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
          />
          <button
            type="button"
            onClick={submitQuick}
            disabled={!quickText.trim()}
            aria-label={t("添加")}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <IconPlus className="h-4 w-4" />
            {t("添加")}
          </button>
        </div>
        {quickEcho && (
          <div className="mt-2 text-[11px] text-[var(--c-emerald)]">{quickEcho}</div>
        )}
      </Card>

      {!tree.guideDismissed && <GettingStarted tree={tree} />}

      {doneGoals.length > 0 && (
        <div className="mb-6 space-y-2">
          {doneGoals.map((g) => (
            <div key={g.id} className="flex items-center gap-2.5 rounded-2xl border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/10 px-4 py-3 text-sm">
              <IconTrophy className="h-4 w-4 flex-shrink-0 text-[var(--c-emerald)]" />
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
                      ? "bg-[var(--accent)] text-white"
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
                pendingActionId={pendingActionId}
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
                onSchedule={(id, date) => scheduleAction(id, date)}
                onScheduleGoal={(id, date) => updateGoal(id, { startDate: date })}
                onPlaceHere={placeHere}
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
                onScheduleGoal={(id, date) => updateGoal(id, { startDate: date })}
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
        </div>

        {/* RIGHT: goals + prediction + backlog */}
        <div className="flex flex-col gap-4 lg:w-[40%]">
          <Card pad="md">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">{t("目标")}</div>
            {activeLongGoals.length === 0 ? (
              <EmptyState
                size="inline"
                icon={<IconTarget className="h-6 w-6" />}
                description={t("还没有目标。去「我的规划」加一个。")}
                action={
                  <button onClick={openPlan} className="rounded-full border border-[var(--accent)]/50 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15">
                    {t("去规划")}
                  </button>
                }
              />
            ) : (
              <div className="space-y-3.5">
                {activeLongGoals.map((g) => {
                  // 长期目标的进度 = 旗下短期目标 + 自身里程碑的综合 roll-up。
                  const pct = Math.round(goalProgress(tree, g) * 100);
                  const shortCount = shortGoalsOf(tree, g.id).length;
                  return (
                    <button
                      key={g.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", g.id);
                        e.dataTransfer.setData("application/x-lp-kind", "goal");
                      }}
                      onClick={() => g.pathId && openPath(g.pathId)}
                      title={t("拖到日历 = 设为开始日")}
                      className="block w-full cursor-grab text-left active:cursor-grabbing"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span aria-hidden="true" className="flex-shrink-0 text-[var(--fg-faint)]">⠿</span>
                          <span className="truncate text-[var(--fg)]">{g.title}</span>
                        </span>
                        <span className="ml-2 flex-shrink-0 text-[11px] tabular-nums text-[var(--fg-faint)]">{t("进度 {pct}%", { pct })}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.08]"><div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} /></div>
                      {shortCount > 0 && (
                        <div className="mt-1 pl-[18px] text-[10px] text-[var(--fg-faint)]">{t("{n} 个短期目标", { n: shortCount })}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* 未来预测 — 日视图下隐藏 */}
          {calView !== "day" && (
            <Card pad="sm" sunken>
              <div className="mb-2 px-1 text-[11px] text-[var(--fg-faint)]">{t("未来预测 ·「你在这里」随里程碑前进")}</div>
              {hasChoicePaths ? (
                <div className="lp-media-dark overflow-hidden rounded-2xl p-2">
                  <LifeMap tree={tree} compact markers={markers} onSelectPath={openPath} onForkAtNode={() => openTree()} />
                </div>
              ) : (
                <EmptyState
                  size="inline"
                  icon={<IconTree className="h-6 w-6" />}
                  description={t("还没有路。去「我的规划」加一个长期目标，它会在树上长出一条路。")}
                  action={
                    <button onClick={openPlan} className="rounded-full border border-[var(--accent)]/50 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15">
                      {t("去规划")}
                    </button>
                  }
                />
              )}
            </Card>
          )}

          {/* 待安排 backlog — drag source, persistent across year/month/day */}
          <Card pad="md">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">{t("待安排")}</span>
              <button
                type="button"
                onClick={() => setAddingTask((v) => !v)}
                aria-label={t("新任务")}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--fg-faint)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
              >
                {t("＋ 任务")}
              </button>
            </div>
            {addingTask && (
              <input
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && newTaskText.trim()) {
                    addLooseTask(newTaskText.trim());
                    setNewTaskText("");
                  } else if (e.key === "Escape") {
                    setNewTaskText("");
                    setAddingTask(false);
                  }
                }}
                onBlur={() => {
                  if (newTaskText.trim()) addLooseTask(newTaskText.trim());
                  setNewTaskText("");
                  setAddingTask(false);
                }}
                placeholder={t("任务名称")}
                aria-label={t("新任务")}
                className="mb-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
                autoFocus
              />
            )}
            <div className="mb-2 text-[11px] text-[var(--fg-dim)]">{t("未排期任务")}</div>
            <div className="flex flex-col gap-1.5">
              {unsched.length === 0 && <span className="text-xs text-[var(--fg-faint)]">{t("没有未排期的任务")}</span>}
              {unsched.map(({ item }) => (
                <button
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item.id);
                    e.dataTransfer.setData("application/x-lp-kind", "task");
                  }}
                  onClick={() => setPendingActionId((cur) => (cur === item.id ? null : item.id))}
                  title={item.text}
                  className={`w-full cursor-grab truncate rounded-xl border px-3 py-2 text-left text-xs transition active:cursor-grabbing ${
                    pendingActionId === item.id ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--line)] text-[var(--fg-dim)] hover:border-[var(--accent)]/60 hover:bg-black/[0.02]"
                  }`}
                >
                  {item.text}
                </button>
              ))}
            </div>
            {unsched.length > 0 && (
              <div className="mt-2.5 text-[11px] text-[var(--fg-faint)]">
                {pendingActionId ? t("点日历某天放下它") : t("拖到日历某天安排")}
              </div>
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
