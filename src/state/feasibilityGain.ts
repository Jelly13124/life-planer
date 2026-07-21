import { effectiveFeasibility, roundFeasibility } from "@/domain/feasibility";
import { findItem } from "@/domain/goalTree";
import type { LifeTree } from "@/domain/types";

export function feasibilityGain(
  before: LifeTree,
  after: LifeTree,
  actionId: string,
  wasDone: boolean,
): { pathLabel: string; before: number; after: number } | null {
  if (wasDone) return null;
  const location = findItem(before, actionId);
  const pathId = location?.goal?.pathId;
  if (!pathId) return null;

  const beforePath = before.paths.find((path) => path.id === pathId);
  const afterPath = after.paths.find((path) => path.id === pathId);
  if (!beforePath || !afterPath) return null;

  const beforeEffective = effectiveFeasibility(before, beforePath);
  const afterEffective = effectiveFeasibility(after, afterPath);
  if (!beforeEffective || !afterEffective) return null;

  const beforeRounded = roundFeasibility(beforeEffective.value);
  const afterRounded = roundFeasibility(afterEffective.value);
  if (afterRounded <= beforeRounded) return null;

  return {
    pathLabel: afterPath.choiceLabel || location.goal?.title || "",
    before: beforeRounded,
    after: afterRounded,
  };
}
