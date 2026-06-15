import type { LifeTree } from "../types";

// 持久化接口 —— UI/state 只依赖它。
// v1: LocalStorageRepository。未来: SupabaseRepository（签名一致）。
export interface TreeRepository {
  load(): LifeTree | null;
  save(tree: LifeTree): void;
  clear(): void;
}
