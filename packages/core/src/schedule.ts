import type { LifeTree } from "./types";
import { findItem, updateHabit, updateTask } from "./goalTree";

// ───────────────────────────────────────────────────────────────────────────
// schedule —— 日视图时间块排程的纯函数。时刻一律本地 HH:MM 24h；分钟自午夜起算。
// 不用 Date.now/Math.random：确定性、可测。
// 模型：嵌套目标 —— startTime/durationMin 落在一次性 Task 或重复 Habit（按 id 定位）。
// ───────────────────────────────────────────────────────────────────────────

export const DEFAULT_DURATION_MIN = 60;
export const DEFAULT_DAY_START = "07:00";
export const DEFAULT_DAY_END = "23:00";
export const DEFAULT_GAP_MIN = 10;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
export function toHHMM(min: number): string {
  const mm = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
}

export interface ArrangeItem { id: string; durationMin?: number }
export interface ArrangeResult { id: string; startTime: string; durationMin: number }

// 贪心顺排：从 window.start 起，每件按其时长(默认60)依次排，块之间留 gapMin 分钟，保证不重叠、有先后。
// window.end 作软目标（MVP 不强制压缩；若排不下就继续顺排，调用方可提示）。纯函数、确定性。
export function arrangeDay(
  items: ArrangeItem[],
  opts?: { start?: string; end?: string; gapMin?: number },
): ArrangeResult[] {
  const start = toMinutes(opts?.start ?? DEFAULT_DAY_START);
  const gap = opts?.gapMin ?? DEFAULT_GAP_MIN;
  let cursor = start;
  const out: ArrangeResult[] = [];
  for (const it of items) {
    const durationMin = it.durationMin && it.durationMin > 0 ? it.durationMin : DEFAULT_DURATION_MIN;
    out.push({ id: it.id, startTime: toHHMM(cursor), durationMin });
    cursor += durationMin + gap;
  }
  return out;
}

// 设/清 某行动（一次性 Task 或重复 Habit，按 id 定位）的开始时间(+可选时长)。
// startTime=null 清掉(连带不强制清 duration)；durationMin 不传则保留旧值。
export function setActionTime(
  tree: LifeTree,
  actionId: string,
  startTime: string | null,
  durationMin?: number,
): LifeTree {
  const loc = findItem(tree, actionId);
  if (!loc) return tree;
  const patch = {
    startTime: startTime ?? undefined,
    durationMin: durationMin ?? loc.item.durationMin,
  };
  return loc.kind === "task"
    ? updateTask(tree, actionId, patch)
    : updateHabit(tree, actionId, patch);
}

export function dayWindow(tree: LifeTree): { start: string; end: string } {
  const start = tree.dayStart ?? DEFAULT_DAY_START;
  const end = tree.dayEnd ?? DEFAULT_DAY_END;
  // 兜底：退化窗（睡<=醒，或跨午夜）会让日视图算出零/负高度的时间轴。
  // 这是两端共用的读取点 → 在此归一，退回默认窗，保证 end>start。
  if (toMinutes(end) <= toMinutes(start)) return { start: DEFAULT_DAY_START, end: DEFAULT_DAY_END };
  return { start, end };
}
export function setDayWindow(tree: LifeTree, start: string, end: string): LifeTree {
  return { ...tree, dayStart: start, dayEnd: end };
}
