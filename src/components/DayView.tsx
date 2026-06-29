"use client";

import { useRef, useState } from "react";
import type { IcsEvent, LifeTree } from "@/domain/types";
import { GOAL_AREA_LABELS } from "@/domain/types";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { actionsOnDay, weekdayOf } from "@/domain/calendar";
import { findItem, goalById } from "@/domain/goalTree";
import { dayWindow, toMinutes, toHHMM, DEFAULT_DURATION_MIN } from "@/domain/schedule";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { IconSparkle, IconPlus, IconRepeat, IconCalendar } from "./ui/icons";

// 日视图：把某天的行动摊在一条竖直时间轴上。纯渲染（date 由 props 注入，绝不在渲染里 new Date）。
// 时间块按 startTime 绝对定位、按 durationMin 定高；像素/分钟比固定，便于眼睛对齐刻度。
// 时间轴是个放置目标：把任务拖到网格上，按落点 Y 反推时刻（吸附到最近 15 分钟）。
// 任务可点开看详情（所属目标/子目标/排期/时间/时长，行内可改）——详情统一渲染在时间轴下方的一张卡里，
// 一次只看一条，避免时间块定高导致的溢出/绝对定位难题。

const PX_PER_MIN = 0.8;
const SNAP_MIN = 15; // 落点时刻吸附粒度（分钟）
// weekdayOf: 0=周日…6=周六。用完整「周X」token，经 t() 译成 Sun…Sat（英文下不漏中文）。
const WEEKDAY_TOKEN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
// 时长可选项（分钟）。
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240];

export function DayView({
  tree,
  date,
  events = [],
  onPrevDay,
  onNextDay,
  onToday,
}: {
  tree: LifeTree;
  date: string;
  events?: IcsEvent[]; // 只读外部日历事件（ICS 导入），不参与拖拽/AI 排程
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
}) {
  const {
    setActionTimeById,
    setDayWindowValues,
    arrangeDayWithAI,
    toggleActionOn,
    removeActionById,
    scheduleActionAt,
    scheduleAction,
    addLooseTask,
    addLooseHabit,
    updateGoal,
    openPlanFocused,
  } = useApp();
  const { t } = useT();
  const [arranging, setArranging] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState(false);
  // 行内快速创建：null=都收起；"task"=新任务（落到这天）；"routine"=新日常（每天重复）。
  const [composing, setComposing] = useState<null | "task" | "routine">(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // 在日历上建一条散任务并排到当天（未排时间，可拖到时间轴定时）。
  function createTaskOnDay(text: string) {
    const id = addLooseTask(text);
    if (id) scheduleAction(id, date);
  }
  // 在日历上建一条散日常（每天重复的习惯，如「上班」；无目标 → 无时间窗，永远重复）。
  function createRoutine(text: string) {
    addLooseHabit(text, "daily");
  }

  const win = dayWindow(tree);
  const items = actionsOnDay(tree, date);
  const timed = items
    .filter((i) => i.item.startTime)
    .sort((a, b) => toMinutes(a.item.startTime!) - toMinutes(b.item.startTime!));
  const untimed = items.filter((i) => !i.item.startTime);

  // 只读外部日历（ICS）：分全天与定时。定时事件落到时间轴上当只读块；全天事件进顶部一条窄行。
  const extAllDay = events.filter((e) => e.allDay || !e.startTime);
  const extTimed = events
    .filter((e) => !e.allDay && e.startTime)
    .sort((a, b) => toMinutes(a.startTime!) - toMinutes(b.startTime!));

  const startMin = toMinutes(win.start);
  const endMin = toMinutes(win.end);
  const totalHeight = Math.max(200, (endMin - startMin) * PX_PER_MIN);

  // 整点刻度：从起床所在的下一个整点，到睡觉所在的整点。
  const firstHour = Math.ceil(startMin / 60);
  const lastHour = Math.floor(endMin / 60);
  const hours: number[] = [];
  for (let h = firstHour; h <= lastHour; h++) hours.push(h);

  const wd = t(WEEKDAY_TOKEN[weekdayOf(date)]);

  // 当前展开的任务（点开后查树定位所属目标/子目标）。已不在当天则视为未展开。
  const expandedLoc = expandedId ? findItem(tree, expandedId) : null;
  const expandedOnDay = expandedId ? items.some((i) => i.item.id === expandedId) : false;
  const detail = expandedOnDay ? expandedLoc : null;

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  async function runArrange() {
    if (arranging) return;
    setArranging(true);
    try {
      await arrangeDayWithAI(date);
    } finally {
      setArranging(false);
    }
  }

  // 落在时间轴上：goal → 设 startDate；task → 按落点 Y 反推时刻（有网格时）或仅排到当天（空态）。
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropOver(false);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const kind = e.dataTransfer.getData("application/x-lp-kind") || "task";
    if (kind === "goal") {
      updateGoal(id, { startDate: date });
      return;
    }
    // task：渲染了网格 → 按 Y 反推时刻；空态（无网格）→ 仅排到当天（未排时间）。
    const grid = gridRef.current;
    if (grid) {
      const rect = grid.getBoundingClientRect();
      const raw = startMin + (e.clientY - rect.top) / PX_PER_MIN;
      const snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN;
      const clamped = Math.max(startMin, Math.min(endMin, snapped));
      scheduleActionAt(id, date, toHHMM(clamped));
    } else {
      scheduleActionAt(id, date);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1) 头部：‹ 日期·星期 › + 回到今天 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onPrevDay}
            aria-label={t("前一天")}
            className="lp-tap-sq flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]"
          >
            ‹
          </button>
          <div className="text-sm font-semibold tracking-tight text-[var(--fg)]">
            {date} <span className="text-[var(--fg-faint)]">{wd}</span>
          </div>
          <button
            onClick={onNextDay}
            aria-label={t("后一天")}
            className="lp-tap-sq flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]"
          >
            ›
          </button>
        </div>
        <button
          onClick={onToday}
          className="lp-tap inline-flex items-center justify-center rounded-full border border-[var(--line)] px-3 py-1 text-[11px] text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]"
        >
          {t("回到今天")}
        </button>
      </div>

      {/* 2) 作息窗口 + AI 排一天 */}
      <Card pad="sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--fg-faint)]">
            {t("起床")}
            <input
              type="time"
              value={win.start}
              onChange={(e) => setDayWindowValues(e.target.value || win.start, win.end)}
              className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)]/60 [color-scheme:light]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--fg-faint)]">
            {t("睡觉")}
            <input
              type="time"
              value={win.end}
              onChange={(e) => setDayWindowValues(win.start, e.target.value || win.end)}
              className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)]/60 [color-scheme:light]"
            />
          </label>
          <Button
            variant="primary"
            onClick={runArrange}
            disabled={arranging || items.length === 0}
            className="lp-tap ml-auto !px-4 !py-2 text-xs"
          >
            {arranging ? (
              t("正在排…")
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <IconSparkle className="h-4 w-4" />
                {t("AI 帮我排今天")}
              </span>
            )}
          </Button>
        </div>
      </Card>

      {/* 2b) 快速创建：＋ 任务（落到这天，可拖到时间轴定时）/ ＋ 日常（每天重复，不必服务某目标） */}
      <Card pad="sm">
        {composing === "task" ? (
          <QuickAddInput
            placeholder={t("任务名称")}
            ariaLabel={t("新任务")}
            onAdd={(text) => createTaskOnDay(text)}
            onClose={() => setComposing(null)}
          />
        ) : composing === "routine" ? (
          <QuickAddInput
            placeholder={t("日常名称（如 上班）")}
            ariaLabel={t("新日常（每天重复）")}
            onAdd={(text) => createRoutine(text)}
            onClose={() => setComposing(null)}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setComposing("task")}
              aria-label={t("新任务")}
              className="lp-tap inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--line)] px-3 py-1.5 text-xs text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
            >
              <IconPlus className="h-3.5 w-3.5" />
              {t("＋ 任务")}
            </button>
            <button
              type="button"
              onClick={() => setComposing("routine")}
              aria-label={t("新日常（每天重复）")}
              className="lp-tap inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--line)] px-3 py-1.5 text-xs text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
            >
              <IconRepeat className="h-3.5 w-3.5" />
              {t("＋ 日常")}
            </button>
          </div>
        )}
      </Card>

      {/* 3) 时间轴（顶部一条「未定时」chip 带：未排时间但已排到当天的任务，可拖到网格定时） */}
      <Card pad="sm">
        {/* 只读外部日历的全天事件：顶部一条窄行，虚线描边 + 日历图标，明显「外部·只读」 */}
        {extAllDay.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5 border-b border-[var(--line)]/60 pb-3">
            <span className="mr-1 self-center text-[10px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">
              {t("全天")}
            </span>
            {extAllDay.map((e) => (
              <span
                key={e.id}
                className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-dashed border-[var(--line)] px-2 py-1 text-[11px] text-[var(--fg-faint)]"
                title={t("只读日历事件：{title}", { title: e.title })}
              >
                <IconCalendar className="h-3 w-3 flex-shrink-0" />
                <span className="min-w-0 truncate">{e.title}</span>
              </span>
            ))}
          </div>
        )}
        {untimed.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5 border-b border-[var(--line)]/60 pb-3">
            <span className="mr-1 self-center text-[10px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">
              {t("未定时")}
            </span>
            {untimed.map(({ item, done }) => {
              const isOpen = expandedId === item.id;
              return (
                <span
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item.id);
                    e.dataTransfer.setData("application/x-lp-kind", "task");
                  }}
                  className={`inline-flex max-w-[12rem] cursor-grab items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition active:cursor-grabbing ${
                    isOpen ? "border-[var(--accent)] bg-[var(--accent)]/15" : "border-[var(--line)] hover:border-[var(--accent)]/60"
                  }`}
                >
                  <button
                    onClick={() => toggleActionOn(item.id, date)}
                    aria-label={done ? t("标记未完成") : t("标记完成")}
                    className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border text-[9px] transition ${
                      done
                        ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]"
                        : "border-[var(--line)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </button>
                  <button
                    onClick={() => toggleExpand(item.id)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? t("收起任务详情") : t("展开任务详情")}
                    className={`min-w-0 truncate text-left ${
                      done ? "text-[var(--fg-faint)] line-through" : isOpen ? "text-[var(--accent)]" : "text-[var(--fg-dim)]"
                    }`}
                  >
                    {item.text}
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!dropOver) setDropOver(true);
          }}
          onDragLeave={(e) => {
            // 仅当真正离开容器时才取消（忽略子元素间的冒泡）
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropOver(false);
          }}
          onDrop={handleDrop}
          className={`rounded-lg transition ${dropOver ? "ring-2 ring-[var(--accent)]/60 ring-offset-2 ring-offset-[var(--bg-1)]" : ""}`}
        >
          {items.length === 0 && extTimed.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs leading-relaxed text-[var(--fg-faint)]">
              {t("这天还没有安排。把行动拖到时间轴上排时间，或在「目标」里加行动。")}
            </p>
          ) : (
            <div ref={gridRef} className="relative pl-12" style={{ height: totalHeight }}>
              {/* 整点刻度 + 标签 */}
              {hours.map((h) => {
                const top = (h * 60 - startMin) * PX_PER_MIN;
                return (
                  <div key={h} className="absolute inset-x-0" style={{ top }}>
                    <span className="absolute -left-12 -translate-y-1/2 text-[10px] tabular-nums text-[var(--fg-faint)]">
                      {toHHMM(h * 60)}
                    </span>
                    <div className="h-px w-full bg-[var(--line)]/60" />
                  </div>
                );
              })}

              {/* 时间块 */}
              {timed.map(({ goal, item, done }) => {
                const s = toMinutes(item.startTime!);
                const dur = item.durationMin ?? DEFAULT_DURATION_MIN;
                const top = Math.max(0, (s - startMin) * PX_PER_MIN);
                const height = Math.max(18, dur * PX_PER_MIN);
                const accent = goal?.pathId ? colorOfPath(tree, goal.pathId) : null;
                const isOpen = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className="absolute right-0 left-1 overflow-hidden rounded-lg border px-2 py-1 transition"
                    style={{
                      top,
                      height,
                      borderColor: isOpen ? "var(--accent)" : done ? "var(--line)" : accent ? `${accent}66` : "var(--accent)",
                      backgroundColor: done ? "transparent" : accent ? `${accent}24` : "rgba(194,65,12,0.1)",
                    }}
                  >
                    {/* 块体不再整体切换完成；只有左侧的勾选框切换 */}
                    <div className="flex h-full w-full items-center gap-1.5 pr-10 text-left">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActionOn(item.id, date);
                        }}
                        aria-label={done ? t("标记未完成") : t("标记完成")}
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[9px] transition ${
                          done
                            ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]"
                            : "border-[var(--line)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {done ? "✓" : ""}
                      </button>
                      <button
                        onClick={() => toggleExpand(item.id)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? t("收起任务详情") : t("展开任务详情")}
                        className="flex min-w-0 flex-1 flex-col justify-center text-left"
                      >
                        <span className={`w-full truncate text-[12px] leading-tight ${done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}`}>
                          {item.text}
                        </span>
                        <span className="mt-0.5 flex w-full items-center gap-1.5 text-[10px] text-[var(--fg-faint)]">
                          <span className="tabular-nums">{toHHMM(s)}–{toHHMM(s + dur)}</span>
                          <span className="truncate">{goal ? t(GOAL_AREA_LABELS[goal.area]) : t("无目标")}</span>
                        </span>
                      </button>
                    </div>
                    <button
                      onClick={() => setActionTimeById(item.id, null)}
                      aria-label={t("清除时间")}
                      title={t("清除时间")}
                      className="absolute right-6 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-[var(--fg-faint)] transition hover:bg-black/[0.06] hover:text-[var(--fg-dim)]"
                    >
                      ⌫
                    </button>
                    <button
                      onClick={() => removeActionById(item.id)}
                      aria-label={t("删除任务")}
                      title={t("删除任务")}
                      className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-[var(--fg-faint)] transition hover:bg-black/[0.06] hover:text-[var(--c-rose)]"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              {/* 只读外部日历定时事件：虚线描边 + 日历图标，无勾选/删除，不参与拖拽/AI 排程 */}
              {extTimed.map((e) => {
                const s = toMinutes(e.startTime!);
                const end = e.endTime ? toMinutes(e.endTime) : s + DEFAULT_DURATION_MIN;
                const dur = Math.max(15, end - s);
                const top = Math.max(0, (s - startMin) * PX_PER_MIN);
                const height = Math.max(18, dur * PX_PER_MIN);
                return (
                  <div
                    key={`ics-${e.id}`}
                    className="absolute right-0 left-1 overflow-hidden rounded-lg border border-dashed border-[var(--line)] bg-black/[0.03] px-2 py-1"
                    style={{ top, height }}
                    title={t("只读日历事件：{title}", { title: e.title })}
                  >
                    <div className="flex h-full w-full items-start gap-1.5 text-left">
                      <IconCalendar className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--fg-faint)]" />
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <span className="w-full truncate text-[12px] leading-tight text-[var(--fg-dim)]">{e.title}</span>
                        <span className="mt-0.5 w-full text-[10px] tabular-nums text-[var(--fg-faint)]">
                          {e.startTime}{e.endTime ? `–${e.endTime}` : ""} · {t("只读")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* 5) 展开任务详情（统一渲染在时间轴下方，一次一条） */}
      {detail && (
        <Card pad="sm">
          <TaskDetail
            tree={tree}
            date={date}
            loc={detail}
            onGoToGoal={(goalId) => openPlanFocused(goalId)}
            onSetTime={(id, start, dur) => setActionTimeById(id, start, dur)}
            onRemove={(id) => {
              removeActionById(id);
              setExpandedId(null);
            }}
            onClose={() => setExpandedId(null)}
          />
        </Card>
      )}
    </div>
  );
}

// 任务详情面板：所属目标（可跳「计划」）/ 子目标 / 排期 / 时间 / 时长（行内可改）/ 为什么。
function TaskDetail({
  tree,
  date,
  loc,
  onGoToGoal,
  onSetTime,
  onRemove,
  onClose,
}: {
  tree: LifeTree;
  date: string;
  loc: NonNullable<ReturnType<typeof findItem>>;
  onGoToGoal: (goalId: string) => void;
  onSetTime: (id: string, startTime: string | null, durationMin?: number) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const { goal, item } = loc;
  // 两级模型：任务挂在长期或短期目标上。若挂在短期目标，展示其所属长期目标为「上级目标」。
  // 散任务（goal=null）无所属/上级目标。
  const parentLong =
    goal && goal.kind === "short" && goal.parentGoalId ? goalById(tree, goal.parentGoalId) : null;
  const dur = item.durationMin ?? DEFAULT_DURATION_MIN;
  const startTime = item.startTime ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">{t("任务详情")}</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-[var(--fg)]">{item.text}</div>
        </div>
        <button
          onClick={onClose}
          aria-label={t("收起任务详情")}
          title={t("收起任务详情")}
          className="flex-shrink-0 rounded-full px-1.5 py-1 text-[11px] text-[var(--fg-faint)] transition hover:text-[var(--fg-dim)]"
        >
          ✕
        </button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-xs">
        {/* 所属目标（可跳计划）；散任务 → 显示「无目标」，不可跳 */}
        <dt className="text-[var(--fg-faint)]">{t("所属目标")}</dt>
        <dd className="min-w-0">
          {goal ? (
            <>
              <button
                onClick={() => onGoToGoal(goal.id)}
                className="max-w-full truncate text-left text-[var(--accent)] underline-offset-2 transition hover:underline"
                title={t("去目标")}
              >
                {goal.title}
              </button>
              <span className="ml-1.5 text-[10px] text-[var(--fg-faint)]">{t(GOAL_AREA_LABELS[goal.area])}</span>
            </>
          ) : (
            <span className="text-[var(--fg-dim)]">{t("无目标")}</span>
          )}
        </dd>

        {/* 上级长期目标（仅当任务挂在短期目标时） */}
        <dt className="text-[var(--fg-faint)]">{t("上级目标")}</dt>
        <dd className="min-w-0 truncate text-[var(--fg-dim)]">{parentLong ? parentLong.title : "—"}</dd>

        {/* 排期 */}
        <dt className="text-[var(--fg-faint)]">{t("排期")}</dt>
        <dd className="text-[var(--fg-dim)] tabular-nums">{date}</dd>

        {/* 时间（行内可改 + 清除） */}
        <dt className="text-[var(--fg-faint)]">{t("时间")}</dt>
        <dd className="flex items-center gap-2">
          <input
            type="time"
            value={startTime ?? ""}
            aria-label={t("设置开始时间")}
            onChange={(e) => onSetTime(item.id, e.target.value || null, dur)}
            className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)]/60 [color-scheme:light]"
          />
          {!startTime && <span className="text-[10px] text-[var(--fg-faint)]">{t("未排时间")}</span>}
          {startTime && (
            <button
              onClick={() => onSetTime(item.id, null, dur)}
              className="rounded-full px-2 py-1 text-[10px] text-[var(--fg-faint)] transition hover:text-[var(--fg-dim)]"
            >
              {t("清除时间")}
            </button>
          )}
        </dd>

        {/* 时长（行内可改） */}
        <dt className="text-[var(--fg-faint)]">{t("时长")}</dt>
        <dd>
          <select
            value={dur}
            aria-label={t("时长")}
            onChange={(e) => onSetTime(item.id, startTime, Number(e.target.value))}
            className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)]/60 [color-scheme:light]"
          >
            {(DURATION_OPTIONS.includes(dur) ? DURATION_OPTIONS : [dur, ...DURATION_OPTIONS]).map((d) => (
              <option key={d} value={d} className="bg-[var(--bg-1)] text-[var(--fg)]">
                {d} {t("分钟")}
              </option>
            ))}
          </select>
        </dd>
      </dl>

      {goal && goal.why ? <p className="text-[11px] leading-relaxed text-[var(--fg-faint)]">{goal.why}</p> : null}

      <div className="flex items-center justify-end">
        <button
          onClick={() => onRemove(item.id)}
          className="rounded-lg px-2.5 py-1 text-[11px] text-[var(--fg-faint)] transition hover:text-[var(--c-rose)]"
        >
          {t("删除任务")}
        </button>
      </div>
    </div>
  );
}

// 取这条路在树上的颜色（找不到则 null → 用强调色兜底）。
function colorOfPath(tree: LifeTree, pathId: string): string | null {
  return tree.paths.find((p) => p.id === pathId)?.color ?? null;
}

// 行内单行快速创建输入：回车提交（提交后清空、保持开启，便于连建）；Esc / 失焦收起。
function QuickAddInput({
  placeholder,
  ariaLabel,
  onAdd,
  onClose,
}: {
  placeholder: string;
  ariaLabel: string;
  onAdd: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing && text.trim()) {
          onAdd(text.trim());
          setText("");
        } else if (e.key === "Escape") {
          onClose();
        }
      }}
      onBlur={() => {
        if (text.trim()) onAdd(text.trim());
        onClose();
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
      autoFocus
    />
  );
}
