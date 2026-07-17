"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FULL_QUESTIONS,
  TIE_BREAKERS,
  scoreDecisionStyle,
  upsertDecisionStyleAnswer,
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
import { DecisionStyleScale } from "./DecisionStyleScale";

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
  const advanceTimer = useRef<number | null>(null);
  const pendingTieBreaker = useRef<DecisionStyleQuestion | null>(null);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    pendingTieBreaker.current = null;
  }, []);

  const scoring = useMemo(
    () => scoreDecisionStyle("full", draftState.detail.answers, draftState.detail.tieBreaks),
    [draftState.detail],
  );

  const tieBreakQueue = scoring.pendingTieBreaks
    .map((axis) => TIE_BREAKERS.find((question) => question.axis === axis))
    .filter((question): question is DecisionStyleQuestion => Boolean(question));

  const activeQuestion = FULL_QUESTIONS[questionIndex];
  const activeTieBreaker = tieBreakQueue[0] ?? pendingTieBreaker.current;

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

  useEffect(() => clearAdvanceTimer, [clearAdvanceTimer]);

  function persist(detail: DecisionStyleLocalDetail, stage = draftState.stage) {
    saveDecisionStyleDraft(detail);
    setDraftState({ stage, detail });
  }

  async function finish(detail = draftState.detail) {
    const next = scoreDecisionStyle("full", detail.answers, detail.tieBreaks);
    if (!next.code) {
      setDraftState({ stage: "tieBreakers", detail });
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

    saveDecisionStyleDetail(detail);
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
    setDraftState({ stage: "result", detail });
  }

  function chooseAnswer(value: DecisionStyleAnswerValue) {
    if (advanceTimer.current !== null) return;
    const nextDetail = upsertDecisionStyleAnswer(draftState.detail, activeQuestion.id, value);
    persist(nextDetail, "questions");
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null;
      if (questionIndex === FULL_QUESTIONS.length - 1) void finish(nextDetail);
      else setQuestionIndex((current) => current + 1);
    }, 200);
  }

  function chooseTie(axis: DecisionStyleAxis, pole: "a" | "b") {
    if (advanceTimer.current !== null) return;
    const nextDetail = updateTieBreak(draftState.detail, axis, pole);
    pendingTieBreaker.current = activeTieBreaker;
    persist(nextDetail, "tieBreakers");
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null;
      pendingTieBreaker.current = null;
      void finish(nextDetail);
    }, 200);
  }

  function restart() {
    if (!window.confirm("确定要重新测试吗？")) return;
    clearAdvanceTimer();
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
          <div className="text-xs tracking-[0.18em] text-[var(--fg-faint)]">决策人格测试</div>
          <h1 className="text-3xl font-semibold text-[var(--fg)]">28 道选择题，看看你做重大决定时像哪种人</h1>
          <p className="text-sm leading-6 text-[var(--fg-dim)]">
            按最近真实发生的选择回答。原始答案只保存在本设备；结果描述当前倾向，不是固定人格或心理诊断。
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
          <div className="text-sm text-[var(--fg-dim)]">加赛题</div>
          <h2 className="text-2xl font-semibold text-[var(--fg)]">{activeTieBreaker.prompt}</h2>
        </div>
        <fieldset className="space-y-3" disabled={advanceTimer.current !== null}>
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
                onChange={() => chooseTie(activeTieBreaker.axis, option.pole)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
        <Button type="button" variant="ghost" className="min-h-11" onClick={restart}>
          重新测试
        </Button>
        {compareError ? <p className="text-sm text-[var(--fg-dim)]">{compareError}</p> : null}
      </Card>
    );
  }

  const selectedValue = draftState.detail.answers.find((item) => item.questionId === activeQuestion.id)?.value;

  return (
    <Card pad="lg" className="space-y-5">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          disabled={questionIndex === 0}
          onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
        >
          上一题
        </Button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/8" aria-hidden="true">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${((questionIndex + 1) / FULL_QUESTIONS.length) * 100}%` }}
          />
        </div>
        <span className="text-sm tabular-nums text-[var(--fg-dim)]">
          {String(questionIndex + 1).padStart(2, "0")} / {FULL_QUESTIONS.length}
        </span>
      </div>
      <h2 className="text-2xl font-semibold text-[var(--fg)]">{activeQuestion.prompt}</h2>

      <DecisionStyleScale
        question={activeQuestion}
        value={selectedValue}
        disabled={advanceTimer.current !== null}
        onChange={chooseAnswer}
      />

      <Button type="button" variant="ghost" className="min-h-11" onClick={restart}>
        重新测试
      </Button>
      {compareError ? <p className="text-sm text-[var(--fg-dim)]">{compareError}</p> : null}
    </Card>
  );
}
