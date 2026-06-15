import type { Profile } from "./types";

// "AI 建议"的岔路（v1 用静态规则 + 关键词命中；未来可换成真实大模型生成）。
const GENERAL: string[] = [
  "辞职创业",
  "换一份更好的工作",
  "去读研深造",
  "搬到另一座城市",
  "慢下来，休息一年",
  "认真经营一段感情",
];

const RULES: { kw: string[]; picks: string[] }[] = [
  { kw: ["创业", "辞职", "做产品"], picks: ["加入一家早期创业公司", "先做副业再决定", "拉上朋友一起干一票"] },
  { kw: ["城市", "搬", "出国", "移民", "老家"], picks: ["去一线城市闯几年", "回老家安稳发展", "出国生活一段时间"] },
  { kw: ["读研", "考研", "学历", "深造", "留学"], picks: ["一边工作一边读在职", "全力备考冲名校", "出国读个学位"] },
  { kw: ["感情", "结婚", "对象", "成家", "恋爱"], picks: ["和现在的人定下来", "先把事业做稳再说", "搬到一起生活"] },
  { kw: ["工作", "跳槽", "公司", "offer"], picks: ["跳去大厂", "转去更有前景的赛道", "争取内部晋升"] },
];

export function suggestFor(profile: Profile): string[] {
  const text = `${profile.crossroad} ${profile.snapshot}`.toLowerCase();
  const matched: string[] = [];
  for (const r of RULES) {
    if (r.kw.some((k) => text.includes(k.toLowerCase()))) matched.push(...r.picks);
  }
  const out = Array.from(new Set([...matched, ...GENERAL]));
  return out.slice(0, 5);
}
