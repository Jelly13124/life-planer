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

// 旧目标判定：带 `actions` 字段，或缺 `subgoals` 字段（旧扁平结构的特征）。
// 反之（已是新嵌套形状）原样透传，不重建、不展平。
function isLegacyGoal(g: Goal | LegacyGoal): g is LegacyGoal {
  return "actions" in g || !("subgoals" in g);
}

// 把旧扁平目标升级成新嵌套目标——无损：每个输入 id 都必出现在输出（顶层 Goal id 或 Subgoal id）。
// 已是新形状的目标原样透传（保留 metrics/subgoals/tasks/habits）。
// 处理三类边界：深层链（祖孙展平到顶层祖先）、自指父、缺失/非法父（孤儿提顶层）；循环安全。
export function migrateGoals(input: ReadonlyArray<Goal | LegacyGoal>): Goal[] {
  const list = input ?? [];

  // 1) 已是新形状的目标：原样透传，成为顶层 Goal（不动其内部结构）。
  const passthrough: Goal[] = [];
  const legacy: LegacyGoal[] = [];
  for (const g of list) {
    if (isLegacyGoal(g)) legacy.push(g);
    else passthrough.push(g);
  }

  // 2) 仅在旧目标子集里建索引（新形状目标不参与父子推断）。
  const byId = new Map<string, LegacyGoal>();
  for (const g of legacy) byId.set(g.id, g);

  // 有效父：自指 → null（修 bug 2）；指向不存在/非旧目标 → null（孤儿，修 bug 3）。
  const effectiveParent = (g: LegacyGoal): string | null => {
    const p = g.parentGoalId;
    if (p == null) return null;
    if (p === g.id) return null; // 自指父
    if (!byId.has(p)) return null; // 缺失或非旧目标的父 → 视为孤儿
    return p;
  };

  // 顶层 = 长期目标 OR 有效父为空。
  const isTopLevel = (g: LegacyGoal): boolean =>
    g.horizon === "long" || effectiveParent(g) == null;

  // 顶层祖先：沿有效父上溯（展平深层链，修 bug 1），seen 防环；
  // 若遇环或链断，返回当前节点（它将被提为顶层，保证不丢）。
  const topAncestor = (g: LegacyGoal): LegacyGoal => {
    let cur = g;
    const seen = new Set<string>();
    while (!isTopLevel(cur)) {
      if (seen.has(cur.id)) return cur; // 环：停在当前，让它兜底成顶层
      seen.add(cur.id);
      const p = effectiveParent(cur);
      if (p == null) return cur; // 链断
      const next = byId.get(p);
      if (!next) return cur; // 防御：父不在索引（理论上已被 effectiveParent 拦掉）
      cur = next;
    }
    return cur;
  };

  const toSubgoal = (g: LegacyGoal): Subgoal => {
    const { tasks, habits } = migrateActions(g.actions);
    return { id: g.id, title: g.title, metrics: [], tasks, habits };
  };

  const toTopGoal = (g: LegacyGoal, subgoals: Subgoal[]): Goal => {
    const { tasks, habits } = migrateActions(g.actions);
    return {
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
    };
  };

  // 3) 每个旧顶层目标 T → 顶层 Goal；其子目标 = 所有顶层祖先为 T 的非顶层旧目标（按输入顺序）。
  const migratedTop: Goal[] = [];
  for (const g of legacy) {
    if (!isTopLevel(g)) continue;
    const subgoals: Subgoal[] = [];
    for (const child of legacy) {
      if (isTopLevel(child)) continue;
      if (topAncestor(child).id !== g.id) continue;
      subgoals.push(toSubgoal(child));
    }
    migratedTop.push(toTopGoal(g, subgoals));
  }

  // 4) 输出（确定性：透传新目标在前，迁移顶层目标在后；测试只断成员关系不断顺序）。
  const out: Goal[] = [...passthrough, ...migratedTop];

  // 5) 兜底无损：收集已落地的所有 goal id + subgoal id；任一旧目标 id 缺失（如被环打断）→ 单独提为顶层。
  const present = new Set<string>();
  for (const g of out) {
    present.add(g.id);
    for (const s of g.subgoals ?? []) present.add(s.id);
  }
  for (const g of legacy) {
    if (present.has(g.id)) continue;
    out.push(toTopGoal(g, []));
    present.add(g.id);
  }

  return out;
}
