// 服务端专用：「和未来的自己聊聊」。模型扮演那个在过去选了某条路、如今活在未来的本人，
// 用第一人称跟现在的用户对话。把这条路的 summary + 各节点作为它的"亲身记忆"喂进去，
// 把用户的现状作为既定事实喂进去（不能矛盾），其余对话沿用前端传来的消息。
// 没有 DEEPSEEK_API_KEY 或调用失败时返回 { reply: null }，前端给出友好提示。
import type { Profile } from "@/domain/types";
import { financialFacts } from "@/domain/profile";
import { allowRequest } from "@/lib/rateLimit";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface PathPayload {
  choiceLabel: string;
  kind: string;
  summary: string;
  scenario: string;
  forkAge: number;
  nodes: { age: number; title: string; story: string; mood: string }[];
}

interface ChatRequestBody {
  profile: Profile;
  horizonYears: number;
  path: PathPayload;
  messages: ChatTurn[];
  lang?: "zh" | "en";
}

function getKey(): string | null {
  const k = process.env.DEEPSEEK_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

// 未来的"我"现在几岁：取这条路所有节点里最大的年龄；没有节点就用 forkAge + horizonYears。
function futureAge(path: PathPayload, horizonYears: number): number {
  const ages = path.nodes.map((n) => n.age).filter((a) => Number.isFinite(a));
  if (ages.length > 0) return Math.max(...ages);
  return path.forkAge + horizonYears;
}

// 构建系统提示：模型 = 用户走了这条路、活在未来的本人。
function buildSystem(body: ChatRequestBody): string {
  const p = body.profile;
  const path = body.path;
  const fAge = futureAge(path, body.horizonYears);

  const lines: string[] = [];
  lines.push(
    `你就是 ${p.name} ——那个在过去选择了「${path.choiceLabel}」、如今 ${fAge} 岁的你自己。用第一人称、像本人一样跟现在的${p.name}对话。`,
  );
  lines.push("");
  // 这条路的记忆
  lines.push("【你这一路真实经历过的事（你的记忆）】");
  if (path.summary) lines.push(`这条路最后把你带到了：${path.summary}`);
  const sortedNodes = [...path.nodes].sort((a, b) => a.age - b.age);
  for (const n of sortedNodes) {
    lines.push(`${n.age}岁：${n.title} —— ${n.story}`);
  }
  lines.push(
    "这些是你这一路真实经历过的事，回答要扎根其中、可以引用细节（具体的人、数字、当时的心情）。",
  );
  lines.push("");
  // 现状（既定事实）
  lines.push("【现在的你（也就是正在跟你说话的那个更年轻的自己）的已知现状】");
  const facts: string[] = [];
  facts.push(`现在 ${p.age} 岁`);
  if (p.location) facts.push(`生活在${p.location}`);
  if (p.status) facts.push(`身份/阶段：${p.status}`);
  if (p.occupation) facts.push(`职业：${p.occupation}`);
  if (p.education) facts.push(`学历代码：${p.education}`);
  if (p.relationship) facts.push(`情感状态代码：${p.relationship}`);
  if (p.snapshot) facts.push(`自述：${p.snapshot}`);
  facts.push(...financialFacts(p));
  lines.push(facts.join("；") + "。");
  lines.push("不要和这些已知事实矛盾。");
  lines.push("");
  // 语气
  lines.push("【怎么说话】");
  lines.push(
    "温暖、具体、像过来人；可以有遗憾也有释然；不要说教、不要打鸡血、不要算命腔。简短口语，每次回答 2-5 句就够了。",
  );
  lines.push("这是一种可能的你，不是预言。");
  lines.push(
    body.lang === "en"
      ? "LANGUAGE: reply entirely in natural, fluent English (the person you are talking to is using English)."
      : "语言：全程用简体中文回答。",
  );
  return lines.join("\n");
}

// 是否已接入真实大模型（前端可用来探测）。
export async function GET() {
  return Response.json({ enabled: Boolean(getKey()) });
}

export async function POST(request: Request) {
  if (!allowRequest(request, Date.now())) {
    return Response.json({ reply: null }, { status: 429 });
  }
  const key = getKey();
  if (!key) return Response.json({ reply: null });

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ reply: null }, { status: 400 });
  }
  if (!body || !body.profile || !body.path || !Array.isArray(body.messages)) {
    return Response.json({ reply: null }, { status: 400 });
  }

  const messages = [
    { role: "system", content: buildSystem(body) },
    ...body.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 600,
        temperature: 0.9,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(
        `[chat] DeepSeek ${res.status}:`,
        await res.text().catch(() => ""),
      );
      return Response.json({ reply: null });
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = data.choices?.[0]?.message?.content;
    if (!reply || !reply.trim()) return Response.json({ reply: null });
    return Response.json({ reply: reply.trim() });
  } catch (e) {
    console.error("[chat] generation failed:", e);
    return Response.json({ reply: null });
  }
}
