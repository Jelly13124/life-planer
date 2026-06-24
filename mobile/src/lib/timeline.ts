// 日视图时间轴布局小工具（mobile 端展示层）。把 HH:MM + 时长映射成像素位置。
// 复用核心 schedule.toMinutes/toHHMM（确定性），不在这里取当前时间。
import { toMinutes } from "@lifeplanner/core/schedule";

export const PX_PER_MIN = 0.9; // 每分钟像素高（1 小时 = 54px）
export const MIN_BLOCK_MIN = 30; // 块最小视觉时长，避免太矮点不到

// 作息窗的小时刻度（含首尾整点）。
export function hourTicks(winStart: string, winEnd: string): number[] {
  const sh = Math.floor(toMinutes(winStart) / 60);
  const eh = Math.ceil(toMinutes(winEnd) / 60);
  const out: number[] = [];
  for (let h = sh; h <= eh; h++) out.push(h);
  return out;
}

// 时间轴总高度（px）。
export function timelineHeight(winStart: string, winEnd: string): number {
  return Math.max(0, (toMinutes(winEnd) - toMinutes(winStart))) * PX_PER_MIN;
}

// 某小时刻度线相对作息窗起点的 top（px）。
export function hourTop(hour: number, winStart: string): number {
  return (hour * 60 - toMinutes(winStart)) * PX_PER_MIN;
}

// 一个时间块的 {top,height}（px），相对作息窗起点。
export function blockLayout(
  startTime: string,
  durationMin: number | undefined,
  winStart: string,
): { top: number; height: number } {
  const top = (toMinutes(startTime) - toMinutes(winStart)) * PX_PER_MIN;
  const dur = Math.max(MIN_BLOCK_MIN, durationMin && durationMin > 0 ? durationMin : 60);
  return { top, height: dur * PX_PER_MIN };
}
