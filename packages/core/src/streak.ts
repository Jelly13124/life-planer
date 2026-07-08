import type { LifeTree } from "./types";
import { addDays } from "./daily";

// ───────────────────────────────────────────────────────────────────────────
// streak —— 补签卡（streak freeze）：每月 2 张免费，用于自动"冻结"漏打卡的日子，
// 让连续天数（streak）不因偶尔一天没做而清零。纯函数、确定性（today 由上层注入）。
// ───────────────────────────────────────────────────────────────────────────

export const FREE_FREEZES_PER_MONTH = 2;

function freezeDays(tree: LifeTree): string[] {
  return tree.freezeDays ?? [];
}

// 某天是否已完成过至少一个行动（daily.ts 的 completedOn 未导出，这里按同样的 ActivityDay 形状重新推导）。
function completedOn(tree: LifeTree, day: string): number {
  return (tree.activity ?? []).find((a) => a.date === day)?.completedActionIds.length ?? 0;
}

// 某天是否被补签卡保护。
export function isFrozen(tree: LifeTree, day: string): boolean {
  return freezeDays(tree).includes(day);
}

// 某天是否"算数"（保住 streak）：完成过 或 被冻结。
function countsForStreak(tree: LifeTree, day: string): boolean {
  return completedOn(tree, day) > 0 || isFrozen(tree, day);
}

// month = "YYYY-MM"。统计该月已用掉的补签卡数。
export function freezesUsedInMonth(tree: LifeTree, month: string): number {
  return freezeDays(tree).filter((d) => d.startsWith(month)).length;
}

// today 所在月，剩余免费补签卡数（下限 0）。
export function freezesLeft(tree: LifeTree, today: string): number {
  const month = today.slice(0, 7);
  return Math.max(0, FREE_FREEZES_PER_MONTH - freezesUsedInMonth(tree, month));
}

// 连续天数（计入补签卡）：与 daily.ts 的 currentStreak 同样的宽限逻辑——
// 今天既没完成也没被冻结 → 从昨天开始数；否则从今天开始数。
export function currentStreakWithFreeze(tree: LifeTree, today: string): number {
  let cursor = countsForStreak(tree, today) ? today : addDays(today, -1);
  let streak = 0;
  while (countsForStreak(tree, cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// 自动补签：检查"昨天往前"的缺口——从昨天开始往回数连续既未完成也未冻结的天数（gap），
// 直到遇到一天已完成/已冻结（说明 gap 有意义：能接上一段已保住的 streak）或超过上限（2 天）。
// gap 为空（昨天已算数）→ 无需补，no-op。gap 非空但触底前未遇到"已算数"的一天（说明再往前也是
// 空的，没有 streak 可保）→ no-op。gap 超过 2 天（补不起/不划算）→ no-op。
// 否则若今月剩余补签卡数 ≥ gap 长度 → 把 gap 里的每一天都计入 freezeDays（全部记在 today 所在月
// 的配额上，保持简单），返回新树 + 被冻结的日期列表；配额不够 → no-op。
export function applyAutoFreeze(
  tree: LifeTree,
  today: string,
): { tree: LifeTree; frozen: string[] } {
  const noop = { tree, frozen: [] as string[] };

  // 今天已经算数（完成或已冻结）→ 没有需要补的缺口。
  if (countsForStreak(tree, today)) return noop;

  const MAX_GAP = 2;
  const gap: string[] = [];
  let cursor = addDays(today, -1);
  while (!countsForStreak(tree, cursor)) {
    gap.push(cursor);
    if (gap.length > MAX_GAP) return noop; // 缺口太长，补不起
    cursor = addDays(cursor, -1);
  }
  // cursor 现在是缺口之前第一个"算数"的日子；缺口为空说明昨天本就算数（不会走到这里，
  // 因为上面 while 至少会尝试 addDays(today,-1) 一次——若它算数则 gap 仍为空）。
  if (gap.length === 0) return noop; // 昨天本就算数，无缺口
  if (completedOn(tree, cursor) === 0 && !isFrozen(tree, cursor)) return noop; // 再往前也是空的，没有 streak 可保

  const left = freezesLeft(tree, today);
  if (left < gap.length) return noop; // 配额不够，宁可不补，不做"补一半"的桥

  const nextFreezeDays = [...freezeDays(tree), ...gap];
  return { tree: { ...tree, freezeDays: nextFreezeDays }, frozen: gap };
}
