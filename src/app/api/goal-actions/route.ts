// 服务端：把一个目标拆成 3-5 条可勾选的近期行动。无 key 时给通用兜底。带限流。
import { allowRequest } from "@/lib/rateLimit";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface Body {
  goalTitle: string;
  why?: string;
  area?: string;
  horizon?: "short" | "long";
  profileSummary?: string;
  lang?: "zh" | "en";
}

const FALLBACK_ZH = ["把目标拆成这周能动手的第一步", "找一个已经做到的人聊 20 分钟", "定个能检验进展的小里程碑"];
const FALLBACK_EN = [
  "Break it into a first step you can do this week",
  "Talk 20 minutes with someone who already did it",
  "Set a small milestone to check your progress",
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

export async function POST(request: Request) {
  const fb = (lang?: string) => (lang === "en" ? FALLBACK_EN : FALLBACK_ZH);
  // 限流命中：不调用大模型（仍保护 key），但仍返回通用兜底（语言未知，默认中文）。
  if (!allowRequest(request, Date.now())) {
    return Response.json({ actions: fb() });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ actions: fb() }, { status: 400 });
  }
  const key = getKey();
  if (!key || !body.goalTitle?.trim()) return Response.json({ actions: fb(body?.lang) });

  const system = [
    `把目标「${body.goalTitle.trim()}」拆成 3-5 条具体、可勾选、近期就能动手的行动。`,
    body.why ? `这个目标对他的意义：${body.why}。` : "",
    body.profileSummary ? `他的现状：${body.profileSummary}。` : "",
    "每条以动词开头、足够具体（能判断做没做完），别空泛。",
    body.lang === "en"
      ? "LANGUAGE: write each action in natural English, starting with a verb (≤ 12 words)."
      : "语言：每条用简体中文，动词开头，≤20字。",
    "只输出如下 json，不要任何解释或代码块：",
    '{"actions":["第一条","第二条"]}',
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
          { role: "user", content: "拆成行动。" },
        ],
        response_format: MODEL.includes("reasoner") ? undefined : { type: "json_object" },
        max_tokens: 500,
        temperature: 0.8,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[goal-actions] DeepSeek ${res.status}`);
      return Response.json({ actions: fb(body.lang) });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json({ actions: fb(body.lang) });
    const parsed = JSON.parse(json) as { actions?: unknown[] };
    const actions = (parsed.actions || [])
      .map((a) => String(a ?? "").trim())
      .filter(Boolean)
      .slice(0, 5);
    return Response.json({ actions: actions.length ? actions : fb(body.lang) });
  } catch (e) {
    console.error("[goal-actions] failed:", e);
    return Response.json({ actions: fb(body.lang) });
  }
}
