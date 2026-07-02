import { describe, it, expect } from "vitest";
import { normalizeLoadedTree } from "../repository/normalize";

// A pre-migration tree shape (loose typing — simulates persisted old data with habits[]).
function oldTree(): any {
  return {
    id: "t1",
    profile: { name: "x", age: 30, areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 } },
    horizonYears: 15,
    paths: [],
    goals: [
      { id: "g1", kind: "long", parentGoalId: null, area: "health", title: "健身", status: "active", createdAt: "2026-01-01T00:00:00.000Z", metrics: [], tasks: [{ id: "tk1", text: "买装备", done: false }], habits: [{ id: "h1", text: "每天跑步", repeat: "daily", startTime: "07:00", durationMin: 30 }] },
    ],
    tasks: [],
    habits: [{ id: "h2", text: "每周复盘", repeat: "weekly", repeatWeekday: 0 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("normalizeLoadedTree — habits→tasks migration", () => {
  it("folds goal.habits into goal.tasks as repeating tasks (id + fields preserved)", () => {
    const t = normalizeLoadedTree(oldTree())!;
    const g = t.goals[0] as any;
    expect(g.habits).toBeUndefined();
    const h1 = g.tasks.find((x: any) => x.id === "h1");
    expect(h1).toMatchObject({ id: "h1", text: "每天跑步", repeat: "daily", startTime: "07:00", durationMin: 30, done: false });
    expect(g.tasks.find((x: any) => x.id === "tk1")).toBeTruthy();
  });

  it("folds tree.habits into tree.tasks and drops the habits field", () => {
    const t = normalizeLoadedTree(oldTree())! as any;
    expect(t.habits).toBeUndefined();
    expect(t.tasks.find((x: any) => x.id === "h2")).toMatchObject({ id: "h2", repeat: "weekly", repeatWeekday: 0, done: false });
  });

  it("is idempotent — re-normalizing already-migrated data is a no-op on tasks", () => {
    const once = normalizeLoadedTree(oldTree())!;
    const twice = normalizeLoadedTree(once as any)!;
    expect(twice.goals[0].tasks.length).toBe(once.goals[0].tasks.length);
    expect((twice as any).habits).toBeUndefined();
    expect(twice.tasks.length).toBe(once.tasks.length);
  });
});
