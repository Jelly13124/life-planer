"use client";

import { useEffect, useMemo, useState } from "react";
import type { LifeTree } from "@/domain/types";
import { useT } from "@/prefs/PreferencesContext";
import { dueReminders } from "@/domain/reminders";
import {
  enableNotifications,
  getNotificationsEnabled,
  notificationPermission,
  notificationsSupported,
} from "@/lib/notifications";
import { IconClock, IconBell } from "./ui/icons";

// 启动常量 now（ISO）：与首页其它 boot-const 一致；可见性变化时刷新本组件的 now。
const _bootNow = new Date().toISOString();

// 应用内「今日提醒」条（P3，始终可见、最可靠的一环）。
//  - 显示：今天 {n} 件 / 逾期 {n} / 即将开始：{text}（无任何到期项时整条隐藏）。
//  - 点击：今天/即将开始 → 跳到当天日视图；逾期 → 跳到「即将到来」时间线。
//  - 「开启提醒」：请求 Notification 权限并记下偏好；开着应用时由 ReminderScheduler 到点提醒。
export function TodayReminders({
  tree,
  onOpenDay,
  onOpenUpcoming,
}: {
  tree: LifeTree;
  onOpenDay: () => void;
  onOpenUpcoming: () => void;
}) {
  const { t } = useT();
  const [now, setNow] = useState(_bootNow);

  // 可见性变化（切回标签页）时刷新 now，让「即将开始」窗口跟上钟表。
  useEffect(() => {
    const update = () => setNow(new Date().toISOString());
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const due = useMemo(() => dueReminders(tree, now), [tree, now]);

  // 通知按钮状态：unsupported | default（可开）| granted | denied。
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [enabledPref, setEnabledPref] = useState(false);
  // 延到下一帧再读浏览器态（避免在 effect 内同步 setState + 保证 SSR/首帧一致）。
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPerm(notificationsSupported() ? notificationPermission() : "unsupported");
      setEnabledPref(getNotificationsEnabled());
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  async function onEnable() {
    const p = await enableNotifications();
    setPerm(p);
    setEnabledPref(p === "granted" && getNotificationsEnabled());
  }

  const todayCount = due.today.length;
  const overdueCount = due.overdue.length;
  const soon = due.upcomingSoon[0] ?? null;

  // 整条隐藏：没有今天/逾期/即将开始 任意一项。
  if (todayCount === 0 && overdueCount === 0 && !soon) return null;

  // 仅 default 态显示「开启提醒」（denied 单独提示，granted 显示已开启，unsupported 隐藏）。
  const showEnable = perm === "default";
  const enabledOn = perm === "granted" && enabledPref;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 text-sm">
      <span className="inline-flex items-center gap-1.5 font-medium text-[var(--fg)]">
        <IconBell className="h-4 w-4 text-[var(--accent)]" />
        {t("今日提醒")}
      </span>

      {todayCount > 0 && (
        <button
          type="button"
          onClick={onOpenDay}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
        >
          {t("今天 {n} 件", { n: todayCount })}
        </button>
      )}

      {overdueCount > 0 && (
        <button
          type="button"
          onClick={onOpenUpcoming}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-amber)]/40 bg-[var(--c-amber)]/10 px-3 py-1 text-xs text-[var(--c-amber)] transition hover:bg-[var(--c-amber)]/20"
        >
          {t("逾期 {n}", { n: overdueCount })}
        </button>
      )}

      {soon && (
        <button
          type="button"
          onClick={onOpenDay}
          title={soon.text}
          className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
        >
          <IconClock className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">
            {t("即将开始：{text}", { text: soon.startTime ? `${soon.startTime} ${soon.text}` : soon.text })}
          </span>
        </button>
      )}

      <span className="ml-auto">
        {showEnable ? (
          <button
            type="button"
            onClick={onEnable}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--fg-faint)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
          >
            <IconBell className="h-3.5 w-3.5" />
            {t("开启提醒")}
          </button>
        ) : enabledOn ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--c-emerald)]">
            <IconBell className="h-3.5 w-3.5" />
            {t("提醒已开启")}
          </span>
        ) : perm === "denied" ? (
          <span className="text-xs text-[var(--fg-faint)]">{t("通知权限被拒绝")}</span>
        ) : null}
      </span>
    </div>
  );
}
