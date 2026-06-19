import type { AsyncTreeRepository, TreeRepository } from "./types";

export type MigrateResult = "migrated" | "skipped-no-local" | "skipped-cloud-exists";

// 首次登录时：本地有树、云端没有 → 把本地树搬到云端。纯逻辑，可注入 mock。
export async function migrateLocalToCloud(
  local: TreeRepository,
  cloud: AsyncTreeRepository,
): Promise<MigrateResult> {
  const localTree = local.load();
  if (!localTree) return "skipped-no-local";
  const cloudTree = await cloud.load();
  if (cloudTree) return "skipped-cloud-exists";
  await cloud.save(localTree);
  return "migrated";
}
