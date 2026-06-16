"use client";

import { usePrefs } from "@/prefs/PreferencesContext";

// 右上角常驻：中英语言切换（即时生效并持久化）。
export function PrefControls() {
  const { locale, toggleLocale, t } = usePrefs();

  return (
    <div className="fixed right-4 top-4 z-[70] flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleLocale}
        aria-label={t("切换语言")}
        title={t("切换语言")}
        className="flex h-8 min-w-8 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg-1)]/80 px-2.5 text-xs font-semibold text-[var(--fg-dim)] backdrop-blur transition hover:border-[var(--accent)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      >
        {locale === "zh" ? "EN" : "中"}
      </button>
    </div>
  );
}
