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

const DIMS = [
  "career",
  "finance",
  "relationships",
  "health",
  "housing",
  "identity",
  "growth",
] as const;

const EnrichOut = z.object({
  summary: z.string(),
  nodes: z.array(
    z.object({
      age: z.number(),
      title: z.string(),
      story: z.string(),
      mood: z.enum(["high", "mid", "low"]),
      dimensions: z.array(z.enum(DIMS)).default([]),
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
  scenario?: "optimistic" | "likely" | "conservative"; // 走向变体
}

// 系统提示：做"贴着真实的你"的推演——只往未来写、不和已知现状矛盾、守现实约束、克制可信。
const SYSTEM = [
  "你在为一款人生探索产品做一段贴近现实的人生推演。我会给你一个真实的人现在的情况，以及他在考虑的一个选择；",
  "你推演：如果他从现在起做这个选择，未来十几年可能怎么走，拆成几个关键时刻。",
  "【必须遵守的硬约束】",
  "1. 主角姓名严格用我给的名字，绝不改名。",
  "2. 只写未来：所有时刻的年龄都必须大于他现在的年龄，绝不重写、不编造、不否定他的过去。",
  "3. 绝不与他已知的现状矛盾——他已达成的、身份/签证、所在地都要当作既定事实。例：他已读完研、在国外持工作签，就不要写他辍学、还在读、或无视签证限制。",
  "4. 尊重现实规律：签证身份、行业现实、时间、金钱、年龄阶段都要讲得通。",
  "风格：克制、可信，普通人真实生活的质感。可以有起伏和转折，但不要爽文/逆袭套路（别动不动就辍学创业然后上市）。像一段真实的人生，不是电影。",
  "可以自由发挥的是：具体经历、遇到的人、起落与结局——只要都扎根在他的真实处境里。",
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
  const now = input.startAge;
  const lo = now + 1;
  const hi = now + input.horizonYears;

  // 现状要点（既定事实，不可矛盾）
  const facts: string[] = [];
  facts.push(`${EDUCATION_LABELS[p.education]}${p.major ? `（${p.major}）` : ""}`);
  if (p.occupation) facts.push(`职业：${p.occupation}`);
  facts.push(`月薪${SALARY_LABELS[p.salary]}`);
  if (p.hasSideHustle) facts.push(p.sideHustle ? `副业：${p.sideHustle}` : "有副业");
  if (p.hobbies) facts.push(`爱好：${p.hobbies}`);
  facts.push(`情感：${RELATIONSHIP_LABELS[p.relationship]}`);
  if (p.snapshot) facts.push(`自述：${p.snapshot}`);

  const choiceText =
    input.kind === "status-quo" ? "维持现状、不做大的改变" : input.choiceLabel;

  const lines: string[] = [];
  lines.push(`主角姓名：${p.name}（全程用这个名字）。`);
  lines.push(`他现在 ${now} 岁${p.location ? `，生活在${p.location}` : ""}${p.status ? `，身份/阶段：${p.status}` : ""}。`);
  lines.push(`现状（既定事实，推演不能与之矛盾）：${facts.join("；")}。`);
  lines.push("");
  lines.push(
    `请推演：${p.name} 从现在（${now} 岁）起，如果选择「${choiceText}」，未来约 ${input.horizonYears} 年的人生会怎么走。整体走向：${arcHint(input.curve)}`,
  );
  if (input.scenario === "optimistic")
    lines.push("按偏顺利、运气较好但仍现实可信的走向来写。");
  else if (input.scenario === "conservative")
    lines.push("按偏不顺、磕磕绊绊、运气一般但依然真实的走向来写。");
  lines.push("");
  const firstBeat =
    input.kind === "status-quo"
      ? `第一个时刻写他从现在起、按原轨道继续走的第一步`
      : `第一个时刻写他从现在的处境出发、为「${choiceText}」迈出的第一步（要符合他现在的真实身份与所在地）`;
  lines.push(
    `自己决定 6-10 个关键转折点：年龄都在 ${lo} 到 ${hi} 岁之间（必须大于他现在的 ${now} 岁、按先后排列、不重复，靠近现在的更密）；每个点标 高光(high)/平稳(mid)/低谷(low)。${firstBeat}；之后每个时刻是接着发生的后续，连起来大致符合上面的“整体走向”。`,
  );
  lines.push("");
  lines.push("【真实与细致的硬要求】");
  lines.push(
    "- 现实锚点：用具体、真实、可核对的细节，禁止空话（如“进了大厂/走上巅峰/逆袭”）。涉及签证就写真实里程碑（H1B 6 年上限/抽签/PERM/I-140/绿卡排期/入籍）；涉及薪资写真实档位与数字；写真实的职业层级、城市、行业现实。",
  );
  lines.push(
    `- 每段 story 要 3-5 句，含至少：一个具体的人或机构、一个具体数字、一处内心或细节；并标注 dimensions（从 career/finance/relationships/health/housing/identity/growth 选 1-2 个该时刻主要触及的维度）。`,
  );
  lines.push(
    "- 多维度：整条至少覆盖 4 个不同维度；finance（财务）必须出现；若他在国外/有签证，identity（身份/签证）也必须出现。",
  );
  lines.push("- 克制可信、扎根现实，有真实的摩擦（如抽签没中、晋升卡壳），不要爽文。");
  lines.push("");
  lines.push("只输出如下结构的 json：");
  lines.push(jsonExample(p.name, lo, hi));
  lines.push("");
  lines.push(
    `要求：summary ≤ 25 字，点出这条路最后把 ${p.name} 带到了哪里；每个 node 的 title ≤ 12 字；绝不与他的现状矛盾。`,
  );
  return lines.join("\n");
}

// DeepSeek 的 json 模式需要一个形状示例。
function jsonExample(name: string, lo: number, hi: number): string {
  const a1 = Math.min(hi, lo + 1);
  const a2 = Math.min(hi, lo + 5);
  return `{
  "summary": "一句话结局",
  "nodes": [
    {"age": ${a1}, "title": "小标题", "story": "3-5 句、关于${name}的、有具体人/数字/细节的叙述", "mood": "low", "dimensions": ["career", "identity"]},
    {"age": ${a2}, "title": "小标题", "story": "……", "mood": "high", "dimensions": ["finance"]}
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
    body.temperature = 0.7; // 偏低：要克制可信、扎根现实，别飘成爽文
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
