// 服务端专用：用真实大模型润色一条人生路径的文案（一句话结局 + 每个节点的标题/故事）。
// 仅生成"文字"，数字/结构仍由本地确定性引擎决定 —— 各取所长。
// 没有 ANTHROPIC_API_KEY 或调用失败时返回 null，调用方回退到本地文案。
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Mood, PathKind, Profile } from "@/domain/types";
import {
  EDUCATION_LABELS,
  RELATIONSHIP_LABELS,
  SALARY_LABELS,
} from "@/domain/profile";

// 默认用最强的 Opus 4.8；想省钱可设 LIFEPLANNER_MODEL=claude-sonnet-4-6 或 claude-haiku-4-5
const MODEL = process.env.LIFEPLANNER_MODEL || "claude-opus-4-8";

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

// 结构化输出 schema（约束模型只能返回这个形状的 JSON）
const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          age: { type: "integer" },
          title: { type: "string" },
          story: { type: "string" },
        },
        required: ["age", "title", "story"],
      },
    },
  },
  required: ["summary", "nodes"],
} as const;

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
  lines.push("【要写的关键时刻】（按顺序，年龄和数量必须与下面完全一致）");
  input.nodes.forEach((n, i) => {
    lines.push(`${i + 1}. ${n.age} 岁 —— 基调：${MOOD_HINT[n.mood]}`);
  });
  lines.push("");
  lines.push("请输出 JSON：");
  lines.push("- summary：一句话概括这条路最终把 " + p.name + " 带向了哪里（≤ 25 字）。");
  lines.push(
    "- nodes：与上面一一对应的数组，每项含 age（与上面相同）、title（≤ 12 字的小标题）、story（1-2 句、贴合该年龄与基调、有画面感的叙述，自然提到 " +
      p.name +
      "）。",
  );
  return lines.join("\n");
}

// 只接受形如 sk-ant-... 的 Anthropic 密钥；格式明显不对的不点亮"已接入"，也不浪费一次请求。
function hasAnthropicKey(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return Boolean(k && k.startsWith("sk-ant-"));
}

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!hasAnthropicKey()) return null;
  if (!client) client = new Anthropic();
  return client;
}

export function isEnrichEnabled(): boolean {
  return hasAnthropicKey();
}

export async function enrichPath(input: EnrichInput): Promise<EnrichOut | null> {
  const anthropic = getClient();
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1400,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: JSON_SCHEMA } },
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    return EnrichOut.parse(JSON.parse(block.text));
  } catch (e) {
    console.error("[enrich] generation failed, falling back to local text:", e);
    return null;
  }
}
