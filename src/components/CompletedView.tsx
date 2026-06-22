"use client";

import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { allTasks } from "@/domain/goalTree";
import { AREA_COLOR, AREA_EMOJI } from "./lib/areaMeta";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";

// 「已完成」视图：所有已完成的一次性任务，最近完成的在前（allTasks 顺序反转即可）。
// 行：勾选（已勾）→ 取消完成恢复（toggleTodayAction）；文本划线；展示所属目标。
export function CompletedView() {
  const { tree, toggleTodayAction, openPlanFocused } = useApp();
  const { t } = useT();

  if (!tree) return null;

  const done = allTasks(tree)
    .filter((l) => l.task.done === true)
    .reverse();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Completed"
        title={t("已完成")}
        subtitle={t("你已经完成的任务。取消勾选可以恢复。")}
      />

      {done.length === 0 ? (
        <EmptyState
          icon="☑️"
          accent="var(--c-emerald)"
          description={t("还没有完成的任务")}
        />
      ) : (
        <ul className="space-y-2">
          {done.map(({ goal, task }) => {
            const color = AREA_COLOR[goal.area];
            const emoji = AREA_EMOJI[goal.area];
            return (
              <li key={task.id}>
                <div className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 transition hover:border-[var(--accent)]/50 hover:bg-[var(--bg-2)]">
                  {/* 已勾 —— 点击取消完成、恢复任务 */}
                  <button
                    onClick={() => toggleTodayAction(task.id)}
                    aria-label={t("标记未完成")}
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[11px] text-[var(--c-emerald)] transition"
                  >
                    ✓
                  </button>

                  {/* 文本（划线） */}
                  <span className="flex-1 truncate text-sm font-medium text-[var(--fg-faint)] line-through">
                    {task.text}
                  </span>

                  {/* 所属目标 */}
                  <button
                    onClick={() => openPlanFocused(goal.id)}
                    className="hidden flex-shrink-0 items-center gap-1.5 text-[11px] text-[var(--fg-faint)] transition hover:text-[var(--fg)] sm:flex"
                    title={goal.title}
                  >
                    <span aria-hidden="true" style={{ color }}>
                      {emoji}
                    </span>
                    <span className="max-w-[10rem] truncate">{goal.title}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
