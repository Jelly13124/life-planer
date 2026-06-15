import type { LifeTree } from "../types";
import type { TreeRepository } from "./types";

const STORAGE_KEY = "lifeplanner.tree.v1";

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
      const parsed = JSON.parse(raw) as LifeTree;
      if (!parsed || !Array.isArray(parsed.paths) || !parsed.profile) return null;
      return parsed;
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
