"use client";

import { useT } from "@/prefs/PreferencesContext";

// 新区块的统一"建设中"占位面板：克制、on-brand，下一步会被真实内容替换。
// 用一条尚未画完的虚线曲线呼应"人生树正在生长"的母题，配合区块强调色。
export function SectionPlaceholder({
  eyebrow,
  icon,
  accent,
  title,
}: {
  eyebrow: string;
  icon: string;
  accent: string; // 该区块的强调色（var(--c-*)）
  title: string; // 中文原文，t() 包裹
}) {
  const { t } = useT();
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8 sm:px-8">
      <header className="animate-fade">
        <div className="text-xs uppercase tracking-[3px] text-[var(--fg-faint)]">{eyebrow}</div>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t(title)}</h1>
      </header>

      <div className="mt-8 flex flex-1 items-center justify-center">
        <div
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--bg-1)]/60 px-8 py-14 text-center animate-scale-in"
        >
          {/* 背景里一条还没画完的曲线，暗示"正在生长" */}
          <svg
            viewBox="0 0 400 160"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full opacity-30"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M0 150 C120 150 150 60 260 50 C330 44 360 30 400 26"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="3 7"
            />
          </svg>

          <div
            className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accent} 45%, transparent)`,
            }}
          >
            <span aria-hidden="true">{icon}</span>
          </div>

          <div className="relative mt-5 text-base font-semibold text-[var(--fg)]">{t(title)}</div>
          <p className="relative mt-1.5 text-sm text-[var(--fg-dim)]">{t("这一块马上就好")}</p>

          <div
            className="relative mx-auto mt-5 h-1 w-24 overflow-hidden rounded-full bg-black/[0.08]"
            aria-hidden="true"
          >
            <div
              className="h-full w-1/3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
