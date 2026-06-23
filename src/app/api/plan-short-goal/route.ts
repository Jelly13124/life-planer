// 服务端：把一个短期目标的未排期任务铺到它的时间窗内（合理频率、不填满），并给每周习惯定星期几。
// DeepSeek 给方案 → zod 校验同一套形状 → 把日期夹进窗口；无 key / 限流 / 失败 / 网络故障一律
// 退回纯函数 localPlanShort（离线确定性兜底）。永远返回一份可用的 {taskDates,habitWeekdays}。
// 结构 + headers 镜像 arrange-day/route.ts。
import { z } from "zod";
import { allowRequest } from "@/lib/rateLimit";
import { localPlanShort, type PlanShortInput, type PlanShortResult } from "@/domain/planShort";
import { addDays } from "@/domain/daily";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface Body {
  goal?: { title?: string; why?: string; startDate?: string; endDate?: string };
  today?: string;
  dayStart?: string;
  dayEnd?: string;
  tasks?: { id?: string; text?: string }[];
  habits?: { id?: string; text?: string; repeat?: "daily" | "weekly" }[];
  lang?: "zh" | "en";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// AI 返回的形状：和 localPlanShort 一致。
const PlanZ = z.object({
  taskDates: z.record(z.string(), z.string()).default({}),
  habitWeekdays: z.record(z.string(), z.number()).default({}),
});

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

// 把日期夹进 [winStart, winEnd]（含两端）。越界则贴到最近一端。非法日期 → null。
function clampDate(d: string, winStart: string, winEnd: string): string | null {
  if (!DATE_RE.test(d)) return null;
  if (d < winStart) return winStart;
  if (d > winEnd) return winEnd;
  return d;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ taskDates: {}, habitWeekdays: {} }, { status: 400 });
  }

  const today = body.today && DATE_RE.test(body.today) ? body.today : null;
  const startDate = body.goal?.startDate && DATE_RE.test(body.goal.startDate) ? body.goal.startDate : null;
  // today 必须有（窗口下限）；startDate 缺失时退化为 today。
  if (!today) return Response.json({ taskDates: {}, habitWeekdays: {} }, { status: 400 });

  const tasks = (Array.isArray(body.tasks) ? body.tasks : [])
    .filter((t): t is { id: string; text: string } => !!t?.id && !!t?.text)
    .map((t) => ({ id: t.id, text: t.text }));
  const habits = (Array.isArray(body.habits) ? body.habits : [])
    .filter((h): h is { id: string; text: string; repeat: "daily" | "weekly" } =>
      !!h?.id && !!h?.text && (h.repeat === "daily" || h.repeat === "weekly"),
    )
    .map((h) => ({ id: h.id, text: h.text, repeat: h.repeat }));

  const input: PlanShortInput = {
    startDate: startDate ?? today,
    endDate: body.goal?.endDate && DATE_RE.test(body.goal.endDate) ? body.goal.endDate : "",
    today,
    tasks,
    habits,
  };

  // 没什么可排 → 直接给空计划（localPlanShort 也会给空，这里省一次调用）。
  if (!tasks.length && !habits.some((h) => h.repeat === "weekly")) {
    return Response.json({ taskDates: {}, habitWeekdays: {} });
  }

  const fallback = (): PlanShortResult => localPlanShort(input);

  const key = getKey();
  if (!key) return Response.json(fallback());
  if (!allowRequest(request, Date.now())) return Response.json(fallback());

  // AI 的真实窗口（与 localPlanShort 同步）：起点不早于今天，缺/早于起点的 endDate → 14 天窗口。
  const winStart = input.startDate > today ? input.startDate : today;
  const winEnd =
    !input.endDate || input.endDate < winStart ? addDays(winStart, 13) : input.endDate;

  const validTaskIds = new Set(tasks.map((t) => t.id));
  const weeklyIds = new Set(habits.filter((h) => h.repeat === "weekly").map((h) => h.id));

  const taskList = tasks.map((t) => `- [${t.id}] ${t.text}`).join("\n") || "（无）";
  const habitList =
    habits.filter((h) => h.repeat === "weekly").map((h) => `- [${h.id}] ${h.text}`).join("\n") ||
    "（无每周习惯）";

  const system = [
    `把一个短期目标的任务铺进它的时间窗 ${winStart} 到 ${winEnd}（含两端，本地日 YYYY-MM-DD），并给每周习惯定星期几。`,
    `目标：${body.goal?.title?.trim() || "（未命名）"}。${body.goal?.why ? `为什么：${body.goal.why}。` : ""}`,
    `作息时段约 ${body.dayStart || "07:00"}–${body.dayEnd || "23:00"}（仅作背景参考，不需要给具体时刻）。`,
    "规则：",
    "1) 每个一次性任务给一个日期(YYYY-MM-DD)，落在窗口内。任务要铺开、有节奏，不要全堆在第一天、也不要每天都排——按合理频率分布（如每隔几天一件）。",
    "2) 每个每周习惯给一个星期几 weekday（0=周日…6=周六），让一周内分布开（如要练3次 → 周一/周三/周五）。",
    "3) 只能用给定的 id；不要新增或删减；不需要给每日习惯安排（它们本就每天）。",
    body.lang === "en" ? "LANGUAGE: any prose in natural English." : "语言：如有文字用简体中文。",
    "只输出如下 json，不要解释或代码块：",
    '{"taskDates":{"任务id":"YYYY-MM-DD"},"habitWeekdays":{"习惯id":3}}',
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
          {
            role: "user",
            content: `任务（铺进窗口）：\n${taskList}\n\n每周习惯（定星期几）：\n${habitList}`,
          },
        ],
        response_format: MODEL.includes("reasoner") ? undefined : { type: "json_object" },
        max_tokens: 900,
        temperature: 0.5,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[plan-short-goal] DeepSeek ${res.status}`);
      return Response.json(fallback());
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json(fallback());
    const parsed = PlanZ.safeParse(JSON.parse(json));
    if (!parsed.success) return Response.json(fallback());

    // 只收有效 id、合法且夹进窗口的日期。
    const taskDates: Record<string, string> = {};
    for (const [id, d] of Object.entries(parsed.data.taskDates)) {
      if (!validTaskIds.has(id)) continue;
      const clamped = clampDate(String(d), winStart, winEnd);
      if (clamped) taskDates[id] = clamped;
    }
    // 只收每周习惯、合法 weekday (0–6)。
    const habitWeekdays: Record<string, number> = {};
    for (const [id, wd] of Object.entries(parsed.data.habitWeekdays)) {
      if (!weeklyIds.has(id)) continue;
      const n = Math.round(Number(wd));
      if (Number.isFinite(n) && n >= 0 && n <= 6) habitWeekdays[id] = n;
    }

    // AI 漏排的任务用本地兜底补齐；每周习惯漏定的也补上，确保始终是完整可用的计划。
    const local = localPlanShort(input);
    for (const id of validTaskIds) if (!(id in taskDates)) taskDates[id] = local.taskDates[id];
    for (const id of weeklyIds) if (!(id in habitWeekdays)) habitWeekdays[id] = local.habitWeekdays[id];

    return Response.json({ taskDates, habitWeekdays });
  } catch (e) {
    console.error("[plan-short-goal] failed:", e);
    return Response.json(fallback());
  }
}
