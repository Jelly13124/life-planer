"use client";

import { useT } from "@/prefs/PreferencesContext";
import { CRISIS_RESOURCES } from "@/domain/safety";
import { Button } from "./ui/Button";

export interface SafetyCareProps {
  onContinue: () => void;
}

export function SafetyCare({ onContinue }: SafetyCareProps) {
  const { t } = useT();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("先停一下，照顾好自己")}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 38%, rgba(27,31,58,0.92) 0%, rgba(10,11,26,0.97) 60%, var(--bg-0) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        animation: "sc-enter .45s ease both",
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-7"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          animation: "sc-rise .55s ease .1s both",
        }}
      >
        {/* Icon — a soft heart / warmth glyph */}
        <div
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.22)" }}
          aria-hidden
        >
          🌿
        </div>

        <h2
          className="text-lg font-bold leading-snug"
          style={{ color: "var(--fg)" }}
        >
          {t("先停一下，照顾好自己")}
        </h2>

        <p
          className="mt-3 text-[14px] leading-relaxed"
          style={{ color: "var(--fg-dim)" }}
        >
          {t(
            "看起来你正在经历很艰难的时刻。你的感受很重要，也值得被认真对待。预测未来可以晚点再说——此刻，先和能帮到你的人聊聊。",
          )}
        </p>

        {/* Resources list */}
        <div className="mt-5">
          <p
            className="mb-2.5 text-xs uppercase tracking-widest"
            style={{ color: "var(--fg-faint)" }}
          >
            {t("可以联系：")}
          </p>
          <ul className="space-y-2.5">
            {CRISIS_RESOURCES.map((r) => (
              <li
                key={r.label}
                className="rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  className="text-[13px] font-medium"
                  style={{ color: "var(--fg)" }}
                >
                  {r.label}
                </div>
                <div
                  className="mt-0.5 text-[13px] tabular-nums"
                  style={{ color: "var(--accent)" }}
                >
                  {r.contact}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Continue button */}
        <div className="mt-6">
          <Button
            variant="ghost"
            className="w-full"
            onClick={onContinue}
          >
            {t("我没事，继续")}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes sc-enter { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sc-rise {
          from { opacity: 0; transform: translateY(14px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  );
}
