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

import type { GoalArea, Goal, LifeTree, Profile, Task, Scenario, LifeArea, LifePath } from "@lifeplanner/core/types";
import {
  createTree,
  addPath,
  addScenarioVariant,
  removePath,
  choosePath as domainChoosePath,
  clearChosenPath as domainClearChosenPath,
} from "@lifeplanner/core/tree";
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
import { FREE_AI_OPS_PER_MONTH, aiOpsLeft, canUseAi, consumeAiOp } from "@lifeplanner/core/aiQuota";
import { isEnriched } from "@lifeplanner/core/pathEnriched";
import {
  localDay,
  addDays,
  todayItems,
  completeAction,
  uncompleteAction,
  planToday,
} from "@lifeplanner/core/daily";
import {
  currentStreakWithFreeze,
  freezesLeft as domainFreezesLeft,
  applyAutoFreeze,
} from "@lifeplanner/core/streak";
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

import { loadTree, saveTree, clearTree, backupTree } from "../lib/storage";
import { syncNotifications, syncDailyDigest } from "../lib/notifications";
import { writeWidgetSnapshot } from "../lib/widgetSnapshot";
import { initPurchases, MONETIZATION_ENABLED } from "../lib/purchases";
import {
  fetchGoalSuggestions,
  fetchGoalActions,
  hasBackend,
  enrichPath,
  applyEnrichToPath,
  type GoalSuggestion,
} from "../lib/api";
import { isCloudEnabled, getSupabase, getCloudStore, sendOtp, verifyOtp, signOut } from "../lib/supabase";
import { normalizeLoadedTree } from "@lifeplanner/core/repository/normalize";

// 时间注入（状态层，允许取当前时间——领域层才禁止）。
const nowISO = (): string => new Date().toISOString();
const todayStr = (): string => localDay(new Date());

// onboarding 收集的字段 = Profile 去掉派生的 areas/snapshot（由 deriveAreas/buildSnapshot 计算）。
export type ProfileInputs = Omit<Profile, "areas" | "snapshot">;

export interface TodayRow {
  goal: Goal | null;
  item: Task;
  kind: "task" | "habit";
  doneToday: boolean;
}

// 某天日历上的一行（已排一次性任务 / 当天到期习惯，两者都是 Task；习惯 = repeat 已设的 Task）。
export interface DayAction {
  goal: Goal | null;
  item: Task;
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
  streak: number; // 含补签卡桥接（见 @lifeplanner/core/streak）
  freezesLeft: number; // 本月剩余免费补签卡数
  nudge: { title: string; delta: number; id: number } | null;
  clearNudge: () => void;
  freezeNotice: string | null; // 自动补签提示（"补签卡帮你保住了 N 天连击"）——与 nudge 分开的独立轻提示通道
  clearFreezeNotice: () => void;
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
  addLongGoal: (area: GoalArea, title: string, why?: string, endDate?: string, pathId?: string | null) => void;
  setGoalDueDate: (goalId: string, endDate?: string) => void;
  addShortGoalToLong: (longId: string, title: string, endDate?: string) => void;
  addTaskToGoal: (goalId: string, text: string) => void;
  addHabitToGoal: (goalId: string, text: string, repeat: "daily" | "weekly") => void;
  addLooseTask: (text: string) => void;
  addTimelineTask: (text: string, date?: string, time?: string) => void;
  addScheduledTask: (opts: { text: string; goalId?: string | null; date?: string; time?: string; durationMin?: number }) => void;
  scheduleToDay: (taskId: string, date: string) => void;
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
  chosenPathId: string | null;
  choosePath: (pathId: string) => void;
  clearChosenPath: () => void;
  decomposePathIntoGoals: (pathId: string) => Promise<void>;
  decomposing: boolean;
  enriching: boolean;
  retryEnrich: (pathId: string) => void;
  onboard: (inputs: ProfileInputs, win?: { start: string; end: string }) => void;
  reset: () => void;
  setDailyDigest: (on: boolean) => void; // 每日摘要推送开关（undefined=默认开）
  // 后端（AI 建议；离线返回 []）
  suggestGoals: () => Promise<GoalSuggestion[]>;
  suggestTasksForGoal: (goalId: string) => Promise<void>;
  suggestingTasksGoalId: string | null;
  // AI 用量配额（免费 20 点/自然月；Pro 不限）——见 @lifeplanner/core/aiQuota
  aiQuotaLeft: number;
  isPro: boolean;
  setIsPro: (v: boolean) => void;
  paywallOpen: boolean;
  openPaywall: () => void;
  closePaywall: () => void;
  // 花费一个 AI 点：Pro 不扣；额度不足 → 打开 Paywall 并返回 false（调用方放弃本次 AI 调用）。
  spendAiOp: () => boolean;
  // 云同步（本地优先；登录可选）
  cloudEnabled: boolean;
  cloudUserId: string | null;
  syncState: "off" | "synced" | "error";
  lastSyncAt: string | null;
  sendLoginCode: (email: string) => Promise<string | null>;
  loginWithOtp: (email: string, token: string) => Promise<string | null>;
  logout: () => Promise<void>;
  retrySync: () => void;
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
  // 自动补签提示：与 nudge（"你的努力让…+X%"）文案不同，独立状态通道，避免误用/混淆。
  const [freezeNotice, setFreezeNotice] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false); // 人生树分支 AI 推演中
  const [decomposing, setDecomposing] = useState(false); // 把路拆成目标 AI 请求中
  const [suggestingTasksGoalId, setSuggestingTasksGoalId] = useState<string | null>(null); // 正在为哪个目标 AI 建议任务
  // 用 ref 保证持久化/动作读到的是最新树（避免闭包旧值）。在 effect 里同步，不在渲染期写 ref。
  const treeRef = useRef<LifeTree | null>(null);
  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);
  // 本地通知重排的去抖定时器（commit 高频，1.5s 合并）。
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── AI 用量配额 / Paywall（见 @lifeplanner/core/aiQuota；Task 4 会用 RevenueCat 驱动 setIsPro）──
  const [isPro, setIsPro] = useState(false);
  // ref 镜像 isPro：spendAiOp 的闭包（useCallback 依赖 [commit]）需要读到最新值。
  const isProRef = useRef(false);
  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const openPaywall = useCallback(() => setPaywallOpen(true), []);
  const closePaywall = useCallback(() => setPaywallOpen(false), []);

  // ── 云同步（本地优先；登录可选，见 mobile/src/lib/supabase.ts）──
  const [cloudUserId, setCloudUserId] = useState<string | null>(null); // null = 未登录
  const [syncState, setSyncState] = useState<"off" | "synced" | "error">("off");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  // ref 镜像 cloudUserId：commit() 的闭包（useCallback 依赖 []）需要读到最新登录态。
  const cloudUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    cloudUserIdRef.current = cloudUserId;
  }, [cloudUserId]);
  // 云端保存的去抖定时器（与本地 notifTimer 分开管理；登出时必须显式取消，
  // 否则可能在切换账号后仍以旧 userId 触发一次保存 —— RLS 会拒绝写入）。
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 取消任何待触发的云端保存（采用云端树前 / 登出 / 重置时都要调用，避免旧树在之后被误写回云端）。
  const cancelPendingCloudSave = useCallback(() => {
    if (cloudSaveTimer.current) {
      clearTimeout(cloudSaveTimer.current);
      cloudSaveTimer.current = null;
    }
  }, []);
  // 拉取云端树、与本地比较（updatedAt 更新者胜）、必要时覆盖本地（覆盖前先兜底备份）或把本地推上云。
  // 直接用会抛错的 CloudStore（而非会吞错的 SupabaseRepository）：
  // getTree 只有「行不存在」才返回 null，网络/RLS 失败一律 throw —— 这样才能区分
  // 「云端确实没有」和「拉取失败」，避免把失败误判成「云端为空」而把本地（可能更旧）推上去覆盖云端。
  // 采纳一棵云端树：先取消待触发的云端保存（防止旧本地树在采用后又被写回云端），重新自动
  // 补签（本地刚补的签可能被这棵新树顶掉；补签幂等，直接对新树再跑一次），只落盘不走 commit()
  // （避免立刻又把刚采用的树写回云端）。resolveCloud 的两处「采纳云端」分支共用此逻辑。
  const adoptCloudTree = useCallback(
    (cloudTree: LifeTree, day: string) => {
      cancelPendingCloudSave();
      const { tree: refrozen, frozen } = applyAutoFreeze(cloudTree, day);
      const next = frozen.length > 0 ? { ...refrozen, updatedAt: nowISO() } : cloudTree;
      setTree(next);
      treeRef.current = next;
      void saveTree(next);
      if (frozen.length > 0) {
        setFreezeNotice(`补签卡帮你保住了 ${currentStreakWithFreeze(next, day)} 天连击`);
      }
    },
    [cancelPendingCloudSave],
  );

  const resolveCloud = useCallback(async (uid: string) => {
    const store = getCloudStore();
    if (!store) return;
    let cloudTree: LifeTree | null = null;
    try {
      const raw = await store.getTree(uid); // 行不存在 → null；网络/RLS 失败 → throw
      cloudTree = raw == null ? null : normalizeLoadedTree(typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch {
      setSyncState("error"); // 拉取失败：绝不把本地推上去（可能盖掉更新的云端），等重试
      return;
    }
    const local = treeRef.current;
    try {
      if (cloudTree && local) {
        if (Date.parse(cloudTree.updatedAt) > Date.parse(local.updatedAt)) {
          // 云端更新 → 先兜底备份，防止数据丢失。
          await backupTree(local);
          // 备份期间（await）用户可能又改了树（commit() 落了新 tree）：此时绝不能用
          // 备份前捕获的旧 cloudTree 采用覆盖，否则会吞掉刚做的编辑。放弃本次采用，
          // 按失败处理——本地数据不动，下次 resolveCloud 再重新比较 updatedAt。
          if (treeRef.current !== local) {
            setSyncState("error");
            return;
          }
          // 确认没有并发编辑后才真正采用（bail 之后再取消定时器，否则备份期间用户新编辑
          // 排的定时器会被误取消，导致那次编辑再也不会被推上云——见 adoptCloudTree 内部）。
          adoptCloudTree(cloudTree, todayStr());
        } else {
          await store.putTree(uid, local); // 本地更新或打平 → 推上云
        }
      } else if (cloudTree) {
        // 本地为空、云端有 → 采用云端。同样防守并发编辑（local 在捕获前就已确定）。
        if (treeRef.current !== local) {
          setSyncState("error");
          return;
        }
        adoptCloudTree(cloudTree, todayStr());
      } else if (local) {
        await store.putTree(uid, local);
      }
      // 云端为空且本地也为空：无事可做。
      setSyncState("synced");
      setLastSyncAt(new Date().toISOString());
    } catch {
      setSyncState("error"); // 推送失败：本地数据不动，UI 给重试
    }
  }, [adoptCloudTree]);

  // 任一变更后持久化（仅在初始化完成后；避免用起始树覆盖刚读到的存档）。
  // 提到 boot effect 之前声明：boot effect 里自动补签命中时要 commit(frozenTree)，
  // React Compiler 的 immutability 检查不允许在效果里引用晚于它声明的 useCallback。
  const commit = useCallback(
    (next: LifeTree) => {
      setTree(next);
      treeRef.current = next;
      void saveTree(next);
      // 去抖重排本地通知 + 每日摘要（取消旧的 → 排未来几天已排时间的提醒；顺序执行——
      // syncNotifications 内部会 cancelAll 再排任务提醒，摘要用独立 identifier 单排，
      // 但仍需排在其后，避免被 cancelAll 连带清掉）。
      if (notifTimer.current) clearTimeout(notifTimer.current);
      notifTimer.current = setTimeout(() => {
        void (async () => {
          await syncNotifications(next, todayStr());
          await syncDailyDigest(next, todayStr());
          // iOS 主屏小组件快照（非 iOS / Expo Go / 旧构建里内部 no-op）。
          writeWidgetSnapshot(next, todayStr());
        })();
      }, 1500);
      // 去抖云端保存（仅登录时；未登录/未配置云同步 → getCloudStore 返回 null，早退）。
      const uid = cloudUserIdRef.current;
      if (uid) {
        if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
        cloudSaveTimer.current = setTimeout(() => {
          // 定时器触发时重新读 uid（而非闭包捕获的旧值）：800ms 内可能已登出/切号。
          const uidAtFire = cloudUserIdRef.current;
          const store = getCloudStore();
          if (!uidAtFire || !store) return;
          // store.putTree 会抛错（不像 SupabaseRepository.save 吞错）——失败真实反映到 syncState。
          store
            .putTree(uidAtFire, next)
            .then(() => {
              setSyncState("synced");
              setLastSyncAt(new Date().toISOString());
            })
            .catch(() => setSyncState("error"));
        }, 800);
      }
    },
    [],
  );

  // 启动：加载存档（可能为 null → 未引导，Gate 显示 onboarding）。不再自动生成默认树。
  useEffect(() => {
    let alive = true;
    // RevenueCat 初始化：读取/订阅 isPro 状态（fire-and-forget，失败静默，isPro 维持 false）。
    if (MONETIZATION_ENABLED) void initPurchases(setIsPro);
    // 订阅 auth 状态变化：一次性 getSession() 只覆盖「冷启动即刻」这一刻；
    // 若冷启动时离线导致 token 刷新失败，cloudUserId 会一直为 null，且没有恢复路径。
    // 订阅事件作为恢复路径——联网后 Supabase SDK 触发 TOKEN_REFRESHED/SIGNED_IN，这里接住并补 resolveCloud。
    const sb = getSupabase();
    const sub = sb?.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      if (event === "SIGNED_OUT") {
        setCloudUserId(null);
        setSyncState("off");
        return;
      }
      // INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED：会话恢复/建立 → 若与当前不同则接管并解决同步。
      if (uid && uid !== cloudUserIdRef.current) {
        setCloudUserId(uid);
        void resolveCloud(uid);
      }
    });
    (async () => {
      const loaded = await loadTree();
      if (!alive) return;
      setTree(loaded);
      treeRef.current = loaded; // 立即同步（下面 resolveCloud 要读最新本地树，不等 effect 那一轮）
      setReady(true);
      if (loaded) {
        // 通知重排 + 每日摘要顺序执行：syncNotifications 内部会 cancelAll 再排任务提醒，
        // 摘要用独立 identifier 单排，但仍需排在其后，避免被 cancelAll 连带清掉。
        void (async () => {
          await syncNotifications(loaded, todayStr());
          await syncDailyDigest(loaded, todayStr());
        })();
        // 开机就刷一次小组件快照（跨天后连击/今日任务数已变，即使用户不做任何编辑）。
        writeWidgetSnapshot(loaded, todayStr());
        // 自动补签：开机时先于任何用户交互桥接漏签的缺口天（见 packages/core/src/streak.ts）。
        const day = todayStr();
        const { tree: frozenTree, frozen } = applyAutoFreeze(loaded, day);
        if (frozen.length > 0) {
          commit({ ...frozenTree, updatedAt: nowISO() });
          setFreezeNotice(`补签卡帮你保住了 ${currentStreakWithFreeze(frozenTree, day)} 天连击`);
        }
      }
      // 本地会话检测：只读 AsyncStorage 缓存的 session，绝不发网络请求
      // （getCurrentUserId() 会发请求验证，开机不能用它）。这是即时路径；上面的订阅是恢复路径。
      const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
      if (!alive) return;
      const uid = data.session?.user?.id ?? null;
      if (uid) {
        setCloudUserId(uid);
        void resolveCloud(uid);
      }
    })();
    return () => {
      alive = false;
      sub?.data.subscription.unsubscribe();
    };
  }, [resolveCloud, commit]);

  // 回到前台时刷新「今天」（对应 web 的 visibilitychange/focus）+ 自动补签：
  // 每次回到前台都先于任何用户交互尝试桥接漏签的缺口天（跨天/跨会话都能补上）。
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      const day = todayStr();
      setToday(day);
      const cur = treeRef.current;
      if (!cur) return;
      const { tree: frozenTree, frozen } = applyAutoFreeze(cur, day);
      if (frozen.length > 0) {
        commit({ ...frozenTree, updatedAt: nowISO() });
        setFreezeNotice(`补签卡帮你保住了 ${currentStreakWithFreeze(frozenTree, day)} 天连击`);
      }
      // 刷新每日摘要通知内容（任务数/连击天数可能已因跨天而变化，即使用户还没做任何编辑）。
      const cur2 = treeRef.current;
      if (cur2) void syncDailyDigest(cur2, todayStr());
    });
    return () => sub.remove();
  }, [commit]);

  const bumpNudge = useCallback((title: string, delta: number) => {
    nudgeId.current += 1;
    setNudge({ title, delta, id: nudgeId.current });
  }, []);
  const clearNudge = useCallback(() => setNudge(null), []);
  const clearFreezeNotice = useCallback(() => setFreezeNotice(null), []);

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
    (area: GoalArea, title: string, why?: string, endDate?: string, pathId?: string | null) => {
      const cur = treeRef.current;
      if (!cur || !title.trim()) return;
      const { tree: next } = domainAddLongGoal(cur, { area, title: title.trim(), why, endDate, pathId: pathId ?? null }, nowISO());
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

  // 把任务排到某一天（不带时间）：目标页新建的未排任务 → 月视图点某天，先分配日期。
  const scheduleToDay = useCallback(
    (taskId: string, date: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(setActionScheduledDate(cur, taskId, date));
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

  // 花费一个 AI 点：Pro 不扣；额度不足 → 打开 Paywall 并返回 false（调用方直接放弃本次 AI 调用）。
  // 商品化总开关关闭时直接放行（不扣点、不弹 Paywall）——见 purchases.ts 的 MONETIZATION_ENABLED。
  const spendAiOp = useCallback((): boolean => {
    if (!MONETIZATION_ENABLED) return true;
    const cur = treeRef.current;
    if (!cur) return false;
    const t = todayStr();
    if (isProRef.current) return true;
    if (!canUseAi(cur, t, false)) {
      setPaywallOpen(true);
      return false;
    }
    commit({ ...consumeAiOp(cur, t), updatedAt: nowISO() });
    return true;
  }, [commit]);

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

  // 切换情景（乐观/中性/保守）：没有该走向变体时本地即时生成一条，
  // 再和 addChoiceBranch 一样异步 AI 推演覆盖 summary/可行度/节点。
  const addScenario = useCallback(
    (basePathId: string, scenario: Scenario) => {
      const cur = treeRef.current;
      if (!cur) return;
      // 计费点：非 likely 情景变体的 AI 推演算 1 点（仅在有后端时才需要，离线本地生成免费）；
      // 在 addScenarioVariant 之前拦截，额度不足时不生成未推演的变体（避免半成品分支）。
      if (hasBackend() && !spendAiOp()) return;
      // spendAiOp 内部已同步 commit 扣费后的树（更新 treeRef）；必须重新读取，
      // 否则下面基于陈旧 cur 构建的 next 一提交，会把刚才扣的额度覆盖回去（扣费变免费）。
      const cur2 = treeRef.current;
      if (!cur2) return;
      const next = addScenarioVariant(cur2, basePathId, scenario, localGenerator, nowISO());
      if (next === cur2) return; // 变体已存在：不重复推演（已扣的 1 点算防御性成本，正常路径由调用方 variantFor 先挡）
      const variant = next.paths[next.paths.length - 1];
      commit(next);
      if (hasBackend()) {
        setEnriching(true);
        void enrichPath(next, variant)
          .then((result) => {
            if (!result) return;
            const t = treeRef.current;
            if (!t) return;
            commit({
              ...t,
              paths: t.paths.map((p) => (p.id === variant.id ? applyEnrichToPath(p, result) : p)),
            });
          })
          .catch(() => {})
          .finally(() => setEnriching(false));
      }
    },
    [commit, spendAiOp],
  );

  const choosePath = useCallback(
    (pathId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(domainChoosePath(cur, pathId, nowISO()));
    },
    [commit],
  );

  const clearChosenPath = useCallback(() => {
    const cur = treeRef.current;
    if (!cur) return;
    commit(domainClearChosenPath(cur, nowISO()));
  }, [commit]);

  // 把一条路拆成 2-3 个挂路长期目标：纯 AI（复用 /api/goals，把这条路作为 choice 上下文）。
  // 离线 / 请求失败 / 返回空 → 不生成任何目标（不再本地兜底虚构内容），
  // 「让 AI 拆一版目标」按钮保持可见，用户可稍后重试。
  const decomposePathIntoGoals = useCallback(
    async (pathId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      const path = cur.paths.find((p) => p.id === pathId);
      if (!path) return; // 「维持现状」也可拆计划（它也是一条可选路线）
      if (!hasBackend()) return;
      if (!spendAiOp()) return; // 计费点：拆目标每次调用算 1 点

      let drafts: { area: LifeArea; title: string; why: string }[] = [];
      setDecomposing(true);
      try {
        const ai = await fetchGoalSuggestions(cur.profile.snapshot || "", [path.choiceLabel], "zh");
        drafts = ai.slice(0, 3).map((g) => ({ area: g.area, title: g.title, why: g.why }));
      } catch {
        drafts = [];
      } finally {
        setDecomposing(false);
      }
      if (drafts.length === 0) return;

      // 按标题去重：同标题会算出同一个 goal id（id = hash(title|now)），去掉重复避免撞 id。
      const seenTitles = new Set<string>();
      drafts = drafts.filter((d) => {
        const key = d.title.trim();
        if (!key || seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      });

      for (const d of drafts) {
        const t = treeRef.current;
        if (!t) break;
        const { tree: next } = domainAddLongGoal(t, { area: d.area, title: d.title, why: d.why, pathId }, nowISO());
        commit(next);
      }
    },
    [commit, spendAiOp],
  );

  // 重试某条路的 AI 推演（用于「重试推演」按钮）：离线时静默不做（按钮仍保留，供用户联网后再点）；
  // 成功则把结果叠加进路径并标记 enriched；失败保留原样，不删已持久化的内容。
  // 计费：「维持现状」或「首次推演一条 likely 基线分支」免费（onboarding/addChoiceBranch 的延续）；
  // 已推演过、或重试的是非 likely 情景变体 → 算 1 点。
  const retryEnrich = useCallback(
    (pathId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      const path = cur.paths.find((p) => p.id === pathId);
      if (!path) return;
      if (!hasBackend()) return;
      const counted = path.kind !== "status-quo" && (isEnriched(path) || path.scenario !== "likely");
      if (counted && !spendAiOp()) return;
      setEnriching(true);
      void enrichPath(cur, path)
        .then((result) => {
          if (!result) return;
          const t = treeRef.current;
          if (!t) return;
          commit({
            ...t,
            paths: t.paths.map((p) => (p.id === path.id ? applyEnrichToPath(p, result) : p)),
          });
        })
        .catch(() => {
          // 网络 / AI 失败：保留原路径，不删已持久化内容，用户可再次点「重试推演」。
        })
        .finally(() => setEnriching(false));
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
      // AI 先推演「维持现状」基线，推演完再进首页（引导页上放推演动画）。
      const sq = tree.paths.find((p) => p.kind === "status-quo");
      if (sq && hasBackend()) {
        void saveTree(tree); // 先落盘防止推演期间被杀丢数据；但先不 setTree（不进首页）
        setEnriching(true);
        void enrichPath(tree, sq)
          .then((result) => {
            const done = result
              ? { ...tree, paths: tree.paths.map((p) => (p.id === sq.id ? applyEnrichToPath(p, result) : p)) }
              : tree;
            commit(done); // setTree → 现在才进首页
          })
          .catch(() => commit(tree))
          .finally(() => setEnriching(false));
      } else {
        commit(tree); // 无后端：直接进首页，无需等待
      }
    },
    [commit],
  );

  const reset = useCallback(() => {
    // 先取消任何待触发的云端保存 —— 否则编辑→800ms 内 reset 会让旧树在清空云端行之后
    // 又被去抖定时器写回去，复活刚清掉的云端数据。
    cancelPendingCloudSave();
    const uid = cloudUserIdRef.current;
    const store = getCloudStore();
    if (uid && store) void store.deleteTree(uid).catch(() => {}); // fire-and-forget：清云端那一行（吞错，不阻塞本地重置）
    void (async () => {
      await clearTree();
      setTree(null);
      treeRef.current = null;
    })();
  }, [cancelPendingCloudSave]);

  // 每日摘要推送开关（undefined=默认开）。
  const setDailyDigest = useCallback(
    (on: boolean) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit({ ...cur, dailyDigest: on, updatedAt: nowISO() });
    },
    [commit],
  );

  // ── 云同步动作（登录可跳过；见 mobile/src/lib/supabase.ts 的 OTP 流）──
  const sendLoginCode = useCallback(async (email: string): Promise<string | null> => {
    return sendOtp(email);
  }, []);

  const loginWithOtp = useCallback(
    async (email: string, token: string): Promise<string | null> => {
      const err = await verifyOtp(email, token);
      if (err) return err;
      const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
      const uid = data.session?.user?.id ?? null;
      if (uid) {
        setCloudUserId(uid);
        void resolveCloud(uid);
      }
      return null;
    },
    [resolveCloud],
  );

  const logout = useCallback(async (): Promise<void> => {
    // 先取消任何待触发的云端保存 —— 否则登出后可能仍以旧 userId 触发一次保存，
    // RLS 会拒绝写入（虽然现在会真实抛错/置 syncState error，但登出后这次写入本就不该发生）。
    cancelPendingCloudSave();
    await signOut();
    setCloudUserId(null);
    setSyncState("off");
  }, [cancelPendingCloudSave]);

  const retrySync = useCallback(() => {
    if (cloudUserId) void resolveCloud(cloudUserId);
  }, [cloudUserId, resolveCloud]);

  const shiftViewDate = useCallback((delta: number) => {
    setViewDate((d) => addDays(d, delta));
  }, []);
  const goToday = useCallback(() => setViewDate(todayStr()), []);

  const suggestGoals = useCallback(async (): Promise<GoalSuggestion[]> => {
    const cur = treeRef.current;
    if (!cur) return [];
    if (!spendAiOp()) return []; // 计费点：AI 建议目标每次调用算 1 点
    const choices = Array.from(
      new Set(cur.paths.filter((p) => p.kind === "choice").map((p) => p.choiceLabel)),
    );
    try {
      return await fetchGoalSuggestions(cur.profile.snapshot || "", choices, "zh");
    } catch {
      // 网络 / AI 失败：返回空列表，调用方显示「暂无建议」，绝不抛到 UI。
      return [];
    }
  }, [spendAiOp]);

  // 给某个目标 AI 建议几条任务并直接加入其任务清单（对应 web 的「AI 建议任务」）。
  // 离线 / 请求失败 / 返回空 → 不生成任何任务（不虚构本地兜底），按钮保持可点，用户可重试。
  const suggestTasksForGoal = useCallback(
    async (goalId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      const goal = longGoals(cur).concat(standaloneShortGoals(cur)).find((g) => g.id === goalId);
      if (!goal) return;
      if (!hasBackend()) return;
      if (!spendAiOp()) return; // 计费点：AI 建议任务每次调用算 1 点

      setSuggestingTasksGoalId(goalId);
      try {
        const texts = await fetchGoalActions({
          goalTitle: goal.title,
          why: goal.why ?? "",
          area: goal.area,
          profileSummary: cur.profile.snapshot || "",
        });
        for (const text of texts.slice(0, 5)) {
          const t = treeRef.current;
          if (!t) break;
          const { tree: next } = domainAddTask(t, goalId, text, nowISO());
          commit(next);
        }
      } catch {
        // 网络 / AI 失败：不生成任何任务，按钮保持可用，用户可重试。
      } finally {
        setSuggestingTasksGoalId(null);
      }
    },
    [commit, spendAiOp],
  );

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
      streak: t ? currentStreakWithFreeze(t, today) : 0,
      freezesLeft: t ? domainFreezesLeft(t, today) : 0,
      nudge,
      clearNudge,
      freezeNotice,
      clearFreezeNotice,
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
      scheduleToDay,
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
      chosenPathId: t?.chosenPathId ?? null,
      choosePath,
      clearChosenPath,
      decomposePathIntoGoals,
      decomposing,
      enriching,
      retryEnrich,
      onboard,
      reset,
      setDailyDigest,
      suggestGoals,
      suggestTasksForGoal,
      suggestingTasksGoalId,
      aiQuotaLeft: t ? aiOpsLeft(t, today) : FREE_AI_OPS_PER_MONTH,
      isPro,
      setIsPro,
      paywallOpen,
      openPaywall,
      closePaywall,
      spendAiOp,
      cloudEnabled: isCloudEnabled(),
      cloudUserId,
      syncState,
      lastSyncAt,
      sendLoginCode,
      loginWithOtp,
      logout,
      retrySync,
    };
  }, [
    tree,
    ready,
    today,
    nudge,
    clearNudge,
    freezeNotice,
    clearFreezeNotice,
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
    scheduleToDay,
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
    choosePath,
    clearChosenPath,
    decomposePathIntoGoals,
    decomposing,
    enriching,
    retryEnrich,
    onboard,
    reset,
    setDailyDigest,
    suggestGoals,
    suggestTasksForGoal,
    suggestingTasksGoalId,
    isPro,
    paywallOpen,
    openPaywall,
    closePaywall,
    spendAiOp,
    cloudUserId,
    syncState,
    lastSyncAt,
    sendLoginCode,
    loginWithOtp,
    logout,
    retrySync,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
