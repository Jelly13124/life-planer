"use client";

import { useState } from "react";
import type { LifeTree } from "@/domain/types";
import { AREA_LABELS } from "@/domain/types";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { actionsOnDay, weekdayOf } from "@/domain/calendar";
import { dayWindow, toMinutes, toHHMM, DEFAULT_DURATION_MIN } from "@/domain/schedule";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

// 日视图：把某天的行动摊在一条竖直时间轴上。纯渲染（date 由 props 注入，绝不在渲染里 new Date）。
// 时间块按 startTime 绝对定位、按 durationMin 定高；像素/分钟比固定，便于眼睛对齐刻度。

const PX_PER_MIN = 0.8;
const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"]; // weekdayOf: 0=周日…6=周六

export function DayView({
  tree,
  date,
  onPrevDay,
  onNextDay,
  onToday,
}: {
  tree: LifeTree;
  date: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
}) {
  const { setActionTimeById, setDayWindowValues, arrangeDayWithAI, toggleActionOn } = useApp();
  const { t } = useT();
  const [arranging, setArranging] = useState(false);

  const win = dayWindow(tree);
  const items = actionsOnDay(tree, date);
  const timed = items
    .filter((i) => i.action.startTime)
    .sort((a, b) => toMinutes(a.action.startTime!) - toMinutes(b.action.startTime!));
  const untimed = items.filter((i) => !i.action.startTime);

  const startMin = toMinutes(win.start);
  const endMin = toMinutes(win.end);
  const totalHeight = Math.max(200, (endMin - startMin) * PX_PER_MIN);

  // 整点刻度：从起床所在的下一个整点，到睡觉所在的整点。
  const firstHour = Math.ceil(startMin / 60);
  const lastHour = Math.floor(endMin / 60);
  const hours: number[] = [];
  for (let h = firstHour; h <= lastHour; h++) hours.push(h);

  const wd = WEEKDAY_ZH[weekdayOf(date)];

  async function runArrange() {
    if (arranging) return;
    setArranging(true);
    try {
      await arrangeDayWithAI(date);
    } finally {
      setArranging(false);
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
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]"
          >
            ‹
          </button>
          <div className="text-sm font-semibold tracking-tight text-[var(--fg)]">
            {date} <span className="text-[var(--fg-faint)]">{t("周{w}", { w: wd })}</span>
          </div>
          <button
            onClick={onNextDay}
            aria-label={t("后一天")}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]"
          >
            ›
          </button>
        </div>
        <button
          onClick={onToday}
          className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]"
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
              className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)]/60 [color-scheme:dark]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--fg-faint)]">
            {t("睡觉")}
            <input
              type="time"
              value={win.end}
              onChange={(e) => setDayWindowValues(win.start, e.target.value || win.end)}
              className="rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)]/60 [color-scheme:dark]"
            />
          </label>
          <Button
            variant="primary"
            onClick={runArrange}
            disabled={arranging || items.length === 0}
            className="ml-auto !px-4 !py-2 text-xs"
          >
            {arranging ? t("正在排…") : t("✨ AI 帮我排今天")}
          </Button>
        </div>
      </Card>

      {/* 3) 未排时间 */}
      {untimed.length > 0 && (
        <Card pad="sm">
          <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">
            {t("未排时间")}
          </div>
          <ul className="space-y-1.5">
            {untimed.map(({ goal, action, done }) => (
              <li key={action.id} className="flex items-center gap-2">
                <button
                  onClick={() => toggleActionOn(action.id, date)}
                  aria-label={done ? t("标记未完成") : t("标记完成")}
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    done
                      ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]"
                      : "border-[var(--line)]"
                  }`}
                >
                  {done ? "✓" : ""}
                </button>
                <span className={`min-w-0 flex-1 truncate text-sm ${done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}`}>
                  {action.text}
                </span>
                <span className="flex-shrink-0 text-[10px] text-[var(--fg-faint)]">{t(AREA_LABELS[goal.area])}</span>
                <input
                  type="time"
                  aria-label={t("设置开始时间")}
                  onChange={(e) => setActionTimeById(action.id, e.target.value || null)}
                  className="flex-shrink-0 rounded-lg border border-[var(--line)] bg-transparent px-2 py-1 text-xs text-[var(--fg-dim)] outline-none transition focus:border-[var(--accent)]/60 [color-scheme:dark]"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 4) 时间轴 */}
      <Card pad="sm">
        {items.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs leading-relaxed text-[var(--fg-faint)]">
            {t("这天还没有安排。去日历把行动排到这天，或在「目标」里加行动。")}
          </p>
        ) : (
          <div className="relative pl-12" style={{ height: totalHeight }}>
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
            {timed.map(({ goal, action, done }) => {
              const s = toMinutes(action.startTime!);
              const dur = action.durationMin ?? DEFAULT_DURATION_MIN;
              const top = Math.max(0, (s - startMin) * PX_PER_MIN);
              const height = Math.max(18, dur * PX_PER_MIN);
              const accent = goal.pathId ? colorOfPath(tree, goal.pathId) : null;
              return (
                <div
                  key={action.id}
                  className="absolute right-0 left-1 overflow-hidden rounded-lg border px-2 py-1 transition"
                  style={{
                    top,
                    height,
                    borderColor: done ? "var(--line)" : accent ? `${accent}66` : "var(--accent)",
                    backgroundColor: done ? "transparent" : accent ? `${accent}1f` : "rgba(167,139,250,0.12)",
                  }}
                >
                  <button
                    onClick={() => toggleActionOn(action.id, date)}
                    className="flex h-full w-full flex-col items-start justify-center pr-5 text-left"
                  >
                    <span className={`w-full truncate text-[12px] leading-tight ${done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}`}>
                      {action.text}
                    </span>
                    <span className="mt-0.5 flex w-full items-center gap-1.5 text-[10px] text-[var(--fg-faint)]">
                      <span className="tabular-nums">{toHHMM(s)}–{toHHMM(s + dur)}</span>
                      <span className="truncate">{t(AREA_LABELS[goal.area])}</span>
                    </span>
                  </button>
                  <button
                    onClick={() => setActionTimeById(action.id, null)}
                    aria-label={t("清除时间")}
                    title={t("清除时间")}
                    className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-[var(--fg-faint)] transition hover:bg-white/10 hover:text-[var(--c-rose)]"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// 取这条路在树上的颜色（找不到则 null → 用强调色兜底）。
function colorOfPath(tree: LifeTree, pathId: string): string | null {
  return tree.paths.find((p) => p.id === pathId)?.color ?? null;
}
