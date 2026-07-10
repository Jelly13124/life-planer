import { AXIS_KEYS, letterFor, type DecisionStyleAxis, type DecisionStyleCode, type DecisionStylePole } from "./axes";
import { FULL_QUESTIONS, QUICK_QUESTIONS, type DecisionStyleAnswerValue, type DecisionStyleSource } from "./questions";

export interface DecisionStyleAxisScores {
  tempo: number;
  focus: number;
  engine: number;
  drive: number;
}

export interface DecisionStyleSummary {
  version: 2;
  source: DecisionStyleSource;
  code: DecisionStyleCode;
  scores: DecisionStyleAxisScores;
  completedAt: string;
}

export interface DecisionStyleLocalDetail {
  version: 2;
  answers: { questionId: string; value: DecisionStyleAnswerValue }[];
  tieBreaks: Partial<Record<DecisionStyleAxis, DecisionStylePole>>;
}

export interface DecisionStyleEvidence {
  questionId: string;
  axis: DecisionStyleAxis;
  choiceLabel: string;
  value: DecisionStyleAnswerValue;
}

export interface DecisionStyleScoringResult {
  scores: DecisionStyleAxisScores;
  tendencies: Record<DecisionStyleAxis, "轻微倾向" | "明显倾向">;
  pendingTieBreaks: DecisionStyleAxis[];
  code?: DecisionStyleCode;
  evidence: DecisionStyleEvidence[];
  axisStrength: (score: number) => "轻微倾向" | "明显倾向";
}

const emptyScores = (): DecisionStyleAxisScores => ({ tempo: 50, focus: 50, engine: 50, drive: 50 });

export function decisionStyleAxisStrength(score: number): "轻微倾向" | "明显倾向" {
  return score >= 45 && score <= 55 ? "轻微倾向" : "明显倾向";
}

function selectedQuestions(source: DecisionStyleSource) {
  return source === "quick" ? QUICK_QUESTIONS : FULL_QUESTIONS;
}

export function scoreDecisionStyle(
  source: DecisionStyleSource,
  answers: DecisionStyleLocalDetail["answers"],
  tieBreaks: DecisionStyleLocalDetail["tieBreaks"] = {},
): DecisionStyleScoringResult {
  const questions = selectedQuestions(source);
  const byId = new Map(questions.map((item) => [item.id, item]));
  const signedSums: Record<DecisionStyleAxis, number> = { tempo: 0, focus: 0, engine: 0, drive: 0 };
  const evidenceCandidates: (DecisionStyleEvidence & { index: number })[] = [];

  for (const answer of answers) {
    const question = byId.get(answer.questionId);
    if (!question || answer.value === 0) continue;
    signedSums[question.axis] += answer.value * (question.left.pole === "a" ? -1 : 1);
    evidenceCandidates.push({
      questionId: question.id,
      axis: question.axis,
      choiceLabel: answer.value < 0 ? question.left.label : question.right.label,
      value: answer.value,
      index: questions.indexOf(question),
    });
  }

  const scores = emptyScores();
  for (const axis of AXIS_KEYS) {
    const maximumAbsoluteSum = questions.filter((item) => item.axis === axis).length * 2;
    scores[axis] = Math.max(0, Math.min(100, Math.round(50 + (signedSums[axis] / maximumAbsoluteSum) * 50)));
  }

  const pendingTieBreaks = AXIS_KEYS.filter((axis) => scores[axis] === 50 && !tieBreaks[axis]);
  const code = pendingTieBreaks.length === 0
    ? AXIS_KEYS.map((axis) => letterFor(axis, scores[axis] === 50 ? tieBreaks[axis]! : scores[axis] > 50 ? "a" : "b")).join("") as DecisionStyleCode
    : undefined;
  const rankedEvidence = evidenceCandidates
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value) || left.index - right.index)
  const selectedEvidence: (DecisionStyleEvidence & { index: number })[] = [];
  for (const candidate of rankedEvidence) {
    if (!selectedEvidence.some((item) => item.axis === candidate.axis)) selectedEvidence.push(candidate);
    if (selectedEvidence.length === 3) break;
  }
  for (const candidate of rankedEvidence) {
    if (selectedEvidence.length === 3) break;
    if (!selectedEvidence.includes(candidate)) selectedEvidence.push(candidate);
  }
  const evidence = selectedEvidence.map(({ questionId, axis, choiceLabel, value }) => ({
    questionId,
    axis,
    choiceLabel,
    value,
  }));

  return {
    scores,
    tendencies: Object.fromEntries(AXIS_KEYS.map((axis) => [axis, decisionStyleAxisStrength(scores[axis])])) as DecisionStyleScoringResult["tendencies"],
    pendingTieBreaks,
    code,
    evidence,
    axisStrength: decisionStyleAxisStrength,
  };
}

export function mergeDecisionStyleSummary(
  current: DecisionStyleSummary | undefined,
  incoming: DecisionStyleSummary,
): DecisionStyleSummary {
  if (!current || incoming.source === current.source) {
    return !current || incoming.completedAt >= current.completedAt ? incoming : current;
  }
  return incoming.source === "full" ? incoming : current;
}
