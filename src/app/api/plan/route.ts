// 服务端：把一个选择落地成 30/90 天计划 + 低成本试错。无 key/失败 → 空数组，前端本地兜底。
import { allowRequest } from "@/lib/rateLimit";
import { completeDeepSeek, extractJson, getDeepSeekKey } from "@/lib/deepseek";

interface Body {
  profileSummary: string;
  choiceLabel: string;
  summary: string;
  rationale: string;
  expectation: string;
  horizon: "30d" | "90d";
  lang?: "zh" | "en";
}

export async function POST(request: Request) {
  if (!allowRequest(request, Date.now())) {
    return Response.json({ steps: [], experiments: [] }, { status: 429 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ steps: [], experiments: [] }, { status: 400 });
  }
  if (!getDeepSeekKey()) return Response.json({ steps: [], experiments: [] });

  const days = body.horizon === "30d" ? 30 : 90;
  const system = [
    "你是一个清醒、务实的人生规划助手。把用户选定的一条人生路，落地成接下来一段时间的具体计划。",
    `给出 3-6 条「近期行动」（steps）：动词开头、具体、可勾选、能在未来 ${days} 天内真正动手。`,
    "再给 2-3 个「低成本试错」（experiments）：花费小、时间短、可证伪，用来验证这条路是否真适合 TA（参考 Designing Your Life 的原型试错）。",
    "务实、不画饼、不喊口号；扎根 TA 的真实处境。",
    body.profileSummary ? `TA 的现状：${body.profileSummary}。` : "",
    `TA 选定的路：「${body.choiceLabel}」${body.summary ? `（${body.summary}）` : ""}。`,
    body.rationale ? `选它的原因：${body.rationale}。` : "",
    body.expectation ? `TA 的预期：${body.expectation}。` : "",
    body.lang === "en"
      ? "LANGUAGE: write every step and experiment in natural, fluent English."
      : "语言：steps 和 experiments 一律用简体中文。",
    "只输出如下 json，不要解释或代码块：",
    '{"steps":["近期行动"],"experiments":["低成本试错"]}',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const content = await completeDeepSeek({
      label: "plan",
      messages: [
        { role: "system", content: system },
        { role: "user", content: "把它落地成计划。" },
      ],
      maxTokens: 700,
      temperature: 0.7,
      structuredOutput: true,
    });
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json({ steps: [], experiments: [] });
    const parsed = JSON.parse(json) as { steps?: unknown; experiments?: unknown };
    return Response.json({
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      experiments: Array.isArray(parsed.experiments) ? parsed.experiments : [],
    });
  } catch (e) {
    console.error("[plan] failed:", e);
    return Response.json({ steps: [], experiments: [] });
  }
}
