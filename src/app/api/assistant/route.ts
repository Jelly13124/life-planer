// 服务端：人生规划助手对话。帮处于迷茫期的人想清楚选择、提出没考虑过的可能。
// 与 enrich/chat 一致地走 DeepSeek，没密钥则优雅降级。
import { allowRequest } from "@/lib/rateLimit";
import { completeDeepSeek, getDeepSeekKey } from "@/lib/deepseek";

interface AssistantBody {
  profileSummary: string; // 一句话现状
  choices: string[]; // 树上已有的选择
  messages: { role: "user" | "assistant"; content: string }[];
  lang?: "zh" | "en";
}

export async function GET() {
  return Response.json({ enabled: Boolean(getDeepSeekKey()) });
}

export async function POST(request: Request) {
  if (!allowRequest(request, Date.now())) {
    return Response.json({ reply: null }, { status: 429 });
  }
  let body: AssistantBody;
  try {
    body = (await request.json()) as AssistantBody;
  } catch {
    return Response.json({ reply: null }, { status: 400 });
  }
  if (!getDeepSeekKey()) return Response.json({ reply: null });

  const system = [
    "你是一个温暖、清醒的人生规划助手，服务的对象正处在迷茫期、面临选择、怕选错。",
    "你的任务：帮 TA 把纠结想清楚，并主动提出 TA 可能没考虑过的、具体的人生选择。",
    "当你建议一个值得探索的选择时，用简短的短语点出来（例如：去读个在职研究生 / 搬去成都 / 先 gap 一年），方便 TA 加进自己的人生树去推演。",
    "诚实、不打鸡血、不说教、不做待办清单管理；像个想得明白的朋友。简洁，每次 2-5 句。",
    "提醒：人生没有标准答案，你给的是可能性和思路，不是命令。",
    body.profileSummary ? `TA 的现状：${body.profileSummary}。` : "",
    body.choices?.length ? `TA 已经在考虑的路：${body.choices.join("、")}。可以基于这些延伸或补充新的。` : "",
    body.lang === "en"
      ? "LANGUAGE: reply entirely in natural, fluent English, and phrase any suggested choices in English."
      : "语言：全程用简体中文回答。",
  ]
    .filter(Boolean)
    .join("");

  try {
    const reply = await completeDeepSeek({
      label: "assistant",
      messages: [{ role: "system", content: system }, ...(body.messages || [])],
      maxTokens: 600,
      temperature: 0.9,
    });
    return Response.json({ reply });
  } catch (e) {
    console.error("[assistant] failed:", e);
    return Response.json({ reply: null });
  }
}
