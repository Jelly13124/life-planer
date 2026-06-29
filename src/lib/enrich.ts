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
  backgroundFacts,
  financialFacts,
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

export const MAX_FORK_DELAY = 10; // AI 决定的"几年后分叉"上限

const EnrichOut = z.object({
  // AI 自己判断：现实里这条路大约几年后才真正开始（0 = 现在/今年就走）。
  forkDelayYears: z.number().int().min(0).max(MAX_FORK_DELAY).default(0),
  // 现实可行度：从主角真实起点到这条路要求的差距——对他多够得着（仅 choice 有意义）。
  feasibility: z.number().int().min(0).max(100).default(50),
  feasibilityNote: z.string().default(""),
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
  currentAge: number; // 他现在的真实年龄（"现在"的锚点）
  startAge: number; // 这条路的起点年龄：子分支=固定分叉点；根分支=占位，AI 可重定
  horizonYears: number;
  choiceLabel: string;
  kind: PathKind;
  curve: CurveShape; // 仅用来给模型一个"整体走向"的轻提示
  scenario?: "optimistic" | "likely" | "conservative"; // 走向变体
  canRetime?: boolean; // 是否允许 AI 决定"几年后才分叉"（根分支的选择=true）
  lang?: "zh" | "en"; // 生成语言：跟随用户界面语言
  note?: string; // 用户补充/更正（最高优先级，用来修正时间/前提后重新推演）
}

// 系统提示：做"贴着真实的你"的推演——只往未来写、不和已知现状矛盾、守现实约束、克制可信。
const SYSTEM = [
  "你在为一款人生探索产品做一段贴近现实的人生推演。我会给你一个真实的人现在的情况，以及他在考虑的一个选择；",
  "你推演：如果他从现在起做这个选择，未来十几年可能怎么走，拆成几个关键时刻。",
  "有时我会先让你判断：现实里这条路大约要几年后才真正开始（筹备/积蓄/申请/签证/人生节奏），把这个年数填进 forkDelayYears，再从那个时间点往后写。",
  "【必须遵守的硬约束】",
  "1. 主角姓名严格用我给的名字，绝不改名。",
  "2. 只写未来：所有时刻的年龄都必须 ≥ 这条路的起点、且不小于他现在的年龄，绝不重写、不编造、不否定他的过去。",
  "3. 绝不与他已知的现状矛盾——他已达成的、身份/签证、所在地都要当作既定事实。例：他已读完研、在国外持工作签，就不要写他辍学、还在读、或无视签证限制。",
  "4. 尊重现实规律：签证身份、行业现实、时间、金钱、年龄阶段都要讲得通。",
  "5. 【禁用词表——出现任意一个即判为不合格，必须重写】：进了大厂、走上人生巅峰、实现逆袭、财务自由、开启新篇章、迎来转机、被更多人看见、走出自己的路、命运的齿轮、人生赢家、稳步上升、一路高歌。要写高薪/升职/买房/成功，一律换成具体数字+具体主体（公司名/职级/城市/金额/年份），不准用形容词代替事实。",
  "6. 禁止预言腔：不准用一定、必然、注定、铁定、命中注定等保证性措辞；统一用很可能、大概率、也许这类概率语气。",
  "风格：克制、可信，普通人真实生活的质感。可以有起伏和转折，但不要爽文/逆袭套路（别动不动就辍学创业然后上市）。像一段真实的人生，不是电影。",
  "可以自由发挥的是：具体经历、遇到的人、起落与结局——只要都扎根在他的真实处境里。",
  "只输出 JSON 本身，不要用代码块包裹，不要任何解释文字。",
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

// 仅当现状里出现美国/工作签/绿卡等线索时，才注入这套真实时间线，避免对不相关的路写错事实。
function isUSVisa(p: Profile): boolean {
  const s = `${p.location} ${p.status}`.toLowerCase();
  return /美国|united states|\bus\b|usa|h1b|h-1b|opt|绿卡|green card|签证|visa|移民/.test(s);
}
const VISA_US_FACTS = [
  "【美国工作签事实校准——按此推演，不得写错时间线】：",
  "H1B 抽签命中率近年约 25–30%，可能多年抽不中；中签后身份最长 6 年；STEM OPT 最长 3 年。",
  "绿卡流程顺序：雇主 PERM 劳工证（约 1–2 年，可能被审计）→ I-140 → 排期（priority date）→ I-485/绿卡；绿卡满 5 年方可入籍。",
  "排期按出生国分：非中印（ROW）通常 1–3 年内可办；中国大陆 EB2/EB3 约 4–7 年；印度 EB2/EB3 普遍 8 年以上。若不知出生国，就把这种依赖关系写进故事（如排期取决于出生国）。",
  "换雇主多数要重走 PERM。把 identity 维度的每个时刻落在上述真实里程碑上，并写出对应年份。",
].join("\n");

function buildUserPrompt(input: EnrichInput): string {
  const p = input.profile;
  const now = input.currentAge;
  // 子分支/维持现状：起点固定。根分支的选择：起点由 AI 决定（now + forkDelayYears）。
  const canRetime = Boolean(input.canRetime) && input.kind === "choice";
  const fixedStart = input.startAge;
  const lo = (canRetime ? now : fixedStart) + 1;
  const hi = (canRetime ? now + MAX_FORK_DELAY : fixedStart) + input.horizonYears;

  // 现状要点（既定事实，不可矛盾）
  const facts: string[] = [];
  facts.push(...backgroundFacts(p)); // 国籍/出生国：用于签证排期等现实校准
  facts.push(`${EDUCATION_LABELS[p.education]}${p.major ? `（${p.major}）` : ""}`);
  if (p.occupation) facts.push(`职业：${p.occupation}`);
  facts.push(`月薪${SALARY_LABELS[p.salary]}`);
  if (p.hasSideHustle) facts.push(p.sideHustle ? `副业：${p.sideHustle}` : "有副业");
  if (p.hobbies) facts.push(`爱好：${p.hobbies}`);
  facts.push(`情感：${RELATIONSHIP_LABELS[p.relationship]}`);
  if (p.snapshot) facts.push(`自述：${p.snapshot}`);
  facts.push(...financialFacts(p));

  const choiceText =
    input.kind === "status-quo" ? "维持现状、不做大的改变" : input.choiceLabel;

  const lines: string[] = [];
  lines.push(`主角姓名：${p.name}（全程用这个名字）。`);
  lines.push(`他现在 ${now} 岁${p.location ? `，生活在${p.location}` : ""}${p.status ? `，身份/阶段：${p.status}` : ""}。`);
  lines.push(`现状（既定事实，推演不能与之矛盾）：${facts.join("；")}。`);
  if (isUSVisa(p)) lines.push(VISA_US_FACTS);
  lines.push("");
  if (input.note?.trim()) {
    lines.push(
      `【用户补充/更正——最高优先级，必须据此调整，尤其是时间起点与前提条件】：${input.note.trim()}`,
    );
    lines.push("");
  }
  if (canRetime) {
    lines.push(
      `第一步·定时机：现实里，${p.name} 从现在（${now} 岁）算起，大约几年后才会真正走上「${choiceText}」这条路？综合筹备、积蓄、申请/签证周期、家庭与人生节奏，给一个现实的年数，填进 forkDelayYears（0 到 ${MAX_FORK_DELAY}；现在/今年就能开始填 0）。这条路的「起点年龄」= ${now} + forkDelayYears。`,
    );
    lines.push(
      `第二步·写人生：从「起点年龄」开始推演，如果 ${p.name} 走「${choiceText}」，往后约 ${input.horizonYears} 年会怎样。整体走向：${arcHint(input.curve)}`,
    );
  } else {
    lines.push(
      `请推演：${p.name} 从 ${fixedStart} 岁起（forkDelayYears 填 0），如果选择「${choiceText}」，往后约 ${input.horizonYears} 年会怎样。整体走向：${arcHint(input.curve)}`,
    );
    // 仅对"同一选择的另一种走向"(乐观/保守变体)才提示对齐基准；维持现状/子分支不适用。
    if (input.scenario && input.scenario !== "likely") {
      lines.push("这是同一选择的另一种走向：前一两个关键时刻紧贴起点、与基准走向时间一致，分歧主要体现在后段经历与结局。");
    }
  }
  if (input.scenario === "optimistic")
    lines.push("按偏顺利、运气较好但仍现实可信的走向来写；即便如此，整条仍至少保留 2 处真实挫折（顺利不等于无摩擦）。");
  else if (input.scenario === "conservative")
    lines.push("按偏不顺、磕磕绊绊、运气一般但依然真实的走向来写。");
  lines.push("");
  const firstBeat =
    input.kind === "status-quo"
      ? `第一个时刻写他从现在起、按原轨道继续走的第一步`
      : `第一个时刻写他在「起点」迈出的第一步：为「${choiceText}」真正动手的那一步（要符合他那时的真实身份与所在地）`;
  lines.push(
    `自己决定 6-10 个关键转折点：年龄都 > 这条路的「起点年龄」、且落在 ${lo}–${hi} 岁范围内（按先后排列、不重复，靠近起点的更密）；每个点标 高光(high)/平稳(mid)/低谷(low)。${firstBeat}；之后每个时刻是接着发生的后续，连起来大致符合“整体走向”。`,
  );
  lines.push("");
  lines.push("【真实与细致的硬要求】");
  lines.push(
    "- 现实锚点：用具体、真实、可核对的细节，禁止空话（如“进了大厂/走上巅峰/逆袭”）。按主角的领域、所在国、出生国来落地——只有当这条路真的涉及移民/签证时才写签证里程碑；涉及薪资写当地真实档位与数字；写真实的职业层级、城市、行业现实。",
  );
  lines.push(
    "- 现实锚点（整条至少满足）：(a) 仅当涉及签证/移民时，至少 2 个真实身份里程碑并写出大致年份（按出生国排期，如有）；(b) 至少 2 处具体收入数字（职级/阶段 + 金额 + 当地币种，按主角所在国与领域的真实口径——如中国大厂 P7 总包约 ¥80–120 万、美国 SWE L5 总包约 $360k、体制内某职级月薪 + 公积金、个体/创业写月营收或年流水）；(c) 至少 1 个真实公司/机构/平台名——优先直接点名该领域真实存在的公司/平台，确实不确定才用同量级的具体描述，但不要用“如某公司”这类含糊措辞；(d) 至少 2 个具体城市/地点。",
  );
  lines.push(
    "- 每个涉及晋升/进阶的时刻必须写出该领域、该国家的真实层级名称 + 对应收入变化，禁止只写“升职了/翻倍”。按主角实际领域选阶梯，例如：中国互联网 P5/P6/P7 或 T 序列；体制内 科员→副科→正科 或 职称评定；创业 天使/Pre-A/A 轮、月营收 0→X、团队 1→N 人、盈亏平衡；教师/医生 规培→主治→副高 或 二级→一级教师；学术 博后→AP→tenure；美国科技 SWE→Senior→Staff；金融 Analyst→Associate→VP。",
  );
  lines.push(
    `- 每段 story 必须至少 3 个完整句子（少于 3 句判为不合格），3-5 句为宜；每段至少含：一个具体的人或机构、一个具体数字、以及一处真实的内心戏——不是再多一个事实，而是他当下的情绪/犹豫/疲惫/欣慰/不甘等真实感受或一个身体感官细节（如手在抖、整夜没睡、松了口气），让人能共情。并标注 dimensions（从 career/finance/relationships/health/housing/identity/growth 选 1-2 个该时刻主要触及的维度）。`,
  );
  lines.push(
    "- 多维度：整条至少覆盖 4 个不同维度；finance（财务）必须出现；若他在国外/有签证，identity（身份/签证）也必须出现。若不涉及移民/签证，identity 可不出现，改用其所在国的真实约束（如中国的户口/编制/学区房/行业周期/家庭期待）作为现实摩擦与锚点。",
  );
  lines.push(
    "- 真实摩擦（每条至少 2 处，乐观路也不例外）：从签证没中要再等、晋升被卡或被 PIP、裁员/组被裁、排期倒退、房租房价压力、异地恋/分手、健康透支中至少选 2 个写成有后果的事件，而非一笔带过。",
  );
  lines.push(
    "- 因果承接：从第 2 个时刻起，每段开头点明它是前一时刻的直接结果（如：因为上一年 PERM 卡在审计，这一年……），不要互不相干的片段。",
  );
  lines.push(
    "- 金额用主角所在国/文化的真实货币与口径（中国用人民币、美国用美元年总包、欧洲欧元……）；表单里的月薪区间只是现状参考，推演里要写当地真实的具体数字，别照抄区间、也别默认套美元。每个金额紧跟其所在城市/国家；跨国流动时显式切换币种并说明原因。",
  );
  lines.push("- 克制可信、扎根现实，有真实的摩擦（如抽签没中、晋升卡壳），不要爽文。");
  if (input.kind === "choice") {
    lines.push("");
    lines.push(
      "评估这条路的【现实可行度】feasibility(0-100 整数)：衡量从主角真实起点（技能/资源/积蓄/约束/当前阶段）到这条路要求之间的差距——对他有多够得着。要校准、别都打高分：起点弱却要大跨越→低；顺势而为/已有基础→高。注意：可行度评估的是这条路本身的现实门槛，不随乐观/保守走向变化（同一选择的不同走向可行度应基本一致）。再给一句 ≤20 字的依据 feasibilityNote（如『有设计功底+已起号，但变现门槛高』）。",
    );
  }
  lines.push("");
  lines.push("只输出如下结构的 json：");
  lines.push(jsonExample(p.name, lo, hi));
  lines.push("");
  lines.push(
    `要求：summary 严格 ≤ 25 字——用一句话写这条路最后把 ${p.name} 带到的「最终去向/状态」，要贴着最后一两个 node 的真实结局。【硬约束】不要列时间线里程碑、不要写成"X岁…Y岁…"的流水账、绝不出现任何年龄或年份数字（这是 summary 最常出错的地方，容易和 nodes 冲突）；重在结局而非过程。每个 node 的 title ≤ 12 字、具体不空泛；绝不与他的现状矛盾。`,
  );
  // 语言：跟随用户界面语言（默认中文）
  lines.push(
    input.lang === "en"
      ? "LANGUAGE: write every JSON string value (summary, title, story) in natural, fluent English. Keep all ages as numbers and keep the JSON keys in English exactly as shown."
      : "语言：所有 JSON 字符串（summary / title / story）一律用简体中文。",
  );
  return lines.join("\n");
}

// DeepSeek 的 json 模式需要一个形状示例。
function jsonExample(name: string, lo: number, hi: number): string {
  const a1 = Math.min(hi, lo + 1);
  const a2 = Math.min(hi, lo + 5);
  return `{
  "forkDelayYears": 2,
  "feasibility": 45,
  "feasibilityNote": "一句依据",
  "summary": "一句话结局",
  "nodes": [
    {"age": ${a1}, "title": "小标题", "story": "至少 3 个完整句子、关于${name}的叙述，含具体人/机构、具体数字、一处内心或细节", "mood": "low", "dimensions": ["career", "identity"]},
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
