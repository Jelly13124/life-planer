import type { DecisionStyleAnswerValue, DecisionStyleQuestion } from "./questions";
import type { DecisionStyleLocalDetail } from "./scoring";

export const DECISION_STYLE_SCALE_VALUES = Object.freeze([-2, -1, 0, 1, 2] as const);

export function decisionStyleScaleAccessibilityLabel(
  question: DecisionStyleQuestion,
  value: DecisionStyleAnswerValue,
): string {
  if (value === 0) return "两边差不多";
  const label = value < 0 ? question.left.label : question.right.label;
  return `${Math.abs(value) === 2 ? "强烈偏向" : "稍微偏向"}：${label}`;
}

export function upsertDecisionStyleAnswer(
  detail: DecisionStyleLocalDetail,
  questionId: string,
  value: DecisionStyleAnswerValue,
): DecisionStyleLocalDetail {
  const found = detail.answers.some((answer) => answer.questionId === questionId);
  return {
    ...detail,
    answers: found
      ? detail.answers.map((answer) => answer.questionId === questionId ? { ...answer, value } : answer)
      : [...detail.answers, { questionId, value }],
  };
}
