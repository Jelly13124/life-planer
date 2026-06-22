"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { allTasks } from "@/domain/goalTree";
import { localTodayStr } from "@/lib/dailyClient";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";
import { GroupedTasks } from "./lib/taskGroups";
import { IconCheckCircle } from "./ui/icons";

// 「全部任务」视图：所有目标下的一次性任务，按领域 → 目标分组。
// 过滤切换：进行中（默认，done===false）/ 全部。
// 行操作：勾选完成（按任务自己的排期日记录，未排期落今天）、删除、点标题跳目标。
// today 用启动常量 + 可见性事件刷新（不在模块作用域 new Date）。
const _bootToday = localTodayStr();

export function AllTasksView() {
  const { tree, toggleActionOn, removeItemById, openPlanFocused } = useApp();
  const { t } = useT();
  const [showAll, setShowAll] = useState(false);

  const [today, setToday] = useState(_bootToday);
  useEffect(() => {
    const update = () => setToday(localTodayStr());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  if (!tree) return null;

  const all = allTasks(tree);
  const locs = showAll ? all : all.filter((l) => l.task.done === false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="All tasks"
        title={t("全部任务")}
        subtitle={t("所有目标下的一次性任务，按人生面分组。")}
        actions={
          <div className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg-1)] p-0.5">
            {[
              { all: false, label: t("进行中") },
              { all: true, label: t("全部") },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setShowAll(opt.all)}
                aria-pressed={showAll === opt.all}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  showAll === opt.all
                    ? "bg-[var(--accent)]/[0.16] text-[var(--fg)]"
                    : "text-[var(--fg-dim)] hover:text-[var(--fg)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      {locs.length === 0 ? (
        <EmptyState
          icon={<IconCheckCircle className="h-7 w-7" />}
          accent="var(--c-emerald)"
          description={
            showAll
              ? t("还没有任务。去「目标」给某个目标加几条任务。")
              : t("没有进行中的任务。切到「全部」看已完成的，或去「目标」新建任务。")
          }
        />
      ) : (
        <GroupedTasks
          tree={tree}
          locs={locs}
          onToggle={(task) => toggleActionOn(task.id, task.scheduledDate ?? today)}
          onRemove={removeItemById}
          onOpenGoal={openPlanFocused}
        />
      )}
    </div>
  );
}
