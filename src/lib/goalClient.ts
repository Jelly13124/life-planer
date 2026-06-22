// 客户端安全：规划主线几条 AI 路由的网络封装。
import type { Goal, LifeArea, LifeTree } from "@/domain/types";
import { currentLocale } from "@/i18n/locale";
import { localDecompose, type GoalDecomposition } from "@/app/api/decompose-goal/route";

export type { GoalDecomposition };

// 目标建议：嵌套模型下的目标雏形（领域 + 标题 + 为什么；无 horizon）。
export interface GoalSuggestion {
  area: LifeArea;
  title: string;
  why: string;
}

// 让 AI 从现状建议几个目标（前端确认后才加入）。
export async function fetchGoalSuggestions(tree: LifeTree): Promise<GoalSuggestion[]> {
  try {
    const choices = Array.from(
      new Set(tree.paths.filter((p) => p.kind === "choice").map((p) => p.choiceLabel)),
    );
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileSummary: tree.profile.snapshot || "", choices, lang: currentLocale() }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { goals?: GoalSuggestion[] };
    return Array.isArray(data.goals) ? data.goals : [];
  } catch {
    return [];
  }
}

// 把一个目标拆成几条可勾选的近期行动（任务）。
export async function fetchGoalActions(goal: Goal, profileSummary: string): Promise<string[]> {
  try {
    const res = await fetch("/api/goal-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goalTitle: goal.title,
        why: goal.why,
        area: goal.area,
        profileSummary,
        lang: currentLocale(),
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { actions?: string[] };
    return Array.isArray(data.actions) ? data.actions.filter((a) => typeof a === "string" && a.trim()) : [];
  } catch {
    return [];
  }
}

// AI 拆解目标：把一个目标拆成 指标/任务/习惯/子目标 的结构化建议（PREVIEW，前端勾选后才落地）。
// 网络/解析失败 → 本地 localDecompose 兜底（离线也能用，不向调用方抛错）。
export async function fetchGoalDecomposition(goal: Goal): Promise<GoalDecomposition> {
  const payload = {
    title: goal.title,
    why: goal.why,
    area: goal.area,
    startDate: goal.startDate,
    endDate: goal.endDate,
  };
  try {
    const res = await fetch("/api/decompose-goal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: payload }),
    });
    if (!res.ok) return localDecompose(payload);
    const data = (await res.json()) as Partial<GoalDecomposition>;
    return {
      metrics: Array.isArray(data.metrics) ? data.metrics : [],
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      habits: Array.isArray(data.habits) ? data.habits : [],
      subgoals: Array.isArray(data.subgoals) ? data.subgoals : [],
    };
  } catch {
    return localDecompose(payload);
  }
}
