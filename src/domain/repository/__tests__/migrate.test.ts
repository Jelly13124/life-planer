import { describe, it, expect } from "vitest";
import { createTree } from "@/domain/tree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import {
  LocalStorageRepository,
  type KeyValueStore,
} from "@/domain/repository/localStorageRepo";
import { SupabaseRepository, type CloudStore } from "@/domain/repository/supabaseRepo";
import { migrateLocalToCloud } from "@/domain/repository/migrate";
import type { LifeTree, Profile } from "@/domain/types";

const profile: Profile = {
  name: "小林",
  age: 30,
  education: "bachelor",
  major: "视觉传达",
  occupation: "设计师",
  salary: "5to10",
  hasSideHustle: false,
  sideHustle: "",
  hobbies: "",
  relationship: "dating",
  location: "杭州",
  status: "工作5年",
  snapshot: "设计师",
  crossroad: "要不要换城市",
  areas: { career: 50, wealth: 45, relationships: 55, health: 60, growth: 50 },
};

const gen = new LocalPathGenerator();
const NOW = "2026-06-15T00:00:00.000Z";
const USER = "user-1";

function makeKeyValueStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function makeCloudStore(): CloudStore {
  const map = new Map<string, LifeTree>();
  return {
    getTree: async (userId) => (map.has(userId) ? map.get(userId)! : null),
    putTree: async (userId, tree) => void map.set(userId, tree),
    deleteTree: async (userId) => void map.delete(userId),
  };
}

describe("migrateLocalToCloud", () => {
  it("returns skipped-no-local when there is no local tree", async () => {
    const local = new LocalStorageRepository(makeKeyValueStore());
    const cloud = new SupabaseRepository(makeCloudStore(), USER);
    expect(await migrateLocalToCloud(local, cloud)).toBe("skipped-no-local");
  });

  it("returns skipped-cloud-exists and does NOT overwrite the cloud tree", async () => {
    const local = new LocalStorageRepository(makeKeyValueStore());
    const localTree = createTree(profile, gen, NOW);
    local.save(localTree);

    const cloud = new SupabaseRepository(makeCloudStore(), USER);
    const cloudTree = createTree({ ...profile, name: "云端" }, gen, NOW);
    await cloud.save(cloudTree);

    expect(await migrateLocalToCloud(local, cloud)).toBe("skipped-cloud-exists");
    // 云端保持原样，没被本地覆盖
    expect((await cloud.load())?.id).toBe(cloudTree.id);
  });

  it("returns migrated and copies the local tree to the empty cloud", async () => {
    const local = new LocalStorageRepository(makeKeyValueStore());
    const localTree = createTree(profile, gen, NOW);
    local.save(localTree);

    const cloud = new SupabaseRepository(makeCloudStore(), USER);
    expect(await cloud.load()).toBeNull(); // 前提：云端是空的

    expect(await migrateLocalToCloud(local, cloud)).toBe("migrated");
    expect((await cloud.load())?.id).toBe(localTree.id);
  });
});
