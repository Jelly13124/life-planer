import { describe, it, expect } from "vitest";
import {
  DEFAULT_DURATION_MIN,
  DEFAULT_DAY_START,
  DEFAULT_DAY_END,
  toMinutes,
  toHHMM,
  arrangeDay,
  setActionTime,
  dayWindow,
  setDayWindow,
} from "@/domain/schedule";
import { createTree } from "@/domain/tree";
import { createGoal, upsertGoal, setGoalActions } from "@/domain/goals";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import type { LifeTree, Profile } from "@/domain/types";

const profile: Profile = {
  name: "小林", age: 30, education: "bachelor", major: "视觉传达", occupation: "设计师",
  salary: "5to10", hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "dating",
  location: "杭州", status: "工作5年", snapshot: "设计师", crossroad: "",
  areas: { career: 50, wealth: 45, relationships: 55, health: 60, growth: 50 },
};
const gen = new LocalPathGenerator();
const NOW = "2026-06-19T00:00:00.000Z";

// 一棵带一个短期目标(三条行动)的树
function withActions(): { tree: LifeTree; goalId: string; a: string[] } {
  let t = createTree(profile, gen, NOW);
  let g = createGoal({ area: "growth", horizon: "short", title: "找工作", why: "" }, NOW);
  g = setGoalActions(g, ["改简历", "投简历", "背单词"]);
  t = upsertGoal(t, g);
  return { tree: t, goalId: g.id, a: g.actions.map((x) => x.id) };
}

describe("schedule domain", () => {
  it("toMinutes / toHHMM round-trip", () => {
    expect(toMinutes("07:30")).toBe(450);
    expect(toHHMM(450)).toBe("07:30");
    expect(toHHMM(toMinutes("07:30"))).toBe("07:30");
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("23:59")).toBe(23 * 60 + 59);
  });

  it("toHHMM pads and wraps modulo 1440", () => {
    expect(toHHMM(0)).toBe("00:00");
    expect(toHHMM(65)).toBe("01:05"); // padding minutes
    expect(toHHMM(540)).toBe("09:00");
    expect(toHHMM(1440)).toBe("00:00"); // wrap
    expect(toHHMM(1500)).toBe("01:00"); // wrap past midnight
    expect(toHHMM(-60)).toBe("23:00"); // negative wraps
  });

  it("arrangeDay: 3 default-duration items → 07:00 / 08:10 / 09:20 (60min + 10min gap)", () => {
    const out = arrangeDay([{ id: "x" }, { id: "y" }, { id: "z" }]);
    expect(out.map((r) => r.startTime)).toEqual(["07:00", "08:10", "09:20"]);
    expect(out.map((r) => r.durationMin)).toEqual([
      DEFAULT_DURATION_MIN, DEFAULT_DURATION_MIN, DEFAULT_DURATION_MIN,
    ]);
    expect(out.map((r) => r.id)).toEqual(["x", "y", "z"]);
  });

  it("arrangeDay: custom durationMin respected", () => {
    const out = arrangeDay([
      { id: "a", durationMin: 30 },
      { id: "b", durationMin: 90 },
      { id: "c" },
    ]);
    // a: 07:00 (+30+10) → b: 07:40 (+90+10) → c: 09:20
    expect(out.map((r) => r.startTime)).toEqual(["07:00", "07:40", "09:20"]);
    expect(out.map((r) => r.durationMin)).toEqual([30, 90, DEFAULT_DURATION_MIN]);
  });

  it("arrangeDay: custom start option", () => {
    const out = arrangeDay([{ id: "a" }, { id: "b" }], { start: "09:00" });
    expect(out.map((r) => r.startTime)).toEqual(["09:00", "10:10"]);
  });

  it("arrangeDay: gapMin=0 → back-to-back", () => {
    const out = arrangeDay([{ id: "a" }, { id: "b" }, { id: "c" }], { gapMin: 0 });
    expect(out.map((r) => r.startTime)).toEqual(["07:00", "08:00", "09:00"]);
  });

  it("arrangeDay: empty → []", () => {
    expect(arrangeDay([])).toEqual([]);
  });

  it("arrangeDay: non-positive durationMin falls back to default", () => {
    const out = arrangeDay([{ id: "a", durationMin: 0 }, { id: "b", durationMin: -5 }]);
    expect(out.map((r) => r.durationMin)).toEqual([DEFAULT_DURATION_MIN, DEFAULT_DURATION_MIN]);
  });

  it("arrangeDay: guarantees no overlap and preserves order", () => {
    const out = arrangeDay(
      [{ id: "a", durationMin: 45 }, { id: "b", durationMin: 30 }, { id: "c", durationMin: 120 }, { id: "d" }],
      { gapMin: 15 },
    );
    for (let i = 1; i < out.length; i++) {
      const cur = out[i - 1];
      const next = out[i];
      expect(toMinutes(next.startTime)).toBeGreaterThanOrEqual(
        toMinutes(cur.startTime) + cur.durationMin,
      );
    }
  });

  it("setActionTime sets startTime + duration", () => {
    const w = withActions();
    const tree = setActionTime(w.tree, w.a[0], "09:30", 45);
    const action = tree.goals[0].actions.find((x) => x.id === w.a[0])!;
    expect(action.startTime).toBe("09:30");
    expect(action.durationMin).toBe(45);
  });

  it("setActionTime: startTime=null clears startTime (keeps duration)", () => {
    const w = withActions();
    let tree = setActionTime(w.tree, w.a[0], "09:30", 45);
    tree = setActionTime(tree, w.a[0], null);
    const action = tree.goals[0].actions.find((x) => x.id === w.a[0])!;
    expect(action.startTime).toBeUndefined();
    expect(action.durationMin).toBe(45); // duration retained
  });

  it("setActionTime: only touches the target action", () => {
    const w = withActions();
    const tree = setActionTime(w.tree, w.a[1], "10:00");
    const others = tree.goals[0].actions.filter((x) => x.id !== w.a[1]);
    for (const o of others) expect(o.startTime).toBeUndefined();
    expect(tree.goals[0].actions.find((x) => x.id === w.a[1])!.startTime).toBe("10:00");
  });

  it("dayWindow defaults when unset", () => {
    const w = withActions();
    expect(dayWindow(w.tree)).toEqual({ start: DEFAULT_DAY_START, end: DEFAULT_DAY_END });
  });

  it("setDayWindow then dayWindow returns it", () => {
    const w = withActions();
    const tree = setDayWindow(w.tree, "06:00", "22:00");
    expect(dayWindow(tree)).toEqual({ start: "06:00", end: "22:00" });
  });
});
