// 客户端安全：调 /api/plan 与 /api/review，失败/无 key 时本地兜底。
import { currentLocale } from "@/i18n/locale";
import type { Decision, LifePath, LifeTree, PlanHorizon } from "@/domain/types";

export interface PlanResult {
  steps: string[];
  experiments: string[];
}

function sanitizeList(x: unknown, max: number): string[] {
  return (Array.isArray(x) ? x : [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

export function sanitizePlan(raw: { steps?: unknown; experiments?: unknown }): PlanResult {
  return { steps: sanitizeList(raw.steps, 6), experiments: sanitizeList(raw.experiments, 3) };
}

// 没接 AI / 失败时的通用模板（仍可用、可编辑）。
export function localPlanTemplate(): PlanResult {
  return {
    steps: [
      "把这个选择拆成最近两周能动手的第一步",
      "找一个已经走过这条路的人，聊 30 分钟",
      "估一估走这条路需要的钱、时间和条件",
    ],
    experiments: [
      "用一个周末做一次最小尝试，记下真实感受",
      "设一个一个月的检查点，到点问自己还想继续吗",
    ],
  };
}

interface PlanRequest {
  rationale: string;
  expectation: string;
  horizon: PlanHorizon;
}

// 返回计划 + 是否由 AI 生成（false = 本地兜底）。
export async function fetchPlan(
  tree: LifeTree,
  path: LifePath,
  req: PlanRequest,
): Promise<{ result: PlanResult; ai: boolean }> {
  try {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileSummary: tree.profile.snapshot || "",
        choiceLabel: path.choiceLabel,
        summary: path.summary || "",
        rationale: req.rationale,
        expectation: req.expectation,
        horizon: req.horizon,
        lang: currentLocale(),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { steps?: unknown; experiments?: unknown };
      const p = sanitizePlan(data ?? {});
      if (p.steps.length >= 1) return { result: p, ai: true };
    }
  } catch {
    /* 落到本地兜底 */
  }
  return { result: localPlanTemplate(), ai: false };
}

interface ReviewRequest {
  whatHappened: string;
  outcome: number;
}

// 返回 AI 校准句；失败返回 null（调用方用 calibrationNote 兜底）。
export async function fetchReviewLesson(
  decision: Decision,
  req: ReviewRequest,
): Promise<string | null> {
  try {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        choiceLabel: decision.choiceLabel,
        rationale: decision.rationale,
        expectation: decision.expectation,
        confidence: decision.confidence,
        whatHappened: req.whatHappened,
        outcome: req.outcome,
        lang: currentLocale(),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lesson?: string | null };
    return data.lesson ?? null;
  } catch {
    return null;
  }
}
