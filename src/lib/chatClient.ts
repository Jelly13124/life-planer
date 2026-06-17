// 客户端安全：不引入任何服务端依赖。封装「和未来的自己聊聊」的网络调用。
import type { LifePath, LifeTree } from "@/domain/types";
import { currentLocale } from "@/i18n/locale";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// 未来的"我"现在几岁：取这条路所有节点里最大的年龄；没有节点就用 forkAge。
export function futureAgeOf(path: LifePath): number {
  const ages = path.nodes.map((n) => n.age).filter((a) => Number.isFinite(a));
  if (ages.length > 0) return Math.max(...ages);
  return path.forkAge;
}

// 一些开场白快捷追问。
export const QUICK_PROMPTS: string[] = [
  "你后悔走这条路吗？",
  "当时最难的坎是怎么熬过来的？",
  "给现在的我一句话",
  "有没有我没考虑过的路？",
];

// 决策框架预设：点一下即把这个"想清楚"的问题抛给未来的自己。
export const FRAMEWORK_PROMPTS: string[] = [
  "后悔最小化：80 岁回头看，哪个更不后悔？",
  "预演失败：三年后它失败了，最可能因为什么？",
  "可逆性：这是单行道还是可回头？",
];

// 发一轮对话，返回未来自己的回复；失败或没接 AI 时返回 null。
export async function sendChat(
  tree: LifeTree,
  path: LifePath,
  messages: ChatMessage[],
): Promise<string | null> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
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
        lang: currentLocale(),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { reply?: string | null };
    return data.reply ?? null;
  } catch {
    return null;
  }
}
