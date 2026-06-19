import type { LifeTree } from "../types";
import type { AsyncTreeRepository } from "./types";
import { normalizeLoadedTree } from "./normalize";

// 我们只依赖这一小撮能力 —— 真正的 supabase 客户端在边缘适配成它（见 docs/supabase-setup.md）。便于 mock 测试。
export interface CloudStore {
  getTree(userId: string): Promise<unknown>; // 返回存储的 LifeTree JSON；不存在时实现应返回 null
  putTree(userId: string, tree: LifeTree): Promise<void>;
  deleteTree(userId: string): Promise<void>;
}

export class SupabaseRepository implements AsyncTreeRepository {
  constructor(private store: CloudStore, private userId: string) {}

  async load(): Promise<LifeTree | null> {
    try {
      const raw = await this.store.getTree(this.userId);
      if (raw == null) return null;
      // raw 可能是对象或 JSON 字符串
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return normalizeLoadedTree(parsed);
    } catch {
      return null;
    }
  }

  async save(tree: LifeTree): Promise<void> {
    try {
      await this.store.putTree(this.userId, tree);
    } catch {
      // 静默失败，不崩
    }
  }

  async clear(): Promise<void> {
    try {
      await this.store.deleteTree(this.userId);
    } catch {
      // ignore
    }
  }
}
