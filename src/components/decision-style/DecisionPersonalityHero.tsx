"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  decisionPersonalityPresentationByCode,
  type DecisionStyleSummary,
} from "@/domain/decisionStyle";
import { DecisionStyleCharacter } from "./DecisionStyleCharacter";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotionPreference() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

function getServerReducedMotionPreference() {
  return false;
}

export function DecisionPersonalityHero({
  summary,
  reveal = true,
}: {
  summary: DecisionStyleSummary;
  reveal?: boolean;
}) {
  const presentation = decisionPersonalityPresentationByCode(summary.code);
  const reduceMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionPreference,
    getServerReducedMotionPreference,
  );
  const [revealDelayElapsed, setRevealDelayElapsed] = useState(!reveal);

  useEffect(() => {
    if (!reveal || reduceMotion) return;

    const timer = window.setTimeout(() => setRevealDelayElapsed(true), 450);
    return () => window.clearTimeout(timer);
  }, [reduceMotion, reveal]);

  const revealed = !reveal || reduceMotion || revealDelayElapsed;

  if (!presentation) return null;

  if (!revealed) {
    return (
      <section
        aria-label="正在揭晓你的决策人格"
        className="grid min-h-[26rem] place-items-center overflow-hidden rounded-[2rem] bg-[#f4eadf]"
      >
        <div className="opacity-35 grayscale">
          <DecisionStyleCharacter code={summary.code} size={280} />
        </div>
      </section>
    );
  }

  const headingId = `decision-personality-${summary.code}`;

  return (
    <section
      aria-labelledby={headingId}
      className="relative overflow-hidden rounded-[2rem] bg-[#f4eadf] px-5 pb-7 pt-6 text-[#251f1a] shadow-[0_20px_60px_-38px_rgba(68,43,24,0.55)] sm:px-9 sm:pb-9 sm:pt-8"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-[#b33f16]"
      />

      <div className="animate-fade text-[0.68rem] font-semibold tracking-[0.2em] text-[#725f50]">
        你的决策人格
      </div>

      <div className="mt-3">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(7.5rem,0.68fr)] items-center gap-2">
          <div className="relative z-10">
            <h1
              id={headingId}
              className="font-[family-name:var(--font-display)] text-6xl font-black leading-none tracking-[-0.065em] text-[#251f1a] sm:text-7xl"
            >
              {summary.code}
            </h1>
            <p className="mt-2 font-serif text-xl font-semibold tracking-[-0.02em] text-[#3b3129] sm:text-2xl">
              {presentation.label}
            </p>
          </div>

          <DecisionStyleCharacter
            code={summary.code}
            size={280}
            className="mx-auto h-auto w-full max-w-[11rem] animate-scale-in drop-shadow-[0_18px_18px_rgba(68,43,24,0.16)]"
          />
        </div>

        <div className="relative z-10">
          <p className="mt-4 max-w-xl text-pretty font-serif text-lg font-semibold leading-8 text-[#392f28] sm:text-xl">
            {presentation.tagline}
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-5 grid items-start gap-3">
        <div className="rounded-[1.25rem] bg-white/65 p-4 sm:p-5">
          <div className="text-xs font-semibold tracking-[0.12em] text-[#a23a14]">你的高光</div>
          <p className="mt-2 text-pretty text-[0.95rem] leading-6 text-[#41362e]">
            {presentation.highlight}
          </p>
        </div>
        <div className="rounded-[1.25rem] bg-[#2d2925] p-4 text-[#fffaf4] sm:p-5">
          <div className="text-xs font-semibold tracking-[0.12em] text-[#ddb99a]">容易翻车</div>
          <p className="mt-2 text-pretty text-[0.95rem] leading-6">
            {presentation.roast}
          </p>
        </div>
      </div>

      <p className="relative z-10 mt-5 max-w-2xl text-pretty text-sm leading-6 text-[#695c52]">
        给你的提醒：{presentation.advice}
      </p>
    </section>
  );
}
