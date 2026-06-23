import type { LifeTree } from "./types";
import { localDay } from "./daily";
import { actionsOnDay } from "./calendar";

// ───────────────────────────────────────────────────────────────────────────
// reminders —— 到期提醒纯函数（P3）。`now` 为注入的 ISO 字符串，模块内不取 Date.now。
// 把当天/逾期/即将开始三类提醒从树里算出来，供应用内「今日提醒」与通知调度复用。
// 日期一律本地日 "YYYY-MM-DD"；时刻 "HH:MM" 24h（与 daily/calendar 一致）。
// ───────────────────────────────────────────────────────────────────────────

export interface ReminderItem {
  id: string;
  text: string;
  goalTitle: string | null;
  date: string; // 本地日 YYYY-MM-DD
  startTime?: string; // 本地时刻 HH:MM（仅 timed 项有）
}

export interface DueReminders {
  overdue: ReminderItem[];
  today: ReminderItem[];
  upcomingSoon: ReminderItem[];
}

// 默认「即将开始」窗口：未来 60 分钟内的 timed 项。
const SOON_WINDOW_MIN = 60;

// "HH:MM" → 当天分钟数；非法/缺失 → null。
function minutesOfTime(t: string | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

// 把注入的 ISO `now` 解析成本地日 + 当天分钟数（用本地时区，与用户钟表一致）。
function nowParts(now: string): { day: string; minutes: number } {
  const d = new Date(now);
  return { day: localDay(d), minutes: d.getHours() * 60 + d.getMinutes() };
}

// 到期提醒：基于注入的 `now`，分今天 / 逾期 / 即将开始三类。
//  - today：今天该出现的一次性任务 + 该做的习惯（含各自 startTime）。
//  - overdue：scheduledDate < 今天 且未完成 的一次性任务。
//  - upcomingSoon：今天 timed 且 startTime 落在 [now, now+60min] 的项（「快开始了」提示）。
export function dueReminders(
  tree: LifeTree,
  now: string,
  soonWindowMin: number = SOON_WINDOW_MIN,
): DueReminders {
  const { day: today, minutes: nowMin } = nowParts(now);

  // —— today：复用 calendar.actionsOnDay（已含 active 目标过滤 + 习惯时间窗 + 散项）——
  const todayActions = actionsOnDay(tree, today);
  const today_: ReminderItem[] = todayActions.map(({ goal, item }) => ({
    id: item.id,
    text: item.text,
    goalTitle: goal ? goal.title : null,
    date: today,
    startTime: item.startTime,
  }));

  // —— upcomingSoon：今天里 timed 且 startTime 在 [now, now+window] 内的项 ——
  const upcomingSoon: ReminderItem[] = today_
    .filter((r) => {
      const m = minutesOfTime(r.startTime);
      return m != null && m >= nowMin && m <= nowMin + soonWindowMin;
    })
    .sort((a, b) => (minutesOfTime(a.startTime)! - minutesOfTime(b.startTime)!));

  // —— overdue：未完成、scheduledDate 早于今天 的一次性任务（散任务恒计入；目标任务仅 active）——
  const overdue: ReminderItem[] = [];
  for (let i = 0; i < tree.goals.length; i++) {
    const g = tree.goals[i];
    if (g.status !== "active") continue;
    for (const task of g.tasks ?? []) {
      if (!task.done && task.scheduledDate && task.scheduledDate < today) {
        overdue.push({
          id: task.id,
          text: task.text,
          goalTitle: g.title,
          date: task.scheduledDate,
          startTime: task.startTime,
        });
      }
    }
  }
  for (const task of tree.tasks ?? []) {
    if (!task.done && task.scheduledDate && task.scheduledDate < today) {
      overdue.push({
        id: task.id,
        text: task.text,
        goalTitle: null,
        date: task.scheduledDate,
        startTime: task.startTime,
      });
    }
  }
  overdue.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { overdue, today: today_, upcomingSoon };
}
