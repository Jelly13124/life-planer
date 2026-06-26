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

import type { GoalArea, Goal, LifeTree, Profile, Task, Habit, Scenario } from "@lifeplanner/core/types";
import { createTree, addPath, addScenarioVariant, removePath } from "@lifeplanner/core/tree";
import { localGenerator } from "@lifeplanner/core/generator/localGenerator";
import {
  longGoals,
  shortGoalsOf,
  standaloneShortGoals,
  addLongGoal as domainAddLongGoal,
  addShortGoal as domainAddShortGoal,
  addTask as domainAddTask,
  addHabit as domainAddHabit,
  addLooseTask as domainAddLooseTask,
  removeItem as domainRemoveItem,
  removeGoalById as domainRemoveGoalById,
  updateGoalById as domainUpdateGoalById,
  findTask,
} from "@lifeplanner/core/goalTree";
import { goalProgress, completeGoal as domainCompleteGoal } from "@lifeplanner/core/goals";
import { deriveAreas, buildSnapshot } from "@lifeplanner/core/profile";
import {
  localDay,
  addDays,
  todayItems,
  completeAction,
  uncompleteAction,
  planToday,
  currentStreak,
} from "@lifeplanner/core/daily";
import {
  actionsOnDay,
  unscheduledActions,
  setActionScheduledDate,
  type DayActionKind,
} from "@lifeplanner/core/calendar";
import {
  dayWindow,
  setDayWindow,
  setActionTime,
  arrangeDay,
  DEFAULT_DURATION_MIN,
} from "@lifeplanner/core/schedule";

import { loadTree, saveTree, clearTree } from "../lib/storage";
import { syncNotifications } from "../lib/notifications";
import {
  fetchGoalSuggestions,
  hasBackend,
  enrichPath,
  applyEnrichToPath,
  type GoalSuggestion,
} from "../lib/api";

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

// 某天日历上的一行（已排一次性任务 / 当天到期习惯）。
export interface DayAction {
  goal: Goal | null;
  item: Task | Habit;
  kind: DayActionKind;
  done: boolean;
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
  nudge: { title: string; delta: number; id: number } | null;
  clearNudge: () => void;
  // 安排（日视图）
  viewDate: string;
  isViewToday: boolean;
  dayWin: { start: string; end: string };
  dayActions: DayAction[]; // viewDate 当天的已排/到期行动
  unscheduled: { goal: Goal | null; item: Task }[]; // 未排托盘
  actionsOn: (date: string) => DayAction[]; // 任意天（月历密度用）
  setViewDate: (date: string) => void;
  shiftViewDate: (delta: number) => void;
  goToday: () => void;
  // 写入（复用领域核心）
  addLongGoal: (area: GoalArea, title: string, why?: string, endDate?: string) => void;
  setGoalDueDate: (goalId: string, endDate?: string) => void;
  addShortGoalToLong: (longId: string, title: string, endDate?: string) => void;
  addTaskToGoal: (goalId: string, text: string) => void;
  addHabitToGoal: (goalId: string, text: string, repeat: "daily" | "weekly") => void;
  addLooseTask: (text: string) => void;
  addTimelineTask: (text: string, date?: string, time?: string) => void;
  addScheduledTask: (opts: { text: string; goalId?: string | null; date?: string; time?: string; durationMin?: number }) => void;
  scheduleAtTime: (taskId: string, date: string, time: string, durationMin?: number) => void;
  setActionTimeById: (id: string, time: string, durationMin?: number) => void;
  unschedule: (taskId: string) => void;
  arrangeToday: (date: string) => void;
  toggleDoneOn: (id: string, date: string, done: boolean) => void;
  toggleTaskDone: (taskId: string) => void;
  toggleTodayDone: (itemId: string, doneToday: boolean) => void;
  planTaskToday: (taskId: string) => void;
  removeItem: (id: string) => void;
  removeGoal: (goalId: string) => void;
  completeGoal: (goalId: string) => void;
  addChoiceBranch: (label: string) => void;
  addChoiceBranchAt: (parentPathId: string, forkAge: number, label: string) => void;
  addScenario: (basePathId: string, scenario: Scenario) => void;
  removeBranch: (pathId: string) => void;
  enriching: boolean;
  onboard: (inputs: ProfileInputs, win?: { start: string; end: string }) => void;
  reset: () => void;
  // 后端（AI 建议；离线返回 []）
  suggestGoals: () => Promise<GoalSuggestion[]>;
}

const Ctx = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tree, setTree] = useState<LifeTree | null>(null);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState<string>(() => todayStr());
  const [viewDate, setViewDate] = useState<string>(() => todayStr());
  // 完成动力提示：完成某目标的任务时弹"你的努力让『X』+Y%"。id 单调递增以重触发自动消失。
  const [nudge, setNudge] = useState<{ title: string; delta: number; id: number } | null>(null);
  const nudgeId = useRef(0);
  const [enriching, setEnriching] = useState(false); // 人生树分支 AI 推演中
  // 用 ref 保证持久化/动作读到的是最新树（避免闭包旧值）。在 effect 里同步，不在渲染期写 ref。
  const treeRef = useRef<LifeTree | null>(null);
  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);
  // 本地通知重排的去抖定时器（commit 高频，1.5s 合并）。
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 启动：加载存档（可能为 null → 未引导，Gate 显示 onboarding）。不再自动生成默认树。
  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = await loadTree();
      if (!alive) return;
      setTree(loaded);
      setReady(true);
      if (loaded) void syncNotifications(loaded, todayStr());
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
  const commit = useCallback((next: LifeTree) => {
    setTree(next);
    treeRef.current = next;
    void saveTree(next);
    // 去抖重排本地通知（取消旧的 → 排未来几天已排时间的提醒）。
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => void syncNotifications(next, todayStr()), 1500);
  }, []);

  const bumpNudge = useCallback((title: string, delta: number) => {
    nudgeId.current += 1;
    setNudge({ title, delta, id: nudgeId.current });
  }, []);
  const clearNudge = useCallback(() => setNudge(null), []);

  // 完成/取消完成核心：完成属于某目标的任务时，算出该目标进度增量 → 触发动力提示。
  const applyComplete = useCallback(
    (cur: LifeTree, id: string, date: string, done: boolean): LifeTree => {
      const next = done ? uncompleteAction(cur, id, date) : completeAction(cur, id, date);
      if (!done) {
        const hit = findTask(cur, id);
        if (hit?.goal) {
          const before = goalProgress(cur, hit.goal);
          const after = goalProgress(next, hit.goal);
          if (after > before) bumpNudge(hit.goal.title, after - before);
        }
      }
      return next;
    },
    [bumpNudge],
  );

  // ───────── 写入动作（全部复用领域核心；时间在此注入） ─────────
  const addLongGoal = useCallback(
    (area: GoalArea, title: string, why?: string, endDate?: string) => {
      const cur = treeRef.current;
      if (!cur || !title.trim()) return;
      const { tree: next } = domainAddLongGoal(cur, { area, title: title.trim(), why, endDate }, nowISO());
      commit(next);
    },
    [commit],
  );

  // 设/改某目标的到期日（endDate=undefined 清除）。
  const setGoalDueDate = useCallback(
    (goalId: string, endDate?: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(domainUpdateGoalById(cur, goalId, { endDate }));
    },
    [commit],
  );

  const addShortGoalToLong = useCallback(
    (longId: string, title: string, endDate?: string) => {
      const cur = treeRef.current;
      if (!cur || !title.trim()) return;
      const parent = longGoals(cur).find((g) => g.id === longId);
      const { tree: next } = domainAddShortGoal(
        cur,
        longId,
        { area: parent ? parent.area : "other", title: title.trim(), endDate },
        nowISO(),
      );
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

  // 安排屏加任务：建散任务，可选直接排到某天某时刻（不传则进未排托盘）。
  const addTimelineTask = useCallback(
    (text: string, date?: string, time?: string) => {
      const cur = treeRef.current;
      if (!cur || !text.trim()) return;
      const { tree: t1, id } = domainAddLooseTask(cur, text.trim(), nowISO());
      let t = t1;
      if (date) t = setActionScheduledDate(t, id, date);
      if (time) t = setActionTime(t, id, time, DEFAULT_DURATION_MIN);
      commit(t);
    },
    [commit],
  );

  // 加任务（可绑目标 + 可直接给日期/时刻）：一次提交完成建+排+定时。
  const addScheduledTask = useCallback(
    (opts: { text: string; goalId?: string | null; date?: string; time?: string; durationMin?: number }) => {
      const cur = treeRef.current;
      const text = opts.text.trim();
      if (!cur || !text) return;
      let t: LifeTree;
      let id: string;
      if (opts.goalId) {
        const r = domainAddTask(cur, opts.goalId, text, nowISO());
        t = r.tree;
        id = r.id;
      } else {
        const r = domainAddLooseTask(cur, text, nowISO());
        t = r.tree;
        id = r.id;
      }
      if (opts.date) t = setActionScheduledDate(t, id, opts.date);
      if (opts.time) t = setActionTime(t, id, opts.time, opts.durationMin ?? DEFAULT_DURATION_MIN);
      commit(t);
    },
    [commit],
  );

  // 把任务排到某天某时刻（托盘→时间轴 / 拖拽落点）。
  const scheduleAtTime = useCallback(
    (taskId: string, date: string, time: string, durationMin?: number) => {
      const cur = treeRef.current;
      if (!cur) return;
      let t = setActionScheduledDate(cur, taskId, date);
      t = setActionTime(t, taskId, time, durationMin ?? DEFAULT_DURATION_MIN);
      commit(t);
    },
    [commit],
  );

  const setActionTimeById = useCallback(
    (id: string, time: string, durationMin?: number) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(setActionTime(cur, id, time, durationMin));
    },
    [commit],
  );

  // 移回未排：清掉排期日期 + 时间。
  const unschedule = useCallback(
    (taskId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      let t = setActionScheduledDate(cur, taskId, null);
      t = setActionTime(t, taskId, null);
      commit(t);
    },
    [commit],
  );

  // AI 排今天：未排托盘任务全部排到 date，再按作息窗顺排时间。
  const arrangeToday = useCallback(
    (date: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      let t = cur;
      for (const { item } of unscheduledActions(cur)) {
        t = setActionScheduledDate(t, item.id, date);
      }
      const win = dayWindow(t);
      const dayTasks = actionsOnDay(t, date).filter((a) => a.kind === "scheduled");
      const arranged = arrangeDay(
        dayTasks.map((a) => ({ id: a.item.id, durationMin: a.item.durationMin })),
        { start: win.start, end: win.end },
      );
      for (const r of arranged) t = setActionTime(t, r.id, r.startTime, r.durationMin);
      commit(t);
    },
    [commit],
  );

  // 在某天完成/取消完成一个行动（时间轴块勾选）。
  const toggleDoneOn = useCallback(
    (id: string, date: string, done: boolean) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(applyComplete(cur, id, date, done));
    },
    [commit, applyComplete],
  );

  // 目标屏勾选任务：在"今天"完成/取消完成（同时记进度 + 喂连续天数 + 动力提示）。
  const toggleTaskDone = useCallback(
    (taskId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      const hit = findTask(cur, taskId);
      const done = hit?.task.done ?? false;
      commit(applyComplete(cur, taskId, today, done));
    },
    [commit, today, applyComplete],
  );

  // 今日屏勾选：按当前 doneToday 翻转。
  const toggleTodayDone = useCallback(
    (itemId: string, doneToday: boolean) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(applyComplete(cur, itemId, today, doneToday));
    },
    [commit, today, applyComplete],
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

  // 加一条人生选择分支：本地生成器立即出线；若后端可达 → 异步 AI 推演覆盖 summary/可行度/节点。
  const addChoiceBranch = useCallback(
    (label: string) => {
      const cur = treeRef.current;
      if (!cur || !label.trim()) return;
      const next = addPath(cur, label.trim(), localGenerator, nowISO());
      const newPath = next.paths[next.paths.length - 1];
      commit(next);
      if (hasBackend()) {
        setEnriching(true);
        void enrichPath(next, newPath)
          .then((result) => {
            if (!result) return;
            const t = treeRef.current;
            if (!t) return;
            commit({
              ...t,
              paths: t.paths.map((p) =>
                p.id === newPath.id ? applyEnrichToPath(p, result) : p,
              ),
            });
          })
          .catch(() => {
            // 网络 / AI 失败：保留本地即时推演结果，不打扰用户、不崩。
          })
          .finally(() => setEnriching(false));
      }
    },
    [commit],
  );

  // 在某条路的某个节点处加岔路（点树上的节点）：从该节点年龄分叉。
  const addChoiceBranchAt = useCallback(
    (parentPathId: string, forkAge: number, label: string) => {
      const cur = treeRef.current;
      if (!cur || !label.trim()) return;
      const next = addPath(cur, label.trim(), localGenerator, nowISO(), {
        parentId: parentPathId,
        forkAge,
      });
      const np = next.paths[next.paths.length - 1];
      commit(next);
      if (hasBackend()) {
        setEnriching(true);
        void enrichPath(next, np)
          .then((result) => {
            if (!result) return;
            const t = treeRef.current;
            if (!t) return;
            commit({
              ...t,
              paths: t.paths.map((p) => (p.id === np.id ? applyEnrichToPath(p, result) : p)),
            });
          })
          .catch(() => {})
          .finally(() => setEnriching(false));
      }
    },
    [commit],
  );

  // 切换情景（乐观/中性/保守）：没有该走向变体时本地即时生成一条。
  const addScenario = useCallback(
    (basePathId: string, scenario: Scenario) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(addScenarioVariant(cur, basePathId, scenario, localGenerator, nowISO()));
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

  // 引导完成：由结构化输入派生 areas/snapshot，生成人生树；可带起床/睡觉作息窗。
  const onboard = useCallback(
    (inputs: ProfileInputs, win?: { start: string; end: string }) => {
      const profile: Profile = {
        ...inputs,
        areas: deriveAreas(inputs),
        snapshot: buildSnapshot(inputs),
      };
      let tree = createTree(profile, localGenerator, nowISO());
      // 作息窗兜底：睡觉必须晚于起床（"HH:MM" 零填充 → 字符串比较即时间比较）。
      // 退化输入（睡<=醒）忽略，保留默认窗，避免时间轴/排程算出负区间。
      if (win && win.end > win.start) tree = setDayWindow(tree, win.start, win.end);
      commit(tree);
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

  const shiftViewDate = useCallback((delta: number) => {
    setViewDate((d) => addDays(d, delta));
  }, []);
  const goToday = useCallback(() => setViewDate(todayStr()), []);

  const suggestGoals = useCallback(async (): Promise<GoalSuggestion[]> => {
    const cur = treeRef.current;
    if (!cur) return [];
    const choices = Array.from(
      new Set(cur.paths.filter((p) => p.kind === "choice").map((p) => p.choiceLabel)),
    );
    try {
      return await fetchGoalSuggestions(cur.profile.snapshot || "", choices, "zh");
    } catch {
      // 网络 / AI 失败：返回空列表，调用方显示「暂无建议」，绝不抛到 UI。
      return [];
    }
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
      nudge,
      clearNudge,
      viewDate,
      isViewToday: viewDate === today,
      dayWin: t ? dayWindow(t) : { start: "07:00", end: "23:00" },
      dayActions: t ? actionsOnDay(t, viewDate) : [],
      unscheduled: t ? unscheduledActions(t) : [],
      actionsOn: (date: string) => (t ? actionsOnDay(t, date) : []),
      setViewDate,
      shiftViewDate,
      goToday,
      addLongGoal,
      setGoalDueDate,
      addShortGoalToLong,
      addTaskToGoal,
      addHabitToGoal,
      addLooseTask,
      addTimelineTask,
      addScheduledTask,
      scheduleAtTime,
      setActionTimeById,
      unschedule,
      arrangeToday,
      toggleDoneOn,
      toggleTaskDone,
      toggleTodayDone,
      planTaskToday,
      removeItem,
      removeGoal,
      completeGoal,
      addChoiceBranch,
      addChoiceBranchAt,
      addScenario,
      removeBranch,
      enriching,
      onboard,
      reset,
      suggestGoals,
    };
  }, [
    tree,
    ready,
    today,
    nudge,
    clearNudge,
    viewDate,
    shiftViewDate,
    goToday,
    addLongGoal,
    setGoalDueDate,
    addShortGoalToLong,
    addTaskToGoal,
    addHabitToGoal,
    addLooseTask,
    addTimelineTask,
    addScheduledTask,
    scheduleAtTime,
    setActionTimeById,
    unschedule,
    arrangeToday,
    toggleDoneOn,
    toggleTaskDone,
    toggleTodayDone,
    planTaskToday,
    removeItem,
    removeGoal,
    completeGoal,
    addChoiceBranch,
    addChoiceBranchAt,
    addScenario,
    removeBranch,
    enriching,
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
