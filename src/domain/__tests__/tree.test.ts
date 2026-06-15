import { describe, it, expect } from "vitest";
import { createTree, addPath, removePath } from "@/domain/tree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import {
  LocalStorageRepository,
  type KeyValueStore,
} from "@/domain/repository/localStorageRepo";
import type { Profile } from "@/domain/types";

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

describe("tree operations", () => {
  it("createTree has status-quo + one crossroad choice", () => {
    const t = createTree(profile, gen, NOW);
    expect(t.paths.length).toBe(2);
    expect(t.paths[0].kind).toBe("status-quo");
    expect(t.paths[1].kind).toBe("choice");
    expect(t.createdAt).toBe(NOW);
  });

  it("createTree with empty crossroad has only status-quo", () => {
    const t = createTree({ ...profile, crossroad: "  " }, gen, NOW);
    expect(t.paths.length).toBe(1);
    expect(t.paths[0].kind).toBe("status-quo");
  });

  it("addPath appends without mutating original", () => {
    const t = createTree(profile, gen, NOW);
    const t2 = addPath(t, "辞职创业", gen, NOW);
    expect(t.paths.length).toBe(2);
    expect(t2.paths.length).toBe(3);
    expect(t2.paths[2].choiceLabel).toBe("辞职创业");
  });

  it("addPath ignores empty label", () => {
    const t = createTree(profile, gen, NOW);
    expect(addPath(t, "   ", gen, NOW).paths.length).toBe(t.paths.length);
  });

  it("removePath removes a choice but never status-quo", () => {
    const t = addPath(createTree(profile, gen, NOW), "读研", gen, NOW);
    const choice = t.paths.find((p) => p.kind === "choice")!;
    const t2 = removePath(t, choice.id, NOW);
    expect(t2.paths.find((p) => p.id === choice.id)).toBeUndefined();

    const sq = t.paths.find((p) => p.kind === "status-quo")!;
    const t3 = removePath(t, sq.id, NOW);
    expect(t3.paths.find((p) => p.id === sq.id)).toBeDefined();
  });
});

describe("LocalStorageRepository", () => {
  function makeStore(): KeyValueStore {
    const map = new Map<string, string>();
    return {
      getItem: (k) => (map.has(k) ? map.get(k)! : null),
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };
  }

  it("round-trips a tree", () => {
    const repo = new LocalStorageRepository(makeStore());
    expect(repo.load()).toBeNull();
    const t = createTree(profile, gen, NOW);
    repo.save(t);
    expect(repo.load()?.id).toBe(t.id);
  });

  it("returns null on corrupt data", () => {
    const store = makeStore();
    store.setItem("lifeplanner.tree.v1", "{not json");
    const repo = new LocalStorageRepository(store);
    expect(repo.load()).toBeNull();
  });

  it("clear removes the tree", () => {
    const repo = new LocalStorageRepository(makeStore());
    repo.save(createTree(profile, gen, NOW));
    repo.clear();
    expect(repo.load()).toBeNull();
  });
});
