"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { IconTree } from "@/components/ui/icons";

// 即时反馈（Part 1）：完成一个推动"挂在某条路上的目标"的行动、且该路的有效可行度（整 5）
// 真的涨了时，AppContext 会置 feasibilityToast。本组件消费它：弹一张 Apple-white 小卡，
// 显示「『{pathLabel}』这条路更近了」+ before% → after% 的数字过渡（轻 count-up + 颜色 pop）。
// ~4s 自动消失，可点掉。尊重 prefers-reduced-motion（不做 count-up，直接显示终值）。

function usePrefersReducedMotion(): boolean {
  // 客户端首帧读取，SSR 安全；变化时同步更新。
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

// after 值的轻 count-up：从 before 爬到 after（按 5 步进，与可行度整 5 口径一致）。
// reduced-motion / 无需上爬时直接显示 after。每次 toast（toastKey）变化时通过 key 重挂本 hook
// 重置初值——effect 只异步推进（setInterval 回调里 setState），不在 effect 体里同步 setState。
function useCountUp(before: number, after: number, reduced: boolean): number {
  const animate = !reduced && after > before;
  const [val, setVal] = useState(animate ? before : after);
  useEffect(() => {
    if (!animate) return;
    // 每 ~120ms 加 5，直到 after；clear 于卸载/换 toast。
    const id = window.setInterval(() => {
      setVal((v) => {
        const nv = v + 5;
        if (nv >= after) {
          window.clearInterval(id);
          return after;
        }
        return nv;
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [animate, after]);
  return val;
}

// 卡片本体：用 key=toast 内容重挂，让 count-up 初值随每个新 toast 干净重置。
function ToastCard({
  pathLabel,
  before,
  after,
  reduced,
  onDismiss,
}: {
  pathLabel: string;
  before: number;
  after: number;
  reduced: boolean;
  onDismiss: () => void;
}) {
  const { t } = useT();
  const shown = useCountUp(before, after, reduced);
  // count-up 到顶后给 after 一个颜色 pop（reduced 下也算"已到顶"，呈现终值色）。
  const arrived = shown >= after;

  return (
    <button
      type="button"
      onClick={onDismiss}
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)]/95 px-4 py-2.5 text-left shadow-lg backdrop-blur animate-fade"
      style={{ animationDuration: "0.25s" }}
    >
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[var(--accent)]">
        <IconTree className="h-5 w-5" />
      </span>
      <span className="flex flex-col gap-0.5 leading-snug">
        <span className="text-xs text-[var(--fg-dim)]">
          {t("「{label}」这条路更近了", { label: pathLabel })}
        </span>
        <span className="flex items-baseline gap-1 text-sm font-medium tabular-nums text-[var(--fg)]">
          <span className="text-[var(--fg-faint)]">{before}%</span>
          <span className="text-[var(--fg-faint)]" aria-hidden="true">
            →
          </span>
          <span
            className="transition-colors duration-300"
            style={{ color: arrived ? "var(--accent)" : "var(--fg-dim)" }}
          >
            {shown}%
          </span>
        </span>
      </span>
    </button>
  );
}

export function FeasibilityToast() {
  const { feasibilityToast, dismissFeasibilityToast } = useApp();
  const reduced = usePrefersReducedMotion();

  // ~4s 自动消失：toast 变化时重置计时器；卸载/换 toast 时清掉。
  useEffect(() => {
    if (!feasibilityToast) return;
    const id = window.setTimeout(() => dismissFeasibilityToast(), 4000);
    return () => window.clearTimeout(id);
  }, [feasibilityToast, dismissFeasibilityToast]);

  if (!feasibilityToast) return null;
  const { pathLabel, before, after } = feasibilityToast;
  return (
    <ToastCard
      key={`${pathLabel}|${before}|${after}`}
      pathLabel={pathLabel}
      before={before}
      after={after}
      reduced={reduced}
      onDismiss={dismissFeasibilityToast}
    />
  );
}
