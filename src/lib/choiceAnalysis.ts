// 选项分析的纯数据契约 + 离线兜底模板（客户端 / 服务端通用，无服务端依赖）。
// 放在 lib 里，避免客户端从 api/route.ts 反向 import 把限流/key 逻辑打进浏览器包。
// 镜像 decompose.ts 的结构。AI 给的建议永远只是「建议」，由用户主动「采纳」写回，绝不自动覆盖。

import type { Reversibility } from "@/domain/types";

// 一个选项的分析建议：利/弊/成本/可逆性（按现实判）/一句点评（≤20字）。
export interface OptionAnalysis {
  pros: string;
  cons: string;
  cost: string;
  reversibility: Reversibility;
  note: string;
}

// 整个选择的分析：每个选项 id → 建议。始终为每个传入的选项 id 给出有效结构。
export type ChoiceAnalysis = Record<string, OptionAnalysis>;

export interface AnalyzeOption {
  id: string;
  label: string;
}

// 离线/无 key/限流/解析失败/网络故障时的确定性兜底：基于选项标签的关键词，给一份
// 保守、克制、不浮夸的通用结构。纯函数：不读 Date.now / Math.random，同输入恒同输出。
// 永远为每个 option id 返回有效 OptionAnalysis（即便 label 为空）。
export function localChoiceAnalysis(options: AnalyzeOption[]): ChoiceAnalysis {
  const out: ChoiceAnalysis = {};
  for (const o of options ?? []) {
    if (!o?.id) continue;
    out[o.id] = analyzeOne(o.label ?? "");
  }
  return out;
}

// "看起来更难回头"的关键词（粗判可逆性，保守起见多数仍按 two-way）。
const ONE_WAY_HINTS = [
  "辞职",
  "离职",
  "创业",
  "结婚",
  "离婚",
  "移民",
  "搬",
  "买房",
  "生",
  "退学",
  "全职",
  "quit",
  "start a company",
  "startup",
  "marry",
  "divorce",
  "immigrate",
  "relocate",
  "buy a house",
  "drop out",
];

function looksOneWay(label: string): boolean {
  const l = label.toLowerCase();
  return ONE_WAY_HINTS.some((h) => l.includes(h.toLowerCase()));
}

// 单个选项的保守兜底：把标签嵌进通用模板，给一份"可以马上替换"的占位建议。
function analyzeOne(rawLabel: string): OptionAnalysis {
  const label = rawLabel.trim();
  const name = label || "这个选项";
  const oneWay = looksOneWay(label);
  return {
    pros: `${name}：列出它最吸引你的 1-2 点（机会 / 成长 / 收入）`,
    cons: `${name}：列出它最大的 1-2 个风险或代价`,
    cost: "时间 / 金钱 / 机会成本（按你的实际情况估）",
    reversibility: oneWay ? "one-way" : "two-way",
    note: "", // 兜底不强行给点评，留空更诚实
  };
}
