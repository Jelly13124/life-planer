// 移动端 API 客户端：调根 Next.js 的 /api/*（enrich/goals/decompose-goal/...）。
//
// 安全铁律：RN 端 **绝不** 直连 DeepSeek（key 会泄露）—— 一律走后端路由。
// 后端基址走 env：开发时指向开发机本机 IP（如 http://192.168.x.x:3000），
// 部署后指向线上域名。未配置基址时所有调用安静返回 null，调用方走本地兜底（离线也能用）。
//
// Expo 公开环境变量：以 EXPO_PUBLIC_ 开头，构建时内联进客户端包。
// 在 mobile/.env 或 shell 里设 EXPO_PUBLIC_API_BASE_URL=http://<开发机IP>:3000

import type { GoalArea, LifeArea } from "@lifeplanner/core/types";

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
