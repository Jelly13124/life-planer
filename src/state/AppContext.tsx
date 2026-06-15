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
import type { LifePath, LifeTree, Profile } from "@/domain/types";
import type { PathGenerator } from "@/domain/generator/types";
import { localGenerator } from "@/domain/generator/localGenerator";
import type { TreeRepository } from "@/domain/repository/types";
import { LocalStorageRepository } from "@/domain/repository/localStorageRepo";
import { addPath, createTree, removePath } from "@/domain/tree";
import {
  applyEnrichment,
  fetchEnrichEnabled,
  fetchEnrichment,
} from "@/lib/enrichClient";

export type View = "onboarding" | "tree" | "detail";

interface State {
  view: View;
  tree: LifeTree | null;
  activePathId: string | null;
  hydrated: boolean;
  enrichingIds: string[]; // 正在被 AI 润色的路径 id
  aiEnabled: boolean; // 后端是否接入了真实大模型
}

type Action =
  | { type: "hydrate"; tree: LifeTree | null }
  | { type: "setTree"; tree: LifeTree }
  | { type: "mergeEnrichment"; pathId: string; result: import("@/lib/enrichClient").EnrichResult }
  | { type: "enrichStart"; ids: string[] }
  | { type: "enrichEnd"; id: string }
  | { type: "setAiEnabled"; enabled: boolean }
  | { type: "openPath"; id: string }
  | { type: "backToTree" }
  | { type: "reset" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        hydrated: true,
        tree: action.tree,
        view: action.tree ? "tree" : "onboarding",
      };
    case "setTree":
      return { ...state, tree: action.tree, view: "tree" };
    case "mergeEnrichment": {
      if (!state.tree) return state;
      const { profile, horizonYears } = state.tree;
      const paths = state.tree.paths.map((p) =>
        p.id === action.pathId
          ? applyEnrichment(p, action.result, profile.age, horizonYears)
          : p,
      );
      return { ...state, tree: { ...state.tree, paths } };
    }
    case "enrichStart":
      return { ...state, enrichingIds: [...new Set([...state.enrichingIds, ...action.ids])] };
    case "enrichEnd":
      return { ...state, enrichingIds: state.enrichingIds.filter((x) => x !== action.id) };
    case "setAiEnabled":
      return { ...state, aiEnabled: action.enabled };
    case "openPath":
      return { ...state, activePathId: action.id, view: "detail" };
    case "backToTree":
      return { ...state, activePathId: null, view: "tree" };
    case "reset":
      return { ...state, tree: null, activePathId: null, view: "onboarding", enrichingIds: [] };
    default:
      return state;
  }
}

interface AppApi {
  view: View;
  tree: LifeTree | null;
  activePathId: string | null;
  hydrated: boolean;
  enrichingIds: string[];
  aiEnabled: boolean;
  completeOnboarding: (profile: Profile) => void;
  addBranch: (label: string) => void;
  removeBranch: (id: string) => void;
  openPath: (id: string) => void;
  backToTree: () => void;
  reset: () => void;
}

const AppContext = createContext<AppApi | null>(null);

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
    enrichingIds: [],
    aiEnabled: false,
  });

  const repoRef = useRef<TreeRepository | null>(repository ?? null);
  const repo = useCallback((): TreeRepository => {
    if (!repoRef.current) repoRef.current = new LocalStorageRepository();
    return repoRef.current;
  }, []);

  // 最新 tree 的引用，供异步润色读取
  const treeRef = useRef<LifeTree | null>(null);
  useEffect(() => {
    treeRef.current = state.tree;
  }, [state.tree]);

  // 挂载：读取本地数据 + 探测 AI 是否接入
  useEffect(() => {
    dispatch({ type: "hydrate", tree: repo().load() });
    fetchEnrichEnabled().then((enabled) => dispatch({ type: "setAiEnabled", enabled }));
  }, [repo]);

  // 持久化：tree 变化即写入本地（含 AI 润色后的合并结果）
  useEffect(() => {
    if (state.hydrated && state.tree) repo().save(state.tree);
  }, [state.tree, state.hydrated, repo]);

  const now = () => new Date().toISOString();

  // 对若干路径异步请求 AI 润色，结果回来即合并（不阻塞 UI）
  const runEnrichment = useCallback((tree: LifeTree, paths: LifePath[]) => {
    if (paths.length === 0) return;
    dispatch({ type: "enrichStart", ids: paths.map((p) => p.id) });
    for (const path of paths) {
      fetchEnrichment(tree, path)
        .then((result) => {
          if (result) dispatch({ type: "mergeEnrichment", pathId: path.id, result });
        })
        .finally(() => dispatch({ type: "enrichEnd", id: path.id }));
    }
  }, []);

  const api = useMemo<AppApi>(
    () => ({
      view: state.view,
      tree: state.tree,
      activePathId: state.activePathId,
      hydrated: state.hydrated,
      enrichingIds: state.enrichingIds,
      aiEnabled: state.aiEnabled,
      completeOnboarding: (profile) => {
        const tree = createTree(profile, generator, now());
        dispatch({ type: "setTree", tree });
        runEnrichment(tree, tree.paths);
      },
      addBranch: (label) => {
        const base = treeRef.current;
        if (!base) return;
        const before = new Set(base.paths.map((p) => p.id));
        const tree = addPath(base, label, generator, now());
        dispatch({ type: "setTree", tree });
        const added = tree.paths.filter((p) => !before.has(p.id));
        runEnrichment(tree, added);
      },
      removeBranch: (id) => {
        const base = treeRef.current;
        if (!base) return;
        dispatch({ type: "setTree", tree: removePath(base, id, now()) });
      },
      openPath: (id) => dispatch({ type: "openPath", id }),
      backToTree: () => dispatch({ type: "backToTree" }),
      reset: () => {
        repo().clear();
        dispatch({ type: "reset" });
      },
    }),
    [
      state.view,
      state.tree,
      state.activePathId,
      state.hydrated,
      state.enrichingIds,
      state.aiEnabled,
      generator,
      repo,
      runEnrichment,
    ],
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
