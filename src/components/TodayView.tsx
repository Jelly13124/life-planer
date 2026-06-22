"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { todayItems } from "@/domain/daily";
import { localTodayStr } from "@/lib/dailyClient";
import { AreaIcon } from "./lib/areaMeta";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";

// 「今天」视图：列出今天该做的事 —— 手动挑的一次性任务 ∪ 今天到期的重复习惯。
// 每行一个勾选按钮 → toggleTodayAction；展示所属目标 + 领域 emoji/色。
// today 用启动常量 + 可见性事件刷新（不在模块作用域 new Date）。
const _bootToday = localTodayStr();

export function TodayView() {
  const { tree, toggleTodayAction, openPlanFocused } = useApp();
  const { t } = useT();

  const [today, setToday] = useState(_bootToday);
  useEffect(() => {
    const update = () => setToday(localTodayStr());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  if (!tree) return null;

  const items = todayItems(tree, today);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Today"
        title={t("今天")}
        subtitle={t("今天该做的任务和习惯，勾掉就算完成。")}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="☀️"
          accent="var(--accent)"
          description={t("今天没有安排。去「目标」把某条任务排到今天，或在「习惯」里坚持重复。")}
        />
      ) : (
        <ul className="space-y-2">
          {items.map(({ goal, item, kind, doneToday }) => {
            return (
              <li key={item.id}>
                <div className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 transition hover:border-[var(--accent)]/50 hover:bg-[var(--bg-2)]">
                  {/* 勾选 —— 唯一切换完成的入口 */}
                  <button
                    onClick={() => toggleTodayAction(item.id)}
                    aria-label={doneToday ? t("标记未完成") : t("标记完成")}
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] transition ${
                      doneToday
                        ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]"
                        : "border-[var(--line)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {doneToday ? "✓" : ""}
                  </button>

                  {/* 行动文本 */}
                  <span
                    className={`flex-1 truncate text-sm font-medium ${
                      doneToday ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"
                    }`}
                  >
                    {item.text}
                  </span>

                  {/* 习惯标记（区分一次性任务与重复习惯） */}
                  {kind === "habit" && (
                    <span className="flex-shrink-0 rounded-full border border-[var(--accent)]/30 px-2 py-0.5 text-[10px] text-[var(--accent)]">
                      {t("习惯")}
                    </span>
                  )}

                  {/* 所属目标（领域 emoji/色 + 标题，点击跳到该目标） */}
                  <button
                    onClick={() => openPlanFocused(goal.id)}
                    className="hidden flex-shrink-0 items-center gap-1.5 text-[11px] text-[var(--fg-faint)] transition hover:text-[var(--fg)] sm:flex"
                    title={goal.title}
                  >
                    <AreaIcon area={goal.area} className="h-3.5 w-3.5" />
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
