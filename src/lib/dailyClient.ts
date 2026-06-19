// 客户端安全：今日计划网络封装 + 本地"今天"日串。
import type { LifeTree } from "@/domain/types";
import { localDay } from "@/domain/daily";
import { currentLocale } from "@/i18n/locale";

export interface TodayPick {
  id: string;
  why: string;
}

export function localTodayStr(): string {
  return localDay(new Date());
}

export async function fetchTodayPlan(
  tree: LifeTree,
  pending: { id: string; text: string; goalTitle: string }[],
): Promise<TodayPick[]> {
  if (!pending.length) return [];
  try {
    const res = await fetch("/api/today-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileSummary: tree.profile.snapshot || "", pending, lang: currentLocale() }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { pick?: TodayPick[] };
    return Array.isArray(data.pick)
      ? data.pick.filter((p) => p && typeof p.id === "string" && typeof p.why === "string")
      : [];
  } catch {
    return [];
  }
}
