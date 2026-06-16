// 客户端安全：只负责调 /api/enrich 并把结果合并进路径。不引入任何服务端依赖。
import {
  DIMENSIONS,
  type Dimension,
  type LifePath,
  type LifeTree,
  type Mood,
  type PathNode,
} from "@/domain/types";

export interface EnrichResult {
  summary: string;
  nodes: {
    age: number;
    title: string;
    story: string;
    mood: Mood;
    dimensions?: Dimension[];
  }[];
}

// 向后端请求某条路径的文案；失败/未接入则返回 null。
// 从该分支的分叉年龄(forkAge)往后推演，所以子分支也只写它那一段未来。
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
        startAge: path.forkAge ?? tree.profile.age,
        horizonYears: tree.horizonYears,
        choiceLabel: path.choiceLabel,
        kind: path.kind,
        curve: path.curve,
        scenario: path.scenario,
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

function cleanDimensions(dims: Dimension[] | undefined, fallback: Dimension[]): Dimension[] {
  const ok = (dims ?? []).filter((d) => DIMENSIONS.includes(d));
  return ok.length ? ok.slice(0, 3) : fallback;
}

// 纯函数：用 AI 自己挑的转折点整体替换这条路的时间线（数字/曲线仍是本地的）。
// 年龄基于该分支的 forkAge；做基本清洗：夹到 [lo, hi]、严格递增、心情/维度合法。
export function applyEnrichment(
  path: LifePath,
  result: EnrichResult,
  startAge: number,
  horizonYears: number,
): LifePath {
  const base = path.forkAge ?? startAge;
  const lo = base + 1;
  const hi = base + horizonYears;

  const cleaned: PathNode[] = [];
  let lastAge = base;
  result.nodes.forEach((n, i) => {
    if (!Number.isFinite(n.age) || !n.title || !n.story) return;
    let age = Math.round(Math.min(hi, Math.max(lo, n.age)));
    if (age <= lastAge) age = lastAge + 1;
    if (age > hi) return;
    lastAge = age;
    // 维度兜底：用本地节点（若有）或按位置给个默认
    const fallback = path.nodes[i]?.dimensions ?? ["career"];
    cleaned.push({
      age,
      title: n.title,
      story: n.story,
      mood: VALID_MOODS.includes(n.mood) ? n.mood : "mid",
      dimensions: cleanDimensions(n.dimensions, fallback),
    });
  });

  const summary = result.summary || path.summary;
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
