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
import type { Decision, Goal, LifePath, LifeTree, Profile, Scenario } from "@/domain/types";
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
  completeGoal,
  createGoal,
  dropGoal,
  dueGoalReviews,
  recordGoalReview,
  setActionRepeat,
  setGoalActions,
  toggleGoalAction,
  upsertGoal,
} from "@/domain/goals";
import { completeAction, planToday, uncompleteAction, unplanToday, localDay } from "@/domain/daily";

export type View = "onboarding" | "tree" | "detail" | "plan" | "dashboard";

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
  | { type: "patchTree"; tree: LifeTree }
  | { type: "reset" };

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
    case "patchTree":
      return { ...state, tree: action.tree };
    case "reset":
      return { ...state, tree: null, activePathId: null, view: "onboarding", predicting: null };
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
  addLongTermGoal: (input: { area: Goal["area"]; title: string; why: string }) => void;
  addShortTermGoal: (input: { area: Goal["area"]; title: string; why: string; parentGoalId?: string | null }) => void;
  setGoalActionTexts: (goalId: string, texts: string[]) => void;
  toggleGoalActionById: (goalId: string, actionId: string) => void;
  completeGoalById: (goalId: string) => void;
  dropGoalById: (goalId: string) => void;
  markDueGoalsReviewed: () => void;
  openDashboard: () => void;
  openTree: () => void;
  planActionToday: (actionId: string) => void;
  unplanActionToday: (actionId: string) => void;
  toggleTodayAction: (actionId: string) => void;
  setActionRepeatById: (goalId: string, actionId: string, repeat: "daily" | "weekly" | undefined) => void;
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
      addLongTermGoal: ({ area, title, why }) => {
        if (predictingRef.current) return;
        const baseTree = treeRef.current;
        if (!baseTree || !title.trim()) return;
        const ts = new Date().toISOString();
        // 1) 在树上长出这条目标的分支（根分支，分叉年龄按选择推测，AI 可重定）
        const working = addPath(baseTree, title, generator, ts);
        if (working === baseTree) return;
        const newPath = working.paths[working.paths.length - 1];
        // 2) 建长期目标并关联这条分支
        const goal = createGoal(
          { area, horizon: "long", title, why, pathId: newPath.id },
          ts,
        );
        const withGoal = upsertGoal(working, goal);
        // 3) 推演这条分支（播动画、落到树上）。withGoal 含 goals，predictAndCommit 会保留。
        void predictAndCommit(withGoal, [newPath], "branch");
      },
      addShortTermGoal: ({ area, title, why, parentGoalId }) => {
        if (predictingRef.current) return;
        const baseTree = treeRef.current;
        if (!baseTree || !title.trim()) return;
        const goal = createGoal(
          { area, horizon: "short", title, why, parentGoalId: parentGoalId ?? null },
          new Date().toISOString(),
        );
        dispatch({ type: "patchTree", tree: upsertGoal(baseTree, goal) });
      },
      setGoalActionTexts: (goalId, texts) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const goal = (baseTree.goals ?? []).find((g) => g.id === goalId);
        if (!goal) return;
        dispatch({ type: "patchTree", tree: upsertGoal(baseTree, setGoalActions(goal, texts)) });
      },
      toggleGoalActionById: (goalId, actionId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const goal = (baseTree.goals ?? []).find((g) => g.id === goalId);
        if (!goal) return;
        dispatch({ type: "patchTree", tree: upsertGoal(baseTree, toggleGoalAction(goal, actionId)) });
      },
      completeGoalById: (goalId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: completeGoal(baseTree, goalId, new Date().toISOString()) });
      },
      dropGoalById: (goalId) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        dispatch({ type: "patchTree", tree: dropGoal(baseTree, goalId, new Date().toISOString()) });
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
        const e = (baseTree.activity ?? []).find((a) => a.date === today);
        const hit = (baseTree.goals ?? []).flatMap((g) => g.actions).find((a) => a.id === actionId);
        // 重复行动看"今天是否记过"；一次性看 done。
        const doneNow = hit?.repeat ? Boolean(e?.completedActionIds.includes(actionId)) : Boolean(hit?.done);
        const next = doneNow
          ? uncompleteAction(baseTree, actionId, today)
          : completeAction(baseTree, actionId, today);
        dispatch({ type: "patchTree", tree: next });
      },
      setActionRepeatById: (goalId, actionId, repeat) => {
        const baseTree = treeRef.current;
        if (!baseTree) return;
        const goal = (baseTree.goals ?? []).find((g) => g.id === goalId);
        if (!goal) return;
        dispatch({ type: "patchTree", tree: upsertGoal(baseTree, setActionRepeat(goal, actionId, repeat)) });
      },
    }),
    [
      state.view,
      state.tree,
      state.activePathId,
      state.hydrated,
      state.predicting,
      state.aiEnabled,
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
