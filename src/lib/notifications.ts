// 客户端通知工具（P3）：本地偏好 + 浏览器 Notification 权限。
// 不依赖 Service Worker —— 用页内 Notification API，应用开着时即可提醒（dev 也能用）。
// 真后台推送（关着也能收）需要 VAPID + 后端，留给早上。

const PREF_KEY = "lp.notificationsEnabled";

// 浏览器是否支持 Notification（SSR / 老环境下安全返回 false）。
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

// 当前权限态（不支持时按 "denied" 处理）。
export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : "denied";
}

// 用户的「开启提醒」偏好（localStorage）。默认关，需用户显式开。
export function getNotificationsEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setNotificationsEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    /* 忽略写入失败 */
  }
}

// 请求权限并在授予时记下偏好。返回最终权限态。
export async function enableNotifications(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  let perm = Notification.permission;
  if (perm === "default") {
    try {
      perm = await Notification.requestPermission();
    } catch {
      perm = Notification.permission;
    }
  }
  setNotificationsEnabled(perm === "granted");
  return perm;
}

// 发一条页内通知（已 granted 才发；失败静默，绝不抛）。
export function fireNotification(title: string, body?: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    new Notification(title, body ? { body } : undefined);
  } catch {
    /* 某些浏览器要求 SW 才能 new Notification —— 失败则静默忽略 */
  }
}
