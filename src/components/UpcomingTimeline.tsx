"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Goal, Habit, Task } from "@/domain/types";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { actionsOnDay, unscheduledActions, weekdayOf } from "@/domain/calendar";
import { addDays } from "@/domain/daily";
import { localTodayStr } from "@/lib/dailyClient";
import { AREA_COLOR, AreaIcon } from "./lib/areaMeta";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";
import { IconRepeat, IconPointer, IconList } from "./ui/icons";

// 散项（goal=null）的中性条色：用 line 色，与领域配色区分。
const NEUTRAL_COLOR = "var(--fg-faint)";

// 「即将到来」视图：从今天起的多日横向规划带。
// - 14 个日期列（横向滚动可见更多，渲染到 21 天）。今天列高亮。
// - 每列：该日已排期的一次性任务 = 领域配色的「条」（带勾选完成）；
//   该日到期的习惯 = 暗淡的只读「幽灵芯片」（习惯按 repeat 复发，不在这里拖/勾）。
// - 未排期托盘（顶部）：unscheduledActions 的任务芯片（可拖、可点选）。
// - 桌面 HTML5 拖放：芯片/条可拖；日列 + 托盘是放置区；放到某天 = scheduleAction(id, date)，
//   放回托盘 = scheduleAction(id, null)，条拖到别天 = 改期。
// - 移动端点选兜底（镜像月历）：点芯片/条 → 选中（高亮 + 顶部提示条）；点某天 → 排到那天；
//   点提示条/托盘 → 取消选中。完全不依赖拖放也能用。
// today 用启动常量 + 可见性事件刷新（绝不在模块作用域 new Date）。

const _bootToday = localTodayStr();
const DAY_COUNT = 21; // 渲染天数（横向滚动）；默认可见约 14 天。
// weekdayOf: 0=周日…6=周六。用完整「周X」token，经 t() 译成 Sun…Sat（英文下不漏中文）。
const WEEKDAY_TOKEN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

type DayCell = {
  date: string;
  tasks: { goal: Goal | null; task: Task; done: boolean }[];
  habits: { goal: Goal | null; habit: Habit }[];
};

export function UpcomingTimeline() {
  const { tree, scheduleAction, toggleActionOn, openDashboard } = useApp();
  const { t } = useT();

  const [today, setToday] = useState(_bootToday);
  useEffect(() => {
    const update = () => setToday(localTodayStr());
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);

  // 点选中的行动 id（移动端/键盘兜底）。拖放进行中用 ref 暂存被拖的 id。
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  // 当前被悬停的放置区（"tray" 或日期串），用于显示放置环。
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const days: DayCell[] = useMemo(() => {
    if (!tree) return [];
    const out: DayCell[] = [];
    for (let i = 0; i < DAY_COUNT; i++) {
      const date = addDays(today, i);
      const acts = actionsOnDay(tree, date);
      const tasks: DayCell["tasks"] = [];
      const habits: DayCell["habits"] = [];
      for (const a of acts) {
        if (a.kind === "scheduled") tasks.push({ goal: a.goal, task: a.item as Task, done: a.done });
        else habits.push({ goal: a.goal, habit: a.item as Habit });
      }
      out.push({ date, tasks, habits });
    }
    return out;
  }, [tree, today]);

  const unsched = useMemo(() => (tree ? unscheduledActions(tree) : []), [tree]);

  if (!tree) return null;

  // 被选中的行动文本（用于提示条）。先从未排期里找，再从各天的条里找。
  const selectedText = (() => {
    if (!selectedId) return null;
    const u = unsched.find((x) => x.item.id === selectedId);
    if (u) return u.item.text;
    for (const d of days) {
      const hit = d.tasks.find((x) => x.task.id === selectedId);
      if (hit) return hit.task.text;
    }
    return null;
  })();

  // 点选某行动（已选则取消）；用于移动端/键盘。
  function toggleSelect(id: string) {
    setSelectedId((cur) => (cur === id ? null : id));
  }

  // 把行动放到某天：拖放或点选两条路都汇到这里。
  function placeOn(id: string, date: string) {
    scheduleAction(id, date);
    setSelectedId(null);
  }

  // 放回托盘 = 清排期（date=null）。
  function placeInTray(id: string) {
    scheduleAction(id, null);
    setSelectedId(null);
  }

  // 点某天：若有选中的行动 → 排到这天；否则不做。
  function dayClick(date: string) {
    if (selectedId) placeOn(selectedId, date);
  }

  function clearSelection() {
    setSelectedId(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Upcoming"
        title={t("即将到来")}
        subtitle={t("把未排期的任务拖到某天，或点一下任务再点某天放入。今天起的两三周一览。")}
      />

      {/* 选中提示条（移动端/键盘兜底）：点它取消选择 */}
      {selectedText && (
        <button
          onClick={clearSelection}
          className="mb-4 flex w-full items-center gap-2 rounded-2xl border border-[var(--accent)]/50 bg-[var(--accent)]/[0.12] px-4 py-2.5 text-left text-sm text-[var(--fg)] transition hover:bg-[var(--accent)]/[0.18]"
        >
          <IconPointer className="h-4 w-4 flex-shrink-0" />
          <span className="min-w-0 flex-1 truncate">{t("已选 {text}", { text: selectedText })}</span>
          <span className="flex-shrink-0 text-xs text-[var(--fg-dim)]">{t("点某天放入")} · {t("取消")}</span>
        </button>
      )}

      {/* 未排期托盘（拖源 + 放置区，放回 = 清排期） */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDropTarget("tray");
        }}
        onDragLeave={() => setDropTarget((c) => (c === "tray" ? null : c))}
        onDrop={(e) => {
          e.preventDefault();
          setDropTarget(null);
          const id = e.dataTransfer.getData("text/plain") || dragIdRef.current;
          if (id) placeInTray(id);
        }}
        onClick={() => selectedId && clearSelection()}
        className={`mb-5 rounded-2xl border p-3 transition ${
          dropTarget === "tray"
            ? "border-[var(--accent)] bg-[var(--accent)]/[0.08]"
            : "border-[var(--line)] bg-[var(--bg-1)]"
        }`}
      >
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">
          {t("未排期")} · {t("拖到某天安排")}
        </div>
        {unsched.length === 0 ? (
          <p className="px-1 py-1 text-xs text-[var(--fg-faint)]">{t("没有未排期的任务，太棒了。")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unsched.map(({ goal, item }) => {
              const sel = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    dragIdRef.current = item.id;
                    e.dataTransfer.setData("text/plain", item.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    dragIdRef.current = null;
                    setDropTarget(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(item.id);
                  }}
                  aria-pressed={sel}
                  aria-label={t("选择任务 {text}", { text: item.text })}
                  className={`flex max-w-[16rem] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                    sel
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "border-[var(--line)] text-[var(--fg-dim)] hover:border-[var(--accent)]/60 hover:text-[var(--fg)]"
                  }`}
                  title={goal ? `${item.text} · ${goal.title}` : `${item.text} · ${t("无目标")}`}
                >
                  {goal ? (
                    <AreaIcon area={goal.area} className="h-3.5 w-3.5" />
                  ) : (
                    <span aria-hidden="true" className="inline-flex flex-shrink-0 text-[var(--fg-faint)]">
                      <IconList className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="min-w-0 truncate">{item.text}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 横向多日带：日期列 */}
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-3">
        {days.map((cell) => (
          <DayColumn
            key={cell.date}
            cell={cell}
            isToday={cell.date === today}
            selectedId={selectedId}
            dropActive={dropTarget === cell.date}
            t={t}
            onDayClick={() => dayClick(cell.date)}
            onDragOverDay={() => setDropTarget(cell.date)}
            onDragLeaveDay={() => setDropTarget((c) => (c === cell.date ? null : c))}
            onDropDay={(id) => {
              setDropTarget(null);
              placeOn(id, cell.date);
            }}
            onDragStartTask={(id) => {
              dragIdRef.current = id;
            }}
            onDragEndTask={() => {
              dragIdRef.current = null;
              setDropTarget(null);
            }}
            onToggleSelect={toggleSelect}
            onComplete={(id) => toggleActionOn(id, cell.date)}
            onOpenDay={openDashboard}
          />
        ))}
      </div>
    </div>
  );
}

type TFn = (zh: string, vars?: Record<string, string | number>) => string;

function DayColumn({
  cell,
  isToday,
  selectedId,
  dropActive,
  t,
  onDayClick,
  onDragOverDay,
  onDragLeaveDay,
  onDropDay,
  onDragStartTask,
  onDragEndTask,
  onToggleSelect,
  onComplete,
  onOpenDay,
}: {
  cell: DayCell;
  isToday: boolean;
  selectedId: string | null;
  dropActive: boolean;
  t: TFn;
  onDayClick: () => void;
  onDragOverDay: () => void;
  onDragLeaveDay: () => void;
  onDropDay: (id: string) => void;
  onDragStartTask: (id: string) => void;
  onDragEndTask: () => void;
  onToggleSelect: (id: string) => void;
  onComplete: (id: string) => void;
  onOpenDay: () => void;
}) {
  const wd = t(WEEKDAY_TOKEN[weekdayOf(cell.date)]);
  const dom = Number(cell.date.slice(8, 10));
  const empty = cell.tasks.length === 0 && cell.habits.length === 0;
  const pickMode = selectedId !== null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverDay();
      }}
      onDragLeave={onDragLeaveDay}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropDay(id);
      }}
      className={`flex w-[150px] flex-shrink-0 flex-col rounded-2xl border transition ${
        dropActive
          ? "border-[var(--accent)] bg-[var(--accent)]/[0.08]"
          : isToday
            ? "border-[var(--accent)]/70 bg-[var(--accent)]/[0.05]"
            : "border-[var(--line)] bg-[var(--bg-1)]"
      } ${pickMode ? "hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.06]" : ""}`}
    >
      {/* 列头：可点（选中态下=放到这天，键盘可用） */}
      <button
        onClick={onDayClick}
        aria-label={
          pickMode
            ? t("放到 {wd} {d} 日", { wd, d: dom })
            : t("{wd} {d} 日", { wd, d: dom })
        }
        className="flex items-center justify-between rounded-t-2xl px-3 py-2 text-left transition"
      >
        <span className={`text-[11px] uppercase tracking-wide ${isToday ? "text-[var(--accent)]" : "text-[var(--fg-faint)]"}`}>
          {wd}
        </span>
        <span
          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] font-semibold tabular-nums ${
            isToday ? "bg-[var(--accent)] text-white" : "text-[var(--fg)]"
          }`}
        >
          {dom}
        </span>
      </button>

      {/* 当天行动列表 */}
      <div className="flex min-h-[88px] flex-1 flex-col gap-1.5 px-2 pb-2">
        {empty ? (
          <button
            onClick={onDayClick}
            className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--line)] px-2 py-4 text-center text-[11px] leading-snug text-[var(--fg-faint)] transition hover:border-[var(--accent)]/50"
          >
            {pickMode ? t("放到这天") : t("这天没有安排")}
          </button>
        ) : (
          <>
            {/* 任务条（领域配色、可拖、可点选、勾选完成）；散任务 → 中性色 + 清单图标 */}
            {cell.tasks.map(({ goal, task, done }) => {
              const color = goal ? AREA_COLOR[goal.area] : NEUTRAL_COLOR;
              const sel = selectedId === task.id;
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    onDragStartTask(task.id);
                    e.dataTransfer.setData("text/plain", task.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={onDragEndTask}
                  style={{
                    borderColor: done ? "var(--line)" : `color-mix(in srgb, ${color} 45%, transparent)`,
                    backgroundColor: done ? "transparent" : `color-mix(in srgb, ${color} 14%, transparent)`,
                  }}
                  className="flex items-center gap-1.5 rounded-lg border px-1.5 py-1"
                >
                  <button
                    onClick={() => onComplete(task.id)}
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
                    onClick={() => onToggleSelect(task.id)}
                    aria-pressed={sel}
                    aria-label={t("选择任务 {text}", { text: task.text })}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left"
                    title={goal ? `${task.text} · ${goal.title}` : `${task.text} · ${t("无目标")}`}
                  >
                    {goal ? (
                      <AreaIcon area={goal.area} className="h-3 w-3 flex-shrink-0" />
                    ) : (
                      <span aria-hidden="true" className="inline-flex flex-shrink-0 text-[var(--fg-faint)]">
                        <IconList className="h-3 w-3" />
                      </span>
                    )}
                    <span
                      className={`min-w-0 truncate text-[11px] leading-tight ${
                        done ? "text-[var(--fg-faint)] line-through" : sel ? "text-[var(--accent)]" : "text-[var(--fg)]"
                      }`}
                    >
                      {task.text}
                    </span>
                  </button>
                </div>
              );
            })}

            {/* 习惯：暗淡只读幽灵芯片（复发，不在此拖/勾）；散习惯 → 中性色 */}
            {cell.habits.map(({ goal, habit }) => {
              const color = goal ? AREA_COLOR[goal.area] : NEUTRAL_COLOR;
              return (
                <div
                  key={habit.id}
                  aria-label={t("习惯（每日重复）：{text}", { text: habit.text })}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-[var(--line)] px-1.5 py-1 opacity-70"
                  title={goal ? `${habit.text} · ${goal.title}` : `${habit.text} · ${t("无目标")}`}
                >
                  <span aria-hidden="true" className="flex-shrink-0" style={{ color }}>
                    <IconRepeat className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 truncate text-[11px] leading-tight text-[var(--fg-faint)]">
                    {habit.text}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* 列脚：去日视图设具体时间 */}
      {!empty && (
        <button
          onClick={onOpenDay}
          className="rounded-b-2xl border-t border-[var(--line)] px-2 py-1.5 text-[10px] text-[var(--fg-faint)] transition hover:text-[var(--accent)]"
        >
          {t("去日视图设时间")}
        </button>
      )}
    </div>
  );
}
