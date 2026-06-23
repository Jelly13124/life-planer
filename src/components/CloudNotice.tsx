"use client";

import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { IconCloud, IconX } from "@/components/ui/icons";

// 云端加载失败、已回退本地时的一条克制提示（P5）。
// flag 关时 cloudNotice 恒 false → 渲染 null，无任何 UI。绝不白屏：它只是告知"暂用本地"。
export function CloudNotice() {
  const { cloudNotice, dismissCloudNotice } = useApp();
  const { t } = useT();
  if (!cloudNotice) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)]/95 px-4 py-2.5 text-xs text-[var(--fg-dim)] shadow-lg backdrop-blur animate-fade"
      style={{ animationDuration: "0.25s" }}
    >
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-[var(--fg-faint)]">
        <IconCloud className="h-4 w-4" />
      </span>
      <span className="leading-snug">{t("云端连接异常，已暂时改用本地存档（数据不会丢）。")}</span>
      <button
        type="button"
        onClick={dismissCloudNotice}
        aria-label={t("关闭")}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[var(--fg-faint)] transition hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
      >
        <IconX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
