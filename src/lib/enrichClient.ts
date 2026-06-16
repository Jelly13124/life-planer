// 客户端安全：只负责调 /api/enrich 并把结果合并进路径。不引入任何服务端依赖。
import {
  DIMENSIONS,
  type Dimension,
  type LifePath,
  type LifeTree,
  type Mood,
  type PathNode,
} from "@/domain/types";
import { currentLocale } from "@/i18n/locale";

export interface EnrichResult {
  forkDelayYears?: number; // AI 决定的"几年后才分叉"（仅根分支的选择会用）
  summary: string;
  nodes: {
    age: number;
    title: string;
    story: string;
    mood: Mood;
    dimensions?: Dimension[];
  }[];
}

export const MAX_FORK_DELAY = 10;

// 根分支的选择才允许 AI 重定时机；子分支(在某节点分叉)与维持现状的起点固定。
function canRetime(path: LifePath): boolean {
  return path.kind === "choice" && (path.parentId == null);
}

// 向后端请求某条路径的文案 + 分叉时机；失败/未接入则返回 null。
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
        currentAge: tree.profile.age,
        startAge: path.forkAge ?? tree.profile.age,
        horizonYears: tree.horizonYears,
        choiceLabel: path.choiceLabel,
        kind: path.kind,
        curve: path.curve,
        scenario: path.scenario,
        canRetime: canRetime(path),
        lang: currentLocale(),
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
// 关键：根分支的选择，分叉年龄(forkAge)由 AI 的 forkDelayYears 决定——它从现实的
// 人生时间点长出，而不是本地占位的那个。子分支/维持现状起点不变。
// startAge 这里即"当前年龄"(profile.age)。清洗：夹到 [lo, hi]、严格递增、心情/维度合法。
export function applyEnrichment(
  path: LifePath,
  result: EnrichResult,
  startAge: number,
  horizonYears: number,
): LifePath {
  // 由 AI 决定分叉时机：起点 = 现在年龄 + forkDelayYears（仅根分支的选择）。
  const retime = path.kind === "choice" && path.parentId == null;
  const delay = retime
    ? Math.max(0, Math.min(MAX_FORK_DELAY, Math.round(result.forkDelayYears ?? 0)))
    : 0;
  const base = retime ? startAge + delay : path.forkAge ?? startAge;
  const lo = base; // 允许第一个时刻落在分叉那一刻
  const hi = base + horizonYears;

  const cleaned: PathNode[] = [];
  let lastAge = base - 1;
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
  // 起点没变（子分支/未重定）时不动 forkAge；根分支按 AI 重定。
  const forkAge = retime ? base : path.forkAge;
  if (cleaned.length < 2) return { ...path, summary, forkAge };
  return { ...path, summary, forkAge, nodes: cleaned };
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
