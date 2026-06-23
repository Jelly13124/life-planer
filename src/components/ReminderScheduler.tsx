"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { dueReminders } from "@/domain/reminders";
import {
  fireNotification,
  getNotificationsEnabled,
  notificationPermission,
} from "@/lib/notifications";

// 应用开着时的轻量提醒调度器（P3）：渲染 null，纯副作用。
//  - 每 ~45s 醒一次（间隔内才读 new Date()，模块作用域不取时间 → 与领域纯函数一致）。
//  - 权限 granted 且偏好开启时：当天 timed 项到点（[start, start+10min] 窗口内）发一条；
//    并每天发一次「今天有 N 件」汇总。
//  - 去重：fired id 记在 ref（含 summary 的特殊 id），并按当天日期持久化到 localStorage，
//    刷新/重开页面同一天不重复发；跨天自动清空。
const TICK_MS = 45_000;
const FIRE_WINDOW_MIN = 10; // 到点后 10 分钟内仍会补发（错过 tick 也不漏）
const FIRED_KEY = "lp.remindersFired"; // { date, ids: string[] }

function loadFired(today: string): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { date?: string; ids?: string[] };
      if (parsed && parsed.date === today && Array.isArray(parsed.ids)) {
        return new Set(parsed.ids);
      }
    }
  } catch {
    /* 解析失败按空处理 */
  }
  return new Set();
}

function saveFired(today: string, ids: Set<string>): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify({ date: today, ids: [...ids] }));
  } catch {
    /* 忽略写入失败 */
  }
}

function minutesOfTime(t: string | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function ReminderScheduler() {
  const { tree } = useApp();
  const { t } = useT();

  // 用 ref 持有最新 tree / t，避免把它们放进 effect 依赖而反复重建 interval。
  const treeRef = useRef(tree);
  const tRef = useRef(t);
  const firedRef = useRef<Set<string>>(new Set());
  const firedDayRef = useRef<string>("");

  // 在 effect（非 render）里同步最新值到 ref。
  useEffect(() => {
    treeRef.current = tree;
    tRef.current = t;
  }, [tree, t]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function tick() {
      const tr = treeRef.current;
      if (!tr) return;
      // 仅在权限授予 + 偏好开启时工作；否则静默（不发任何通知）。
      if (notificationPermission() !== "granted" || !getNotificationsEnabled()) return;

      const now = new Date(); // 在 tick 内读时间（非模块作用域）
      const nowIso = now.toISOString();
      const due = dueReminders(tr, nowIso);
      const today = due.today[0]?.date
        ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const nowMin = now.getHours() * 60 + now.getMinutes();

      // 跨天：重置去重集合（按当天 localStorage 载入，刷新不重复）。
      if (firedDayRef.current !== today) {
        firedDayRef.current = today;
        firedRef.current = loadFired(today);
      }
      const fired = firedRef.current;
      let changed = false;

      // 1) 每天一次的「今天有 N 件」汇总（有项才发）。
      const summaryId = `summary:${today}`;
      const count = due.today.length;
      if (count > 0 && !fired.has(summaryId)) {
        fireNotification(tRef.current("今日提醒"), tRef.current("今天有 {n} 件待办", { n: count }));
        fired.add(summaryId);
        changed = true;
      }

      // 2) 当天 timed 项到点：start <= now <= start+window，且当天未发过。
      for (const item of due.today) {
        const m = minutesOfTime(item.startTime);
        if (m == null) continue;
        const fireId = `item:${today}:${item.id}`;
        if (m <= nowMin && nowMin <= m + FIRE_WINDOW_MIN && !fired.has(fireId)) {
          fireNotification(item.text, item.goalTitle ?? undefined);
          fired.add(fireId);
          changed = true;
        }
      }

      if (changed) saveFired(today, fired);
    }

    // 立即跑一次（捕捉刚打开页面时已到点的项），随后定时。
    tick();
    timer = setInterval(tick, TICK_MS);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  return null;
}
