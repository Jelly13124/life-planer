// 本地定时通知。
// ⚠️ expo-notifications 在 Expo Go(SDK 53+) 一被加载就抛错（远程推送已从 Expo Go 移除）。
// 所以这里在 Expo Go 里整体 no-op（绝不 import expo-notifications，避免崩溃）；
// 只有 dev build / 正式包（TestFlight）里才真正请求权限 + 调度本地通知。
// "排哪些/几点"用核心 calendar.actionsOnDay；这里是副作用层，可取当前时间（new Date）。
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { LifeTree } from "@lifeplanner/core/types";
import { actionsOnDay } from "@lifeplanner/core/calendar";
import { addDays, todayItems } from "@lifeplanner/core/daily";
import { dayWindow } from "@lifeplanner/core/schedule";
import { currentStreakWithFreeze } from "@lifeplanner/core/streak";

// Expo Go 检测：storeClient / appOwnership==="expo" 即 Expo Go；dev build/standalone 才用通知。
const IS_EXPO_GO =
  Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient";

export function notificationsAvailable(): boolean {
  return !IS_EXPO_GO;
}

let handlerSet = false;
// 惰性加载 expo-notifications：Expo Go 里返回 null（绝不触碰该模块）。
async function getNotif(): Promise<typeof import("expo-notifications") | null> {
  if (IS_EXPO_GO) return null;
  try {
    const N = await import("expo-notifications");
    if (!handlerSet) {
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      handlerSet = true;
    }
    return N;
  } catch {
    return null;
  }
}

// 申请权限 + Android 通知渠道。Expo Go / 失败 → false。
export async function ensureNotifPermission(): Promise<boolean> {
  const N = await getNotif();
  if (!N) return false;
  try {
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("default", {
        name: "提醒",
        importance: N.AndroidImportance.DEFAULT,
      });
    }
    const { status } = await N.getPermissionsAsync();
    if (status === "granted") return true;
    const req = await N.requestPermissionsAsync();
    return req.status === "granted";
  } catch {
    return false;
  }
}

// 本地日 + HH:MM → 本地 Date（UI 层，允许 new Date）。
function parseLocal(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

// 重排未来 daysAhead 天内、已排时间且未完成的提醒。Expo Go / 失败静默 no-op。
export async function syncNotifications(
  tree: LifeTree,
  today: string,
  daysAhead = 7,
): Promise<void> {
  const N = await getNotif();
  if (!N) return;
  try {
    const granted = await ensureNotifPermission();
    if (!granted) return;
    await N.cancelAllScheduledNotificationsAsync();
    const nowMs = Date.now();
    for (let i = 0; i < daysAhead; i++) {
      const date = addDays(today, i);
      for (const a of actionsOnDay(tree, date)) {
        const st = a.item.startTime;
        if (!st || a.done) continue;
        const when = parseLocal(date, st);
        if (when.getTime() <= nowMs + 60_000) continue; // 只排 1 分钟后的未来
        await N.scheduleNotificationAsync({
          content: {
            title: `该做：${a.item.text}`,
            body: a.goal ? a.goal.title : "Life Planner",
          },
          trigger: {
            type: N.SchedulableTriggerInputTypes.DATE,
            date: when,
          },
        });
      }
    }
  } catch {
    // 通知失败不影响应用主流程
  }
}

const DAILY_DIGEST_ID = "daily-digest";

// 每日摘要推送：每天固定时刻一条常驻提醒（今日任务数 + 连击天数），独立于按任务时间点的提醒。
// tree.dailyDigest === false → 只取消、不再排；否则先取消旧的再排新的（同 identifier，
// 保证任何时候至多一条）。时刻 = 清醒时段起点 +2 小时，夹在 [8, 11] 点之间。
// Expo Go / 未授权 / 失败 → 静默 no-op，不影响应用主流程。
export async function syncDailyDigest(tree: LifeTree, today: string): Promise<void> {
  const N = await getNotif();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(DAILY_DIGEST_ID);
  } catch {
    // 可能压根没排过，忽略
  }
  if (tree.dailyDigest === false) return;
  try {
    const granted = await ensureNotifPermission();
    if (!granted) return;
    const startHour = Number(dayWindow(tree).start.slice(0, 2));
    const hour = Math.min(11, Math.max(8, (Number.isFinite(startHour) ? startHour : 7) + 2));
    const count = todayItems(tree, today).length;
    const streak = currentStreakWithFreeze(tree, today);
    const body =
      count > 0 ? `今天 ${count} 个任务在等你 · 连击 ${streak} 天` : "给未来的自己留 10 分钟";
    await N.scheduleNotificationAsync({
      identifier: DAILY_DIGEST_ID,
      content: { title: "人生树", body },
      trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour, minute: 0 },
    });
  } catch {
    // 通知失败不影响应用主流程
  }
}
