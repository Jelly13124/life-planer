import type { InboxItem, LifeTree } from "./types";
import { hashSeed } from "./seed";

// 纯函数：不使用 Date.now/Math.random。now 由副作用层注入。

export function addInboxItem(tree: LifeTree, text: string, now: string): LifeTree {
  const t = text.trim();
  if (!t) return tree;
  const item: InboxItem = {
    id: `inbox-${hashSeed(`${t}|${now}`)}`,
    text: t,
    createdAt: now,
  };
  return { ...tree, inbox: [item, ...(tree.inbox ?? [])], updatedAt: now };
}

export function removeInboxItem(tree: LifeTree, id: string, now: string): LifeTree {
  return { ...tree, inbox: (tree.inbox ?? []).filter((i) => i.id !== id), updatedAt: now };
}
