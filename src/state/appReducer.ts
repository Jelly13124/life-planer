import type { LifeTree, Profile } from "@/domain/types";

export type View =
  | "onboarding"
  | "tree"
  | "detail"
  | "plan"
  | "dashboard"
  | "habits"
  | "areas"
  | "insights"
  | "today"
  | "upcoming"
  | "alltasks"
  | "completed"
  | "choices"
  | "tag";

// 一次"AI 正在推演"的进行态：在 AI 把这一批路全部写完之前，分支不落到树上。
export interface Predicting {
  labels: string[]; // 正在推演的选择（用于动画里展示）
  total: number; // 这一批要推演的路径数
  done: number; // 已完成数
  context: "onboarding" | "branch";
}

export interface State {
  view: View;
  tree: LifeTree | null;
  activePathId: string | null;
  hydrated: boolean;
  predicting: Predicting | null; // 非空 = 正在推演，显示全屏动画
  aiEnabled: boolean; // 后端是否接入了真实大模型
  safetyHold: Profile | null; // 非空 = 检测到危机信号，暂停推演，等用户确认
  selectedTag: string | null; // 当前「标签」视图选中的标签
  focusGoalId: string | null; // 跳到「计划」视图时要聚焦/展开的目标
  cloudNotice: boolean; // 云端加载失败、已回退本地时的小提示（P5；flag 关时永远 false）
  // 即时反馈（Part 1）：完成某行动把"挂在某条路上"的目标推动、可行度整 5 上涨时弹的短暂 toast。
  // 仅由未完成→完成且 after>before 才置；自动 ~4s 消失或用户点掉。
  feasibilityToast: { pathLabel: string; before: number; after: number } | null;
}

export type Action =
  | { type: "hydrate"; tree: LifeTree | null }
  | { type: "setTree"; tree: LifeTree }
  | { type: "predictStart"; labels: string[]; total: number; context: "onboarding" | "branch" }
  | { type: "predictTick" }
  | { type: "predictEnd" }
  | { type: "setAiEnabled"; enabled: boolean }
  | { type: "openPath"; id: string }
  | { type: "backToTree" }
  | { type: "openPlan" }
  | { type: "openDashboard" }
  | { type: "openHabits" }
  | { type: "openAreas" }
  | { type: "openInsights" }
  | { type: "openToday" }
  | { type: "openUpcoming" }
  | { type: "openAllTasks" }
  | { type: "openCompleted" }
  | { type: "openChoices" }
  | { type: "openTag"; tag: string }
  | { type: "openPlanFocused"; goalId: string }
  | { type: "clearFocusGoal" }
  | { type: "patchTree"; tree: LifeTree }
  | { type: "reset" }
  | { type: "safetyHold"; profile: Profile }
  | { type: "clearSafety" }
  | { type: "setCloudNotice"; on: boolean }
  | { type: "showFeasibilityToast"; toast: { pathLabel: string; before: number; after: number } }
  | { type: "dismissFeasibilityToast" };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        hydrated: true,
        tree: action.tree,
        // 老用户(已有树)落地到人生树——产品主角是方向/预测,不是任务网格。
        view: action.tree ? "tree" : "onboarding",
      };
    case "setTree":
      return { ...state, tree: action.tree, view: "tree" };
    case "predictStart":
      return {
        ...state,
        predicting: {
          labels: action.labels,
          total: action.total,
          done: 0,
          context: action.context,
        },
      };
    case "predictTick":
      return state.predicting
        ? { ...state, predicting: { ...state.predicting, done: state.predicting.done + 1 } }
        : state;
    case "predictEnd":
      return { ...state, predicting: null };
    case "setAiEnabled":
      return { ...state, aiEnabled: action.enabled };
    case "openPath":
      return { ...state, activePathId: action.id, view: "detail" };
    case "backToTree":
      return { ...state, activePathId: null, view: "tree" };
    case "openPlan":
      return { ...state, activePathId: null, view: "plan" };
    case "openDashboard":
      return { ...state, activePathId: null, view: "dashboard" };
    case "openHabits":
      return { ...state, activePathId: null, view: "habits" };
    case "openAreas":
      return { ...state, activePathId: null, view: "areas" };
    case "openInsights":
      return { ...state, activePathId: null, view: "insights" };
    case "openToday":
      return { ...state, activePathId: null, view: "today" };
    case "openUpcoming":
      return { ...state, activePathId: null, view: "upcoming" };
    case "openAllTasks":
      return { ...state, activePathId: null, view: "alltasks" };
    case "openCompleted":
      return { ...state, activePathId: null, view: "completed" };
    case "openChoices":
      return { ...state, activePathId: null, view: "choices" };
    case "openTag":
      return { ...state, activePathId: null, view: "tag", selectedTag: action.tag };
    case "openPlanFocused":
      return { ...state, activePathId: null, view: "plan", focusGoalId: action.goalId };
    case "clearFocusGoal":
      return { ...state, focusGoalId: null };
    case "patchTree":
      return { ...state, tree: action.tree };
    case "reset":
      return { ...state, tree: null, activePathId: null, view: "onboarding", predicting: null, safetyHold: null };
    case "safetyHold":
      return { ...state, safetyHold: action.profile };
    case "clearSafety":
      return { ...state, safetyHold: null };
    case "setCloudNotice":
      return { ...state, cloudNotice: action.on };
    case "showFeasibilityToast":
      return { ...state, feasibilityToast: action.toast };
    case "dismissFeasibilityToast":
      return { ...state, feasibilityToast: null };
    default:
      return state;
  }
}

export const initialState: State = {
  view: "onboarding",
  tree: null,
  activePathId: null,
  hydrated: false,
  predicting: null,
  aiEnabled: false,
  safetyHold: null,
  selectedTag: null,
  focusGoalId: null,
  cloudNotice: false,
  feasibilityToast: null,
};
