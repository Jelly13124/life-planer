import { describe, it, expect } from "vitest";
import { createTree, addPath, choosePath, clearChosenPath, chosenPath, removePath } from "../tree";
import { localGenerator } from "../generator/localGenerator";
import type { Profile } from "../types";

const NOW = "2026-07-01T00:00:00.000Z";
const profile = (): Profile => ({
  name: "测试", age: 28, education: "本科", major: "", occupation: "", salary: "1万 - 2万",
  hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "single", location: "上海",
  status: "", snapshot: "", crossroad: "",
  areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 },
});

function treeWithPath() {
  const t = addPath(createTree(profile(), localGenerator, NOW), "去创业", localGenerator, NOW);
  const choice = t.paths.find((p) => p.kind === "choice")!;
  return { t, choiceId: choice.id };
}

describe("chosenPath", () => {
  it("choosePath sets chosenPathId for a choice path", () => {
    const { t, choiceId } = treeWithPath();
    const next = choosePath(t, choiceId, NOW);
    expect(next.chosenPathId).toBe(choiceId);
    expect(chosenPath(next)?.id).toBe(choiceId);
  });

  it("choosePath ignores status-quo and unknown ids", () => {
    const { t } = treeWithPath();
    const sq = t.paths.find((p) => p.kind === "status-quo")!;
    expect(choosePath(t, sq.id, NOW).chosenPathId).toBeUndefined();
    expect(choosePath(t, "nope", NOW).chosenPathId).toBeUndefined();
  });

  it("clearChosenPath resets to null", () => {
    const { t, choiceId } = treeWithPath();
    const chosen = choosePath(t, choiceId, NOW);
    expect(clearChosenPath(chosen, NOW).chosenPathId).toBeNull();
  });

  it("removePath clears a dangling chosenPathId", () => {
    const { t, choiceId } = treeWithPath();
    const chosen = choosePath(t, choiceId, NOW);
    const removed = removePath(chosen, choiceId, NOW);
    expect(removed.chosenPathId).toBeNull();
    expect(chosenPath(removed)).toBeNull();
  });

  it("chosenPath returns null when unset", () => {
    const { t } = treeWithPath();
    expect(chosenPath(t)).toBeNull();
  });
});
