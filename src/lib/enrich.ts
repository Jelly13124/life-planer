// 服务端专用：用真实大模型（DeepSeek）润色一条人生路径的文案
// （一句话结局 + 每个节点的标题/故事）。只生成"文字"，数字/结构仍由本地确定性引擎决定。
// 没有 DEEPSEEK_API_KEY 或调用失败时返回 null，调用方回退到本地文案。
import { z } from "zod";
import type { Mood, PathKind, Profile } from "@/domain/types";
import {
  EDUCATION_LABELS,
  RELATIONSHIP_LABELS,
  SALARY_LABELS,
} from "@/domain/profile";

// DeepSeek 兼容 OpenAI 协议。默认 deepseek-chat（DeepSeek-V3）。
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

const EnrichOut = z.object({
  summary: z.string(),
  nodes: z.array(
    z.object({
      age: z.number(),
      title: z.string(),
      story: z.string(),
    }),
  ),
});
export type EnrichOut = z.infer<typeof EnrichOut>;

export interface EnrichInput {
  profile: Profile;
  horizonYears: number;
  choiceLabel: string;
  kind: PathKind;
  nodes: { age: number; mood: Mood }[];
}

const MOOD_HINT: Record<Mood, string> = {
  high: "高光、顺遂、有成就感",
  mid: "平稳、过渡、有起有伏",
  low: "低谷、挣扎、有代价",
};

const SYSTEM = [
  "你在为一款人生探索产品生成内容。",
  "给定一个人的真实背景，以及他设想的一个人生选择，写出“如果走这条路，可能的一段人生”。",
  "重点是情感真实、有代入感、像一段小说，而不是预测、建议或保证。",
  "这是一种可能性，不是预言；不要写成算命，不要承诺一定会发生，不要说教。",
  "全部用中文。自然地把这个人的真实背景（专业、职业、爱好、情感状态等）织进故事，但不要生硬罗列。",
  "只输出 json，不要任何额外说明文字。",
].join("");

function buildUserPrompt(input: EnrichInput): string {
  const p = input.profile;
  const lines: string[] = [];
  lines.push("【这个人】");
  lines.push(`- 称呼：${p.name}，当前 ${p.age} 岁`);
  lines.push(`- 学历：${EDUCATION_LABELS[p.education]}${p.major ? `（${p.major}专业）` : ""}`);
  lines.push(`- 职业：${p.occupation || "未填写"}，月薪 ${SALARY_LABELS[p.salary]}`);
  if (p.hasSideHustle) lines.push(`- 副业：${p.sideHustle || "有"}`);
  if (p.hobbies) lines.push(`- 爱好：${p.hobbies}`);
  lines.push(`- 情感状态：${RELATIONSHIP_LABELS[p.relationship]}`);
  if (p.snapshot) lines.push(`- 自述：${p.snapshot}`);
  lines.push("");
  lines.push("【这条人生路径】");
  lines.push(
    input.kind === "status-quo"
      ? "- 选择：维持现状，不做大的改变"
      : `- 选择：${input.choiceLabel}`,
  );
  lines.push(`- 推演跨度：约 ${input.horizonYears} 年`);
  lines.push("");
  lines.push("【要写的关键时刻】（年龄和数量必须与下面完全一致，按顺序）");
  input.nodes.forEach((n, i) => {
    lines.push(`${i + 1}. ${n.age} 岁 —— 基调：${MOOD_HINT[n.mood]}`);
  });
  lines.push("");
  lines.push("请只输出如下格式的 json：");
  lines.push(jsonExample(input, p.name));
  lines.push("");
  lines.push(
    `要求：summary ≤ 25 字，概括这条路最终把 ${p.name} 带向哪里；nodes 与上面关键时刻一一对应，age 必须相同，title ≤ 12 字，story 用 1-2 句、贴合该年龄与基调、有画面感、自然提到 ${p.name}。`,
  );
  return lines.join("\n");
}

// 给模型一个具体的 JSON 形状示例（用真实 age 占位），DeepSeek 的 json 模式需要示例。
function jsonExample(input: EnrichInput, name: string): string {
  const nodes = input.nodes
    .map(
      (n) =>
        `    {"age": ${n.age}, "title": "小标题", "story": "一两句关于${name}的、有画面感的叙述"}`,
    )
    .join(",\n");
  return `{
  "summary": "一句话结局",
  "nodes": [
${nodes}
  ]
}`;
}

function getKey(): string | null {
  const k = process.env.DEEPSEEK_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

export function isEnrichEnabled(): boolean {
  return getKey() !== null;
}

export async function enrichPath(input: EnrichInput): Promise<EnrichOut | null> {
  const key = getKey();
  if (!key) return null;
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: buildUserPrompt(input) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1600,
        temperature: 1.3, // DeepSeek 对创意写作推荐的温度
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[enrich] DeepSeek ${res.status}:`, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return EnrichOut.parse(JSON.parse(content));
  } catch (e) {
    console.error("[enrich] generation failed, falling back to local text:", e);
    return null;
  }
}
