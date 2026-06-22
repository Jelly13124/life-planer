"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/prefs/PreferencesContext";
import { CRISIS_RESOURCES } from "@/domain/safety";
import { Button } from "./ui/Button";
import { IconSprout } from "./ui/icons";

export interface SafetyCareProps {
  onContinue: () => void;
}

export function SafetyCare({ onContinue }: SafetyCareProps) {
  const { t } = useT();
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("先停一下，照顾好自己")}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 38%, rgba(245,245,247,0.82) 0%, rgba(235,236,240,0.92) 60%, rgba(28,28,30,0.28) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        animation: "sc-enter .45s ease both",
      }}
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          btnRef.current?.focus();
        }
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-7"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          animation: "sc-rise .55s ease .1s both",
        }}
      >
        {/* Icon — a soft sprout / warmth glyph */}
        <div
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(109,74,255,0.1)", border: "1px solid rgba(109,74,255,0.22)", color: "var(--accent)" }}
          aria-hidden
        >
          <IconSprout className="h-6 w-6" />
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
                  background: "rgba(0,0,0,0.025)",
                  border: "1px solid var(--line)",
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
            ref={btnRef}
            variant="ghost"
            className="w-full"
            onClick={onContinue}
          >
            {t("我没事，继续")}
          </Button>
        </div>
      </div>
    </div>
  );
}
