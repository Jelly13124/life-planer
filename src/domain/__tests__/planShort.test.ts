import { describe, it, expect } from "vitest";
import { localPlanShort } from "@/domain/planShort";
import { addDays } from "@/domain/daily";

// 造若干任务/习惯的小工具
const tasks = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, text: `任务${i}` }));
const weekly = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `w${i}`, text: `习惯${i}`, repeat: "weekly" as const }));

describe("localPlanShort", () => {
  it("empty inputs → empty plan", () => {
    const r = localPlanShort({
      startDate: "2026-06-23",
      endDate: "2026-07-07",
      today: "2026-06-23",
      tasks: [],
      habits: [],
    });
    expect(r.taskDates).toEqual({});
    expect(r.habitWeekdays).toEqual({});
  });

  it("single task → window first day", () => {
    const r = localPlanShort({
      startDate: "2026-06-23",
      endDate: "2026-07-07",
      today: "2026-06-23",
      tasks: tasks(1),
      habits: [],
    });
    expect(r.taskDates.t0).toBe("2026-06-23");
  });

  it("spreads tasks evenly: first on start, last on end, distributed between", () => {
    const start = "2026-06-23";
    const end = "2026-07-07"; // 15-day window inclusive (D=15, D-1=14)
    const r = localPlanShort({ startDate: start, endDate: end, today: start, tasks: tasks(3), habits: [] });
    // i=0 → +0; i=1 → round(1*14/2)=7; i=2 → +14
    expect(r.taskDates.t0).toBe(start);
    expect(r.taskDates.t1).toBe(addDays(start, 7));
    expect(r.taskDates.t2).toBe(end);
  });

  it("does not bunch all on day one and does not fill every day (N<D)", () => {
    const start = "2026-06-23";
    const end = addDays(start, 13); // D=14
    const r = localPlanShort({ startDate: start, endDate: end, today: start, tasks: tasks(4), habits: [] });
    const dates = Object.values(r.taskDates);
    const uniq = new Set(dates);
    // 4 tasks over 14 days → 4 distinct days, not all on the first, not 14.
    expect(uniq.size).toBe(4);
    expect(dates.filter((d) => d === start).length).toBe(1);
    expect(uniq.size).toBeLessThan(14);
  });

  it("even spread for several N over various D — endpoints always anchored", () => {
    const start = "2026-06-01";
    for (const N of [2, 3, 5, 8]) {
      for (const D of [7, 14, 30]) {
        const end = addDays(start, D - 1);
        const r = localPlanShort({ startDate: start, endDate: end, today: start, tasks: tasks(N), habits: [] });
        const ts = tasks(N);
        expect(r.taskDates[ts[0].id]).toBe(start); // first on start
        expect(r.taskDates[ts[N - 1].id]).toBe(end); // last on end
        // monotonic non-decreasing across the window
        let prev = start;
        for (const tk of ts) {
          expect(r.taskDates[tk.id] >= prev).toBe(true);
          prev = r.taskDates[tk.id];
        }
      }
    }
  });

  it("respects today floor: tasks never scheduled before today", () => {
    const start = "2026-06-01"; // before today
    const today = "2026-06-23";
    const end = "2026-07-07";
    const r = localPlanShort({ startDate: start, endDate: end, today, tasks: tasks(3), habits: [] });
    for (const d of Object.values(r.taskDates)) {
      expect(d >= today).toBe(true);
    }
    // window starts at today, ends at endDate
    expect(r.taskDates.t0).toBe(today);
    expect(r.taskDates.t2).toBe(end);
  });

  it("missing/invalid endDate → 14-day window from start", () => {
    const start = "2026-06-23";
    const r1 = localPlanShort({ startDate: start, endDate: "", today: start, tasks: tasks(2), habits: [] });
    expect(r1.taskDates.t0).toBe(start);
    expect(r1.taskDates.t1).toBe(addDays(start, 13)); // D=14 → last on +13
    // endDate earlier than window start also falls back
    const r2 = localPlanShort({ startDate: start, endDate: "2020-01-01", today: start, tasks: tasks(2), habits: [] });
    expect(r2.taskDates.t1).toBe(addDays(start, 13));
  });

  it("weekly habit weekday assignment: 1→Wed, 2→Mon/Thu, 3→Mon/Wed/Fri", () => {
    const base = { startDate: "2026-06-23", endDate: "2026-07-07", today: "2026-06-23", tasks: [] };
    const one = localPlanShort({ ...base, habits: weekly(1) });
    expect(one.habitWeekdays).toEqual({ w0: 3 });

    const two = localPlanShort({ ...base, habits: weekly(2) });
    expect(two.habitWeekdays).toEqual({ w0: 1, w1: 4 });

    const three = localPlanShort({ ...base, habits: weekly(3) });
    expect(three.habitWeekdays).toEqual({ w0: 1, w1: 3, w2: 5 });
  });

  it("more than 5 weekly habits → cycles through the weekday set deterministically", () => {
    const base = { startDate: "2026-06-23", endDate: "2026-07-07", today: "2026-06-23", tasks: [] };
    const r = localPlanShort({ ...base, habits: weekly(7) });
    // 7 weeklies use the 5-weekday spread [1,2,3,4,5] cycled
    expect(r.habitWeekdays).toEqual({
      w0: 1, w1: 2, w2: 3, w3: 4, w4: 5, w5: 1, w6: 2,
    });
  });

  it("daily habits are left untouched (no weekday assigned)", () => {
    const r = localPlanShort({
      startDate: "2026-06-23",
      endDate: "2026-07-07",
      today: "2026-06-23",
      tasks: [],
      habits: [
        { id: "d0", text: "每天读书", repeat: "daily" },
        { id: "w0", text: "每周复盘", repeat: "weekly" },
      ],
    });
    expect(r.habitWeekdays).toEqual({ w0: 3 });
    expect("d0" in r.habitWeekdays).toBe(false);
  });

  it("is deterministic — same input gives same output", () => {
    const input = {
      startDate: "2026-06-23",
      endDate: "2026-07-20",
      today: "2026-06-23",
      tasks: tasks(5),
      habits: weekly(3),
    };
    expect(localPlanShort(input)).toEqual(localPlanShort(input));
  });
});
