"use client";

import { useT } from "@/prefs/PreferencesContext";
import type { SharePayload } from "./shareData";

// 与 feasibility % 展示口径保持一致（约 X%，取整到 5，封顶 95）。
function roundFeasibility(n: number): number {
  return Math.min(95, Math.max(0, Math.round(n / 5) * 5));
}

export function ShareCard({ payload }: { payload: SharePayload }) {
  const { t } = useT();
  const items = payload.items ?? [];
  const isQuote = payload.kind === "future-self" && !!payload.quote;
  const meta = [payload.subtitle, payload.name].filter((s): s is string => !!s).join(" · ");

  return (
    <div className="lp-media-dark w-full overflow-hidden rounded-3xl p-6 shadow-[var(--shadow-violet)]">
      <div className="mb-4 text-[11px] text-[var(--fg-faint)]">{t("人生树 · Life Planner")}</div>

      <div className="text-[22px] font-semibold leading-snug text-[var(--fg)]">{payload.title}</div>
      {meta && <p className="mt-1 text-sm text-[var(--fg-dim)]">{meta}</p>}

      {isQuote ? (
        <div className="mt-5 rounded-2xl bg-[var(--bg-2)] px-4 py-5">
          <p className="lp-display text-[19px] italic leading-relaxed text-[var(--fg)]">{`“${payload.quote}”`}</p>
          <p className="mt-3 text-[12px] text-[var(--fg-faint)]">{t("来自未来的我")}</p>
        </div>
      ) : items.length > 0 ? (
        <div className="mt-5 flex flex-col gap-2">
          {items.map((it, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-[var(--bg-2)] px-3.5 py-2.5"
            >
              <span className="text-sm text-[var(--fg)]">{it.label}</span>
              {typeof it.feasibility === "number" && (
                <span className="text-sm font-semibold text-[var(--accent)]">
                  {t("约 {n}%", { n: roundFeasibility(it.feasibility) })}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-5 text-[11px] text-[var(--fg-faint)]">{t("AI 推演的可能性，非预测 · 由朋友分享")}</p>
    </div>
  );
}
