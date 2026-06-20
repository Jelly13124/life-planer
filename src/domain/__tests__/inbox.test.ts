import { describe, it, expect } from "vitest";
import { addInboxItem, removeInboxItem } from "@/domain/inbox";
import { createTree } from "@/domain/tree";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { LifeTree, Profile } from "@/domain/types";

const profile: Profile = {
  name: "测试员",
  age: 28,
  education: "bachelor",
  major: "计算机",
  occupation: "工程师",
  salary: "10to20",
  hasSideHustle: false,
  sideHustle: "",
  hobbies: "",
  relationship: "single",
  location: "北京",
  status: "在职",
  snapshot: "工程师",
  crossroad: "",
  areas: { career: 60, wealth: 50, relationships: 50, health: 60, growth: 55 },
};

const gen = new LocalPathGenerator();
const NOW = "2026-06-20T10:00:00.000Z";
const NOW2 = "2026-06-20T10:01:00.000Z";

const base = (): LifeTree => createTree(profile, gen, NOW);

describe("inbox domain", () => {
  it("addInboxItem prepends (newest first)", () => {
    let t = base();
    t = addInboxItem(t, "第一条", NOW);
    t = addInboxItem(t, "第二条", NOW2);
    expect(t.inbox).toHaveLength(2);
    expect(t.inbox[0].text).toBe("第二条"); // newest first
    expect(t.inbox[1].text).toBe("第一条");
  });

  it("addInboxItem trims whitespace", () => {
    const t = addInboxItem(base(), "  有空格  ", NOW);
    expect(t.inbox[0].text).toBe("有空格");
  });

  it("addInboxItem ignores empty / whitespace-only text", () => {
    const t1 = addInboxItem(base(), "", NOW);
    const t2 = addInboxItem(base(), "   ", NOW);
    expect(t1.inbox).toHaveLength(0);
    expect(t2.inbox).toHaveLength(0);
    // tree is returned unchanged (same reference via structural equality)
    expect(t1.inbox).toEqual([]);
    expect(t2.inbox).toEqual([]);
  });

  it("addInboxItem generates a stable id from text+now", () => {
    const t = addInboxItem(base(), "买牛奶", NOW);
    expect(t.inbox[0].id).toMatch(/^inbox-/);
    // same input → same id (deterministic)
    const t2 = addInboxItem(base(), "买牛奶", NOW);
    expect(t2.inbox[0].id).toBe(t.inbox[0].id);
  });

  it("addInboxItem sets createdAt to injected now", () => {
    const t = addInboxItem(base(), "test", NOW);
    expect(t.inbox[0].createdAt).toBe(NOW);
  });

  it("addInboxItem updates tree.updatedAt", () => {
    const t = addInboxItem(base(), "update test", NOW2);
    expect(t.updatedAt).toBe(NOW2);
  });

  it("addInboxItem keeps other tree fields intact", () => {
    const orig = base();
    const t = addInboxItem(orig, "something", NOW);
    expect(t.profile).toBe(orig.profile);
    expect(t.paths).toBe(orig.paths);
    expect(t.goals).toBe(orig.goals);
    expect(t.decisions).toBe(orig.decisions);
    expect(t.activity).toBe(orig.activity);
  });

  it("removeInboxItem removes by id", () => {
    let t = base();
    t = addInboxItem(t, "要删的", NOW);
    t = addInboxItem(t, "要留的", NOW2);
    const idToRemove = t.inbox.find((i) => i.text === "要删的")!.id;
    t = removeInboxItem(t, idToRemove, NOW2);
    expect(t.inbox).toHaveLength(1);
    expect(t.inbox[0].text).toBe("要留的");
  });

  it("removeInboxItem is a no-op for unknown id", () => {
    let t = base();
    t = addInboxItem(t, "保留", NOW);
    const before = t.inbox.length;
    t = removeInboxItem(t, "inbox-nonexistent", NOW2);
    expect(t.inbox).toHaveLength(before);
  });

  it("removeInboxItem updates tree.updatedAt", () => {
    let t = addInboxItem(base(), "item", NOW);
    const id = t.inbox[0].id;
    t = removeInboxItem(t, id, NOW2);
    expect(t.updatedAt).toBe(NOW2);
  });

  it("removeInboxItem keeps other tree fields intact", () => {
    let t = base();
    t = addInboxItem(t, "item", NOW);
    const id = t.inbox[0].id;
    const before = t;
    const after = removeInboxItem(t, id, NOW2);
    expect(after.profile).toBe(before.profile);
    expect(after.paths).toBe(before.paths);
    expect(after.goals).toBe(before.goals);
  });
});
