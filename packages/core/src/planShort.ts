import { addDays } from "./daily";

// ───────────────────────────────────────────────────────────────────────────
// planShort —— 纯函数：把一个短期目标的"未排期一次性任务"均匀铺到它的时间窗内，
// 并给"无星期的每周习惯"分配合理铺开的星期几。完全确定性：不读 Date.now/Math.random，
// today 由 state 层注入。日期一律本地日 "YYYY-MM-DD"（与 daily.ts addDays 一致）。
//
// 设计要点：
//  - 任务"铺开"而非"填满"：N 个任务在 D 天的窗口里，第 i 个落在 start + round(i*(D-1)/(N-1))，
//    第一个落在窗口首日、最后一个落在窗口末日，中间均匀分布（N=1 → 落首日）。
//  - 不排到今天之前：窗口起点 = max(startDate, today)。
//  - 每周习惯（无 repeatWeekday）：按数量给一组铺开的星期几（1→周三；2→周一/周四；
//    3→周一/周三/周五；更多则在工作日为主的集合里循环），让一周内分布开。
//  - 每日习惯：不动（仍是每日）。
// ───────────────────────────────────────────────────────────────────────────

export interface PlanShortInput {
  startDate: string;
  endDate: string;
  today: string;
  tasks: { id: string; text: string }[];
  habits: { id: string; text: string; repeat: "daily" | "weekly" }[];
}

export interface PlanShortResult {
  taskDates: Record<string, string>; // taskId → 本地日 YYYY-MM-DD
  habitWeekdays: Record<string, number>; // weekly habitId → 0=周日…6=周六
}

// 无 endDate / endDate 早于窗口起点时，默认用 14 天窗口（含起点共 14 天）。
const DEFAULT_WINDOW_DAYS = 14;

// 给每周习惯铺开星期几的预设：按"本组习惯总数"取一套均匀分布的工作日集合。
// 1→周三(3)；2→周一/周四(1,4)；3→周一/周三/周五(1,3,5)；4→周一/周二/周四/周五；5→周一…周五。
// 超过 5 个时在这套五工作日集合里循环复用（确定性）。
const WEEKLY_SPREADS: Record<number, number[]> = {
  1: [3],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
};

// 取窗口 [start, end]（含两端）的整数天数 D（>=1）。start/end 均为 YYYY-MM-DD。
function windowDays(start: string, end: string): number {
  let d = 1;
  let cursor = start;
  // end 不早于 start（调用方已保证）；逐日推进直到追上 end。封顶避免异常输入死循环。
  while (cursor < end && d < 100000) {
    cursor = addDays(cursor, 1);
    d += 1;
  }
  return d;
}

export function localPlanShort(input: PlanShortInput): PlanShortResult {
  const { startDate, endDate, today, tasks, habits } = input;

  // 窗口起点：不早于今天（不把任务排到过去）。
  const winStart = startDate > today ? startDate : today;
  // 窗口终点：endDate 缺失或早于起点 → 起点起的默认 14 天窗口；否则用 endDate。
  const winEnd =
    !endDate || endDate < winStart ? addDays(winStart, DEFAULT_WINDOW_DAYS - 1) : endDate;

  const D = windowDays(winStart, winEnd); // 窗口天数，>=1
  const N = tasks.length;

  // 任务：均匀铺开。N=1 → 落首日；否则第 i 个落在 round(i*(D-1)/(N-1)) 偏移。
  const taskDates: Record<string, string> = {};
  for (let i = 0; i < N; i++) {
    const offset = N <= 1 ? 0 : Math.round((i * (D - 1)) / (N - 1));
    taskDates[tasks[i].id] = addDays(winStart, offset);
  }

  // 每周习惯（去重 id）→ 取一套均匀星期几集合，按出现顺序分配。每日习惯不动。
  const weeklies = habits.filter((h) => h.repeat === "weekly");
  const spread = WEEKLY_SPREADS[Math.min(weeklies.length, 5)] ?? WEEKLY_SPREADS[5];
  const habitWeekdays: Record<string, number> = {};
  weeklies.forEach((h, i) => {
    habitWeekdays[h.id] = spread[i % spread.length];
  });

  return { taskDates, habitWeekdays };
}
