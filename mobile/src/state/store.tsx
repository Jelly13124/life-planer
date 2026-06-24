// 移动端状态中枢（对应 web 的 src/state/AppContext.tsx 的精简版）。
//
// 职责：加载/初始化树 → 持有 tree → 每次变更持久化到 AsyncStorage。
// 所有目标/任务/习惯的变更都复用「共享纯领域核心」(@lifeplanner/core) 的纯函数；
// 这里是「副作用/状态层」，负责注入时间（now/today）—— 领域层自身不取当前时间。
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import type { GoalArea, Goal, LifeTree, Profile, Task, Habit } from "@lifeplanner/core/types";
import { createTree, addPath, removePath } from "@lifeplanner/core/tree";
import { localGenerator } from "@lifeplanner/core/generator/localGenerator";
import {
  longGoals,
  shortGoalsOf,
  standaloneShortGoals,
  addLongGoal as domainAddLongGoal,
  addTask as domainAddTask,
  addHabit as domainAddHabit,
  addLooseTask as domainAddLooseTask,
  removeItem as domainRemoveItem,
  removeGoalById as domainRemoveGoalById,
  findTask,
} from "@lifeplanner/core/goalTree";
import { goalProgress, completeGoal as domainCompleteGoal } from "@lifeplanner/core/goals";
import { deriveAreas, buildSnapshot } from "@lifeplanner/core/profile";
import {
  localDay,
  todayItems,
  completeAction,
  uncompleteAction,
  planToday,
  currentStreak,
} from "@lifeplanner/core/daily";

import { loadTree, saveTree, clearTree } from "../lib/storage";
import { fetchGoalSuggestions, type GoalSuggestion } from "../lib/api";

// 时间注入（状态层，允许取当前时间——领域层才禁止）。
const nowISO = (): string => new Date().toISOString();
const todayStr = (): string => localDay(new Date());

// onboarding 收集的字段 = Profile 去掉派生的 areas/snapshot（由 deriveAreas/buildSnapshot 计算）。
export type ProfileInputs = Omit<Profile, "areas" | "snapshot">;

export interface TodayRow {
  goal: Goal | null;
  item: Task | Habit;
  kind: "task" | "habit";
  doneToday: boolean;
}

interface AppValue {
  ready: boolean;
  tree: LifeTree | null;
  today: string;
  // 读取（派生）
  longGoals: Goal[];
  standaloneShortGoals: Goal[];
  shortGoalsOf: (longId: string) => Goal[];
  progressOf: (goal: Goal) => number;
  todayRows: TodayRow[];
  streak: number;
  // 写入（复用领域核心）
  addLongGoal: (area: GoalArea, title: string, why?: string) => void;
  addTaskToGoal: (goalId: string, text: string) => void;
  addHabitToGoal: (goalId: string, text: string, repeat: "daily" | "weekly") => void;
  addLooseTask: (text: string) => void;
  toggleTaskDone: (taskId: string) => void;
  toggleTodayDone: (itemId: string, doneToday: boolean) => void;
  planTaskToday: (taskId: string) => void;
  removeItem: (id: string) => void;
  removeGoal: (goalId: string) => void;
  completeGoal: (goalId: string) => void;
  addChoiceBranch: (label: string) => void;
  removeBranch: (pathId: string) => void;
  onboard: (inputs: ProfileInputs) => void;
  reset: () => void;
  // 后端（AI 建议；离线返回 []）
  suggestGoals: () => Promise<GoalSuggestion[]>;
}

const Ctx = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tree, setTree] = useState<LifeTree | null>(null);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState<string>(() => todayStr());
  // 用 ref 保证持久化/动作读到的是最新树（避免闭包旧值）。在 effect 里同步，不在渲染期写 ref。
  const treeRef = useRef<LifeTree | null>(null);
  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  // 启动：加载存档（可能为 null → 未引导，Gate 显示 onboarding）。不再自动生成默认树。
  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = await loadTree();
      if (!alive) return;
      setTree(loaded);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 回到前台时刷新「今天」（对应 web 的 visibilitychange/focus）。
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setToday(todayStr());
    });
    return () => sub.remove();
  }, []);

  // 任一变更后持久化（仅在初始化完成后；避免用起始树覆盖刚读到的存档）。
  const commit = useCallback(
    (next: LifeTree) => {
      setTree(next);
      treeRef.current = next;
      void saveTree(next);
    },
    [],
  );

  // ───────── 写入动作（全部复用领域核心；时间在此注入） ─────────
  const addLongGoal = useCallback(
    (area: GoalArea, title: string, why?: string) => {
      const cur = treeRef.current;
      if (!cur || !title.trim()) return;
      const { tree: next } = domainAddLongGoal(cur, { area, title: title.trim(), why }, nowISO());
      commit(next);
    },
    [commit],
  );

  const addTaskToGoal = useCallback(
    (goalId: string, text: string) => {
      const cur = treeRef.current;
      if (!cur || !text.trim()) return;
      const { tree: next } = domainAddTask(cur, goalId, text.trim(), nowISO());
      commit(next);
    },
    [commit],
  );

  const addHabitToGoal = useCallback(
    (goalId: string, text: string, repeat: "daily" | "weekly") => {
      const cur = treeRef.current;
      if (!cur || !text.trim()) return;
      const { tree: next } = domainAddHabit(cur, goalId, text.trim(), repeat, undefined, nowISO());
      commit(next);
    },
    [commit],
  );

  const addLooseTask = useCallback(
    (text: string) => {
      const cur = treeRef.current;
      if (!cur || !text.trim()) return;
      const { tree: next } = domainAddLooseTask(cur, text.trim(), nowISO());
      commit(next);
    },
    [commit],
  );

  // 目标屏勾选任务：在"今天"完成/取消完成（同时记进度 + 喂连续天数）。
  const toggleTaskDone = useCallback(
    (taskId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      const hit = findTask(cur, taskId);
      const done = hit?.task.done ?? false;
      const next = done
        ? uncompleteAction(cur, taskId, today)
        : completeAction(cur, taskId, today);
      commit(next);
    },
    [commit, today],
  );

  // 今日屏勾选：按当前 doneToday 翻转。
  const toggleTodayDone = useCallback(
    (itemId: string, doneToday: boolean) => {
      const cur = treeRef.current;
      if (!cur) return;
      const next = doneToday
        ? uncompleteAction(cur, itemId, today)
        : completeAction(cur, itemId, today);
      commit(next);
    },
    [commit, today],
  );

  const planTaskToday = useCallback(
    (taskId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(planToday(cur, taskId, today));
    },
    [commit, today],
  );

  const removeItem = useCallback(
    (id: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(domainRemoveItem(cur, id));
    },
    [commit],
  );

  const removeGoal = useCallback(
    (goalId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(domainRemoveGoalById(cur, goalId, nowISO()));
    },
    [commit],
  );

  const completeGoal = useCallback(
    (goalId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(domainCompleteGoal(cur, goalId, nowISO()));
    },
    [commit],
  );

  // 加一条人生选择分支（离线：本地生成器，立即长出彩色曲线；AI 推演待后续接后端）。
  const addChoiceBranch = useCallback(
    (label: string) => {
      const cur = treeRef.current;
      if (!cur || !label.trim()) return;
      commit(addPath(cur, label.trim(), localGenerator, nowISO()));
    },
    [commit],
  );

  // 删除一条分支（级联删其后代；维持现状不可删，由领域层保证）。
  const removeBranch = useCallback(
    (pathId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(removePath(cur, pathId, nowISO()));
    },
    [commit],
  );

  // 引导完成：由结构化输入派生 areas/snapshot，生成人生树并落盘。
  const onboard = useCallback(
    (inputs: ProfileInputs) => {
      const profile: Profile = {
        ...inputs,
        areas: deriveAreas(inputs),
        snapshot: buildSnapshot(inputs),
      };
      commit(createTree(profile, localGenerator, nowISO()));
    },
    [commit],
  );

  const reset = useCallback(() => {
    void (async () => {
      await clearTree();
      setTree(null);
      treeRef.current = null;
    })();
  }, []);

  const suggestGoals = useCallback(async (): Promise<GoalSuggestion[]> => {
    const cur = treeRef.current;
    if (!cur) return [];
    const choices = Array.from(
      new Set(cur.paths.filter((p) => p.kind === "choice").map((p) => p.choiceLabel)),
    );
    return fetchGoalSuggestions(cur.profile.snapshot || "", choices, "zh");
  }, []);

  const value = useMemo<AppValue>(() => {
    const t = tree;
    return {
      ready,
      tree: t,
      today,
      longGoals: t ? longGoals(t) : [],
      standaloneShortGoals: t ? standaloneShortGoals(t) : [],
      shortGoalsOf: (longId: string) => (t ? shortGoalsOf(t, longId) : []),
      progressOf: (goal: Goal) => (t ? goalProgress(t, goal) : 0),
      todayRows: t ? todayItems(t, today) : [],
      streak: t ? currentStreak(t, today) : 0,
      addLongGoal,
      addTaskToGoal,
      addHabitToGoal,
      addLooseTask,
      toggleTaskDone,
      toggleTodayDone,
      planTaskToday,
      removeItem,
      removeGoal,
      completeGoal,
      addChoiceBranch,
      removeBranch,
      onboard,
      reset,
      suggestGoals,
    };
  }, [
    tree,
    ready,
    today,
    addLongGoal,
    addTaskToGoal,
    addHabitToGoal,
    addLooseTask,
    toggleTaskDone,
    toggleTodayDone,
    planTaskToday,
    removeItem,
    removeGoal,
    completeGoal,
    addChoiceBranch,
    removeBranch,
    onboard,
    reset,
    suggestGoals,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
