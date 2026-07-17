"use client";

import { useState } from "react";
import { scoreDecisionStyle, type DecisionStyleEvidence, type DecisionStyleSummary } from "@/domain/decisionStyle";
import { Button } from "@/components/ui/Button";
import {
  copyDecisionStyleLink,
  downloadDecisionStylePng,
  requestDecisionStyleShareLink,
  shareDecisionStyleLink,
} from "@/lib/decisionStyleShareClient";
import { DecisionStyleAxisBars } from "./DecisionStyleAxisBars";
import { DecisionPersonalityHero } from "./DecisionPersonalityHero";
import { trackDecisionStyleEvent } from "@/lib/decisionStyleAnalytics";

const RESULT_BUTTON_CLASS =
  "min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)]";

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function DecisionStyleResult({
  summary,
  evidence,
  onContinue,
  onRestart,
}: {
  summary: DecisionStyleSummary;
  evidence: DecisionStyleEvidence[];
  onContinue: () => void;
  onRestart: () => void;
}) {
  const tendencies = scoreDecisionStyle(summary.source, [], {}).tendencies;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"share" | "copy" | "png" | null>(null);

  for (const [axis, score] of Object.entries(summary.scores)) {
    tendencies[axis as keyof typeof tendencies] = score >= 45 && score <= 55 ? "轻微倾向" : "明显倾向";
  }

  async function runSignedAction(
    action: "share" | "copy" | "png",
    handler: (signed: Awaited<ReturnType<typeof requestDecisionStyleShareLink>>) => Promise<string | void>,
    fallback: string,
  ) {
    setBusyAction(action);
    setStatusMessage(null);

    try {
      const signed = await requestDecisionStyleShareLink(summary);
      const message = await handler(signed);
      if (message) setStatusMessage(message);
    } catch (error) {
      setStatusMessage(messageFromError(error, fallback));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <DecisionPersonalityHero summary={summary} />

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          disabled={busyAction === "share"}
          className={RESULT_BUTTON_CLASS}
          onClick={() =>
            void runSignedAction(
              "share",
              async (signed) => {
                void trackDecisionStyleEvent("style_share", { source: "direct" });
                const outcome = await shareDecisionStyleLink(signed.url, summary.code);
                return outcome === "copied" ? "链接已复制" : "已打开系统分享";
              },
              "分享暂时不可用，请稍后重试",
            )
          }
        >
          分享我的人格
        </Button>
        <Button
          type="button"
          variant="subtle"
          aria-expanded={detailsOpen}
          aria-controls="decision-style-details"
          className={RESULT_BUTTON_CLASS}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {detailsOpen ? "收起人格详情" : "看看我为什么是这个类型"}
        </Button>
      </div>

      {detailsOpen ? (
        <section
          id="decision-style-details"
          aria-label="人格详情"
          className="animate-fade space-y-6 rounded-[1.5rem] border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6"
        >
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--fg)]">四个决策轴</h2>
              <span className="text-xs text-[var(--fg-faint)]">
                {summary.source === "full" ? "28 题完整版" : "快测"}
              </span>
            </div>
            <div className="mt-5">
              <DecisionStyleAxisBars scores={summary.scores} tendencies={tendencies} />
            </div>
          </div>

          <div className="border-t border-[var(--line)] pt-5">
            <h3 className="font-semibold text-[var(--fg)]">本地结果依据</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--fg-dim)]">
              {evidence.map((item) => (
                <li key={`${item.axis}-${item.questionId}`} className="ml-4 list-disc pl-1 marker:text-[var(--accent)]">
                  {item.choiceLabel}
                </li>
              ))}
            </ul>
          </div>

          <p className="border-t border-[var(--line)] pt-4 text-sm leading-6 text-[var(--fg-dim)]">
            当前自报倾向，不是固定人格或心理诊断。
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="subtle"
              disabled={busyAction === "copy"}
              className={RESULT_BUTTON_CLASS}
              onClick={() =>
                void runSignedAction(
                  "copy",
                  async (signed) => {
                    await copyDecisionStyleLink(signed.url);
                    return "链接已复制";
                  },
                  "复制失败，请稍后重试",
                )
              }
            >
              复制链接
            </Button>
            <Button
              type="button"
              variant="subtle"
              disabled={busyAction === "png"}
              className={RESULT_BUTTON_CLASS}
              onClick={() =>
                void runSignedAction(
                  "png",
                  async (signed) => {
                    await downloadDecisionStylePng(signed.pngUrl);
                    return "PNG 下载已开始";
                  },
                  "PNG 保存失败，请稍后重试",
                )
              }
            >
              保存 PNG
            </Button>
            <Button type="button" variant="subtle" className={RESULT_BUTTON_CLASS} onClick={onContinue}>
              继续生成人生树
            </Button>
            <Button type="button" variant="ghost" className={RESULT_BUTTON_CLASS} onClick={onRestart}>
              重新测试
            </Button>
          </div>
        </section>
      ) : null}

      {statusMessage ? (
        <p aria-live="polite" className="text-sm text-[var(--fg-dim)]">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
