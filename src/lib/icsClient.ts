// 客户端安全：通过 /api/ics 代取并解析一个 https ICS 订阅地址（避 CORS）。
// 失败 / 离线 / 非数组一律返回空数组——只读叠加，拿不到就当没有，不影响其它日历内容。
import type { IcsEvent } from "@/domain/types";

export async function fetchIcsEvents(url: string): Promise<IcsEvent[]> {
  if (!url || !/^https:\/\//i.test(url)) return [];
  try {
    const res = await fetch(`/api/ics?url=${encodeURIComponent(url)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: IcsEvent[] };
    return Array.isArray(data.events) ? data.events : [];
  } catch {
    return [];
  }
}
