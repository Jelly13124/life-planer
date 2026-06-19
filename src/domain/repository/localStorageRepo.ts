import type { LifeTree } from "../types";
import type { TreeRepository } from "./types";
import { normalizeLoadedTree } from "./normalize";

// v3：分支改为"从各自现实的人生时间点分叉"（forkAge 不再都等于当前年龄）。
// 旧树的分叉与节点年龄都钉在"现在"，无法在不产生年龄/文案错位的情况下平滑迁移，
// 故换 key 丢弃旧数据，让新树带着正确时间线重新生成。
const STORAGE_KEY = "lifeplanner.tree.v3";

// 最小 Storage 接口，便于注入内存实现做测试。
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

function resolveStore(): KeyValueStore {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      // 探测可用性（隐私模式下 localStorage 可能抛错）
      const k = "__lp_probe__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return window.localStorage;
    }
  } catch {
    // 降级到内存
  }
  return new MemoryStore();
}

export class LocalStorageRepository implements TreeRepository {
  private store: KeyValueStore;

  constructor(store?: KeyValueStore) {
    this.store = store ?? resolveStore();
  }

  load(): LifeTree | null {
    const raw = this.store.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return normalizeLoadedTree(JSON.parse(raw)); // 校验 + 旧树补字段（共享逻辑）
    } catch {
      return null; // 数据损坏 -> 当作没有，UI 回退到重新引导
    }
  }

  save(tree: LifeTree): void {
    try {
      this.store.setItem(STORAGE_KEY, JSON.stringify(tree));
    } catch {
      // 写入失败（如配额）静默忽略，不崩溃
    }
  }

  clear(): void {
    try {
      this.store.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
