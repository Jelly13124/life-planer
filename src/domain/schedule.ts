import type { LifeTree } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// schedule —— 日视图时间块排程的纯函数。时刻一律本地 HH:MM 24h；分钟自午夜起算。
// 不用 Date.now/Math.random：确定性、可测。
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

// 设/清 某行动的开始时间(+可选时长)。startTime=null 清掉(连带不强制清 duration)。
export function setActionTime(
  tree: LifeTree,
  actionId: string,
  startTime: string | null,
  durationMin?: number,
): LifeTree {
  return {
    ...tree,
    goals: (tree.goals ?? []).map((g) =>
      g.actions.some((a) => a.id === actionId)
        ? {
            ...g,
            actions: g.actions.map((a) =>
              a.id === actionId
                ? { ...a, startTime: startTime ?? undefined, durationMin: durationMin ?? a.durationMin }
                : a,
            ),
          }
        : g,
    ),
  };
}

export function dayWindow(tree: LifeTree): { start: string; end: string } {
  return { start: tree.dayStart ?? DEFAULT_DAY_START, end: tree.dayEnd ?? DEFAULT_DAY_END };
}
export function setDayWindow(tree: LifeTree, start: string, end: string): LifeTree {
  return { ...tree, dayStart: start, dayEnd: end };
}
