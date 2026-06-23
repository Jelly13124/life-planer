import type { Goal, LifePath, LifeTree } from "./types";
import { goalProgress } from "./goals";
import { longGoals } from "./goalTree";

// ───────────────────────────────────────────────────────────────────────────
// feasibility —— 动机闭环 × 动态可行度（Route A ②）。
// 每条 choice 路有 AI 给的起步分（path.feasibility）；用户完成挂在这条路上的目标
// → 进度加成 → 有效可行度上涨。让"我的行动把那个未来推近了"肉眼可见。
//   有效可行度 = min(95, 起步分 + round(pathProgress * 30))。
// 纯、确定性：不读 Date.now/Math.random；进度由 goals.goalProgress 推。
// 这是产品化的动机设计，不是客观概率——封顶 95 + 文案明说"是你推动的"守住不浮夸。
// ───────────────────────────────────────────────────────────────────────────

// 完成目标最多能把可行度抬高多少（百分点）。
const BUMP_MAX = 30;
// 有效可行度上限：绝不显示 100%（诚实）。
const FEASIBILITY_CAP = 95;

// 关联目标：活跃、且 pathId 指向该路的「长期」目标（短期不上树，不计）。
export function linkedGoals(tree: LifeTree, pathId: string): Goal[] {
  return longGoals(tree).filter((g) => g.status === "active" && g.pathId === pathId);
}

// 这条路的整体进度 0–1 = 各关联目标 goalProgress 的平均；无关联目标 → 0。
export function pathProgress(tree: LifeTree, pathId: string): number {
  const goals = linkedGoals(tree, pathId);
  if (goals.length === 0) return 0;
  const sum = goals.reduce((acc, g) => acc + goalProgress(tree, g), 0);
  return sum / goals.length;
}

export interface EffectiveFeasibility {
  value: number; // 显示用：起步分 + 行动加成，封顶 95
  baseline: number; // AI 给的起步分（path.feasibility）
  bump: number; // 你的行动加成（百分点）
  pathProgress: number; // 这条路的整体进度 0–1
}

// 有效可行度：path.feasibility 未定义 → null（UI 不显示）。
//   baseline = path.feasibility；bump = round(pathProgress * 30)；
//   value = min(95, baseline + bump)。
export function effectiveFeasibility(
  tree: LifeTree,
  path: LifePath,
): EffectiveFeasibility | null {
  if (path.feasibility == null) return null;
  const baseline = path.feasibility;
  const progress = pathProgress(tree, path.id);
  const bump = Math.round(progress * BUMP_MAX);
  const value = Math.min(FEASIBILITY_CAP, baseline + bump);
  return { value, baseline, bump, pathProgress: progress };
}
