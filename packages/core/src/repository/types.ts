import type { LifeTree } from "../types";

// 持久化接口 —— UI/state 只依赖它。
// v1: LocalStorageRepository。未来: SupabaseRepository（签名一致）。
export interface TreeRepository {
  load(): LifeTree | null;
  save(tree: LifeTree): void;
  clear(): void;
}

// 异步持久化接口 —— 云端存档（Supabase）用。签名与 TreeRepository 一致，只是返回 Promise。
// AppContext 改为 async 后才能接上（见 docs/supabase-setup.md 的“剩余接线步骤”）。
export interface AsyncTreeRepository {
  load(): Promise<LifeTree | null>;
  save(tree: LifeTree): Promise<void>;
  clear(): Promise<void>;
}
