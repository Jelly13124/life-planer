"use client";

// 路由级错误边界：页面任意子树抛错时，给一张克制的恢复卡，而不是白屏。
// 关键：本组件不依赖任何 React context（错误可能正来自 context 自身），
// 文案双语静态（默认中文 + 英文副行），语言从 localStorage 读取，绝不二次崩溃。
// 用户数据存在浏览器本地，错误不会丢数据——这里如实说明并给「重试 / 刷新」两个出口。

import { useEffect } from "react";

function readLocale(): "zh" | "en" {
  try {
    const l = localStorage.getItem("lp.locale");
    if (l === "en" || l === "zh") return l;
  } catch {
    /* localStorage 不可用时回退中文 */
  }
  return "zh";
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 把错误抛到控制台，便于线上排查（digest 是 Next 给的服务端关联 id）。
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  const zh = readLocale() === "zh";
  const title = zh ? "出了点小问题" : "Something went wrong";
  const body = zh
    ? "这一步出了个意外。你的数据都还安全地存在这台设备上——重试或刷新通常就能恢复。"
    : "An unexpected error occurred. Your data is safe on this device — retrying or refreshing usually fixes it.";
  const retry = zh ? "重试" : "Try again";
  const reload = zh ? "刷新页面" : "Reload";

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="lp-card w-full max-w-sm p-6 text-center animate-fade">
        {/* 品牌小标记：现状直线 + 一条分叉曲线（与人生树同源） */}
        <svg viewBox="0 0 28 28" className="mx-auto mb-4 h-8 w-8" fill="none" aria-hidden="true">
          <path d="M3 22 H25" stroke="var(--fg-faint)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 3" />
          <path d="M7 22 C12 22 13 8 24 6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="7" cy="22" r="2.4" fill="var(--accent)" />
        </svg>
        <h1 className="text-base font-semibold text-[var(--fg)]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fg-dim)]">{body}</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-[image:var(--grad-accent)] px-5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.08),0_6px_16px_-6px_rgba(194,65,12,0.45)] transition hover:brightness-[1.05] active:brightness-95"
          >
            {retry}
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[var(--line)] px-5 text-sm text-[var(--fg-dim)] transition hover:border-black/20 hover:text-[var(--fg)]"
          >
            {reload}
          </button>
        </div>
      </div>
    </div>
  );
}
