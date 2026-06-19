import { describe, it, expect } from "vitest";
import { createTree, addPath, removePath } from "@/domain/tree";
import { createDecision, upsertDecision } from "@/domain/decisions";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import {
  LocalStorageRepository,
  type KeyValueStore,
} from "@/domain/repository/localStorageRepo";
import type { Goal, Profile } from "@/domain/types";

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
  it("createTree starts single-line: only status-quo even if a crossroad is filled", () => {
    const t = createTree(profile, gen, NOW); // profile.crossroad = "要不要换城市"
    expect(t.paths.length).toBe(1);
    expect(t.paths[0].kind).toBe("status-quo");
    expect(t.createdAt).toBe(NOW);
    expect(t.goals).toEqual([]);
  });

  it("createTree with empty crossroad has only status-quo", () => {
    const t = createTree({ ...profile, crossroad: "  " }, gen, NOW);
    expect(t.paths.length).toBe(1);
    expect(t.paths[0].kind).toBe("status-quo");
  });

  it("addPath appends without mutating original", () => {
    const t = createTree(profile, gen, NOW);
    const t2 = addPath(t, "辞职创业", gen, NOW);
    expect(t.paths.length).toBe(1);
    expect(t2.paths.length).toBe(2);
    expect(t2.paths[1].choiceLabel).toBe("辞职创业");
  });

  it("addPath ignores empty label", () => {
    const t = createTree(profile, gen, NOW);
    expect(addPath(t, "   ", gen, NOW).paths.length).toBe(t.paths.length);
  });

  it("root choices fork at a realistic future age, not all from now", () => {
    // profile.age = 30；不同选择推测出不同的分叉年龄 → 从不同时间点长出。
    const t = createTree({ ...profile, crossroad: "" }, gen, NOW); // 只有维持现状
    const t1 = addPath(t, "辞职做自媒体", gen, NOW); // 含'辞职/自媒体' → +2
    const p1 = t1.paths[t1.paths.length - 1];
    expect(p1.forkAge).toBe(profile.age + 2);

    const t2 = addPath(t1, "去读研", gen, NOW); // 含'读研' → +1
    const p2 = t2.paths[t2.paths.length - 1];
    expect(p2.forkAge).toBe(profile.age + 1);

    // 两条根分支从不同的人生时间点分叉
    expect(p1.forkAge).not.toBe(p2.forkAge);
    // 维持现状仍从现在起
    expect(t.paths[0].forkAge).toBe(profile.age);
  });

  it("addPath honors an explicit forkAge (user-adjusted timing)", () => {
    const t = createTree(profile, gen, NOW);
    const t2 = addPath(t, "辞职做自媒体", gen, NOW, { forkAge: profile.age });
    const p = t2.paths[t2.paths.length - 1];
    expect(p.forkAge).toBe(profile.age); // 用户选"现在就开始"覆盖推测
  });

  it("folding several addPath onto one base yields distinct ids (batch '全部画上')", () => {
    // 复刻 addBranches 的折叠：在同一个 base 上依次 addPath。每条都要真的加进去，
    // 且 id 互不相同（这正是逐条 addBranch 因 ref 滞后而做不到的）。
    const base = createTree(profile, gen, NOW);
    const labels = ["转战自媒体全职", "搬去加拿大或欧洲", "考个云计算认证", "回亚洲加入初创"];
    let t = base;
    for (const l of labels) t = addPath(t, l, gen, NOW);
    expect(t.paths.length).toBe(base.paths.length + labels.length);
    const added = t.paths.filter((p) => !base.paths.some((b) => b.id === p.id));
    expect(added.map((p) => p.choiceLabel)).toEqual(labels);
    expect(new Set(added.map((p) => p.id)).size).toBe(labels.length); // 全部唯一
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

  it("removePath also prunes decisions attached to removed paths", () => {
    let t = addPath(createTree(profile, gen, NOW), "读研", gen, NOW);
    const choice = t.paths.find((p) => p.kind === "choice")!;
    t = upsertDecision(
      t,
      createDecision(
        {
          pathId: choice.id,
          choiceLabel: choice.choiceLabel,
          rationale: "",
          expectation: "",
          confidence: 50,
          reversibility: "two-way",
          horizon: "90d",
        },
        NOW,
      ),
    );
    expect(t.decisions).toHaveLength(1);
    const t2 = removePath(t, choice.id, NOW);
    expect(t2.decisions).toHaveLength(0); // 删分支时连带清掉它的决定，避免幽灵复盘提示
  });

  it("createTree starts with empty activity", () => {
    const t = createTree(profile, gen, NOW);
    expect(t.activity).toEqual([]);
  });

  it("removePath also prunes a long-term goal attached to the removed branch", () => {
    let t = addPath(createTree(profile, gen, NOW), "去读研", gen, NOW);
    const choice = t.paths.find((p) => p.kind === "choice")!;
    const goal: Goal = {
      id: "goal-x",
      area: "career",
      horizon: "long",
      title: "读完研换赛道",
      why: "",
      status: "active",
      createdAt: NOW,
      parentGoalId: null,
      pathId: choice.id,
      actions: [],
    };
    t = { ...t, goals: [goal] };
    const t2 = removePath(t, choice.id, NOW);
    expect(t2.goals).toHaveLength(0); // 分支没了，挂在它上面的长期目标也清掉
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

  it("backfills decisions: [] for old trees missing the field", () => {
    const store = makeStore();
    const t = createTree(profile, gen, NOW);
    const legacy = { ...t } as Record<string, unknown>;
    delete legacy.decisions; // 模拟旧版没有 decisions 的树
    store.setItem("lifeplanner.tree.v3", JSON.stringify(legacy));
    const repo = new LocalStorageRepository(store);
    const loaded = repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.decisions).toEqual([]);
  });

  it("backfills goals: [] for old trees missing the field", () => {
    const store = makeStore();
    const t = createTree(profile, gen, NOW);
    const legacy = { ...t } as Record<string, unknown>;
    delete legacy.goals; // 模拟旧版没有 goals 的树
    store.setItem("lifeplanner.tree.v3", JSON.stringify(legacy));
    const repo = new LocalStorageRepository(store);
    const loaded = repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.goals).toEqual([]);
  });
});
