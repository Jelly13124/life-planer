// 服务端：复盘——对照"当时预期/信心"与"真实发生"，给一句校准。无 key/失败 → null，前端本地兜底。
import { allowRequest } from "@/lib/rateLimit";
import { completeDeepSeek, getDeepSeekKey } from "@/lib/deepseek";

interface Body {
  choiceLabel: string;
  rationale: string;
  expectation: string;
  confidence: number;
  whatHappened: string;
  outcome: number; // 1-5
  lang?: "zh" | "en";
}

export async function POST(request: Request) {
  if (!allowRequest(request, Date.now())) {
    return Response.json({ lesson: null }, { status: 429 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ lesson: null }, { status: 400 });
  }
  if (!getDeepSeekKey()) return Response.json({ lesson: null });

  const system = [
    "你在帮用户复盘一个人生决定。对照 TA 当时的预期与信心、以及真实发生的，给一句温暖、诚实、可迁移的教训/校准。",
    "不说教、不打鸡血、不算命。≤2 句。",
    `选择：「${body.choiceLabel}」。当时原因：${body.rationale || "（未填）"}。`,
    `当时预期：${body.expectation || "（未填）"}。当时信心：${body.confidence}%。`,
    `真实发生：${body.whatHappened}。结果对比预期（1 远差—5 远好）：${body.outcome}。`,
    body.lang === "en" ? "LANGUAGE: reply in natural, fluent English, ≤2 sentences." : "语言：用简体中文，≤2 句。",
    "只输出这一句话本身，不要前缀、不要引号、不要解释。",
  ].join("\n");

  try {
    const lesson = await completeDeepSeek({
      label: "review",
      messages: [
        { role: "system", content: system },
        { role: "user", content: "给我一句复盘校准。" },
      ],
      maxTokens: 200,
      temperature: 0.7,
    });
    return Response.json({ lesson });
  } catch (e) {
    console.error("[review] failed:", e);
    return Response.json({ lesson: null });
  }
}
