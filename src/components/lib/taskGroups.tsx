"use client";

import type { Goal, LifeTree, Task } from "@/domain/types";
import { GOAL_AREAS, GOAL_AREA_LABELS } from "@/domain/types";
import type { TaskLoc } from "@/domain/goalTree";
import { useT } from "@/prefs/PreferencesContext";
import { AREA_COLOR, AREA_EMOJI } from "./areaMeta";

// ───────────────────────────────────────────────────────────────────────────
// taskGroups —— 「全部任务」「标签」视图共享的任务行 + 按领域→目标分组渲染。
// 纯展示：父组件传入已筛好的 TaskLoc[] 与回调。
// ───────────────────────────────────────────────────────────────────────────

// 一行任务：勾选完成 + 文本（完成划线）+ 删除 + 点标题跳目标。
export function TaskRow({
  task,
  goal,
  onToggle,
  onRemove,
  onOpenGoal,
}: {
  task: Task;
  goal: Goal;
  onToggle: () => void;
  onRemove: () => void;
  onOpenGoal: () => void;
}) {
  const { t } = useT();
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 transition hover:border-[var(--accent)]/50 hover:bg-[var(--bg-2)]">
      {/* 勾选 —— 唯一切换完成的入口 */}
      <button
        onClick={onToggle}
        aria-label={task.done ? t("标记未完成") : t("标记完成")}
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] transition ${
          task.done
            ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]"
            : "border-[var(--line)] hover:border-[var(--accent)]"
        }`}
      >
        {task.done ? "✓" : ""}
      </button>

      {/* 文本 —— 点击跳到所属目标 */}
      <button
        onClick={onOpenGoal}
        className={`flex-1 truncate text-left text-sm font-medium transition hover:text-[var(--accent)] ${
          task.done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"
        }`}
        title={t("跳到目标")}
      >
        {task.text}
      </button>

      {/* 删除 */}
      <button
        onClick={onRemove}
        aria-label={t("删除任务")}
        title={t("删除任务")}
        className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[12px] text-[var(--fg-faint)] transition hover:text-[var(--c-rose)]"
      >
        ✕
      </button>
    </div>
  );
}

// 把一批 TaskLoc 按领域（GOAL_AREAS 顺序）→ 目标分组渲染。
export function GroupedTasks({
  tree,
  locs,
  onToggle,
  onRemove,
  onOpenGoal,
}: {
  tree: LifeTree;
  locs: TaskLoc[];
  // 传整条 task（而非仅 id）：调用方可按 task.scheduledDate 决定把完成记到哪一天。
  onToggle: (task: Task) => void;
  onRemove: (taskId: string) => void;
  onOpenGoal: (goalId: string) => void;
}) {
  const { t } = useT();
  void tree; // 仅为签名对称保留；分组只需 locs

  return (
    <div className="space-y-8">
      {GOAL_AREAS.map((area) => {
        const inArea = locs.filter((l) => l.goal.area === area);
        if (inArea.length === 0) return null;

        // 该领域内再按目标聚合（保持 allTasks 的目标先后顺序）。
        const byGoal: { goal: Goal; tasks: Task[] }[] = [];
        for (const { goal, task } of inArea) {
          let bucket = byGoal.find((b) => b.goal.id === goal.id);
          if (!bucket) {
            bucket = { goal, tasks: [] };
            byGoal.push(bucket);
          }
          bucket.tasks.push(task);
        }

        return (
          <section key={area} aria-label={t(GOAL_AREA_LABELS[area])}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <span aria-hidden="true" className="text-sm" style={{ color: AREA_COLOR[area] }}>
                {AREA_EMOJI[area]}
              </span>
              <h2 className="text-xs font-semibold uppercase tracking-[2px] text-[var(--fg-dim)]">
                {t(GOAL_AREA_LABELS[area])}
              </h2>
            </div>

            <div className="space-y-4">
              {byGoal.map(({ goal, tasks }) => (
                <div key={goal.id} className="space-y-2">
                  <button
                    onClick={() => onOpenGoal(goal.id)}
                    className="px-1 text-[11px] text-[var(--fg-faint)] transition hover:text-[var(--fg)]"
                  >
                    {goal.title}
                  </button>
                  <ul className="space-y-2">
                    {tasks.map((task) => (
                      <li key={task.id}>
                        <TaskRow
                          task={task}
                          goal={goal}
                          onToggle={() => onToggle(task)}
                          onRemove={() => onRemove(task.id)}
                          onOpenGoal={() => onOpenGoal(goal.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
