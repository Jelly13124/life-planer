// 客户端安全：只负责调 /api/enrich 并把结果合并进路径。不引入任何服务端依赖。
import type { LifePath, LifeTree, Mood, PathNode } from "@/domain/types";

export interface EnrichResult {
  summary: string;
  nodes: { age: number; title: string; story: string; mood: Mood }[];
}

// 向后端请求某条路径的文案；失败/未接入则返回 null。
// 模型会自己决定转折点，所以只把人物+选择+整体走向发过去，不再发固定的节点骨架。
export async function fetchEnrichment(
  tree: LifeTree,
  path: LifePath,
): Promise<EnrichResult | null> {
  try {
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profile: tree.profile,
        startAge: tree.profile.age,
        horizonYears: tree.horizonYears,
        choiceLabel: path.choiceLabel,
        kind: path.kind,
        curve: path.curve,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result: EnrichResult | null };
    return data.result ?? null;
  } catch {
    return null;
  }
}

const VALID_MOODS: Mood[] = ["high", "mid", "low"];

// 纯函数：用 AI 自己挑的转折点整体替换这条路的时间线（数字/曲线仍是本地的）。
// 做基本清洗：年龄夹到 [lo, hi]、严格递增、心情合法；点数太少则保留本地文案。
export function applyEnrichment(
  path: LifePath,
  result: EnrichResult,
  startAge: number,
  horizonYears: number,
): LifePath {
  const lo = startAge + 1;
  const hi = startAge + horizonYears;

  const cleaned: PathNode[] = [];
  let lastAge = startAge;
  for (const n of result.nodes) {
    if (!Number.isFinite(n.age) || !n.title || !n.story) continue;
    let age = Math.round(Math.min(hi, Math.max(lo, n.age)));
    if (age <= lastAge) age = lastAge + 1; // 保证严格递增
    if (age > hi) break;
    lastAge = age;
    cleaned.push({
      age,
      title: n.title,
      story: n.story,
      mood: VALID_MOODS.includes(n.mood) ? n.mood : "mid",
    });
  }

  const summary = result.summary || path.summary;
  // 转折点太少（模型抽风）时只换 summary，保留本地节点，避免时间线变空
  if (cleaned.length < 2) return { ...path, summary };
  return { ...path, summary, nodes: cleaned };
}

// 查询后端是否已接入真实大模型
export async function fetchEnrichEnabled(): Promise<boolean> {
  try {
    const res = await fetch("/api/enrich", { method: "GET" });
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled: boolean };
    return Boolean(data.enabled);
  } catch {
    return false;
  }
}
