"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FULL_QUESTIONS,
  TIE_BREAKERS,
  scoreDecisionStyle,
  type DecisionStyleAnswerValue,
  type DecisionStyleAxis,
  type DecisionStyleLocalDetail,
  type DecisionStyleQuestion,
  type DecisionStyleSummary,
} from "@/domain/decisionStyle";
import type { LifeTree } from "@/domain/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requestDecisionStyleShareLink } from "@/lib/decisionStyleShareClient";
import { trackDecisionStyleEvent } from "@/lib/decisionStyleAnalytics";
import {
  clearDecisionStyleDraft,
  clearDecisionStyleLocalData,
  loadDecisionStyleDraft,
  saveDecisionStyleDetail,
  saveDecisionStyleDraft,
  saveDecisionStyleSummaryHandoff,
} from "@/lib/decisionStyleStorage";
import { persistDecisionStyleSummary } from "@/lib/decisionStyleTreeBridge";
import { useApp } from "@/state/AppContext";
import { DecisionStyleResult } from "./DecisionStyleResult";

type Stage = "intro" | "questions" | "tieBreakers" | "result";

interface DraftState {
  stage: Stage;
  detail: DecisionStyleLocalDetail;
}

function buildInitialState(): DraftState {
  const draft = loadDecisionStyleDraft();
  if (!draft) {
    return { stage: "intro", detail: { version: 2, answers: [], tieBreaks: {} } };
  }

  const result = scoreDecisionStyle("full", draft.answers, draft.tieBreaks);
  if (draft.answers.length < FULL_QUESTIONS.length) return { stage: "questions", detail: draft };
  if (result.code) return { stage: "result", detail: draft };
  return { stage: "tieBreakers", detail: draft };
}

function intensityOptions(question: DecisionStyleQuestion) {
  return [
    { value: -2 as DecisionStyleAnswerValue, label: `${question.left.label}（非常符合）` },
    { value: -1 as DecisionStyleAnswerValue, label: `${question.left.label}（比较符合）` },
    { value: 0 as DecisionStyleAnswerValue, label: "两边都差不多" },
    { value: 1 as DecisionStyleAnswerValue, label: `${question.right.label}（比较符合）` },
    { value: 2 as DecisionStyleAnswerValue, label: `${question.right.label}（非常符合）` },
  ];
}

function updateAnswer(
  detail: DecisionStyleLocalDetail,
  questionId: string,
  value: DecisionStyleAnswerValue,
): DecisionStyleLocalDetail {
  const answers = detail.answers.some((item) => item.questionId === questionId)
    ? detail.answers.map((item) => (item.questionId === questionId ? { ...item, value } : item))
    : [...detail.answers, { questionId, value }];
  return { ...detail, answers };
}

function updateTieBreak(
  detail: DecisionStyleLocalDetail,
  axis: DecisionStyleAxis,
  pole: "a" | "b",
): DecisionStyleLocalDetail {
  return {
    ...detail,
    tieBreaks: { ...detail.tieBreaks, [axis]: pole },
  };
}

export function DecisionStyleTest({
  onContinueToTree,
  inviteToken,
  onCompareReady,
  onInviteCleared,
}: {
  onContinueToTree: () => void;
  inviteToken?: string | null;
  onCompareReady?: (path: string) => void;
  onInviteCleared?: () => void;
}) {
  const app = useApp() as unknown as {
    tree: LifeTree | null;
    applyDecisionStyleSummary?: (summary: DecisionStyleSummary) => void;
  };
  const { tree, applyDecisionStyleSummary } = app;
  // Keep the first render identical on the server and client. Draft storage is
  // browser-only, so restore it after hydration instead of reading it in the
  // state initializer.
  const [draftState, setDraftState] = useState<DraftState>(() => ({
    stage: "intro",
    detail: { version: 2, answers: [], tieBreaks: {} },
  }));
  const [completedSummary, setCompletedSummary] = useState<DecisionStyleSummary | null>(null);
  const [completedEvidence, setCompletedEvidence] = useState<ReturnType<typeof scoreDecisionStyle>["evidence"]>([]);
  const [compareError, setCompareError] = useState<string | null>(null);
  const analyticsStarted = useRef(false);
  const [questionIndex, setQuestionIndex] = useState(0);

  const scoring = useMemo(
    () => scoreDecisionStyle("full", draftState.detail.answers, draftState.detail.tieBreaks),
    [draftState.detail],
  );

  const tieBreakQueue = scoring.pendingTieBreaks
    .map((axis) => TIE_BREAKERS.find((question) => question.axis === axis))
    .filter((question): question is DecisionStyleQuestion => Boolean(question));

  const activeQuestion = FULL_QUESTIONS[questionIndex];
  const activeTieBreaker = tieBreakQueue[0] ?? null;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const restored = buildInitialState();
      setDraftState(restored);
      setQuestionIndex(Math.min(restored.detail.answers.length, FULL_QUESTIONS.length - 1));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (analyticsStarted.current) return;
    analyticsStarted.current = true;
    const source = inviteToken ? "shared" : "direct";
    void trackDecisionStyleEvent("style_view", { source });
    if (inviteToken) void trackDecisionStyleEvent("style_compare_start", { source });
  }, [inviteToken]);

  function persist(detail: DecisionStyleLocalDetail, stage = draftState.stage) {
    saveDecisionStyleDraft(detail);
    setDraftState({ stage, detail });
  }

  async function finish() {
    const next = scoreDecisionStyle("full", draftState.detail.answers, draftState.detail.tieBreaks);
    if (!next.code) {
      setDraftState((current) => ({ ...current, stage: "tieBreakers" }));
      return;
    }

    const summary: DecisionStyleSummary = {
      version: 2,
      source: "full",
      code: next.code,
      scores: next.scores,
      completedAt: new Date().toISOString(),
    };

    void trackDecisionStyleEvent("style_complete", { source: inviteToken ? "shared" : "direct" });

    saveDecisionStyleDetail(draftState.detail);
    clearDecisionStyleDraft();
    setCompareError(null);

    if (tree) {
      if (applyDecisionStyleSummary) applyDecisionStyleSummary(summary);
      else persistDecisionStyleSummary(summary, tree);
    } else if (!inviteToken) {
      saveDecisionStyleSummaryHandoff(summary);
    }

    if (inviteToken) {
      try {
        const signed = await requestDecisionStyleShareLink(summary);
        onInviteCleared?.();
        onCompareReady?.(`/compare/${inviteToken}/${signed.token}`);
        return;
      } catch {
        setCompareError("对比暂时不可用，请稍后重试。");
      }
    }

    setCompletedSummary(summary);
    setCompletedEvidence(next.evidence);
    setDraftState((current) => ({ ...current, stage: "result" }));
  }

  function restart() {
    if (!window.confirm("确定要重新测试吗？")) return;
    clearDecisionStyleLocalData();
    setCompareError(null);
    setCompletedSummary(null);
    setCompletedEvidence([]);
    setQuestionIndex(0);
    setDraftState({ stage: "intro", detail: { version: 2, answers: [], tieBreaks: {} } });
    onInviteCleared?.();
  }

  if (draftState.stage === "result" && completedSummary) {
    const continueToTree = () => {
      if (tree && !applyDecisionStyleSummary) {
        window.location.assign("/");
        return;
      }
      if (tree && applyDecisionStyleSummary) {
        window.setTimeout(onContinueToTree, 900);
        return;
      }
      onContinueToTree();
    };

    return (
      <DecisionStyleResult
        summary={completedSummary}
        evidence={completedEvidence}
        onContinue={() => {
          void trackDecisionStyleEvent("style_continue_tree", { source: "direct" });
          continueToTree();
        }}
        onRestart={restart}
      />
    );
  }

  if (draftState.stage === "intro") {
    return (
      <Card pad="lg" className="space-y-5">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--fg-faint)]">职业决策风格测试</div>
          <h1 className="text-3xl font-semibold text-[var(--fg)]">28 题完整版</h1>
          <p className="text-sm leading-6 text-[var(--fg-dim)]">
            用最近的真实决策习惯看你现在的职业决策倾向。全程本地计算，不是心理诊断。
          </p>
        </div>
        <ul className="space-y-2 text-sm text-[var(--fg-dim)]">
          <li className="list-disc pl-2 ml-4">预计 4–6 分钟</li>
          <li className="list-disc pl-2 ml-4">只在本设备保存原始细节</li>
          <li className="list-disc pl-2 ml-4">完成后可继续生成人生树</li>
        </ul>
        <Button
          type="button"
          className="min-h-11"
          onClick={() => {
            void trackDecisionStyleEvent("style_start", { source: inviteToken ? "shared" : "direct" });
            setCompareError(null);
            setQuestionIndex(Math.min(draftState.detail.answers.length, FULL_QUESTIONS.length - 1));
            setDraftState((current) => ({ ...current, stage: "questions" }));
          }}
        >
          开始测试
        </Button>
        {compareError ? <p className="text-sm text-[var(--fg-dim)]">{compareError}</p> : null}
      </Card>
    );
  }

  if (draftState.stage === "tieBreakers" && activeTieBreaker) {
    return (
      <Card pad="lg" className="space-y-5">
        <div className="space-y-2">
          <div className="text-sm text-[var(--fg-dim)]">还需要 {tieBreakQueue.length} 个平分追问</div>
          <h2 className="text-2xl font-semibold text-[var(--fg)]">{activeTieBreaker.prompt}</h2>
        </div>
        <fieldset className="space-y-3">
          <legend className="sr-only">{activeTieBreaker.prompt}</legend>
          {[activeTieBreaker.left, activeTieBreaker.right].map((option) => (
            <label
              key={option.pole}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm text-[var(--fg)]"
            >
              <input
                type="radio"
                name={activeTieBreaker.id}
                value={option.pole}
                checked={draftState.detail.tieBreaks[activeTieBreaker.axis] === option.pole}
                onChange={() =>
                  persist(updateTieBreak(draftState.detail, activeTieBreaker.axis, option.pole), "tieBreakers")}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="ghost" className="min-h-11" onClick={restart}>
            重新测试
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={!draftState.detail.tieBreaks[activeTieBreaker.axis]}
            onClick={() => void finish()}
          >
            查看结果
          </Button>
        </div>
        {compareError ? <p className="text-sm text-[var(--fg-dim)]">{compareError}</p> : null}
      </Card>
    );
  }

  const selectedValue = draftState.detail.answers.find((item) => item.questionId === activeQuestion.id)?.value;

  return (
    <Card pad="lg" className="space-y-5">
      <div className="space-y-2">
        <div className="text-sm text-[var(--fg-dim)]">第 {questionIndex + 1} / {FULL_QUESTIONS.length} 题</div>
        <h2 className="text-2xl font-semibold text-[var(--fg)]">{activeQuestion.prompt}</h2>
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">{activeQuestion.prompt}</legend>
        {intensityOptions(activeQuestion).map((option) => (
          <label
            key={option.label}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm text-[var(--fg)]"
          >
            <input
              type="radio"
              name={activeQuestion.id}
              value={option.value}
              checked={selectedValue === option.value}
              onChange={() => persist(updateAnswer(draftState.detail, activeQuestion.id, option.value), "questions")}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={questionIndex === 0}
            onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
          >
            上一题
          </Button>
          <Button type="button" variant="ghost" className="min-h-11" onClick={restart}>
            重新测试
          </Button>
        </div>

        <Button
          type="button"
          className="min-h-11"
          disabled={selectedValue === undefined}
          onClick={() => {
            setCompareError(null);
            if (questionIndex === FULL_QUESTIONS.length - 1) void finish();
            else setQuestionIndex((current) => current + 1);
          }}
        >
          {questionIndex === FULL_QUESTIONS.length - 1 ? "查看结果" : "下一题"}
        </Button>
      </div>
      {compareError ? <p className="text-sm text-[var(--fg-dim)]">{compareError}</p> : null}
    </Card>
  );
}
