import type { Decision, LifeTree, PlanHorizon, Review, Reversibility } from "./types";
import { hashSeed } from "./seed";

const DAY_MS = 86_400_000;
const HORIZON_DAYS: Record<PlanHorizon, number> = { "30d": 30, "90d": 90 };

export interface DecisionInput {
  pathId: string;
  choiceLabel: string;
  rationale: string;
  expectation: string;
  confidence: number;
  reversibility: Reversibility;
  horizon: PlanHorizon;
}

const clampConfidence = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// 注入 ISO 字符串做日期运算（解析既定字符串是确定性的，不用 Date.now）。
export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

export function createDecision(input: DecisionInput, now: string): Decision {
  const id = `dec-${hashSeed(`${input.pathId}|${now}`)}`;
  return {
    id,
    pathId: input.pathId,
    choiceLabel: input.choiceLabel,
    createdAt: now,
    rationale: input.rationale.trim(),
    expectation: input.expectation.trim(),
    confidence: clampConfidence(input.confidence),
    reversibility: input.reversibility,
    reviewDate: addDays(now, HORIZON_DAYS[input.horizon]),
    plan: { horizon: input.horizon, steps: [], experiments: [], generatedByAI: false },
    review: null,
  };
}

// 覆盖同一条路上"未复盘"的旧决定；按 id 去重后追加。
export function upsertDecision(tree: LifeTree, decision: Decision): LifeTree {
  const kept = tree.decisions.filter(
    (d) =>
      d.id !== decision.id &&
      !(d.pathId === decision.pathId && d.review === null),
  );
  return { ...tree, decisions: [...kept, decision] };
}

export function setPlan(
  decision: Decision,
  steps: string[],
  experiments: string[],
  generatedByAI: boolean,
): Decision {
  return {
    ...decision,
    plan: {
      horizon: decision.plan.horizon,
      steps: steps.map((text, i) => ({ id: `${decision.id}-s${i}`, text, done: false })),
      experiments: experiments.map((text, i) => ({ id: `${decision.id}-e${i}`, text, done: false })),
      generatedByAI,
    },
  };
}

export function togglePlanItem(decision: Decision, itemId: string): Decision {
  const flip = <T extends { id: string; done: boolean }>(arr: T[]): T[] =>
    arr.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
  return {
    ...decision,
    plan: {
      ...decision.plan,
      steps: flip(decision.plan.steps),
      experiments: flip(decision.plan.experiments),
    },
  };
}

export function recordReview(decision: Decision, review: Review): Decision {
  return { ...decision, review };
}

export function activeDecisionFor(tree: LifeTree, pathId: string): Decision | null {
  return tree.decisions.find((d) => d.pathId === pathId && d.review === null) ?? null;
}

// 这条路上已复盘的决定（最新在后），用于在详情页回看当时的判断与教训。
export function reviewedDecisionsFor(tree: LifeTree, pathId: string): Decision[] {
  return tree.decisions.filter((d) => d.pathId === pathId && d.review !== null);
}

export function dueDecisions(tree: LifeTree, today: string): Decision[] {
  return tree.decisions.filter((d) => d.review === null && d.reviewDate <= today);
}

// 本地兜底的一句校准（AI 版在 /api/review 生成更好的）。
export function calibrationNote(confidence: number, outcome: Review["outcome"]): string {
  if (outcome >= 4 && confidence <= 40) return "结果比你当时预想的好——你也许低估了自己。";
  if (outcome <= 2 && confidence >= 70) return "结果比预期差——当时的信心也许高了点，下次多想想会怎么出错。";
  if (outcome === 3) return "和预期差不多——这次判断挺准。";
  return "把这次的预期和真实对照记下来，你的判断会越来越准。";
}
