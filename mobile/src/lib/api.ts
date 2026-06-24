// 移动端 API 客户端：调根 Next.js 的 /api/*（enrich/goals/decompose-goal/...）。
//
// 安全铁律：RN 端 **绝不** 直连 DeepSeek（key 会泄露）—— 一律走后端路由。
// 后端基址走 env：开发时指向开发机本机 IP（如 http://192.168.x.x:3000），
// 部署后指向线上域名。未配置基址时所有调用安静返回 null，调用方走本地兜底（离线也能用）。
//
// Expo 公开环境变量：以 EXPO_PUBLIC_ 开头，构建时内联进客户端包。
// 在 mobile/.env 或 shell 里设 EXPO_PUBLIC_API_BASE_URL=http://<开发机IP>:3000

import {
  DIMENSIONS,
  type Dimension,
  type GoalArea,
  type LifeArea,
  type LifePath,
  type LifeTree,
  type Mood,
  type PathNode,
} from "@lifeplanner/core/types";

// 末尾去掉斜杠，避免拼出 //api。未配置 → 空串（视为「无后端」）。
export const API_BASE_URL: string = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? ""
).replace(/\/+$/, "");

export function hasBackend(): boolean {
  return API_BASE_URL.length > 0;
}

// 通用 POST：成功返回解析后的 JSON，任何失败（无基址/网络/非 2xx/解析错）→ null。
// 调用方据此决定走本地兜底，绝不向 UI 抛错。
export async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  if (!hasBackend()) return null;
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ───────── 具体调用（演示打通预测/规划管线；离线时返回空，UI 不报错） ─────────

// 目标雏形建议（对应 web 的 fetchGoalSuggestions → POST /api/goals）。
export interface GoalSuggestion {
  area: LifeArea;
  title: string;
  why: string;
}

export async function fetchGoalSuggestions(
  profileSummary: string,
  choices: string[],
  lang: "zh" | "en" = "zh",
): Promise<GoalSuggestion[]> {
  const data = await postJson<{ goals?: GoalSuggestion[] }>("/api/goals", {
    profileSummary,
    choices,
    lang,
  });
  return Array.isArray(data?.goals) ? data!.goals : [];
}

// 把一个目标拆成几条可勾选的近期任务（对应 web 的 fetchGoalActions → POST /api/goal-actions）。
export async function fetchGoalActions(input: {
  goalTitle: string;
  why: string;
  area: GoalArea;
  profileSummary: string;
  lang?: "zh" | "en";
}): Promise<string[]> {
  const data = await postJson<{ actions?: string[] }>("/api/goal-actions", {
    goalTitle: input.goalTitle,
    why: input.why,
    area: input.area,
    profileSummary: input.profileSummary,
    lang: input.lang ?? "zh",
  });
  return Array.isArray(data?.actions)
    ? data!.actions.filter((a) => typeof a === "string" && a.trim())
    : [];
}

// ───────── 人生树：AI 增强分支（/api/enrich） ─────────
// 对应 web enrichClient：拿一条路的可信故事 + 现实可行度。曲线仍用本地 metrics，
// 这里只覆盖 summary / feasibility / nodes（含 chat 用的转折点）。失败 → null（离线降级）。
export interface EnrichResult {
  forkDelayYears?: number;
  feasibility?: number;
  feasibilityNote?: string;
  summary: string;
  nodes: { age: number; title: string; story: string; mood: Mood; dimensions?: Dimension[] }[];
}

export async function enrichPath(tree: LifeTree, path: LifePath): Promise<EnrichResult | null> {
  const data = await postJson<{ result: EnrichResult | null }>("/api/enrich", {
    profile: tree.profile,
    currentAge: tree.profile.age,
    startAge: path.forkAge ?? tree.profile.age,
    horizonYears: tree.horizonYears,
    choiceLabel: path.choiceLabel,
    kind: path.kind,
    curve: path.curve,
    scenario: path.scenario,
    canRetime: false, // 移动端 MVP 不重定分叉时机，保持本地 forkAge
    lang: "zh",
    note: path.note,
  });
  return data?.result ?? null;
}

const VALID_MOODS: Mood[] = ["high", "mid", "low"];

// 把 AI 结果叠加到一条路：覆盖 summary / feasibility / nodes（轻清洗：年龄递增、合法 mood/维度）。
// metrics/color/curve/forkAge 保持本地（曲线不变，consistent with web）。
export function applyEnrichToPath(path: LifePath, result: EnrichResult): LifePath {
  const base = path.forkAge;
  const cleaned: PathNode[] = [];
  let lastAge = base - 1;
  result.nodes.forEach((n, i) => {
    if (!Number.isFinite(n.age) || !n.title || !n.story) return;
    let age = Math.round(Math.max(base, n.age));
    if (age <= lastAge) age = lastAge + 1;
    lastAge = age;
    const dims = (n.dimensions ?? []).filter((d) => DIMENSIONS.includes(d));
    const fallback = path.nodes[i]?.dimensions ?? ["career"];
    cleaned.push({
      age,
      title: n.title,
      story: n.story,
      mood: VALID_MOODS.includes(n.mood) ? n.mood : "mid",
      dimensions: dims.length ? dims.slice(0, 3) : fallback,
    });
  });
  const feas: Partial<LifePath> =
    path.kind === "choice" && Number.isFinite(result.feasibility)
      ? {
          feasibility: Math.round(Math.max(0, Math.min(100, result.feasibility!))),
          feasibilityNote: (result.feasibilityNote ?? "").trim() || undefined,
        }
      : {};
  const summary = result.summary || path.summary;
  return cleaned.length >= 2
    ? { ...path, ...feas, summary, nodes: cleaned }
    : { ...path, ...feas, summary };
}

// ───────── 和未来的自己对话（/api/chat，非流式 v1） ─────────
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function futureAgeOf(path: LifePath): number {
  const ages = path.nodes.map((n) => n.age).filter((a) => Number.isFinite(a));
  return ages.length > 0 ? Math.max(...ages) : path.forkAge;
}

export async function chatReply(
  tree: LifeTree,
  path: LifePath,
  messages: ChatMessage[],
): Promise<string | null> {
  const data = await postJson<{ reply?: string | null }>("/api/chat", {
    profile: tree.profile,
    horizonYears: tree.horizonYears,
    path: {
      choiceLabel: path.choiceLabel,
      kind: path.kind,
      summary: path.summary,
      scenario: path.scenario,
      forkAge: path.forkAge,
      nodes: path.nodes.map((n) => ({
        age: n.age,
        title: n.title,
        story: n.story,
        mood: n.mood,
      })),
    },
    messages,
    lang: "zh",
  });
  return data?.reply ?? null;
}
