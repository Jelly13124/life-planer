"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { LifeTree, Profile } from "@/domain/types";
import type { PathGenerator } from "@/domain/generator/types";
import { localGenerator } from "@/domain/generator/localGenerator";
import type { TreeRepository } from "@/domain/repository/types";
import { LocalStorageRepository } from "@/domain/repository/localStorageRepo";
import { addPath, createTree, removePath } from "@/domain/tree";

export type View = "onboarding" | "tree" | "detail";

interface State {
  view: View;
  tree: LifeTree | null;
  activePathId: string | null;
  hydrated: boolean; // 是否已从持久层读取过
}

type Action =
  | { type: "hydrate"; tree: LifeTree | null }
  | { type: "setTree"; tree: LifeTree }
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
    case "openPath":
      return { ...state, activePathId: action.id, view: "detail" };
    case "backToTree":
      return { ...state, activePathId: null, view: "tree" };
    case "reset":
      return { ...state, tree: null, activePathId: null, view: "onboarding" };
    default:
      return state;
  }
}

interface AppApi {
  view: View;
  tree: LifeTree | null;
  activePathId: string | null;
  hydrated: boolean;
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
  });

  // 持久层只在客户端创建（localStorage）
  const repoRef = useRef<TreeRepository | null>(repository ?? null);
  function repo(): TreeRepository {
    if (!repoRef.current) repoRef.current = new LocalStorageRepository();
    return repoRef.current;
  }

  // 挂载时读取
  useEffect(() => {
    dispatch({ type: "hydrate", tree: repo().load() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = () => new Date().toISOString();

  const persist = (tree: LifeTree) => {
    repo().save(tree);
    dispatch({ type: "setTree", tree });
  };

  const api = useMemo<AppApi>(
    () => ({
      view: state.view,
      tree: state.tree,
      activePathId: state.activePathId,
      hydrated: state.hydrated,
      completeOnboarding: (profile) => {
        persist(createTree(profile, generator, now()));
      },
      addBranch: (label) => {
        if (!state.tree) return;
        persist(addPath(state.tree, label, generator, now()));
      },
      removeBranch: (id) => {
        if (!state.tree) return;
        persist(removePath(state.tree, id, now()));
      },
      openPath: (id) => dispatch({ type: "openPath", id }),
      backToTree: () => dispatch({ type: "backToTree" }),
      reset: () => {
        repo().clear();
        dispatch({ type: "reset" });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.view, state.tree, state.activePathId, state.hydrated, generator],
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
