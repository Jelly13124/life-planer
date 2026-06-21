// 服务端：从用户现状建议几个值得追的目标（新嵌套模型：不再有 长期/短期 horizon，
// 只是 area/title/why 的目标雏形）。无 key 时给通用兜底，让规划主线离线也能用。带限流。
import { allowRequest } from "@/lib/rateLimit";
import { LIFE_AREAS, type LifeArea } from "@/domain/types";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface Body {
  profileSummary: string;
  choices: string[];
  lang?: "zh" | "en";
}

// 目标雏形 DTO：嵌套模型下的一个目标（领域 + 标题 + 为什么）。
// 子目标/指标/任务/习惯由用户在 PlanScreen 里继续展开，建议接口只给目标本体。
interface GoalSuggestionDTO {
  area: LifeArea;
  title: string;
  why: string;
}

const FALLBACK: GoalSuggestionDTO[] = [
  { area: "career", title: "在本行做到能独当一面", why: "三年内成为团队里靠得住的人" },
  { area: "wealth", title: "攒够半年生活的应急金", why: "有底气才敢做选择" },
  { area: "growth", title: "每周留 5 小时学新技能", why: "为长期目标攒底气" },
  { area: "health", title: "每周运动三次", why: "状态是一切的本钱" },
];

function getKey(): string | null {
  const k = process.env.DEEPSEEK_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

function extractJson(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const s = body.indexOf("{");
  const e = body.lastIndexOf("}");
  return s === -1 || e === -1 || e < s ? null : body.slice(s, e + 1);
}

function normalize(raw: { area?: unknown; title?: unknown; why?: unknown }[]): GoalSuggestionDTO[] {
  return raw
    .map((g) => {
      const area = String(g.area ?? "") as LifeArea;
      return {
        area: LIFE_AREAS.includes(area) ? area : "growth",
        title: String(g.title ?? "").trim(),
        why: String(g.why ?? "").trim(),
      };
    })
    .filter((g) => g.title)
    .slice(0, 5);
}

export async function POST(request: Request) {
  // 限流命中：不调用大模型（仍保护 key），但仍返回通用兜底，让用户有东西可用。
  if (!allowRequest(request, Date.now())) {
    return Response.json({ goals: FALLBACK });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ goals: FALLBACK }, { status: 400 });
  }
  const key = getKey();
  if (!key) return Response.json({ goals: FALLBACK });

  const system = [
    "你在帮一个想认真规划人生的人，提炼几个值得追的目标。",
    "给出 3-5 个目标：有的偏长期方向（跨度数年），有的偏近期可推进（几周到几个月），但都只描述目标本身。",
    "每个目标：area 从 career/wealth/relationships/health/growth 里选一个最贴的；title 是一个具体、可执行的短语（≤12字）；why 一句话点出为什么值得他追（≤25字）。",
    "彼此方向不同，扣住他的现状，别空泛（不要「走上人生巅峰」这种）。",
    body.profileSummary ? `这个人的现状：${body.profileSummary}。` : "",
    body.choices?.length ? `他正在考虑的路：${body.choices.join("、")}。` : "",
    body.lang === "en"
      ? "LANGUAGE: write title and why in natural English (title ≤ 6 words, why ≤ 12 words). Keep area values in English exactly as specified."
      : "语言：title 与 why 用简体中文。area 用给定的英文枚举值。",
    "只输出如下 json，不要任何解释或代码块：",
    '{"goals":[{"area":"career","title":"短语","why":"一句话理由"}]}',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: "给我几个值得追的目标。" },
        ],
        response_format: MODEL.includes("reasoner") ? undefined : { type: "json_object" },
        max_tokens: 800,
        temperature: 0.9,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[goals] DeepSeek ${res.status}`);
      return Response.json({ goals: FALLBACK });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json({ goals: FALLBACK });
    const parsed = JSON.parse(json) as { goals?: { area?: unknown; title?: unknown; why?: unknown }[] };
    const out = normalize(parsed.goals || []);
    return Response.json({ goals: out.length ? out : FALLBACK });
  } catch (e) {
    console.error("[goals] failed:", e);
    return Response.json({ goals: FALLBACK });
  }
}
