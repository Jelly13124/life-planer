// 移动端持久化：AsyncStorage 版的树仓库（对应 web 的 LocalStorageRepository）。
//
// 复用共享纯领域核心的 normalizeLoadedTree（校验 + 旧数据无损补字段/迁移），
// 与 web 端用同一个 storage key —— 这样接 Supabase 云同步时两端是同一份 jsonb 结构。
// 领域层保持纯净：这里是「副作用/状态层」，可以做 I/O；时间仍由调用方注入。
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LifeTree } from "@lifeplanner/core/types";
import { normalizeLoadedTree } from "@lifeplanner/core/repository/normalize";

// 与 web 端 packages/core/src/repository/localStorageRepo.ts 的 key 保持一致（勿改）。
const STORAGE_KEY = "lifeplanner.tree.v3";

// 读取并校验/升级本地存档。无存档或数据损坏 → null（UI 回退到重新引导/重新生成）。
export async function loadTree(): Promise<LifeTree | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeLoadedTree(JSON.parse(raw)); // 共享：校验 + 旧数据补字段/两级迁移
  } catch {
    return null; // 损坏当作没有，不崩溃
  }
}

// 写入存档。失败（配额/磁盘）静默忽略，不崩溃。
export async function saveTree(tree: LifeTree): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  } catch {
    // ignore
  }
}

// 清空存档（用于「重置」）。
export async function clearTree(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// 云端覆盖本地前的兜底备份（一份，覆盖式）。恢复入口后续再做——先保证数据不丢。
const BACKUP_KEY = "lifeplanner.tree.backup";
export async function backupTree(tree: LifeTree): Promise<void> {
  try {
    await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(tree));
  } catch {
    /* 忽略 */
  }
}
