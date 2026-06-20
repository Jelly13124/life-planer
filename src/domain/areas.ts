import { LIFE_AREAS, type Goal, type LifeArea, type LifeTree } from "./types";
import { recurringActions } from "./habits";

export interface AreaSummary {
  area: LifeArea;
  score: number;       // profile.areas[area] clamped 0..100, default 50 if missing
  goals: Goal[];       // active goals (long or short) with goal.area === area
  habitCount: number;  // recurringActions whose goal.area === area
}

export function areaSummaries(tree: LifeTree): AreaSummary[] {
  const habits = recurringActions(tree);
  return LIFE_AREAS.map((area) => {
    const raw = tree.profile.areas[area];
    const score = Math.max(0, Math.min(100, raw ?? 50));
    const goals = (tree.goals ?? []).filter(
      (g) => g.status === "active" && g.area === area,
    );
    const habitCount = habits.filter((r) => r.goal.area === area).length;
    return { area, score, goals, habitCount };
  });
}
