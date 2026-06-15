// 客户端安全：只负责调 /api/enrich 并把结果合并进路径。不引入任何服务端依赖。
import type { LifePath, LifeTree } from "@/domain/types";

export interface EnrichResult {
  summary: string;
  nodes: { age: number; title: string; story: string }[];
}

// 向后端请求某条路径的润色文案；失败/未接入则返回 null。
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
        horizonYears: tree.horizonYears,
        choiceLabel: path.choiceLabel,
        kind: path.kind,
        nodes: path.nodes.map((n) => ({ age: n.age, mood: n.mood })),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result: EnrichResult | null };
    return data.result ?? null;
  } catch {
    return null;
  }
}

// 纯函数：把润色文案合并进一条路径（按年龄匹配节点；缺失则保留本地文案）。
export function applyEnrichment(path: LifePath, result: EnrichResult): LifePath {
  const byAge = new Map(result.nodes.map((n) => [n.age, n]));
  return {
    ...path,
    summary: result.summary || path.summary,
    nodes: path.nodes.map((node) => {
      const e = byAge.get(node.age);
      return e ? { ...node, title: e.title || node.title, story: e.story || node.story } : node;
    }),
  };
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
