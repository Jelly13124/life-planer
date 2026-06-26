import type { Scenario } from "./types";

// 三情景可能性比率（乐观/中性/保守）—— 纯函数、确定性。三者整数,和恒为 100,中性占大头。
// 来源:现实可行度 f(0-100)。中性基准 60;剩下的 40 按 f 分给乐观/保守,中性吃舍入余量。
// 诚实声明:这是 AI 粗估,不是精确概率(UI 旁注说明)。
export type ScenarioOdds = Record<Scenario, number>;

const round5 = (n: number) => Math.round(n / 5) * 5;

export function scenarioOdds(feasibility?: number): ScenarioOdds {
  const f = Math.max(0, Math.min(100, feasibility ?? 50)) / 100;
  const optimistic = round5(40 * f);
  const conservative = round5(40 * (1 - f));
  const likely = 100 - optimistic - conservative; // 中性吃舍入余量,始终最大
  return { optimistic, likely, conservative };
}
