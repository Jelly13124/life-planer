import { describe, it, expect } from "vitest";
import {
  FREE_FREEZES_PER_MONTH,
  freezesUsedInMonth,
  freezesLeft,
  currentStreakWithFreeze,
  applyAutoFreeze,
} from "../streak";
import type { LifeTree, Profile } from "../types";

const profile = (): Profile => ({
  name: "测试", age: 28, education: "bachelor", major: "", occupation: "", salary: "10to20",
  hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "single", location: "上海",
  status: "", snapshot: "", crossroad: "",
  areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 },
});

const NOW = "2026-07-01T00:00:00.000Z";

function baseTree(overrides: Partial<LifeTree> = {}): LifeTree {
  return {
    id: "t1",
    profile: profile(),
    horizonYears: 15,
    paths: [],
    decisions: [],
    goals: [],
    tasks: [],
    choices: [],
    activity: [],
    calendarFeeds: [],
    freezeDays: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function completedDay(date: string) {
  return { date, plannedActionIds: [], completedActionIds: ["x"] };
}

describe("streak freezes", () => {
  it("currentStreakWithFreeze matches the plain streak when there are no freezeDays", () => {
    const t = baseTree({
      activity: [completedDay("2026-07-02"), completedDay("2026-07-03"), completedDay("2026-07-04")],
    });
    expect(currentStreakWithFreeze(t, "2026-07-04")).toBe(3);
  });

  it("a 1-day gap covered by freezeDays keeps the streak running through it", () => {
    const t = baseTree({
      activity: [completedDay("2026-07-01"), completedDay("2026-07-02"), completedDay("2026-07-04")],
      freezeDays: ["2026-07-03"],
    });
    expect(currentStreakWithFreeze(t, "2026-07-04")).toBe(4);
  });

  it("freezesUsedInMonth counts only that month's freezeDays; freezesLeft = free - used", () => {
    const t = baseTree({ freezeDays: ["2026-06-28", "2026-07-05", "2026-07-10"] });
    expect(freezesUsedInMonth(t, "2026-07")).toBe(2);
    expect(freezesUsedInMonth(t, "2026-06")).toBe(1);
    expect(freezesLeft(t, "2026-07-15")).toBe(0);
  });

  it("applyAutoFreeze: yesterday empty, day before completed → freezes yesterday", () => {
    // today = 07-04; yesterday 07-03 has 0 completions; 07-02 completed.
    const t = baseTree({ activity: [completedDay("2026-07-02")] });
    const { tree, frozen } = applyAutoFreeze(t, "2026-07-04");
    expect(frozen).toEqual(["2026-07-03"]);
    expect(tree.freezeDays).toContain("2026-07-03");
  });

  it("cap: 2 freezes already used this month → applyAutoFreeze no-ops", () => {
    const t = baseTree({
      activity: [completedDay("2026-07-02")],
      freezeDays: ["2026-07-08", "2026-07-09"], // already used this month's 2 free freezes
    });
    const { tree, frozen } = applyAutoFreeze(t, "2026-07-04");
    expect(frozen).toEqual([]);
    expect(tree).toEqual(t);
  });

  it("gap > 2 days (more than available/allowed) → no-op", () => {
    // today = 07-05; 07-02..07-04 all empty (3-day gap); 07-01 completed.
    const t = baseTree({ activity: [completedDay("2026-07-01")] });
    const { tree, frozen } = applyAutoFreeze(t, "2026-07-05");
    expect(frozen).toEqual([]);
    expect(tree).toEqual(t);
  });

  it("is idempotent — running applyAutoFreeze twice: second run no-ops", () => {
    const t = baseTree({ activity: [completedDay("2026-07-02")] });
    const once = applyAutoFreeze(t, "2026-07-04");
    const twice = applyAutoFreeze(once.tree, "2026-07-04");
    expect(twice.frozen).toEqual([]);
    expect(twice.tree).toEqual(once.tree);
  });

  it("month rollover: freezes used in June don't count against July's allowance", () => {
    // June already has 2 freezeDays used (would be capped in June), but July is fresh.
    const t = baseTree({
      activity: [completedDay("2026-07-02")],
      freezeDays: ["2026-06-10", "2026-06-11"],
    });
    expect(freezesLeft(t, "2026-07-04")).toBe(FREE_FREEZES_PER_MONTH);
    const { frozen } = applyAutoFreeze(t, "2026-07-04");
    expect(frozen).toEqual(["2026-07-03"]);
  });
});
