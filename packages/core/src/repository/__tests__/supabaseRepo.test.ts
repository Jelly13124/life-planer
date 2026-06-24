import { describe, it, expect } from "vitest";
import { createTree } from "@/domain/tree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import { SupabaseRepository, type CloudStore } from "@/domain/repository/supabaseRepo";
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

// 内存版 CloudStore：用 Map 顶替真实 supabase 客户端，零网络零密钥。
function makeCloudStore(): CloudStore {
  const map = new Map<string, LifeTree>();
  return {
    getTree: async (userId) => (map.has(userId) ? map.get(userId)! : null),
    putTree: async (userId, tree) => void map.set(userId, tree),
    deleteTree: async (userId) => void map.delete(userId),
  };
}

describe("SupabaseRepository", () => {
  it("save then load returns the tree", async () => {
    const repo = new SupabaseRepository(makeCloudStore(), USER);
    const t = createTree(profile, gen, NOW);
    await repo.save(t);
    const loaded = await repo.load();
    expect(loaded?.id).toBe(t.id);
  });

  it("load when empty returns null", async () => {
    const repo = new SupabaseRepository(makeCloudStore(), USER);
    expect(await repo.load()).toBeNull();
  });

  it("backfills goals and activity for an old tree missing those fields", async () => {
    const store = makeCloudStore();
    const t = createTree(profile, gen, NOW);
    const legacy = { ...t } as Record<string, unknown>;
    delete legacy.goals; // 模拟旧树缺字段
    delete legacy.activity;
    // putTree 期望 LifeTree，这里刻意塞旧形状以测试 load 时的补字段
    await store.putTree(USER, legacy as unknown as LifeTree);
    const repo = new SupabaseRepository(store, USER);
    const loaded = await repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.goals).toEqual([]);
    expect(loaded!.activity).toEqual([]);
  });

  it("parses a tree stored as a JSON string", async () => {
    const t = createTree(profile, gen, NOW);
    // 模拟把 LifeTree 以 JSON 字符串存进去的后端
    const stringStore: CloudStore = {
      getTree: async () => JSON.stringify(t),
      putTree: async () => {},
      deleteTree: async () => {},
    };
    const repo = new SupabaseRepository(stringStore, USER);
    const loaded = await repo.load();
    expect(loaded?.id).toBe(t.id);
  });

  it("clear removes the tree", async () => {
    const store = makeCloudStore();
    const repo = new SupabaseRepository(store, USER);
    await repo.save(createTree(profile, gen, NOW));
    await repo.clear();
    expect(await repo.load()).toBeNull();
  });

  it("load returns null (no throw) when getTree throws", async () => {
    const throwingStore: CloudStore = {
      getTree: async () => {
        throw new Error("network down");
      },
      putTree: async () => {},
      deleteTree: async () => {},
    };
    const repo = new SupabaseRepository(throwingStore, USER);
    await expect(repo.load()).resolves.toBeNull();
  });
});
