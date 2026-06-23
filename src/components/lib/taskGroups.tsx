"use client";

import type { Goal, LifeTree, Task } from "@/domain/types";
import { GOAL_AREAS, GOAL_AREA_LABELS } from "@/domain/types";
import type { TaskLoc } from "@/domain/goalTree";
import { useT } from "@/prefs/PreferencesContext";
import { AreaIcon } from "./areaMeta";
import { IconList } from "@/components/ui/icons";

// ───────────────────────────────────────────────────────────────────────────
// taskGroups —— 「全部任务」「标签」视图共享的任务行 + 按领域→目标分组渲染。
// 纯展示：父组件传入已筛好的 TaskLoc[] 与回调。
// ───────────────────────────────────────────────────────────────────────────

// 一行任务：勾选完成 + 文本（完成划线）+ 删除 + 点标题跳目标。
// goal 为 null（散任务）→ 中性前导图标、无领域色、不可「跳到目标」。
export function TaskRow({
  task,
  goal,
  onToggle,
  onRemove,
  onOpenGoal,
}: {
  task: Task;
  goal: Goal | null;
  onToggle: () => void;
  onRemove: () => void;
  onOpenGoal: () => void;
}) {
  const { t } = useT();
  const loose = goal == null;
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

      {/* 前导图标：有目标 → 领域色图标；散任务 → 中性清单图标 */}
      {loose ? (
        <span aria-hidden="true" className="inline-flex flex-shrink-0 text-[var(--fg-faint)]">
          <IconList className="h-4 w-4" />
        </span>
      ) : (
        <AreaIcon area={goal.area} className="h-4 w-4" />
      )}

      {/* 文本 —— 有目标时点击跳到所属目标；散任务不可跳，仅展示 */}
      {loose ? (
        <span
          className={`flex-1 truncate text-left text-sm font-medium ${
            task.done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"
          }`}
        >
          {task.text}
        </span>
      ) : (
        <button
          onClick={onOpenGoal}
          className={`flex-1 truncate text-left text-sm font-medium transition hover:text-[var(--accent)] ${
            task.done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"
          }`}
          title={t("跳到目标")}
        >
          {task.text}
        </button>
      )}

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

  // 散任务（goal=null）单独收进「无目标」桶，渲染在所有领域组之后。
  const looseTasks = locs.filter((l) => l.goal == null).map((l) => l.task);

  return (
    <div className="space-y-8">
      {GOAL_AREAS.map((area) => {
        const inArea = locs.filter((l) => l.goal != null && l.goal.area === area);
        if (inArea.length === 0) return null;

        // 该领域内再按目标聚合（保持 allTasks 的目标先后顺序）。
        const byGoal: { goal: Goal; tasks: Task[] }[] = [];
        for (const { goal, task } of inArea) {
          if (!goal) continue; // 已过滤，仅为收窄类型
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
              <AreaIcon area={area} className="h-4 w-4" />
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

      {/* 无目标桶：所有散任务（goal=null），放在最后，中性图标无领域色 */}
      {looseTasks.length > 0 && (
        <section aria-label={t("无目标")}>
          <div className="mb-2 flex items-center gap-2 px-1">
            <span aria-hidden="true" className="inline-flex text-[var(--fg-faint)]">
              <IconList className="h-4 w-4" />
            </span>
            <h2 className="text-xs font-semibold uppercase tracking-[2px] text-[var(--fg-dim)]">
              {t("无目标")}
            </h2>
          </div>
          <ul className="space-y-2">
            {looseTasks.map((task) => (
              <li key={task.id}>
                <TaskRow
                  task={task}
                  goal={null}
                  onToggle={() => onToggle(task)}
                  onRemove={() => onRemove(task.id)}
                  onOpenGoal={() => {}}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
