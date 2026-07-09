import type { LifeTree } from "./types";

// AI 用量配额：免费 20 点/自然月，Pro 不限。纯函数、today 注入（YYYY-MM-DD）。
export const FREE_AI_OPS_PER_MONTH = 20;

const monthOf = (today: string): string => today.slice(0, 7);

export function aiOpsUsed(tree: LifeTree, today: string): number {
  const a = tree.aiOps;
  return a && a.month === monthOf(today) ? a.used : 0;
}

export function aiOpsLeft(tree: LifeTree, today: string): number {
  return Math.max(0, FREE_AI_OPS_PER_MONTH - aiOpsUsed(tree, today));
}

export function canUseAi(tree: LifeTree, today: string, isPro: boolean): boolean {
  return isPro || aiOpsLeft(tree, today) > 0;
}

export function consumeAiOp(tree: LifeTree, today: string): LifeTree {
  const month = monthOf(today);
  return { ...tree, aiOps: { month, used: aiOpsUsed(tree, today) + 1 } };
}
