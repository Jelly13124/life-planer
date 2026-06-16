// 服务端：让规划助手"铺开几条值得探索的路"——返回结构化的候选选择，
// 前端渲染成确认按钮，用户点一下才真正画上（确认优先）。
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface Body {
  profileSummary: string;
  choices: string[]; // 树上已有的选择，避免重复
  lang?: "zh" | "en";
}

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
  const key = getKey();
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ suggestions: [] }, { status: 400 });
  }
  if (!key) return Response.json({ suggestions: [] });

  const system = [
    "你在帮一个处于迷茫期的人，铺开几条他值得探索的人生选择。",
    "给出 3-4 条具体、彼此不同方向的选择（参考 Odyssey：几条现实的替代路 + 一条更大胆的）。",
    "每条 label 是一个具体可执行的短语（≤12字，例如：去读个在职硕士 / 搬去成都 / 先 gap 一年），why 用一句话点出为什么值得他考虑（≤25字）。",
    body.profileSummary ? `这个人的现状：${body.profileSummary}。` : "",
    body.choices?.length ? `已经在考虑的路（不要重复）：${body.choices.join("、")}。` : "",
    body.lang === "en"
      ? "LANGUAGE: write label and why in natural, fluent English (label ≤ 6 words, why ≤ 12 words)."
      : "语言：label 与 why 用简体中文。",
    "只输出如下 json，不要任何解释或代码块：",
    '{"suggestions":[{"label":"短语","why":"一句话理由"}]}',
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
          { role: "user", content: "给我铺开几条路。" },
        ],
        response_format: MODEL.includes("reasoner") ? undefined : { type: "json_object" },
        max_tokens: 700,
        temperature: 1.0,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[suggest-paths] DeepSeek ${res.status}`);
      return Response.json({ suggestions: [] });
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json({ suggestions: [] });
    const parsed = JSON.parse(json) as {
      suggestions?: { label?: unknown; why?: unknown }[];
    };
    const suggestions = (parsed.suggestions || [])
      .map((s) => ({ label: String(s.label ?? "").trim(), why: String(s.why ?? "").trim() }))
      .filter((s) => s.label)
      .slice(0, 4);
    return Response.json({ suggestions });
  } catch (e) {
    console.error("[suggest-paths] failed:", e);
    return Response.json({ suggestions: [] });
  }
}
