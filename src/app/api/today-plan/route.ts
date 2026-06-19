// 服务端：从"还没完成的行动"里挑今天最该做的≤3条。无 key/限流时本地兜底。
import { allowRequest } from "@/lib/rateLimit";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface PendingItem {
  id: string;
  text: string;
  goalTitle: string;
}
interface Body {
  profileSummary?: string;
  pending?: PendingItem[];
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

// 兜底：跨不同目标各取第一条、最多 3 条，给通用理由。
function localPick(pending: PendingItem[], lang?: string): { id: string; why: string }[] {
  const why = lang === "en" ? "A small step you can finish today" : "今天就能推进的一小步";
  const seen = new Set<string>();
  const spread: PendingItem[] = [];
  for (const p of pending) {
    if (!seen.has(p.goalTitle)) {
      seen.add(p.goalTitle);
      spread.push(p);
    }
  }
  return (spread.length ? spread : pending).slice(0, 3).map((p) => ({ id: p.id, why }));
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ pick: [] }, { status: 400 });
  }
  const pending = Array.isArray(body.pending) ? body.pending.filter((p) => p?.id && p?.text) : [];
  if (!pending.length) return Response.json({ pick: [] });

  const key = getKey();
  if (!allowRequest(request, Date.now()) || !key) {
    return Response.json({ pick: localPick(pending, body.lang) });
  }

  const list = pending.map((p) => `- [${p.id}] ${p.text}（来自目标：${p.goalTitle}）`).join("\n");
  const system = [
    "从下面这些还没完成的行动里，挑出今天最值得做的最多 3 条，帮一个人把今天过得有进展。",
    "优先：能马上动手的、能解锁后续的、跨不同目标平衡推进。",
    body.profileSummary ? `他的现状：${body.profileSummary}。` : "",
    "每条给出它的 id 和一句话理由（≤20字）。只能从给定 id 里选，不要编新行动。",
    body.lang === "en"
      ? "LANGUAGE: write each why in natural English (≤ 12 words)."
      : "语言：理由用简体中文。",
    "只输出如下 json，不要解释或代码块：",
    '{"pick":[{"id":"行动id","why":"一句话理由"}]}',
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
          { role: "user", content: `这些是待办行动：\n${list}` },
        ],
        response_format: MODEL.includes("reasoner") ? undefined : { type: "json_object" },
        max_tokens: 400,
        temperature: 0.6,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[today-plan] DeepSeek ${res.status}`);
      return Response.json({ pick: localPick(pending, body.lang) });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json({ pick: localPick(pending, body.lang) });
    const parsed = JSON.parse(json) as { pick?: { id?: unknown; why?: unknown }[] };
    const valid = new Set(pending.map((p) => p.id));
    const pick = (parsed.pick || [])
      .map((x) => ({ id: String(x.id ?? "").trim(), why: String(x.why ?? "").trim() }))
      .filter((x) => valid.has(x.id))
      .slice(0, 3);
    return Response.json({ pick: pick.length ? pick : localPick(pending, body.lang) });
  } catch (e) {
    console.error("[today-plan] failed:", e);
    return Response.json({ pick: localPick(pending, body.lang) });
  }
}
