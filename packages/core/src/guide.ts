import type { LifeTree } from "./types";
import { allTasks } from "./goalTree";

// 首次上手三步：从现有 tree 状态自动判断每步是否走通（纯函数，无 Date/random）。
export interface FirstRunSteps {
  hasLongGoal: boolean;   // 有目标（=树上长出一条规划）
  hasScheduled: boolean;  // 有一次性任务排进了某天
  hasCompletion: boolean; // 有任何完成记录
  allDone: boolean;
}

export function firstRunSteps(tree: LifeTree): FirstRunSteps {
  const goals = tree.goals ?? [];
  const hasLongGoal = goals.length > 0;
  const hasScheduled = allTasks(tree).some(({ task }) => Boolean(task.scheduledDate));
  const hasCompletion = (tree.activity ?? []).some((d) => d.completedActionIds.length > 0);
  return {
    hasLongGoal,
    hasScheduled,
    hasCompletion,
    allDone: hasLongGoal && hasScheduled && hasCompletion,
  };
}
