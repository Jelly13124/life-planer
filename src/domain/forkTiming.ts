import type { Profile } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// forkTiming —— 推测一个选择"多久之后才真正发生"。
// 现实里不同决定有不同的筹备期：读研要先申请、移民要排队、辞职做自媒体要攒
// 跑道。所以分支不该都从"现在"长出来，而应从各自现实的人生时间点分叉。
// 这里给的是一个确定性的默认值（不依赖随机/时间），UI 允许用户改。
// ───────────────────────────────────────────────────────────────────────────

interface Rule {
  years: number;
  keys: string[];
}

// 命中靠前的规则优先。关键词大小写不敏感（中文不受影响）。
const RULES: Rule[] = [
  { years: 0, keys: ["现在", "立刻", "马上", "今年", "立即"] },
  {
    years: 1,
    keys: ["读研", "考研", "读博", "申请", "留学", "出国", "mba", "考证", "认证", "进修", "转专业", "深造"],
  },
  { years: 1, keys: ["移民", "绿卡", "签证", "h1b", "opt", "ee", "永居", "身份"] },
  {
    years: 2,
    keys: ["辞职", "裸辞", "转行", "跳槽", "创业", "自媒体", "全职做", "做副业", "副业", "gap", "间隔年", "转型"],
  },
  { years: 1, keys: ["搬", "回国", "回亚洲", "relocate", "定居", "换城市"] },
  { years: 3, keys: ["结婚", "成家", "生孩子", "要孩子", "买房", "置业", "安家"] },
];

const DEFAULT_YEARS = 2;
export const MAX_FORK_DELAY = 10; // UI 调整与兜底的上限

const clampDelay = (n: number): number => Math.max(0, Math.min(MAX_FORK_DELAY, Math.round(n)));

// 推测「几年后才走这条路」。仅是默认值——用户可在加岔路时调整。
export function inferForkDelayYears(label: string): number {
  const s = label.trim().toLowerCase();
  if (!s) return 0;
  for (const r of RULES) {
    if (r.keys.some((k) => s.includes(k))) return r.years;
  }
  return DEFAULT_YEARS;
}

// 推测这条根分支应从哪个年龄分叉（= 现在年龄 + 筹备期）。
export function inferForkAge(profile: Profile, label: string): number {
  return profile.age + inferForkDelayYears(label);
}

export { clampDelay };
