import type { Choice, ChoiceOption, LifeTree } from "./types";
import { hashSeed } from "./seed";

// ───────────────────────────────────────────────────────────────────────────
// choices —— 选择面板的纯访问器 / 写入器（独立于绑定 pathId 的 Decision）。
// 一律纯函数：不读 Date.now / Math.random；id 由 hashSeed 生成，时间 now 注入。
// 写操作均返回新 tree（不可变）；按 id 在 tree.choices 里跨选择定位。
// ───────────────────────────────────────────────────────────────────────────

const choicesOf = (tree: LifeTree): Choice[] => tree.choices ?? [];

// 对每个 choice 应用变换，返回新 tree（不修改原 tree）。
function mapChoices(tree: LifeTree, fn: (c: Choice) => Choice): LifeTree {
  return { ...tree, choices: choicesOf(tree).map(fn) };
}

// 把一个值夹在 [min, max] 区间内。
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ───────── reads ─────────

export function findChoiceByOption(
  tree: LifeTree,
  optionId: string,
): { choice: Choice; option: ChoiceOption } | null {
  for (const choice of choicesOf(tree)) {
    const option = (choice.options ?? []).find((o) => o.id === optionId);
    if (option) return { choice, option };
  }
  return null;
}

// 给定一个选择，建议一个选项：直觉分最高；并列时优先「可回头」(two-way)；
// 再并列时偏好弊更少（按行计数）；空选项返回 null。纯函数、确定性、稳定（并列取靠前者）。
export function suggestOption(choice: Choice): string | null {
  const options = choice.options ?? [];
  if (options.length === 0) return null;
  const consLines = (cons: string): number =>
    cons.split("\n").filter(Boolean).length;
  let best = options[0];
  for (let i = 1; i < options.length; i++) {
    const o = options[i];
    if (o.gut > best.gut) {
      best = o;
      continue;
    }
    if (o.gut < best.gut) continue;
    // gut 并列：优先 two-way
    const oTwoWay = o.reversibility === "two-way";
    const bestTwoWay = best.reversibility === "two-way";
    if (oTwoWay !== bestTwoWay) {
      if (oTwoWay) best = o;
      continue;
    }
    // 再并列：弊更少胜出（严格更少才替换，保持稳定）
    if (consLines(o.cons) < consLines(best.cons)) best = o;
  }
  return best.id;
}

// ───────── writes: choices ─────────

// 追加一个选择，返回新 tree + 新 id（id 由 问题+now+index 确定，确定性）。
export function createChoice(
  tree: LifeTree,
  question: string,
  now: string,
): { tree: LifeTree; id: string } {
  const index = choicesOf(tree).length;
  const id = `choice-${hashSeed(`${question}|${now}|${index}`)}`;
  const choice: Choice = {
    id,
    question: question.trim(),
    createdAt: now,
    options: [],
    chosenOptionId: null,
  };
  return { tree: { ...tree, choices: [...choicesOf(tree), choice] }, id };
}

export function removeChoice(tree: LifeTree, choiceId: string): LifeTree {
  return { ...tree, choices: choicesOf(tree).filter((c) => c.id !== choiceId) };
}

// 设定选定项 + 决定时间（仅当该选项确属此选择时才生效）。
export function decideChoice(
  tree: LifeTree,
  choiceId: string,
  optionId: string,
  now: string,
): LifeTree {
  return mapChoices(tree, (c) => {
    if (c.id !== choiceId) return c;
    const belongs = (c.options ?? []).some((o) => o.id === optionId);
    if (!belongs) return c;
    return { ...c, chosenOptionId: optionId, decidedAt: now };
  });
}

// 重新打开：清掉选定项与决定时间。
export function reopenChoice(tree: LifeTree, choiceId: string): LifeTree {
  return mapChoices(tree, (c) => {
    if (c.id !== choiceId) return c;
    const { decidedAt: _drop, ...rest } = c;
    return { ...rest, chosenOptionId: null };
  });
}

// ───────── writes: options ─────────

// 给某选择追加一个选项（带默认值），返回新 tree + 新 id。
// 找不到 choiceId 时为安全无操作：返回原 tree 与 id:""。
export function addOption(
  tree: LifeTree,
  choiceId: string,
  label: string,
  now: string,
): { tree: LifeTree; id: string } {
  const target = choicesOf(tree).find((c) => c.id === choiceId);
  if (!target) return { tree, id: "" };
  const index = (target.options ?? []).length;
  const id = `option-${hashSeed(`${choiceId}|${label}|${now}|${index}`)}`;
  const option: ChoiceOption = {
    id,
    label: label.trim(),
    pros: "",
    cons: "",
    cost: "",
    reversibility: "two-way",
    gut: 3,
    pathId: null,
  };
  const next = mapChoices(tree, (c) =>
    c.id === choiceId ? { ...c, options: [...(c.options ?? []), option] } : c,
  );
  return { tree: next, id };
}

// 在任意选择里按 optionId 定位并浅合并 patch（绝不覆盖 id；present 时把 gut 夹到 [1,5]）。
export function updateOption(
  tree: LifeTree,
  optionId: string,
  patch: Partial<ChoiceOption>,
): LifeTree {
  return mapChoices(tree, (c) => ({
    ...c,
    options: (c.options ?? []).map((o) => {
      if (o.id !== optionId) return o;
      const merged: ChoiceOption = { ...o, ...patch, id: o.id };
      if (patch.gut !== undefined) merged.gut = clamp(patch.gut, 1, 5);
      return merged;
    }),
  }));
}

// 从所属选择里移除该选项；若它正是 chosenOptionId，连带清掉 chosen/decidedAt。
export function removeOption(tree: LifeTree, optionId: string): LifeTree {
  return mapChoices(tree, (c) => {
    const has = (c.options ?? []).some((o) => o.id === optionId);
    if (!has) return c;
    const options = (c.options ?? []).filter((o) => o.id !== optionId);
    if (c.chosenOptionId === optionId) {
      const { decidedAt: _drop, ...rest } = c;
      return { ...rest, options, chosenOptionId: null };
    }
    return { ...c, options };
  });
}

// 把某选项关联到树上的一条分支（推演后回填）。
export function linkOptionPath(
  tree: LifeTree,
  optionId: string,
  pathId: string,
): LifeTree {
  return mapChoices(tree, (c) => ({
    ...c,
    options: (c.options ?? []).map((o) => (o.id === optionId ? { ...o, pathId } : o)),
  }));
}
