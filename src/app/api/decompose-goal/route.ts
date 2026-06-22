// 服务端：把一个目标拆成 指标/任务/习惯/子目标 的结构化建议（PREVIEW，前端勾选后才落地）。
// 无 key / 调用失败 → 退回纯函数 localDecompose（按领域给模板，离线也能用）。带限流。
import { z } from "zod";
import { allowRequest } from "@/lib/rateLimit";
import { localDecompose, type GoalDecomposition, type GoalInput } from "@/lib/decompose";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface Body {
  goal?: GoalInput;
}

const MetricZ = z.object({
  label: z.string().trim().min(1),
  target: z.number(),
  unit: z.string().trim(),
});
const TaskZ = z.object({ text: z.string().trim().min(1) });
const HabitZ = z.object({
  text: z.string().trim().min(1),
  repeat: z.enum(["daily", "weekly"]),
  repeatWeekday: z.number().int().min(0).max(6).optional(),
});
const SubgoalZ = z.object({
  title: z.string().trim().min(1),
  metrics: z.array(MetricZ).default([]),
  tasks: z.array(TaskZ).default([]),
  habits: z.array(HabitZ).default([]),
});
const DecompositionZ = z.object({
  metrics: z.array(MetricZ).default([]),
  tasks: z.array(TaskZ).default([]),
  habits: z.array(HabitZ).default([]),
  subgoals: z.array(SubgoalZ).default([]),
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

// 收口：截断到任务书里规定的条数上限，避免 AI 一次塞太多。
function clamp(dec: GoalDecomposition): GoalDecomposition {
  return {
    metrics: dec.metrics.slice(0, 3),
    tasks: dec.tasks.slice(0, 6),
    habits: dec.habits.slice(0, 3),
    subgoals: dec.subgoals.slice(0, 3).map((s) => ({
      ...s,
      metrics: s.metrics.slice(0, 3),
      tasks: s.tasks.slice(0, 6),
      habits: s.habits.slice(0, 3),
    })),
  };
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json(localDecompose({ title: "" }), { status: 400 });
  }
  const goal = body.goal;
  if (!goal?.title?.trim()) {
    return Response.json(localDecompose({ title: "" }), { status: 400 });
  }

  // 限流命中：不调用大模型（仍保护 key），但仍返回离线兜底，让用户有东西可用。
  if (!allowRequest(request, Date.now())) {
    return Response.json(localDecompose(goal), { status: 429 });
  }

  const key = getKey();
  if (!key) return Response.json(localDecompose(goal));

  const system = [
    "你是目标拆解助手。根据用户的目标(标题/为什么/领域/时间范围),拆成可执行的结构:" +
      "1-3 个可量化的成功指标(带数字目标值和单位)、3-6 个具体一次性任务、1-3 个习惯(daily/weekly)、" +
      "可选 0-3 个子目标(每个子目标也可带自己的任务/指标/习惯)。简洁、贴合目标、可立即执行。只返回 JSON。",
    `目标标题：${goal.title.trim()}。`,
    goal.why ? `为什么想做到它：${goal.why}。` : "",
    goal.area ? `领域：${goal.area}。` : "",
    goal.startDate || goal.endDate ? `时间范围：${goal.startDate ?? "—"} 至 ${goal.endDate ?? "—"}。` : "",
    "指标 target 是数字、unit 是单位(如 次/元/本/%)。习惯 repeat 取 daily 或 weekly；weekly 可带 repeatWeekday(0=周日…6=周六)。",
    "只输出如下 json，不要任何解释或代码块：",
    '{"metrics":[{"label":"每周运动次数","target":3,"unit":"次"}],"tasks":[{"text":"制定运动计划"}],"habits":[{"text":"运动30分钟","repeat":"daily"}],"subgoals":[{"title":"子目标","metrics":[],"tasks":[{"text":"第一步"}],"habits":[]}]}',
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
          { role: "user", content: "把这个目标拆成可执行结构。" },
        ],
        response_format: MODEL.includes("reasoner") ? undefined : { type: "json_object" },
        max_tokens: 1200,
        temperature: 0.7,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[decompose-goal] DeepSeek ${res.status}`);
      return Response.json(localDecompose(goal));
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json(localDecompose(goal));
    const parsed = DecompositionZ.safeParse(JSON.parse(json));
    if (!parsed.success) return Response.json(localDecompose(goal));
    const out = clamp(parsed.data);
    // 一条都没拆出来：退回兜底，别给空面板。
    const empty =
      !out.metrics.length && !out.tasks.length && !out.habits.length && !out.subgoals.length;
    return Response.json(empty ? localDecompose(goal) : out);
  } catch (e) {
    console.error("[decompose-goal] failed:", e);
    return Response.json(localDecompose(goal));
  }
}
