import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  QUICK_QUESTIONS,
  TIE_BREAKERS,
  scoreDecisionStyle,
  upsertDecisionStyleAnswer,
  type DecisionStyleAnswerValue,
  type DecisionStyleAxis,
  type DecisionStyleLocalDetail,
  type DecisionStyleQuestion,
  type DecisionStyleSummary,
} from "@lifeplanner/core/decisionStyle";
import { Button, Card, Muted } from "../ui";
import { colors, radii, space } from "../theme";
import { clearDecisionStyleDetail, loadDecisionStyleDetail, saveDecisionStyleDetail } from "../lib/decisionStyleStorage";
import { trackAppDecisionStyleEvent } from "../lib/decisionStyleAnalytics";
import { DecisionStyleScale } from "./DecisionStyleScale";

function answerOf(detail: DecisionStyleLocalDetail, questionId: string) {
  return detail.answers.find((item) => item.questionId === questionId)?.value;
}

function TestFrame({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  if (embedded) return <View style={styles.content}>{children}</View>;
  return <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>;
}

export default function DecisionStyleQuickTest({
  embedded = false,
  onComplete,
  onSkip,
}: {
  embedded?: boolean;
  onComplete: (summary: DecisionStyleSummary) => void;
  onSkip: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<"intro" | "questions" | "ties" | "result">("intro");
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState<DecisionStyleLocalDetail>({ version: 2, answers: [], tieBreaks: {} });
  const [summary, setSummary] = useState<DecisionStyleSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingTieBreaker, setPendingTieBreaker] = useState<DecisionStyleQuestion | null>(null);
  const advanceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void trackAppDecisionStyleEvent("style_view");
    void loadDecisionStyleDetail().then((saved) => {
      if (saved && saved.answers.length > 0) {
        setDetail(saved);
        setIndex(Math.min(saved.answers.length, QUICK_QUESTIONS.length - 1));
        setStage(saved.answers.length >= QUICK_QUESTIONS.length ? "ties" : "questions");
      }
      setReady(true);
    });
  }, []);

  useEffect(() => () => {
    if (advanceTimer.current !== null) clearTimeout(advanceTimer.current);
  }, []);

  const scoring = useMemo(
    () => scoreDecisionStyle("quick", detail.answers, detail.tieBreaks),
    [detail],
  );
  const tieQueue = scoring.pendingTieBreaks
    .map((axis) => TIE_BREAKERS.find((question) => question.axis === axis))
    .filter((question): question is (typeof TIE_BREAKERS)[number] => Boolean(question));
  const activeTieBreaker = pendingTieBreaker ?? tieQueue[0];

  if (!ready) return null;

  const save = (next: DecisionStyleLocalDetail) => {
    setDetail(next);
    void saveDecisionStyleDetail(next);
  };

  const finish = async (nextDetail: DecisionStyleLocalDetail) => {
    const result = scoreDecisionStyle("quick", nextDetail.answers, nextDetail.tieBreaks);
    if (!result.code) {
      setStage("ties");
      return;
    }
    setBusy(true);
    try {
      await saveDecisionStyleDetail(nextDetail);
      const nextSummary: DecisionStyleSummary = {
        version: 2,
        source: "quick",
        code: result.code,
        scores: result.scores,
        completedAt: new Date().toISOString(),
      };
      void trackAppDecisionStyleEvent("style_complete");
      setSummary(nextSummary);
      setStage("result");
    } finally {
      setBusy(false);
    }
  };

  const chooseAnswer = (value: DecisionStyleAnswerValue) => {
    if (advanceTimer.current !== null) return;
    const question = QUICK_QUESTIONS[index];
    const next = upsertDecisionStyleAnswer(detail, question.id, value);
    save(next);
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      if (index === QUICK_QUESTIONS.length - 1) void finish(next);
      else setIndex((current) => current + 1);
    }, 200);
  };

  const updateTie = (axis: DecisionStyleAxis, pole: "a" | "b") => {
    if (advanceTimer.current !== null || !activeTieBreaker) return;
    const next = { ...detail, tieBreaks: { ...detail.tieBreaks, [axis]: pole } };
    setPendingTieBreaker(activeTieBreaker);
    save(next);
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      void finish(next).finally(() => setPendingTieBreaker(null));
    }, 200);
  };

  if (stage === "intro") {
    return (
      <TestFrame embedded={embedded}>
        <Card>
          <Text style={styles.eyebrow}>决策人格测试</Text>
          <Text style={styles.title}>12 道选择题，看看你做重大决定时像哪种人</Text>
          <Muted>按最近真实发生的选择回答。原始答案只保存在本机；结果描述当前倾向，不是固定人格或心理诊断。</Muted>
          <View style={styles.gap} />
          <Button label="开始快测" onPress={() => { void trackAppDecisionStyleEvent("style_start"); setStage("questions"); }} />
          <Button label="先跳过" kind="ghost" onPress={() => { void trackAppDecisionStyleEvent("style_skip"); void clearDecisionStyleDetail(); onSkip(); }} />
        </Card>
      </TestFrame>
    );
  }

  if (stage === "result" && summary) {
    return (
      <TestFrame embedded={embedded}>
        <Card>
          <Text style={styles.eyebrow}>你的当前倾向</Text>
          <Text style={styles.title}>{summary.code}</Text>
          <Muted>四个轴的分数已保存在资料摘要中，之后可以在「我」里重测。</Muted>
          <View style={styles.scoreGrid}>
            {Object.entries(summary.scores).map(([axis, score]) => (
              <View key={axis} style={styles.scoreItem}>
                <Text style={styles.scoreAxis}>{axis}</Text>
                <Text style={styles.score}>{score}</Text>
              </View>
            ))}
          </View>
          <Button label="继续填写资料" onPress={() => onComplete(summary)} />
        </Card>
      </TestFrame>
    );
  }

  if (stage === "ties" && activeTieBreaker) {
    const question = activeTieBreaker;
    const locked = advanceTimer.current !== null || busy;
    return (
      <TestFrame embedded={embedded}>
        <Card>
          <Text style={styles.eyebrow}>加赛题</Text>
          <Text style={styles.title}>{question.prompt}</Text>
          {question.left && question.right ? [question.left, question.right].map((choice) => (
            <Pressable
              key={choice.pole}
              accessibilityRole="radio"
              accessibilityState={{ selected: detail.tieBreaks[question.axis] === choice.pole, disabled: locked }}
              disabled={locked}
              onPress={() => updateTie(question.axis, choice.pole)}
              hitSlop={4}
              style={({ pressed }) => [
                styles.option,
                detail.tieBreaks[question.axis] === choice.pole && styles.optionSelected,
                pressed && !locked && styles.optionPressed,
              ]}
            >
              <Text style={styles.optionText}>{choice.label}</Text>
            </Pressable>
          )) : null}
          {busy ? <Muted>正在保存…</Muted> : null}
        </Card>
      </TestFrame>
    );
  }

  const question = QUICK_QUESTIONS[index];
  const locked = advanceTimer.current !== null || busy;
  const backDisabled = index === 0 || locked;
  return (
    <TestFrame embedded={embedded}>
      <Card>
        <View style={styles.questionHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="上一题"
            accessibilityState={{ disabled: backDisabled }}
            disabled={backDisabled}
            hitSlop={8}
            onPress={() => {
              if (advanceTimer.current !== null) return;
              setIndex((current) => Math.max(0, current - 1));
            }}
            style={({ pressed }) => [
              styles.back,
              backDisabled && styles.backDisabled,
              pressed && !backDisabled && styles.backPressed,
            ]}
          >
            <Text style={styles.backText}>上一题</Text>
          </Pressable>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${((index + 1) / QUICK_QUESTIONS.length) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {String(index + 1).padStart(2, "0")} / {QUICK_QUESTIONS.length}
          </Text>
        </View>
        <Text style={styles.title}>{question.prompt}</Text>
        <DecisionStyleScale
          question={question}
          value={answerOf(detail, question.id)}
          disabled={locked}
          onChange={chooseAnswer}
        />
      </Card>
    </TestFrame>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: space },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: space },
  eyebrow: { color: colors.fgMuted, fontSize: 13, marginBottom: 8 },
  title: { color: colors.fg, fontSize: 26, fontWeight: "700", marginBottom: 12 },
  gap: { height: 16 },
  questionHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  back: { minHeight: 44, justifyContent: "center" },
  backDisabled: { opacity: 0.4 },
  backPressed: { opacity: 0.75 },
  backText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  progressText: { color: colors.fgMuted, fontSize: 13, fontVariant: ["tabular-nums"] },
  option: { minHeight: 56, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radii.md, justifyContent: "center", padding: 14, marginTop: 10, backgroundColor: colors.card },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  optionText: { color: colors.fg, fontSize: 15, lineHeight: 22 },
  scoreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginVertical: 18 },
  scoreItem: { width: "47%", borderRadius: radii.sm, backgroundColor: colors.accentSoft, padding: 12 },
  scoreAxis: { color: colors.fgMuted, fontSize: 12 },
  score: { color: colors.fg, fontSize: 24, fontWeight: "700", marginTop: 4 },
});
