// 服务端：结合用户 profile（起点/约束/所在国）给一个选择里每个选项的 利/弊/成本/可逆性/一句点评。
// DeepSeek 给方案 → zod 校验 → 只收有效选项 id；无 key / 限流 / 失败 / 网络故障 / 漏给一律
// 退回纯函数 localChoiceAnalysis（离线确定性兜底）。永远为每个 option id 返回有效结构。
// 结构 + headers 镜像 plan-short-goal/route.ts。建议永远只是建议——客户端由用户主动「采纳」。
import { z } from "zod";
import { allowRequest } from "@/lib/rateLimit";
import {
  localChoiceAnalysis,
  type AnalyzeOption,
  type ChoiceAnalysis,
  type OptionAnalysis,
} from "@/lib/choiceAnalysis";
import {
  EDUCATION_LABELS,
  RELATIONSHIP_LABELS,
  SALARY_LABELS,
  backgroundFacts,
  financialFacts,
} from "@/domain/profile";
import type { Profile } from "@/domain/types";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.LIFEPLANNER_MODEL || "deepseek-chat";

interface Body {
  question?: string;
  options?: { id?: string; label?: string }[];
  profile?: Partial<Profile>;
  lang?: "zh" | "en";
}

// AI 返回的形状：optionId → 建议。每个字段都给默认值，缺项不致命（之后用本地兜底补齐）。
const OptionZ = z.object({
  pros: z.string().default(""),
  cons: z.string().default(""),
  cost: z.string().default(""),
  reversibility: z.enum(["one-way", "two-way"]).default("two-way"),
  note: z.string().default(""),
});
const AnalysisZ = z.object({
  analysis: z.record(z.string(), OptionZ).default({}),
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

// 把用户 profile 压成几行"既定事实"，让 AI 结合起点/约束/所在国去判（缺字段就略过）。
function profileFacts(p: Partial<Profile>): string {
  const facts: string[] = [];
  facts.push(...backgroundFacts(p)); // 国籍/出生国（签证排期等现实校准）
  if (p.age) facts.push(`${p.age} 岁`);
  if (p.education && EDUCATION_LABELS[p.education]) {
    facts.push(`${EDUCATION_LABELS[p.education]}${p.major ? `（${p.major}）` : ""}`);
  }
  if (p.occupation) facts.push(`职业：${p.occupation}`);
  if (p.salary && SALARY_LABELS[p.salary]) facts.push(`月薪${SALARY_LABELS[p.salary]}`);
  if (p.location) facts.push(`生活在${p.location}`);
  if (p.status) facts.push(`身份/阶段：${p.status}`);
  if (p.relationship && RELATIONSHIP_LABELS[p.relationship]) {
    facts.push(`情感：${RELATIONSHIP_LABELS[p.relationship]}`);
  }
  facts.push(...financialFacts(p));
  return facts.join("；") || "（未提供更多背景）";
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ analysis: {} }, { status: 400 });
  }

  // 收有效选项（id + label）；label 可空（兜底仍能给通用结构）。
  const options: AnalyzeOption[] = (Array.isArray(body.options) ? body.options : [])
    .filter((o): o is { id: string; label?: string } => !!o?.id)
    .map((o) => ({ id: o.id, label: (o.label ?? "").trim() }));

  // 没有选项 → 空分析（合法、可用）。
  if (!options.length) return Response.json({ analysis: {} });

  const fallback = (): ChoiceAnalysis => localChoiceAnalysis(options);

  const key = getKey();
  if (!key) return Response.json({ analysis: fallback() });
  if (!allowRequest(request, Date.now())) return Response.json({ analysis: fallback() });

  const question = (body.question ?? "").trim() || "（未写明的选择）";
  const profile = body.profile ?? {};
  const facts = profileFacts(profile);
  const name = profile.name?.trim() || "他";

  const optionList = options.map((o) => `- [${o.id}] ${o.label || "（未命名选项）"}`).join("\n");

  const system = [
    `结合主角的现实背景，给一个选择里每个选项的 利/弊/成本/可逆性/一句点评。`,
    `主角：${name}。现状（既定事实，分析要贴合，不要与之矛盾）：${facts}。`,
    `他面临的选择：${question}`,
    "规则：",
    "1) 为每个给定选项 id 各给一份建议：pros（利）、cons（弊）、cost（成本：时间/金钱/机会，结合他的实际）、reversibility（可逆性，按现实判：one-way=单行道难回头 / two-way=可回头）、note（一句点评，≤20 字）。",
    "2) 克制、务实、不浮夸、不用预言腔（不要说『你一定会』『注定』）；利弊各 1-3 条短句，可用换行分隔。",
    "3) 结合他的起点与约束（年龄/学历/职业/收入/所在国/签证/家庭/存款负债）去判，不要泛泛而谈。",
    "4) 只能用给定的选项 id；不要新增或删减。",
    body.lang === "en" ? "LANGUAGE: write all prose in natural English." : "语言：用简体中文。",
    "只输出如下 json，不要解释或代码块：",
    '{"analysis":{"选项id":{"pros":"…","cons":"…","cost":"…","reversibility":"two-way","note":"…"}}}',
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
          { role: "user", content: `选项（逐个分析）：\n${optionList}` },
        ],
        response_format: MODEL.includes("reasoner") ? undefined : { type: "json_object" },
        max_tokens: 1200,
        temperature: 0.5,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[analyze-choice] DeepSeek ${res.status}`);
      return Response.json({ analysis: fallback() });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const json = content ? extractJson(content) : null;
    if (!json) return Response.json({ analysis: fallback() });
    const parsed = AnalysisZ.safeParse(JSON.parse(json));
    if (!parsed.success) return Response.json({ analysis: fallback() });

    // 只收有效选项 id 的建议；AI 漏给的选项用本地兜底补齐，确保每个 id 都有有效结构。
    const validIds = new Set(options.map((o) => o.id));
    const local = localChoiceAnalysis(options);
    const analysis: ChoiceAnalysis = {};
    for (const o of options) {
      const ai = parsed.data.analysis[o.id];
      if (ai && validIds.has(o.id)) {
        const merged: OptionAnalysis = {
          pros: ai.pros,
          cons: ai.cons,
          cost: ai.cost,
          reversibility: ai.reversibility,
          note: ai.note,
        };
        analysis[o.id] = merged;
      } else {
        analysis[o.id] = local[o.id];
      }
    }
    return Response.json({ analysis });
  } catch (e) {
    console.error("[analyze-choice] failed:", e);
    return Response.json({ analysis: fallback() });
  }
}
