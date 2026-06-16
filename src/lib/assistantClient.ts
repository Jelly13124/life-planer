// 客户端安全：规划助手对话的网络封装。
import type { LifeTree } from "@/domain/types";
import type { ChatMessage } from "./chatClient";

export type { ChatMessage } from "./chatClient";

export async function sendAssistant(
  tree: LifeTree,
  messages: ChatMessage[],
): Promise<string | null> {
  try {
    const choices = Array.from(
      new Set(tree.paths.filter((p) => p.kind === "choice").map((p) => p.choiceLabel)),
    );
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileSummary: tree.profile.snapshot || "",
        choices,
        messages,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { reply?: string | null };
    return data.reply ?? null;
  } catch {
    return null;
  }
}

export const ASSISTANT_PROMPTS: string[] = [
  "我有点迷茫，帮我理理我现在的选择",
  "我还有哪些没想到的路？",
  "这几条路各自最大的风险是什么？",
];

export interface PathSuggestion {
  label: string;
  why: string;
}

// 让助手"铺开几条值得探索的路"，返回候选（前端确认后才画上）。
export async function fetchSuggestedPaths(tree: LifeTree): Promise<PathSuggestion[]> {
  try {
    const choices = Array.from(
      new Set(tree.paths.filter((p) => p.kind === "choice").map((p) => p.choiceLabel)),
    );
    const res = await fetch("/api/suggest-paths", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileSummary: tree.profile.snapshot || "", choices }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { suggestions?: PathSuggestion[] };
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch {
    return [];
  }
}
