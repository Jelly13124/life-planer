import type { Goal, Habit, LegacyGoal, LegacyGoalAction, Subgoal, Task } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// migrateGoals —— 旧扁平目标（horizon/parentGoalId/actions）→ 新嵌套目标（无损）。
// 关键：保留 id —— 旧 action 的 id 原样变成 Task/Habit 的 id，所以 activity（按 id
// 记完成/计划）、排期、连续天数、热力图全部继续对得上，无需重算历史。
// 纯函数：不读 Date.now/Math.random。
// ───────────────────────────────────────────────────────────────────────────

// 把一组旧 action 按是否有 repeat 拆成 tasks（无 repeat）/ habits（有 repeat），保留 id。
export function migrateActions(actions: LegacyGoalAction[]): { tasks: Task[]; habits: Habit[] } {
  const tasks: Task[] = [];
  const habits: Habit[] = [];
  for (const a of actions ?? []) {
    if (a.repeat) {
      habits.push({
        id: a.id,
        text: a.text,
        repeat: a.repeat,
        repeatWeekday: a.repeatWeekday,
        startTime: a.startTime,
        durationMin: a.durationMin,
      });
    } else {
      tasks.push({
        id: a.id,
        text: a.text,
        done: a.done,
        scheduledDate: a.scheduledDate,
        startTime: a.startTime,
        durationMin: a.durationMin,
      });
    }
  }
  return { tasks, habits };
}

export function migrateGoals(legacy: LegacyGoal[]): Goal[] {
  const list = legacy ?? [];
  const byId = new Map<string, LegacyGoal>();
  for (const g of list) byId.set(g.id, g);

  // 顶层 = 长期目标 OR parentGoalId==null OR 孤儿短期目标（父不存在）。
  const isTopLevel = (g: LegacyGoal): boolean => {
    if (g.horizon === "long") return true;
    if (g.parentGoalId == null) return true;
    return !byId.has(g.parentGoalId); // 孤儿短期 → 顶层
  };

  const out: Goal[] = [];
  for (const g of list) {
    if (!isTopLevel(g)) continue;
    const { tasks, habits } = migrateActions(g.actions);

    // 子目标 = 父指向本目标的短期目标（按出现顺序）。
    const subgoals: Subgoal[] = [];
    for (const child of list) {
      if (child.parentGoalId !== g.id) continue;
      if (child === g) continue;
      if (isTopLevel(child)) continue; // 孤儿短期已被单独提为顶层，不再做子目标
      const ca = migrateActions(child.actions);
      subgoals.push({
        id: child.id,
        title: child.title,
        metrics: [],
        tasks: ca.tasks,
        habits: ca.habits,
      });
    }

    out.push({
      id: g.id,
      area: g.area,
      title: g.title,
      why: g.why,
      status: g.status,
      createdAt: g.createdAt,
      endDate: g.deadline,
      pathId: g.pathId,
      tags: g.tags,
      metrics: [],
      subgoals,
      tasks,
      habits,
      completedAt: g.completedAt,
      lastReviewedAt: g.lastReviewedAt,
    });
  }
  return out;
}
