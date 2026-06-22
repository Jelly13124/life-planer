// 目标拆解的纯数据契约 + 离线兜底模板（客户端 / 服务端通用，无服务端依赖）。
// 放在 lib 里，避免客户端从 api/route.ts 反向 import 把限流/key 逻辑打进浏览器包。
import { LIFE_AREAS, type LifeArea } from "@/domain/types";

export interface GoalInput {
  title: string;
  why?: string;
  area?: string;
  startDate?: string;
  endDate?: string;
}

export interface MetricSuggestion {
  label: string;
  target: number;
  unit: string;
}
export interface TaskSuggestion {
  text: string;
}
export interface HabitSuggestion {
  text: string;
  repeat: "daily" | "weekly";
  repeatWeekday?: number;
}
export interface SubgoalSuggestion {
  title: string;
  metrics: MetricSuggestion[];
  tasks: TaskSuggestion[];
  habits: HabitSuggestion[];
}
export interface GoalDecomposition {
  metrics: MetricSuggestion[];
  tasks: TaskSuggestion[];
  habits: HabitSuggestion[];
  subgoals: SubgoalSuggestion[];
}

// 离线兜底：按领域给一份贴合的模板（纯函数，无 Date.now/Math.random）。
// variety 仅由 goal.area 决定，保证同领域可单测、可重现。未知领域回落到 growth。
export function localDecompose(goal: GoalInput): GoalDecomposition {
  const area: LifeArea = LIFE_AREAS.includes(goal.area as LifeArea)
    ? (goal.area as LifeArea)
    : "growth";

  const TEMPLATES: Record<LifeArea, GoalDecomposition> = {
    health: {
      metrics: [{ label: "每周运动次数", target: 3, unit: "次" }],
      tasks: [{ text: "制定本周运动计划" }, { text: "准备运动装备" }, { text: "约一个固定的运动时间" }],
      habits: [{ text: "运动 30 分钟", repeat: "daily" }],
      subgoals: [],
    },
    career: {
      metrics: [{ label: "投递简历数", target: 10, unit: "份" }],
      tasks: [
        { text: "梳理并更新简历" },
        { text: "列出 5 家目标公司" },
        { text: "找一位行业前辈聊 20 分钟" },
      ],
      habits: [{ text: "每天学习一项核心技能 1 小时", repeat: "daily" }],
      subgoals: [],
    },
    wealth: {
      metrics: [{ label: "存款", target: 50000, unit: "元" }],
      tasks: [
        { text: "梳理当前收支情况" },
        { text: "制定每月储蓄计划" },
        { text: "开一个专门的储蓄账户" },
      ],
      habits: [{ text: "每周记一次账", repeat: "weekly" }],
      subgoals: [],
    },
    relationships: {
      metrics: [{ label: "深度交流次数", target: 4, unit: "次" }],
      tasks: [
        { text: "列出想多联系的 3 个人" },
        { text: "约一次面对面见面" },
        { text: "主动发起一次问候" },
      ],
      habits: [{ text: "每周和重要的人深聊一次", repeat: "weekly" }],
      subgoals: [],
    },
    growth: {
      metrics: [{ label: "读完的书", target: 6, unit: "本" }],
      tasks: [
        { text: "挑选要学习的主题" },
        { text: "找到 2 个优质学习资源" },
        { text: "制定学习计划" },
      ],
      habits: [{ text: "每天阅读 30 分钟", repeat: "daily" }],
      subgoals: [],
    },
  };

  return TEMPLATES[area];
}
