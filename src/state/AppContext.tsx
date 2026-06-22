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
import type { Decision, Goal, LifePath, LifeTree, Metric, Profile, Scenario } from "@/domain/types";
import { createDecision, upsertDecision, type DecisionInput } from "@/domain/decisions";
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
  addGoal as addGoalToTree,
  addHabit as addHabitToTree,
  addSubgoal as addSubgoalToTree,
  addTask as addTaskToTree,
  bumpMetric as bumpMetricInTree,
  removeGoalById as removeGoalFromTree,
  removeMetric as removeMetricFromTree,
  setMetric as setMetricInTree,
  updateGoalById,
  type AddGoalInput,
} from "@/domain/goalTree";
import type { GoalDecomposition } from "@/lib/goalClient";
import { completeAction, findAction, isActionDoneToday, planToday, removeActionEverywhere, uncompleteAction, unplanToday, localDay } from "@/domain/daily";
import { actionsOnDay, setActionScheduledDate } from "@/domain/calendar";
import { arrangeDay, setActionTime, setDayWindow, dayWindow } from "@/domain/schedule";
import { fetchArrangeDay } from "@/lib/scheduleClient";
import { anyCrisisSignal } from "@/domain/safety";

export type View =
  | "onboarding"
  | "tree"
  | "detail"
  | "plan"
  | "dashboard"
  | "habits"
  | "areas"
  | "insights";

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
  // ── Goals（嵌套模型：领域 → 目标(时间范围) → 子目标 → {指标/任务/习惯}）──
  // 建一个目标（可选关联人生树分支 pathId）。返回新目标 id。
  addGoal: (input: { area: Goal["area"]; title: string; why?: string; startDate?: string; endDate?: string; pathId?: string | null; tags?: string[] }) => string | null;
  // 建一个目标并在人生树上长出一条对应分支（长目标），AI 推演后落树。
  addGoalWithBranch: (input: { area: Goal["area"]; title: string; why?: string; startDate?: string; endDate?: string }) => void;
  // 改目标字段（title/why/area/startDate/endDate/tags…）。
  updateGoal: (goalId: string, patch: Partial<Goal>) => void;
  // 删目标（级联子目标/任务/习惯，清 activity，剪掉关联分支）。
  removeGoalById: (goalId: string) => void;
  // 达成目标（标 done + 给所属人生面加分）。
  completeGoalById: (goalId: string) => void;
  markDueGoalsReviewed: () => void;
  addGoalTagById: (goalId: string, tag: string) => void;
  removeGoalTagById: (goalId: string, tag: string) => void;
  // ── Subgoals ──
  addSubgoal: (goalId: string, title: string) => string | null;
  removeSubgoal: (subgoalId: string) => void;
  // ── Tasks / Habits（建在目标级 subgoalId=null，或某子目标下）──
  addTask: (goalId: string, subgoalId: string | null, text: string) => string | null;
  addHabit: (goalId: string, subgoalId: string | null, text: string, repeat: "daily" | "weekly", weekday?: number) => string | null;
  removeItemById: (itemId: string) => void; // 删一条 task 或 habit（任意层），清 activity
  // ── Metrics（owner = 目标或子目标，按 id）──
  setMetric: (ownerId: string, metric: Metric) => void;
  bumpMetric: (metricId: string, delta: number) => void;
  removeMetric: (ownerId: string, metricId: string) => void;
  // ── AI 拆解目标：把一份（已勾选的）拆解结果一次性折进目标（仅新增，原子提交）──
  applyGoalDecomposition: (goalId: string, dec: GoalDecomposition) => void;
  openDashboard: () => void;
  openHabits: () => void;
  openAreas: () => void;
  openInsights: () => void;
  openTree: () => void;
  planActionToday: (actionId: string) => void;
  unplanActionToday: (actionId: string) => void;
  toggleTodayAction: (actionId: string) => void;
  removeActionById: (actionId: string) => void;
  scheduleAction: (actionId: string, date: string | null) => void;
  toggleActionOn: (actionId: string, date: string) => void;
  setActionTimeById: (actionId: string, startTime: string | null, durationMin?: number) => void;
  setDayWindowValues: (start: string, end: string) => void;
  arrangeDayWithAI: (date: string) => Promise<void>;
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
      dispatch({
        type: "setTree",
        tree: { ...workingTree, paths: finalPaths, updatedAt: new Date().toISOString() },
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
      // 建目标（不长分支）。返回新 id（无 tree / 空标题 → null）。
      addGoal: ({ area, title, why, startDate, endDate, pathId, tags }) => {
        const baseTree = treeRef.current;
        if (!baseTree || !title.trim()) return null;
        const input: AddGoalInput = { area, title, why, startDate, endDate, pathId, tags };
        const { tree, id } = addGoalToTree(baseTree, input, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      // 建目标 + 长出一条人生树分支（长目标），AI 推演后整体落树。
      addGoalWithBranch: ({ area, title, why, startDate, endDate }) => {
        if (predictingRef.current) return;
        const baseTree = treeRef.current;
        if (!baseTree || !title.trim()) return;
        const ts = new Date().toISOString();
        // 1) 在树上长出这条目标的分支（根分支，分叉年龄按选择推测，AI 可重定）
        const working = addPath(baseTree, title, generator, ts);
        if (working === baseTree) return;
        const newPath = working.paths[working.paths.length - 1];
        // 2) 建目标并关联这条分支（同一棵 working 树上加，避免并发回填竞态）
        const { tree: withGoal } = addGoalToTree(
          working,
          { area, title, why, startDate, endDate, pathId: newPath.id },
          ts,
        );
        // 3) 推演这条分支（播动画、落到树上）。withGoal 含 goals，predictAndCommit 会保留。
        void predictAndCommit(withGoal, [newPath], "branch");
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
      // ── Subgoals ──
      addSubgoal: (goalId, title) => {
        const baseTree = treeRef.current;
        if (!baseTree || !title.trim()) return null;
        const { tree, id } = addSubgoalToTree(baseTree, goalId, title, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      // 删一个子目标：连带它名下的 task/habit，并清掉这些 id 在每日活动里的记录。
      // goalTree 未提供 removeSubgoal，这里在 state 层做最小定位+过滤（保持 domain 不动）。
      removeSubgoal: (subgoalId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const ids = new Set<string>();
        for (const g of baseTree.goals ?? []) {
          for (const s of g.subgoals ?? []) {
            if (s.id !== subgoalId) continue;
            for (const t of s.tasks ?? []) ids.add(t.id);
            for (const h of s.habits ?? []) ids.add(h.id);
          }
        }
        const next: LifeTree = {
          ...baseTree,
          goals: (baseTree.goals ?? []).map((g) => ({
            ...g,
            subgoals: (g.subgoals ?? []).filter((s) => s.id !== subgoalId),
          })),
          activity: (baseTree.activity ?? []).map((d) => ({
            ...d,
            plannedActionIds: d.plannedActionIds.filter((x) => !ids.has(x)),
            completedActionIds: d.completedActionIds.filter((x) => !ids.has(x)),
          })),
        };
        dispatch({ type: "patchTree", tree: next });
      },
      // ── Tasks / Habits ──
      addTask: (goalId, subgoalId, text) => {
        const baseTree = treeRef.current;
        if (!baseTree || !text.trim()) return null;
        const { tree, id } = addTaskToTree(baseTree, goalId, subgoalId, text, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      addHabit: (goalId, subgoalId, text, repeat, weekday) => {
        const baseTree = treeRef.current;
        if (!baseTree || !text.trim()) return null;
        // weekly 习惯未指定星期几时，锚定到今天的本地星期几（与 localDay/本地时间一致，应用为 UTC+8）。
        const wd = repeat === "weekly" ? (weekday ?? new Date().getDay()) : undefined;
        const { tree, id } = addHabitToTree(baseTree, goalId, subgoalId, text, repeat, wd, new Date().toISOString());
        dispatch({ type: "patchTree", tree });
        return id;
      },
      removeItemById: (itemId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: removeActionEverywhere(baseTree, itemId) });
      },
      // ── Metrics ──
      setMetric: (ownerId, metric) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: setMetricInTree(baseTree, ownerId, metric) });
      },
      bumpMetric: (metricId, delta) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: bumpMetricInTree(baseTree, metricId, delta) });
      },
      removeMetric: (ownerId, metricId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: removeMetricFromTree(baseTree, ownerId, metricId) });
      },
      // AI 拆解：把（已勾选的）指标/任务/习惯/子目标一次性折进一棵树，单次 patchTree。
      // 仅新增、永不删除；now/uuid 在 state 层生成（domain 保持纯）。读最新树避免并发覆盖。
      applyGoalDecomposition: (goalId, dec) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const now = new Date().toISOString();
        let t = baseTree;
        // 目标级 指标 / 任务 / 习惯
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
          ({ tree: t } = addTaskToTree(t, goalId, null, task.text, now));
        }
        for (const h of dec.habits ?? []) {
          ({ tree: t } = addHabitToTree(t, goalId, null, h.text, h.repeat, h.repeatWeekday, now));
        }
        // 每个子目标：先建，再把它自己的 指标/任务/习惯 折到新子目标 id 上。
        for (const sg of dec.subgoals ?? []) {
          let sgId: string;
          ({ tree: t, id: sgId } = addSubgoalToTree(t, goalId, sg.title, now));
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
            ({ tree: t } = addTaskToTree(t, goalId, sgId, task.text, now));
          }
          for (const h of sg.habits ?? []) {
            ({ tree: t } = addHabitToTree(t, goalId, sgId, h.text, h.repeat, h.repeatWeekday, now));
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
