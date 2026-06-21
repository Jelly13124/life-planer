// 客户端安全：AI 排一天的网络封装。失败/离线一律回退到本地 arrangeDay，永远给得出计划。
import type { ArrangeResult } from "@/domain/schedule";
import { arrangeDay } from "@/domain/schedule";
import { currentLocale } from "@/i18n/locale";

export async function fetchArrangeDay(
  items: { id: string; text: string; durationMin?: number }[],
  window: { start: string; end: string },
): Promise<ArrangeResult[]> {
  if (!items.length) return [];
  try {
    const res = await fetch("/api/arrange-day", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items, start: window.start, end: window.end, lang: currentLocale() }),
    });
    if (!res.ok) return arrangeDay(items.map((i) => ({ id: i.id, durationMin: i.durationMin })), window);
    const data = (await res.json()) as { plan?: ArrangeResult[] };
    const plan = Array.isArray(data.plan)
      ? data.plan.filter((p) => p && typeof p.id === "string" && typeof p.startTime === "string")
      : [];
    return plan.length ? plan : arrangeDay(items.map((i) => ({ id: i.id, durationMin: i.durationMin })), window);
  } catch {
    return arrangeDay(items.map((i) => ({ id: i.id, durationMin: i.durationMin })), window);
  }
}
