// 服务端专用：用真实大模型（DeepSeek）生成一条人生路径的文案。
// 模型自己决定关键转折点（年龄/起伏/事件），我们只给它人物背景、这条路的选择、
// 大致时间跨度和一个"整体走向"提示。数字曲线仍由本地引擎决定，各取所长。
// 没有 DEEPSEEK_API_KEY 或调用失败时返回 null，调用方回退到本地文案。
import { z } from "zod";
import type { CurveShape, PathKind, Profile } from "@/domain/types";
import {
  EDUCATION_LABELS,
  RELATIONSHIP_LABELS,
  SALARY_LABELS,
} from "@/domain/profile";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

const EnrichOut = z.object({
  summary: z.string(),
  nodes: z.array(
    z.object({
      age: z.number(),
      title: z.string(),
      story: z.string(),
      mood: z.enum(["high", "mid", "low"]),
    }),
  ),
});
export type EnrichOut = z.infer<typeof EnrichOut>;

export interface EnrichInput {
  profile: Profile;
  startAge: number;
  horizonYears: number;
  choiceLabel: string;
  kind: PathKind;
  curve: CurveShape; // 仅用来给模型一个"整体走向"的轻提示
}

// 系统提示：把"名字"和"选择"钉成不可违背的硬约束（模型很爱改名/偏题），
// 其余（经历、转折、结局、开头）留给模型自由发挥，保证差异。
const SYSTEM = [
  "你在为一款人生探索产品写故事。我会给你一个主角和他做出的一个具体选择，",
  "你写出他做了这个选择之后、未来十几年可能经历的一段人生，拆成几个关键时刻。",
  "【不可违背的硬约束】",
  "1. 主角姓名严格用我给的名字，绝不改名、绝不换成别人。",
  "2. 整段人生必须是“他真的做了这个选择”之后发生的，全程围绕这个选择；绝不能写成他没做这件事、或改去做了别的事。",
  "【可以自由发挥】具体经历、遇到的人、起伏与转折、最终结局都由你定，可以大胆、可以有意外；开头不必从“现在在上班”写起，也不必逐条复述背景。",
  "风格像小说，有画面感、情感真实。这是一种可能性，不是预测或保证，别说教、别算命腔。",
  "全部用中文。只输出 JSON 本身，不要用代码块包裹，不要任何解释文字。",
].join("");

function arcHint(curve: CurveShape): string {
  switch (curve) {
    case "rise-steep":
      return "整体往上走，而且后程会有明显的腾飞。";
    case "rise-gentle":
      return "整体是稳步向上的。";
    case "decline":
      return "整体在走下坡，但下坡里也可能有别的收获。";
    case "dip-rise":
      return "先抑后扬：中途有低谷，后面会爬起来。";
    case "flat":
      return "起伏不大，大体平稳。";
  }
}

function buildUserPrompt(input: EnrichInput): string {
  const p = input.profile;
  const lo = input.startAge + 1;
  const hi = input.startAge + input.horizonYears;

  const bg: string[] = [];
  bg.push(`${input.startAge} 岁`);
  bg.push(EDUCATION_LABELS[p.education] + (p.major ? `（${p.major}）` : ""));
  if (p.occupation) bg.push(p.occupation);
  bg.push(`月薪${SALARY_LABELS[p.salary]}`);
  if (p.hasSideHustle) bg.push(p.sideHustle ? `副业:${p.sideHustle}` : "有副业");
  if (p.hobbies) bg.push(`爱好:${p.hobbies}`);
  bg.push(RELATIONSHIP_LABELS[p.relationship]);
  if (p.snapshot) bg.push(p.snapshot);

  const choiceText =
    input.kind === "status-quo" ? "维持现状、不做大的改变" : input.choiceLabel;

  const lines: string[] = [];
  lines.push(`主角姓名：${p.name}（全程必须用这个名字）。`);
  lines.push(`背景（参考用，不必逐条写进去）：${bg.join("、")}。`);
  lines.push(`${p.name} 做出的选择：${choiceText}。`);
  lines.push("");
  lines.push(
    `请写 ${p.name} 做了“${choiceText}”这个选择之后、约 ${input.horizonYears} 年里的人生，全程围绕这个选择展开。整体走向：${arcHint(input.curve)}`,
  );
  lines.push("");
  const firstBeat =
    input.kind === "status-quo"
      ? `第一个时刻写 ${p.name} 意识到自己决定就这样走下去的那一刻`
      : `第一个时刻就写 ${p.name} 真正开始“${choiceText}”的那一刻（例如读研=拿到录取/入学，开店=盘下店面/开业，跳槽=入职新公司）`;
  lines.push(
    `请你自己决定这段人生里 3-5 个关键转折点：每个点的年龄（在 ${lo} 到 ${hi} 岁之间、按先后排列、不重复）、当时是高光(high)/平稳(mid)/低谷(low)、发生了什么。${firstBeat}；之后的每个时刻都是这条路上接着发生的后续，连起来大致符合上面的“整体走向”，但具体怎么走由你发挥。`,
  );
  lines.push("");
  lines.push("只输出如下结构的 json：");
  lines.push(jsonExample(p.name, lo, hi));
  lines.push("");
  lines.push(
    `要求：summary ≤ 25 字，一句话点出这条路最后把 ${p.name} 带到了哪里；每个 node 的 title ≤ 12 字，story 用 1-3 句、有画面感、自然带到 ${p.name}。`,
  );
  return lines.join("\n");
}

// DeepSeek 的 json 模式需要一个形状示例。
function jsonExample(name: string, lo: number, hi: number): string {
  const a1 = Math.min(hi, lo + 2);
  const a2 = Math.min(hi, lo + 7);
  return `{
  "summary": "一句话结局",
  "nodes": [
    {"age": ${a1}, "title": "小标题", "story": "一两句关于${name}的、有画面感的叙述", "mood": "low"},
    {"age": ${a2}, "title": "小标题", "story": "……", "mood": "high"}
  ]
}`;
}

function getKey(): string | null {
  const k = process.env.DEEPSEEK_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

// reasoner（R1）不支持 json 模式/temperature，且更慢——单独处理。
const IS_REASONER = /reasoner/i.test(MODEL);

// 从模型输出里稳妥地抠出 JSON（兼容裸 JSON、```json 代码块、夹带解释的情况）。
function extractJson(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return body.slice(start, end + 1);
}

export function isEnrichEnabled(): boolean {
  return getKey() !== null;
}

export async function enrichPath(input: EnrichInput): Promise<EnrichOut | null> {
  const key = getKey();
  if (!key) return null;

  const body: Record<string, unknown> = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildUserPrompt(input) },
    ],
    max_tokens: IS_REASONER ? 2200 : 1800,
    stream: false,
  };
  if (!IS_REASONER) {
    // 仅普通 chat 模型支持：JSON 模式 + 温度。reasoner 都不支持。
    body.response_format = { type: "json_object" };
    body.temperature = 0.8; // 差异来自"模型自选转折点"，温度低一点更扣题、中文更顺
  }

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(IS_REASONER ? 90000 : 30000), // reasoner 更慢
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
    const json = extractJson(content);
    if (!json) return null;
    return EnrichOut.parse(JSON.parse(json));
  } catch (e) {
    console.error("[enrich] generation failed, falling back to local text:", e);
    return null;
  }
}
