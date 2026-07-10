import {
  mergeDecisionStyleSummary,
  type DecisionStyleSummary,
} from "@/domain/decisionStyle";
import { LocalStorageRepository } from "@/domain/repository/localStorageRepo";
import type { LifeTree } from "@/domain/types";

export function mergeDecisionStyleSummaryIntoTree(
  tree: LifeTree,
  summary: DecisionStyleSummary,
): LifeTree {
  return {
    ...tree,
    profile: {
      ...tree.profile,
      decisionStyle: mergeDecisionStyleSummary(tree.profile.decisionStyle, summary),
    },
    updatedAt: new Date().toISOString(),
  };
}

export function persistDecisionStyleSummary(
  summary: DecisionStyleSummary,
  tree: LifeTree,
): void {
  new LocalStorageRepository().save(
    mergeDecisionStyleSummaryIntoTree(tree, summary),
  );
}
