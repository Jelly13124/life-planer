// 服务端：把今天的行动排进不重叠的时间块（运动放早晚、学习放精力好的时段、三餐合理）。
// 无 key/限流/出错/网络故障时，回退到确定性的本地 arrangeDay，永远给得出可用的一天。
import { allowRequest } from "@/lib/rateLimit";
import { arrangeDay, DEFAULT_DAY_START, DEFAULT_DAY_END } from "@/domain/schedule";
import type { ArrangeResult } from "@/domain/schedule";
import { completeDeepSeek, extractJson, getDeepSeekKey } from "@/lib/deepseek";

interface ArrangeInput {
  id: string;
  text: string;
  durationMin?: number;
}
interface Body {
  items?: ArrangeInput[];
  start?: string;
  end?: string;
  lang?: "zh" | "en";
}

// 兜底：用确定性的本地贪心顺排，保证一定排得出不重叠的一天。
function localPlan(items: ArrangeInput[], start: string, end: string): ArrangeResult[] {
  return arrangeDay(
    items.map((i) => ({ id: i.id, durationMin: i.durationMin })),
    { start, end },
  );
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ plan: [] }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items.filter((i) => i?.id && i?.text) : [];
  if (!items.length) return Response.json({ plan: [] });

  const start = body.start && /^\d{2}:\d{2}$/.test(body.start) ? body.start : DEFAULT_DAY_START;
  const end = body.end && /^\d{2}:\d{2}$/.test(body.end) ? body.end : DEFAULT_DAY_END;

  if (!getDeepSeekKey()) return Response.json({ plan: localPlan(items, start, end) });
  if (!allowRequest(request, Date.now())) {
    return Response.json({ plan: localPlan(items, start, end) });
  }

  const list = items
    .map((i) => `- [${i.id}] ${i.text}（约 ${i.durationMin && i.durationMin > 0 ? i.durationMin : 60} 分钟）`)
    .join("\n");
  const system = [
    `把下面这些行动排进 ${start} 到 ${end} 之间的时间块，帮一个人把今天过得顺、有节奏。`,
    "规则：块之间不重叠、有先后；运动放早晨或傍晚；需要专注的（学习、写作、深度工作）放精力好的时段；三餐安排在合理的饭点。",
    "每块给出它的 id、开始时间 startTime（HH:MM，24 小时制）、时长 durationMin（分钟，正整数）。",
    "只能用给定的 id，不要新增或删减行动；尽量都排进窗口内。",
    body.lang === "en" ? "LANGUAGE: any prose in natural English." : "语言：如有文字用简体中文。",
    "只输出如下 json，不要解释或代码块：",
    '{"plan":[{"id":"行动id","startTime":"HH:MM","durationMin":60}]}',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const content = await completeDeepSeek({
      label: "arrange-day",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `这些是今天要排的行动（窗口 ${start}–${end}）：\n${list}` },
      ],
      maxTokens: 800,
      temperature: 0.4,
      structuredOutput: true,
    });
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json({ plan: localPlan(items, start, end) });
    const parsed = JSON.parse(json) as {
      plan?: { id?: unknown; startTime?: unknown; durationMin?: unknown }[];
    };
    const valid = new Set(items.map((i) => i.id));
    const plan: ArrangeResult[] = (parsed.plan || [])
      .map((x) => {
        const id = String(x.id ?? "").trim();
        const startTime = String(x.startTime ?? "").trim();
        const n = Number(x.durationMin);
        const durationMin = Number.isFinite(n) && n > 0 ? Math.round(n) : 60;
        return { id, startTime, durationMin };
      })
      .filter((x) => valid.has(x.id) && /^\d{2}:\d{2}$/.test(x.startTime));
    return Response.json({ plan: plan.length ? plan : localPlan(items, start, end) });
  } catch (e) {
    console.error("[arrange-day] failed:", e);
    return Response.json({ plan: localPlan(items, start, end) });
  }
}
