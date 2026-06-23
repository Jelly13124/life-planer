"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { ChoiceOption, Decision, Goal, GoalArea, LifePath, LifeTree, Metric, Profile, Scenario } from "@/domain/types";
import { createDecision, upsertDecision, type DecisionInput } from "@/domain/decisions";
import * as choices from "@/domain/choices";
import type { PathGenerator } from "@/domain/generator/types";
import { localGenerator } from "@/domain/generator/localGenerator";
import type { TreeRepository } from "@/domain/repository/types";
import { LocalStorageRepository } from "@/domain/repository/localStorageRepo";
import {
  addPath,
  addScenarioVariant,
  createTree,
  removePath,
  type AddPathOptions,
} from "@/domain/tree";
import {
  applyEnrichment,
  fetchEnrichEnabled,
  fetchEnrichment,
} from "@/lib/enrichClient";
import {
  addGoalTag,
  completeGoal,
  dueGoalReviews,
  recordGoalReview,
  removeGoalTag,
} from "@/domain/goals";
import {
  addLongGoal as addLongGoalToTree,
  addShortGoal as addShortGoalToTree,
  addStandaloneShortGoal as addStandaloneShortGoalToTree,
  addHabit as addHabitToTree,
  addTask as addTaskToTree,
  addLooseTask as addLooseTaskToTree,
  addLooseHabit as addLooseHabitToTree,
  bumpMetric as bumpMetricInTree,
  goalById as goalByIdInTree,
  removeGoalById as removeGoalFromTree,
  removeItem as removeItemFromTree,
  removeMetric as removeMetricFromTree,
  setMetric as setMetricInTree,
  updateGoalById,
  type AddGoalInput,
} from "@/domain/goalTree";
import type { GoalDecomposition } from "@/lib/goalClient";
import { completeAction, findAction, isActionDoneToday, planToday, removeActionEverywhere, uncompleteAction, unplanToday, localDay } from "@/domain/daily";
import { actionsOnDay, setActionScheduledDate } from "@/domain/calendar";
import { arrangeDay, setActionTime, setDayWindow, dayWindow } from "@/domain/schedule";
import { parseQuickInput } from "@/domain/quickParse";
import { updateHabit as updateHabitInTree } from "@/domain/goalTree";
import { fetchArrangeDay } from "@/lib/scheduleClient";
import { fetchPlanShort } from "@/lib/planShortClient";
import type { PlanShortResult } from "@/domain/planShort";
import { anyCrisisSignal } from "@/domain/safety";

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

interface State {
  view: View;
  tree: LifeTree | null;
  activePathId: string | null;
  hydrated: boolean;
  predicting: Predicting | null; // 非空 = 正在推演，显示全屏动画
  aiEnabled: boolean; // 后端是否接入了真实大模型
  safetyHold: Profile | null; // 非空 = 检测到危机信号，暂停推演，等用户确认
  selectedTag: string | null; // 当前「标签」视图选中的标签
  focusGoalId: string | null; // 跳到「计划」视图时要聚焦/展开的目标
}

type Action =
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
  | { type: "clearSafety" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        hydrated: true,
        tree: action.tree,
        view: action.tree ? "dashboard" : "onboarding",
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
    default:
      return state;
  }
}

interface AppApi {
  view: View;
  tree: LifeTree | null;
  activePathId: string | null;
  hydrated: boolean;
  predicting: Predicting | null;
  aiEnabled: boolean;
  selectedTag: string | null; // 「标签」视图当前选中的标签（供组件读取）
  focusGoalId: string | null; // 「计划」视图要聚焦的目标（供组件读取，看完后调 clearFocusGoal）
  completeOnboarding: (profile: Profile) => void;
  addBranch: (label: string, opts?: AddPathOptions) => void;
  // 一次加多条（如"全部画上"）：在同一个 base 上折叠，单次 dispatch，避免
  // 逐条 addBranch 因 treeRef 在 effect 后才更新而互相覆盖。
  addBranches: (labels: string[], opts?: AddPathOptions) => void;
  addScenario: (basePathId: string, scenario: Scenario) => void;
  removeBranch: (id: string) => void;
  openPath: (id: string) => void;
  backToTree: () => void;
  reset: () => void;
  makeDecision: (input: DecisionInput) => Decision;
  commitDecision: (decision: Decision) => void; // 新建/覆盖同路活跃决定
  updateDecision: (decision: Decision) => void; // 按 id 原地更新（勾选/复盘）
  regeneratePath: (pathId: string, note: string) => void; // 带补充信息重新推演这条路
  openPlan: () => void;
  // ── Goals（两级模型：领域 → 长期目标 ⊃ 短期目标 → {指标/任务/习惯}）──
  // 建一个长期目标（kind:"long"，可选关联人生树分支 pathId）。返回新目标 id。
  addLongGoal: (input: { area: Goal["area"]; title: string; why?: string; startDate?: string; endDate?: string; pathId?: string | null; tags?: string[] }) => string | null;
  // 建一个长期目标并在人生树上长出一条对应分支，AI 推演后落树（仅长期目标上树）。
  addLongGoalWithBranch: (input: { area: Goal["area"]; title: string; why?: string; startDate?: string; endDate?: string }) => void;
  // 在某长期目标下建一个短期目标（kind:"short"，parentGoalId=parentLongId；area 默认继承父长期目标）。返回新目标 id。
  addShortGoal: (parentLongId: string, input: { title: string; why?: string; startDate?: string; endDate?: string; area?: Goal["area"] }) => string | null;
  // 改目标字段（title/why/area/startDate/endDate/tags…）。
  updateGoal: (goalId: string, patch: Partial<Goal>) => void;
  // 删目标（长期级联其短期子目标/任务/习惯，清 activity，剪掉关联分支；短期仅删自身）。
  removeGoalById: (goalId: string) => void;
  // 达成目标（标 done；仅长期且非 other 给所属人生面加分，由 domain 处理）。
  completeGoalById: (goalId: string) => void;
  markDueGoalsReviewed: () => void;
  addGoalTagById: (goalId: string, tag: string) => void;
  removeGoalTagById: (goalId: string, tag: string) => void;
  // ── Tasks / Habits（直挂在某目标上：长期或短期皆可，无 subgoalId）──
  addTask: (goalId: string, text: string) => string | null;
  addHabit: (goalId: string, text: string, repeat: "daily" | "weekly", weekday?: number) => string | null;
  removeItemById: (itemId: string) => void; // 删一条 task 或 habit（任意目标），清 activity
  // ── Loose / standalone（无目标）：散任务、散习惯/日常、独立短期目标 ──
  // 建一条散一次性任务（goal=null，挂在树根）。返回新 id（无 tree / 空文本 → null）。
  addLooseTask: (text: string) => string | null;
  // 建一条散习惯/日常（goal=null，无时间窗永远重复）。返回新 id（无 tree / 空文本 → null）。
  addLooseHabit: (text: string, repeat: "daily" | "weekly", weekday?: number) => string | null;
  // 建一个独立短期目标（kind:"short"，parentGoalId=null；area 默认 growth）。返回新 id（无 tree / 空标题 → null）。
  addStandaloneShortGoal: (input: { title: string; why?: string; startDate?: string; endDate?: string; area?: GoalArea }) => string | null;
  // 快速捕捉：解析一行自然语言（日期/时间/重复/标签）→ 在「单棵树快照」里建散任务或散习惯并排期，返回新 id（空标题 → null）。
  quickAdd: (text: string) => string | null;
  // ── Metrics（owner = 一个目标 id）──
  setMetric: (goalId: string, metric: Metric) => void;
  bumpMetric: (metricId: string, delta: number) => void;
  removeMetric: (goalId: string, metricId: string) => void;
  // ── AI 拆解目标：把一份（已勾选的）拆解结果一次性折进目标（仅新增，原子提交）──
  applyGoalDecomposition: (goalId: string, dec: GoalDecomposition) => void;
  openDashboard: () => void;
  openHabits: () => void;
  openAreas: () => void;
  openInsights: () => void;
  openTree: () => void;
  // ── 新导航视图（Phase 2）：待办/即将到来/全部任务/已完成/选择/标签 ──
  openToday: () => void;
  openUpcoming: () => void;
  openAllTasks: () => void;
  openCompleted: () => void;
  openChoices: () => void;
  openTag: (tag: string) => void; // 打开「标签」视图并选中该标签
  openPlanFocused: (goalId: string) => void; // 打开「计划」视图并聚焦某目标
  clearFocusGoal: () => void; // 清掉聚焦目标（组件滚动/展开后调用）
  toggleGoalFavorite: (goalId: string) => void; // 切换目标收藏状态
  // ── 选择面板（Phase 6）：CRUD + 树联动（推演选项分支 / 拍板→目标）──
  // 新建一个选择，返回新 id（无 tree / 空问题 → null）。
  createChoice: (question: string) => string | null;
  // 给某选择加一个选项，返回新 id（无 tree / 找不到 choice / 空标签 → null）。
  addChoiceOption: (choiceId: string, label: string) => string | null;
  // 行内编辑某选项字段（pros/cons/cost/reversibility/gut/label…）。
  updateChoiceOption: (optionId: string, patch: Partial<ChoiceOption>) => void;
  // 删一个选项（若是选定项，连带清掉 chosen/decidedAt）。
  removeChoiceOption: (optionId: string) => void;
  // 删整个选择。
  removeChoice: (choiceId: string) => void;
  // 重新打开已决选择（清 chosen/decidedAt）。
  reopenChoice: (choiceId: string) => void;
  // 拍板：置选定项；opts.makeGoal 时同一快照里再建一个目标（可指定 area）。
  decideChoice: (
    choiceId: string,
    optionId: string,
    opts?: { makeGoal?: boolean; area?: GoalArea },
  ) => void;
  // 为某选项在人生树上长出一条分支并回填 pathId，然后像目标分支一样 AI 推演。
  predictOptionBranch: (choiceId: string, optionId: string) => void;
  planActionToday: (actionId: string) => void;
  unplanActionToday: (actionId: string) => void;
  toggleTodayAction: (actionId: string) => void;
  removeActionById: (actionId: string) => void;
  scheduleAction: (actionId: string, date: string | null) => void;
  // 组合排程（单快照）：设 scheduledDate=date，并（若给了 startTime）同时设 startTime/durationMin。
  // 复用 scheduleAction + setActionTimeById 各自走的 domain helper（先 setActionScheduledDate，
  // 再在同一棵 working 树上 setActionTime），最后一次 patchTree。startTime 省略时等价 scheduleAction(id,date)。
  scheduleActionAt: (actionId: string, date: string, startTime?: string | null, durationMin?: number) => void;
  toggleActionOn: (actionId: string, date: string) => void;
  setActionTimeById: (actionId: string, startTime: string | null, durationMin?: number) => void;
  setDayWindowValues: (start: string, end: string) => void;
  arrangeDayWithAI: (date: string) => Promise<void>;
  // AI 规划一个短期目标这一段：在其时间窗内按合理频率排未排期任务、给每周习惯定星期几。
  // 返回方案（供预览），不直接落地；找不到目标 / 无可排项 → null。离线走本地兜底。
  planShortGoal: (goalId: string) => Promise<PlanShortResult | null>;
  // 应用预览方案：在一棵 working 树上设每个任务的 scheduledDate + 每个习惯的 repeatWeekday，单次 patchTree。
  applyShortPlan: (plan: PlanShortResult) => void;
  dismissGuide: () => void;
  safetyHold: Profile | null;
  continueAfterSafety: () => void;
}

const AppContext = createContext<AppApi | null>(null);

// "正在推演"动画至少播这么久——即便没接 AI / 本地秒出，也让过场有质感。
const MIN_PREDICT_MS = 1600;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function AppProvider({
  children,
  generator = localGenerator,
  repository,
}: {
  children: ReactNode;
  generator?: PathGenerator;
  repository?: TreeRepository;
}) {
  const [state, dispatch] = useReducer(reducer, {
    view: "onboarding",
    tree: null,
    activePathId: null,
    hydrated: false,
    predicting: null,
    aiEnabled: false,
    safetyHold: null,
    selectedTag: null,
    focusGoalId: null,
  });

  const repoRef = useRef<TreeRepository | null>(repository ?? null);
  const repo = useCallback((): TreeRepository => {
    if (!repoRef.current) repoRef.current = new LocalStorageRepository();
    return repoRef.current;
  }, []);

  // 最新 tree 的引用，供异步推演读取
  const treeRef = useRef<LifeTree | null>(null);
  useEffect(() => {
    treeRef.current = state.tree;
  }, [state.tree]);

  // 给异步推演读取的最新值：是否接入 AI、是否正在推演（用于并发保护）
  const aiEnabledRef = useRef(false);
  useEffect(() => {
    aiEnabledRef.current = state.aiEnabled;
  }, [state.aiEnabled]);
  const predictingRef = useRef(false);
  useEffect(() => {
    predictingRef.current = state.predicting !== null;
  }, [state.predicting]);

  // 挂载：读取本地数据 + 探测 AI 是否接入
  useEffect(() => {
    dispatch({ type: "hydrate", tree: repo().load() });
    fetchEnrichEnabled().then((enabled) => dispatch({ type: "setAiEnabled", enabled }));
  }, [repo]);

  // 持久化：tree 变化即写入本地（含 AI 润色后的合并结果）
  useEffect(() => {
    if (state.hydrated && state.tree) repo().save(state.tree);
  }, [state.tree, state.hydrated, repo]);

  // 核心：先在内存里生成本地占位路径，等 AI 把这一批全部推演完，再一次性提交到
  // 树上（届时分支才画出来，并落在 AI 决定的分叉年龄）。AI 没接入/失败则用本地兜底，
  // 但仍保证动画至少播 MIN_PREDICT_MS，让"正在推演"有质感。
  const predictAndCommit = useCallback(
    async (
      workingTree: LifeTree,
      newPaths: LifePath[],
      context: "onboarding" | "branch",
    ): Promise<void> => {
      const labels = newPaths
        .filter((p) => p.kind === "choice")
        .map((p) => p.choiceLabel);
      dispatch({ type: "predictStart", labels, total: newPaths.length, context });

      const { profile, horizonYears } = workingTree;
      const enrichedById = new Map<string, LifePath>();
      const enrichOne = async (p: LifePath) => {
        let finalP = p;
        if (aiEnabledRef.current) {
          const result = await fetchEnrichment(workingTree, p);
          if (result) finalP = applyEnrichment(p, result, profile.age, horizonYears);
        }
        enrichedById.set(p.id, finalP);
        dispatch({ type: "predictTick" });
      };

      await Promise.all([
        Promise.all(newPaths.map(enrichOne)),
        delay(MIN_PREDICT_MS), // 动画下限：等真预测或这个时长，取较长者
      ]);

      const finalPaths = workingTree.paths.map((p) => enrichedById.get(p.id) ?? p);
      // 推演期间 UI 仍可编辑（选项字段/目标/任务/拍板…），这些都写进了更新的 treeRef。
      // 提交时读最新树、只整体替换 paths（已含新分支+润色），保留期间的并发编辑，不回退。
      // treeRef 为空（首次 onboarding）则退回 workingTree，行为不变。
      const cur = treeRef.current ?? workingTree;
      dispatch({
        type: "setTree",
        tree: { ...cur, paths: finalPaths, updatedAt: new Date().toISOString() },
      });
      dispatch({ type: "predictEnd" });
    },
    [],
  );

  // 带上用户补充信息，重新推演某条已存在的路（原地替换，停留在详情页）。
  // 若重推的是"最可能"基准，顺带丢掉它的乐观/保守兄弟——下次切换时按新 forkAge 重生，
  // 免得与基准时间错位。
  const regenerateAndCommit = useCallback(
    async (pathId: string, note: string): Promise<void> => {
      const base = treeRef.current;
      if (!base) return;
      const target = base.paths.find((p) => p.id === pathId);
      if (!target) return;
      const noted: LifePath = { ...target, note: note.trim() || undefined };
      dispatch({ type: "predictStart", labels: [noted.choiceLabel], total: 1, context: "branch" });

      let finalP = noted;
      await Promise.all([
        (async () => {
          if (aiEnabledRef.current) {
            const result = await fetchEnrichment(base, noted);
            if (result) finalP = applyEnrichment(noted, result, base.profile.age, base.horizonYears);
          }
          dispatch({ type: "predictTick" });
        })(),
        delay(MIN_PREDICT_MS),
      ]);

      const cur = treeRef.current ?? base;
      const dropSiblings = finalP.scenario === "likely" && finalP.parentId == null;
      const paths = cur.paths
        .filter(
          (p) =>
            !(
              dropSiblings &&
              p.id !== finalP.id &&
              p.choiceLabel === finalP.choiceLabel &&
              p.parentId === finalP.parentId &&
              p.scenario !== "likely"
            ),
        )
        .map((p) => (p.id === finalP.id ? finalP : p));
      dispatch({ type: "patchTree", tree: { ...cur, paths, updatedAt: new Date().toISOString() } });
      dispatch({ type: "predictEnd" });
    },
    [],
  );

  const api = useMemo<AppApi>(
    () => ({
      view: state.view,
      tree: state.tree,
      activePathId: state.activePathId,
      hydrated: state.hydrated,
      predicting: state.predicting,
      aiEnabled: state.aiEnabled,
      selectedTag: state.selectedTag,
      focusGoalId: state.focusGoalId,
      completeOnboarding: (profile) => {
        if (predictingRef.current) return;
        const crisis = anyCrisisSignal([
          profile.name,
          profile.snapshot,
          profile.crossroad,
          profile.status,
          profile.occupation,
          profile.hobbies,
          profile.skills,
          profile.assets,
          profile.sideHustle,
        ]);
        if (crisis) {
          dispatch({ type: "safetyHold", profile });
          return;
        }
        const tree = createTree(profile, generator, new Date().toISOString());
        void predictAndCommit(tree, tree.paths, "onboarding");
      },
      addBranch: (label, opts) => {
        if (predictingRef.current) return;
        const base = treeRef.current;
        if (!base) return;
        const working = addPath(base, label, generator, new Date().toISOString(), opts);
        if (working === base) return; // 空标签
        const newPath = working.paths[working.paths.length - 1];
        void predictAndCommit(working, [newPath], "branch");
      },
      addBranches: (labels, opts) => {
        if (predictingRef.current) return;
        const base = treeRef.current;
        if (!base) return;
        const ts = new Date().toISOString();
        // 在同一个 base 上依次折叠（index 递增 → id 互不相同）
        let working = base;
        const newPaths: LifePath[] = [];
        for (const label of labels) {
          if (label.trim()) {
            working = addPath(working, label, generator, ts, opts);
            newPaths.push(working.paths[working.paths.length - 1]);
          }
        }
        if (!newPaths.length) return;
        void predictAndCommit(working, newPaths, "branch");
      },
      addScenario: (basePathId, scenario) => {
        if (predictingRef.current) return;
        const base = treeRef.current;
        if (!base) return;
        const working = addScenarioVariant(
          base,
          basePathId,
          scenario,
          generator,
          new Date().toISOString(),
        );
        if (working === base) return; // 已存在或没找到
        const newPath = working.paths[working.paths.length - 1];
        void predictAndCommit(working, [newPath], "branch").then(() =>
          dispatch({ type: "openPath", id: newPath.id }),
        );
      },
      removeBranch: (id) => {
        const base = treeRef.current;
        if (!base) return;
        dispatch({ type: "setTree", tree: removePath(base, id, new Date().toISOString()) });
      },
      openPath: (id) => dispatch({ type: "openPath", id }),
      backToTree: () => dispatch({ type: "backToTree" }),
      reset: () => {
        repo().clear();
        dispatch({ type: "reset" });
      },
      makeDecision: (input) => createDecision(input, new Date().toISOString()),
      commitDecision: (decision) => {
        const base = treeRef.current;
        if (!base) return;
        dispatch({ type: "patchTree", tree: upsertDecision(base, decision) });
      },
      updateDecision: (decision) => {
        const base = treeRef.current;
        if (!base) return;
        dispatch({
          type: "patchTree",
          tree: {
            ...base,
            decisions: base.decisions.map((d) => (d.id === decision.id ? decision : d)),
          },
        });
      },
      regeneratePath: (pathId, note) => {
        if (predictingRef.current) return;
        void regenerateAndCommit(pathId, note);
      },
      openPlan: () => dispatch({ type: "openPlan" }),
      // 建长期目标（不长分支）。返回新 id（无 tree / 空标题 → null）。
      addLongGoal: ({ area, title, why, startDate, endDate, pathId, tags }) => {
        const baseTree = treeRef.current;
        if (!baseTree || !title.trim()) return null;
        const input: AddGoalInput = { area, title, why, startDate, endDate, pathId, tags };
        const { tree, id } = addLongGoalToTree(baseTree, input, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      // 建长期目标 + 长出一条人生树分支，AI 推演后整体落树（仅长期目标上树）。
      addLongGoalWithBranch: ({ area, title, why, startDate, endDate }) => {
        if (predictingRef.current) return;
        const baseTree = treeRef.current;
        if (!baseTree || !title.trim()) return;
        const ts = new Date().toISOString();
        // 1) 在树上长出这条目标的分支（根分支，分叉年龄按选择推测，AI 可重定）
        const working = addPath(baseTree, title, generator, ts);
        if (working === baseTree) return;
        const newPath = working.paths[working.paths.length - 1];
        // 2) 建长期目标并关联这条分支（同一棵 working 树上加，避免并发回填竞态）
        const { tree: withGoal } = addLongGoalToTree(
          working,
          { area, title, why, startDate, endDate, pathId: newPath.id },
          ts,
        );
        // 3) 推演这条分支（播动画、落到树上）。withGoal 含 goals，predictAndCommit 会保留。
        void predictAndCommit(withGoal, [newPath], "branch");
      },
      // 在某长期目标下建一个短期目标（area 默认继承父长期目标）。返回新 id（无 tree / 空标题 / 找不到父目标 → null）。
      addShortGoal: (parentLongId, { title, why, startDate, endDate, area }) => {
        const baseTree = treeRef.current;
        if (!baseTree || !title.trim()) return null;
        const parent = goalByIdInTree(baseTree, parentLongId);
        if (!parent) return null;
        const input: AddGoalInput = { area: area ?? parent.area, title, why, startDate, endDate };
        const { tree, id } = addShortGoalToTree(baseTree, parentLongId, input, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      updateGoal: (goalId, patch) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: updateGoalById(baseTree, goalId, patch) });
      },
      removeGoalById: (goalId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: removeGoalFromTree(baseTree, goalId, new Date().toISOString()) });
      },
      completeGoalById: (goalId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: completeGoal(baseTree, goalId, new Date().toISOString()) });
      },
      markDueGoalsReviewed: () => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const now = new Date().toISOString();
        // 待复盘清单按 baseTree 快照一次性确定（不要改成 tt，否则会边盖时间戳边缩短清单）；
        // 折叠到一棵树上单次 dispatch（逐条 dispatch 会因 treeRef 滞后只生效一条）。
        let tt = baseTree;
        for (const g of dueGoalReviews(baseTree, now)) tt = recordGoalReview(tt, g.id, now);
        dispatch({ type: "patchTree", tree: tt });
      },
      openDashboard: () => dispatch({ type: "openDashboard" }),
      openHabits: () => dispatch({ type: "openHabits" }),
      openAreas: () => dispatch({ type: "openAreas" }),
      openInsights: () => dispatch({ type: "openInsights" }),
      // ── 新导航视图（Phase 2）──
      openToday: () => dispatch({ type: "openToday" }),
      openUpcoming: () => dispatch({ type: "openUpcoming" }),
      openAllTasks: () => dispatch({ type: "openAllTasks" }),
      openCompleted: () => dispatch({ type: "openCompleted" }),
      openChoices: () => dispatch({ type: "openChoices" }),
      openTag: (tag) => dispatch({ type: "openTag", tag }),
      openPlanFocused: (goalId) => dispatch({ type: "openPlanFocused", goalId }),
      clearFocusGoal: () => dispatch({ type: "clearFocusGoal" }),
      // 切换目标收藏：读最新树快照，按 id 翻转 favorite，单次 patchTree（镜像其它目标 mutator）。
      toggleGoalFavorite: (goalId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const goal = (baseTree.goals ?? []).find((g) => g.id === goalId);
        if (!goal) return;
        dispatch({
          type: "patchTree",
          tree: updateGoalById(baseTree, goalId, { favorite: !goal.favorite }),
        });
      },
      // ── 选择面板（Phase 6）：读最新树快照、单次 patchTree，镜像其它目标 mutator ──
      // 新建选择：读最新树，choices.createChoice 折成一棵树后单次 patchTree。返回新 id。
      createChoice: (question) => {
        const baseTree = treeRef.current;
        if (!baseTree || !question.trim()) return null;
        const { tree, id } = choices.createChoice(baseTree, question, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      // 加选项：找不到 choice / 空 id 视为无操作（choices.addOption 已做安全兜底）。
      addChoiceOption: (choiceId, label) => {
        const baseTree = treeRef.current;
        if (!baseTree || !label.trim()) return null;
        const { tree, id } = choices.addOption(baseTree, choiceId, label, new Date().toISOString());
        if (!id) return null; // 找不到 choiceId
        dispatch({ type: "patchTree", tree });
        return id;
      },
      updateChoiceOption: (optionId, patch) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: choices.updateOption(baseTree, optionId, patch) });
      },
      removeChoiceOption: (optionId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: choices.removeOption(baseTree, optionId) });
      },
      removeChoice: (choiceId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: choices.removeChoice(baseTree, choiceId) });
      },
      reopenChoice: (choiceId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: choices.reopenChoice(baseTree, choiceId) });
      },
      // 拍板：在同一快照里 decideChoice + （可选）建长期目标，避免两次 dispatch 互相覆盖。
      // 从同一份 baseTree 快照查 option/choice，建长期目标走 goalTree.addLongGoal，
      // 关联该选项已推演出的分支（option.pathId）。仅长期目标上树，故拍板只造长期目标。
      decideChoice: (choiceId, optionId, opts) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const now = new Date().toISOString();
        let t = choices.decideChoice(baseTree, choiceId, optionId, now);
        if (opts?.makeGoal) {
          const hit = choices.findChoiceByOption(baseTree, optionId);
          if (hit && hit.choice.id === choiceId) {
            const { choice, option } = hit;
            const input: AddGoalInput = {
              area: opts.area ?? "growth",
              title: option.label,
              why: choice.question,
              pathId: option.pathId ?? null,
            };
            ({ tree: t } = addLongGoalToTree(t, input, now));
          }
        }
        dispatch({ type: "patchTree", tree: t });
      },
      // 为某选项长出分支并推演，镜像 addGoalWithBranch：
      // 1) 读最新树，定位选项；已有 pathId 则无操作（已推演过）。
      // 2) addPath（choiceLabel=option.label，从「现在」根分叉）→ 拿到新 pathId →
      //    在同一棵 working 树上 linkOptionPath，确保链接先落树（不依赖异步推演完成）。
      // 3) patchTree 一次（把分支+链接先落树），再 predictAndCommit 推演这条分支
      //    （沿用 addGoalWithBranch 的离线/本地兜底；predictAndCommit 读 working 的快照保留 choices）。
      predictOptionBranch: (choiceId, optionId) => {
        if (predictingRef.current) return;
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const hit = choices.findChoiceByOption(baseTree, optionId);
        if (!hit || hit.choice.id !== choiceId) return;
        if (hit.option.pathId) return; // 已推演过，无操作
        const ts = new Date().toISOString();
        // 1) 长出这条选项的根分支（与 addGoalWithBranch 同样：从「现在」分叉、AI 可重定分叉年龄）
        const working = addPath(baseTree, hit.option.label, generator, ts);
        if (working === baseTree) return; // 空标签
        const newPath = working.paths[working.paths.length - 1];
        // 2) 在同一棵 working 树上回填链接，链接先落树（无论异步推演成败都不丢）
        const linked = choices.linkOptionPath(working, optionId, newPath.id);
        // 3) 先 patch（分支 + 链接），再推演这条分支（保留 choices/链接）
        dispatch({ type: "patchTree", tree: linked });
        void predictAndCommit(linked, [newPath], "branch");
      },
      // ── Tasks / Habits（直挂在某目标上：长期或短期皆可） ──
      addTask: (goalId, text) => {
        const baseTree = treeRef.current;
        if (!baseTree || !text.trim()) return null;
        const { tree, id } = addTaskToTree(baseTree, goalId, text, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      addHabit: (goalId, text, repeat, weekday) => {
        const baseTree = treeRef.current;
        if (!baseTree || !text.trim()) return null;
        // weekly 习惯未指定星期几时，锚定到今天的本地星期几（与 localDay/本地时间一致，应用为 UTC+8）。
        const wd = repeat === "weekly" ? (weekday ?? new Date().getDay()) : undefined;
        const { tree, id } = addHabitToTree(baseTree, goalId, text, repeat, wd, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      removeItemById: (itemId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: removeItemFromTree(baseTree, itemId) });
      },
      // ── Loose / standalone（无目标）：读最新树快照、单次 patchTree，镜像 addTask/addHabit/addShortGoal ──
      addLooseTask: (text) => {
        const baseTree = treeRef.current;
        if (!baseTree || !text.trim()) return null;
        const { tree, id } = addLooseTaskToTree(baseTree, text, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      addLooseHabit: (text, repeat, weekday) => {
        const baseTree = treeRef.current;
        if (!baseTree || !text.trim()) return null;
        // weekly 习惯未指定星期几时，锚定到今天的本地星期几（与 addHabit 一致）。
        const wd = repeat === "weekly" ? (weekday ?? new Date().getDay()) : undefined;
        const { tree, id } = addLooseHabitToTree(baseTree, text, repeat, wd, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      // 建独立短期目标（无长期父）：area 默认 growth。
      addStandaloneShortGoal: ({ title, why, startDate, endDate, area }) => {
        const baseTree = treeRef.current;
        if (!baseTree || !title.trim()) return null;
        const input: AddGoalInput = { area: area ?? "growth", title, why, startDate, endDate };
        const { tree, id } = addStandaloneShortGoalToTree(baseTree, input, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      // 快速捕捉：用 state 层 today 解析，再在「同一棵 working 树」上建散项 + 排期，单次 patchTree（不连环 dispatch，避免互相覆盖）。
      //   有 repeat → 散习惯（+ startTime）；否则 → 散任务（+ scheduledDate + startTime）。
      //   解析出的 tags 暂忽略（散项不挂目标，预留字段，不崩）。
      quickAdd: (text) => {
        const baseTree = treeRef.current;
        if (!baseTree) return null;
        const now = new Date().toISOString();
        const p = parseQuickInput(text, localDay(new Date()));
        if (!p.text) return null; // 解析后无标题
        if (p.repeat) {
          const made = addLooseHabitToTree(baseTree, p.text, p.repeat, p.repeatWeekday, now);
          let t = made.tree;
          if (p.startTime) t = setActionTime(t, made.id, p.startTime);
          dispatch({ type: "patchTree", tree: t });
          return made.id;
        }
        const made = addLooseTaskToTree(baseTree, p.text, now);
        let t = made.tree;
        if (p.scheduledDate) t = setActionScheduledDate(t, made.id, p.scheduledDate);
        if (p.startTime) t = setActionTime(t, made.id, p.startTime);
        dispatch({ type: "patchTree", tree: t });
        return made.id;
      },
      // ── Metrics（owner = 一个目标 id） ──
      setMetric: (goalId, metric) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: setMetricInTree(baseTree, goalId, metric) });
      },
      bumpMetric: (metricId, delta) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: bumpMetricInTree(baseTree, metricId, delta) });
      },
      removeMetric: (goalId, metricId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: removeMetricFromTree(baseTree, goalId, metricId) });
      },
      // AI 拆解：把（已勾选的）指标/任务/习惯/短期子目标一次性折进一棵树，单次 patchTree。
      // 两级模型下，拆解里的 subgoal → 在该（长期）目标下建一个 short goal，承接其 指标/任务/习惯。
      // 仅新增、永不删除；now/uuid 在 state 层生成（domain 保持纯）。读最新树避免并发覆盖。
      applyGoalDecomposition: (goalId, dec) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const now = new Date().toISOString();
        const parent = goalByIdInTree(baseTree, goalId);
        if (!parent) return;
        let t = baseTree;
        // 目标级 指标 / 任务 / 习惯（直挂在该目标上）
        for (const m of dec.metrics ?? []) {
          t = setMetricInTree(t, goalId, {
            id: crypto.randomUUID(),
            label: m.label,
            current: 0,
            target: m.target,
            unit: m.unit,
          });
        }
        for (const task of dec.tasks ?? []) {
          ({ tree: t } = addTaskToTree(t, goalId, task.text, now));
        }
        for (const h of dec.habits ?? []) {
          ({ tree: t } = addHabitToTree(t, goalId, h.text, h.repeat, h.repeatWeekday, now));
        }
        // 每个子目标 → 在该长期目标下建一个短期目标，再把它自己的 指标/任务/习惯 折到新短期目标 id 上。
        for (const sg of dec.subgoals ?? []) {
          let sgId: string;
          ({ tree: t, id: sgId } = addShortGoalToTree(t, goalId, { area: parent.area, title: sg.title }, now));
          for (const m of sg.metrics ?? []) {
            t = setMetricInTree(t, sgId, {
              id: crypto.randomUUID(),
              label: m.label,
              current: 0,
              target: m.target,
              unit: m.unit,
            });
          }
          for (const task of sg.tasks ?? []) {
            ({ tree: t } = addTaskToTree(t, sgId, task.text, now));
          }
          for (const h of sg.habits ?? []) {
            ({ tree: t } = addHabitToTree(t, sgId, h.text, h.repeat, h.repeatWeekday, now));
          }
        }
        dispatch({ type: "patchTree", tree: t });
      },
      openTree: () => dispatch({ type: "backToTree" }),
      planActionToday: (actionId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: planToday(baseTree, actionId, localDay(new Date())) });
      },
      unplanActionToday: (actionId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: unplanToday(baseTree, actionId, localDay(new Date())) });
      },
      toggleTodayAction: (actionId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const today = localDay(new Date());
        const hit = findAction(baseTree, actionId);
        // 用同一套口径判断"今天是否已完成"（一次性=done；daily=今天；weekly=本周内）。
        const doneNow = hit ? isActionDoneToday(baseTree, hit.item, today) : false;
        const next = doneNow
          ? uncompleteAction(baseTree, actionId, today)
          : completeAction(baseTree, actionId, today);
        dispatch({ type: "patchTree", tree: next });
      },
      // 删除一条行动（task/habit，任意层）；removeItemById 的别名，保留旧调用点。
      removeActionById: (actionId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: removeActionEverywhere(baseTree, actionId) });
      },
      addGoalTagById: (goalId, tag) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: addGoalTag(baseTree, goalId, tag) });
      },
      removeGoalTagById: (goalId, tag) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: removeGoalTag(baseTree, goalId, tag) });
      },
      scheduleAction: (actionId, date) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: setActionScheduledDate(baseTree, actionId, date) });
      },
      // 组合排程：在一棵 working 树上先 setActionScheduledDate，再（若给 startTime）setActionTime，单次 dispatch。
      scheduleActionAt: (actionId, date, startTime, durationMin) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        let t = setActionScheduledDate(baseTree, actionId, date);
        if (startTime !== undefined) t = setActionTime(t, actionId, startTime, durationMin);
        dispatch({ type: "patchTree", tree: t });
      },
      toggleActionOn: (actionId, date) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const hit = findAction(baseTree, actionId);
        if (!hit) return;
        const done = isActionDoneToday(baseTree, hit.item, date);
        const next = done
          ? uncompleteAction(baseTree, actionId, date)
          : completeAction(baseTree, actionId, date);
        dispatch({ type: "patchTree", tree: next });
      },
      setActionTimeById: (actionId, startTime, durationMin) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: setActionTime(baseTree, actionId, startTime, durationMin) });
      },
      setDayWindowValues: (start, end) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: setDayWindow(baseTree, start, end) });
      },
      arrangeDayWithAI: async (date) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const items = actionsOnDay(baseTree, date).map(({ item }) => ({
          id: item.id,
          text: item.text,
          durationMin: item.durationMin,
        }));
        if (!items.length) return;
        const win = dayWindow(baseTree);
        // 网络/AI 失败也别让 UI 挂着：兜底用本地 arrangeDay 给一份不重叠的安排（离线可用）。
        let plan;
        try {
          plan = await fetchArrangeDay(items, win);
        } catch {
          plan = arrangeDay(items.map((i) => ({ id: i.id, durationMin: i.durationMin })), win);
        }
        if (!plan.length) return;
        // 应用时读最新树，避免动画/并发期间被覆盖；把所有结果折进一棵树，单次 dispatch。
        let t = treeRef.current ?? baseTree;
        for (const p of plan) t = setActionTime(t, p.id, p.startTime, p.durationMin);
        dispatch({ type: "patchTree", tree: t });
      },
      // AI 规划短期目标这一段：收集该短期目标的未排期任务 + 每周习惯 + 时间窗 + 作息 + today，
      // 调 fetchPlanShort（离线走本地兜底），返回方案给 UI 预览。不直接落地。
      planShortGoal: async (goalId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return null;
        const goal = goalByIdInTree(baseTree, goalId);
        if (!goal) return null;
        const today = localDay(new Date());
        // 未排期任务：没排日期、未完成。
        const tasks = (goal.tasks ?? [])
          .filter((tk) => !tk.scheduledDate && !tk.done)
          .map((tk) => ({ id: tk.id, text: tk.text }));
        // 每周习惯参与定星期几；每日习惯随同传入但本地兜底不动它们。
        const habits = (goal.habits ?? []).map((h) => ({ id: h.id, text: h.text, repeat: h.repeat }));
        // 没什么可排（无任务且无每周习惯）→ null，让 UI 提示「这段没有可排的任务」。
        if (!tasks.length && !habits.some((h) => h.repeat === "weekly")) return null;
        const win = dayWindow(baseTree);
        return fetchPlanShort({
          goal: { title: goal.title, why: goal.why, startDate: goal.startDate, endDate: goal.endDate },
          startDate: goal.startDate ?? today,
          endDate: goal.endDate ?? "",
          today,
          dayStart: win.start,
          dayEnd: win.end,
          tasks,
          habits,
        });
      },
      // 应用预览方案：读最新树，在一棵 working 树上设每个任务 scheduledDate + 每个习惯 repeatWeekday，单次 patchTree。
      applyShortPlan: (plan) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        let t = baseTree;
        for (const [taskId, date] of Object.entries(plan.taskDates)) {
          t = setActionScheduledDate(t, taskId, date);
        }
        for (const [habitId, wd] of Object.entries(plan.habitWeekdays)) {
          t = updateHabitInTree(t, habitId, { repeatWeekday: wd });
        }
        dispatch({ type: "patchTree", tree: t });
      },
      dismissGuide: () => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: { ...baseTree, guideDismissed: true, updatedAt: new Date().toISOString() } });
      },
      safetyHold: state.safetyHold,
      continueAfterSafety: () => {
        if (predictingRef.current) return;
        const p = state.safetyHold;
        if (!p) return;
        dispatch({ type: "clearSafety" });
        const tree = createTree(p, generator, new Date().toISOString());
        void predictAndCommit(tree, tree.paths, "onboarding");
      },
    }),
    [
      state.view,
      state.tree,
      state.activePathId,
      state.hydrated,
      state.predicting,
      state.aiEnabled,
      state.safetyHold,
      state.selectedTag,
      state.focusGoalId,
      generator,
      repo,
      predictAndCommit,
      regenerateAndCommit,
    ],
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
