import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  QUICK_QUESTIONS,
  TIE_BREAKERS,
  scoreDecisionStyle,
  type DecisionStyleAnswerValue,
  type DecisionStyleAxis,
  type DecisionStyleLocalDetail,
  type DecisionStyleSummary,
} from "@lifeplanner/core/decisionStyle";
import { Button, Card, Muted } from "../ui";
import { colors, radii, space } from "../theme";
import { clearDecisionStyleDetail, loadDecisionStyleDetail, saveDecisionStyleDetail } from "../lib/decisionStyleStorage";

function options(question: (typeof QUICK_QUESTIONS)[number]) {
  return [
    { value: -2 as DecisionStyleAnswerValue, label: `${question.left.label}（明显）` },
    { value: -1 as DecisionStyleAnswerValue, label: `${question.left.label}（略偏）` },
    { value: 0 as DecisionStyleAnswerValue, label: "两边差不多" },
    { value: 1 as DecisionStyleAnswerValue, label: `${question.right.label}（略偏）` },
    { value: 2 as DecisionStyleAnswerValue, label: `${question.right.label}（明显）` },
  ];
}

function answerOf(detail: DecisionStyleLocalDetail, questionId: string) {
  return detail.answers.find((item) => item.questionId === questionId)?.value;
}

export default function DecisionStyleQuickTest({
  onComplete,
  onSkip,
}: {
  onComplete: (summary: DecisionStyleSummary) => void;
  onSkip: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<"intro" | "questions" | "ties" | "result">("intro");
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState<DecisionStyleLocalDetail>({ version: 2, answers: [], tieBreaks: {} });
  const [summary, setSummary] = useState<DecisionStyleSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadDecisionStyleDetail().then((saved) => {
      if (saved && saved.answers.length > 0) {
        setDetail(saved);
        setIndex(Math.min(saved.answers.length, QUICK_QUESTIONS.length - 1));
        setStage(saved.answers.length >= QUICK_QUESTIONS.length ? "ties" : "questions");
      }
      setReady(true);
    });
  }, []);

  const scoring = useMemo(
    () => scoreDecisionStyle("quick", detail.answers, detail.tieBreaks),
    [detail],
  );
  const tieQueue = scoring.pendingTieBreaks
    .map((axis) => TIE_BREAKERS.find((question) => question.axis === axis))
    .filter((question): question is (typeof TIE_BREAKERS)[number] => Boolean(question));

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
    await saveDecisionStyleDetail(nextDetail);
    const nextSummary: DecisionStyleSummary = {
      version: 2,
      source: "quick",
      code: result.code,
      scores: result.scores,
      completedAt: new Date().toISOString(),
    };
    setSummary(nextSummary);
    setStage("result");
    setBusy(false);
  };

  const updateAnswer = (value: DecisionStyleAnswerValue) => {
    const question = QUICK_QUESTIONS[index];
    const next: DecisionStyleLocalDetail = {
      ...detail,
      answers: detail.answers.some((item) => item.questionId === question.id)
        ? detail.answers.map((item) => (item.questionId === question.id ? { ...item, value } : item))
        : [...detail.answers, { questionId: question.id, value }],
    };
    save(next);
  };

  const updateTie = (axis: DecisionStyleAxis, pole: "a" | "b") => {
    const next = { ...detail, tieBreaks: { ...detail.tieBreaks, [axis]: pole } };
    save(next);
    if (tieQueue.length === 1) void finish(next);
  };

  if (stage === "intro") {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.eyebrow}>职业决策风格测试</Text>
          <Text style={styles.title}>先做 12 题快测</Text>
          <Muted>本地计算，约 2 分钟。它描述当前倾向，不是固定人格或心理诊断。</Muted>
          <View style={styles.gap} />
          <Button label="开始快测" onPress={() => setStage("questions")} />
          <Button label="先跳过" kind="ghost" onPress={() => { void clearDecisionStyleDetail(); onSkip(); }} />
        </Card>
      </ScrollView>
    );
  }

  if (stage === "result" && summary) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
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
      </ScrollView>
    );
  }

  if (stage === "ties" && tieQueue[0]) {
    const question = tieQueue[0];
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.eyebrow}>需要一个平分追问</Text>
          <Text style={styles.title}>{question.prompt}</Text>
          {question.left && question.right ? [question.left, question.right].map((choice) => (
            <Pressable
              key={choice.pole}
              accessibilityRole="radio"
              accessibilityState={{ selected: detail.tieBreaks[question.axis] === choice.pole }}
              onPress={() => updateTie(question.axis, choice.pole)}
              style={styles.option}
            >
              <Text style={styles.optionText}>{choice.label}</Text>
            </Pressable>
          )) : null}
          {busy ? <Muted>正在保存…</Muted> : null}
        </Card>
      </ScrollView>
    );
  }

  const question = QUICK_QUESTIONS[index];
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.eyebrow}>快测 · {index + 1} / {QUICK_QUESTIONS.length}</Text>
        <Text style={styles.title}>{question.prompt}</Text>
        {options(question).map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: answerOf(detail, question.id) === option.value }}
            onPress={() => updateAnswer(option.value)}
            style={styles.option}
          >
            <Text style={styles.optionText}>{option.label}</Text>
          </Pressable>
        ))}
        <Button
          label={index === QUICK_QUESTIONS.length - 1 ? "完成快测" : "下一题"}
          disabled={answerOf(detail, question.id) === undefined}
          onPress={() => {
            if (index < QUICK_QUESTIONS.length - 1) setIndex((current) => current + 1);
            else void finish(detail);
          }}
        />
        <Button label="先跳过" kind="ghost" onPress={() => { void clearDecisionStyleDetail(); onSkip(); }} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: space },
  eyebrow: { color: colors.fgMuted, fontSize: 13, marginBottom: 8 },
  title: { color: colors.fg, fontSize: 26, fontWeight: "700", marginBottom: 12 },
  gap: { height: 16 },
  option: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radii.md, justifyContent: "center", padding: 14, marginTop: 10 },
  optionText: { color: colors.fg, fontSize: 15, lineHeight: 22 },
  scoreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginVertical: 18 },
  scoreItem: { width: "47%", borderRadius: radii.sm, backgroundColor: colors.accentSoft, padding: 12 },
  scoreAxis: { color: colors.fgMuted, fontSize: 12 },
  score: { color: colors.fg, fontSize: 24, fontWeight: "700", marginTop: 4 },
});
