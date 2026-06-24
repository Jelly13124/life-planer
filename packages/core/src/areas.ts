import { LIFE_AREAS, type Goal, type LifeArea, type LifeTree } from "./types";
import { longGoals } from "./goalTree";
import { recurringActions } from "./habits";

export interface AreaSummary {
  area: LifeArea;
  score: number;       // profile.areas[area] clamped 0..100, default 50 if missing
  goals: Goal[];       // active LONG goals with goal.area === area（短期目标归在其长期下，不在此列）
  habitCount: number;  // recurring habits whose goal.area === area（长/短目标上的都计）
}

export function areaSummaries(tree: LifeTree): AreaSummary[] {
  const habits = recurringActions(tree);
  const longs = longGoals(tree);
  return LIFE_AREAS.map((area) => {
    const raw = tree.profile.areas[area];
    const score = Math.max(0, Math.min(100, raw ?? 50));
    // 领域卡只列长期目标（方向/身份级）；短期目标挂在其长期父目标之下。
    const goals = longs.filter((g) => g.status === "active" && g.area === area);
    const habitCount = habits.filter((r) => r.goal?.area === area).length;
    return { area, score, goals, habitCount };
  });
}
