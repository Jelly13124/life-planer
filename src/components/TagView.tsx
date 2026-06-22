"use client";

import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { allTasks } from "@/domain/goalTree";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";
import { GroupedTasks } from "./lib/taskGroups";

// 「标签」视图：读取 selectedTag，列出带该标签的目标 + 它们的任务（复用全部任务的分组渲染）。
export function TagView() {
  const { tree, selectedTag, toggleTodayAction, removeItemById, openPlanFocused } = useApp();
  const { t } = useT();

  if (!tree) return null;

  const tag = selectedTag ?? "";
  const taggedGoalIds = new Set(
    (tree.goals ?? []).filter((g) => g.tags?.includes(tag)).map((g) => g.id),
  );
  const locs = allTasks(tree).filter((l) => taggedGoalIds.has(l.goal.id));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Tag"
        title={`🏷️ ${tag}`}
        subtitle={t("带这个标签的目标和它们的任务。")}
      />

      {taggedGoalIds.size === 0 ? (
        <EmptyState
          icon="🏷️"
          accent="var(--accent)"
          description={t("没有带这个标签的目标。去「目标」给目标加上标签。")}
        />
      ) : locs.length === 0 ? (
        <EmptyState
          icon="🏷️"
          accent="var(--accent)"
          description={t("这些目标下还没有任务。去「目标」加几条任务。")}
        />
      ) : (
        <GroupedTasks
          tree={tree}
          locs={locs}
          onToggle={toggleTodayAction}
          onRemove={removeItemById}
          onOpenGoal={openPlanFocused}
        />
      )}
    </div>
  );
}
