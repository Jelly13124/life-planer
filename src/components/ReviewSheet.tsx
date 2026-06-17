"use client";

import { useState } from "react";
import type { Decision, ReviewOutcome } from "@/domain/types";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { recordReview, calibrationNote } from "@/domain/decisions";
import { fetchReviewLesson } from "@/lib/planClient";
import { Button } from "./ui/Button";

export function ReviewSheet({
  decision,
  onClose,
  onReplan,
}: {
  decision: Decision;
  onClose: () => void;
  onReplan?: (label: string) => void; // 用真实情况再推演一条（复用 addBranch）
}) {
  const { t } = useT();
  const { updateDecision } = useApp();
  const [whatHappened, setWhatHappened] = useState("");
  const [outcome, setOutcome] = useState<ReviewOutcome>(3);
  const [busy, setBusy] = useState(false);
  const [doneLesson, setDoneLesson] = useState<string | null>(null);

  async function finish() {
    if (busy || !whatHappened.trim()) return;
    setBusy(true);
    const lesson =
      (await fetchReviewLesson(decision, { whatHappened, outcome })) ??
      calibrationNote(decision.confidence, outcome);
    updateDecision(
      recordReview(decision, {
        reviewedAt: new Date().toISOString(),
        whatHappened: whatHappened.trim(),
        outcome,
        lesson,
      }),
    );
    setBusy(false);
    setDoneLesson(lesson);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-lg rounded-t-3xl border border-[var(--line)] bg-[var(--bg-1)] p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">{t("复盘：{label}", { label: decision.choiceLabel })}</h3>
        <p className="mt-1 text-sm text-[var(--fg-dim)]">
          {t("当时你预期：{exp}", { exp: decision.expectation || "—" })} ·{" "}
          {t("当时信心 {n}%", { n: decision.confidence })}
        </p>

        {doneLesson === null ? (
          <>
            <label className="mt-4 block text-xs uppercase tracking-wider text-[var(--fg-faint)]">
              {t("实际发生了什么？")}
            </label>
            <textarea
              value={whatHappened}
              onChange={(e) => setWhatHappened(e.target.value)}
              rows={3}
              autoFocus
              className="mt-1 w-full resize-none px-4 py-3 text-base"
            />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-[var(--fg-faint)]">{t("比预期差很多")}</span>
              <span className="text-xs text-[var(--fg-faint)]">{t("比预期好很多")}</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={outcome}
              onChange={(e) => setOutcome(Number(e.target.value) as ReviewOutcome)}
              className="mt-1 w-full"
            />

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={onClose}>
                {t("取消")}
              </Button>
              <Button variant="primary" disabled={busy || !whatHappened.trim()} onClick={finish}>
                {t("完成复盘")}
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-4 text-sm text-[var(--fg)]">
              {doneLesson}
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              {onReplan && (
                <Button
                  variant="subtle"
                  onClick={() => {
                    onReplan(decision.choiceLabel);
                    onClose();
                  }}
                >
                  {t("用真实情况再推演一条")}
                </Button>
              )}
              <Button variant="primary" onClick={onClose}>
                {t("完成")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
