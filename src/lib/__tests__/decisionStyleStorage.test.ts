// @vitest-environment jsdom

import type { DecisionStyleLocalDetail, DecisionStyleSummary } from "@/domain/decisionStyle";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  mergeDecisionStyleSummaryIntoTree,
  persistDecisionStyleSummary,
} from "@/lib/decisionStyleTreeBridge";
import { LocalStorageRepository } from "@/domain/repository/localStorageRepo";
import type { LifeTree } from "@/domain/types";
import {
  STYLE_DETAIL_KEY,
  STYLE_DRAFT_KEY,
  STYLE_SUMMARY_KEY,
  clearDecisionStyleLocalData,
  loadDecisionStyleDetail,
  loadDecisionStyleDraft,
  loadDecisionStyleSummaryHandoff,
  saveDecisionStyleDetail,
  saveDecisionStyleDraft,
  saveDecisionStyleSummaryHandoff,
} from "@/lib/decisionStyleStorage";

const detail: DecisionStyleLocalDetail = {
  version: 2,
  answers: [
    { questionId: "tempo-1", value: -2 },
    { questionId: "focus-1", value: 2 },
  ],
  tieBreaks: { drive: "b" },
};

const quickSummary: DecisionStyleSummary = {
  version: 2,
  source: "quick",
  code: "FDBG",
  scores: { tempo: 72, focus: 61, engine: 58, drive: 44 },
  completedAt: "2026-07-10T10:00:00.000Z",
};

const fullSummary: DecisionStyleSummary = {
  ...quickSummary,
  source: "full",
  code: "SWLV",
  completedAt: "2026-07-10T12:00:00.000Z",
};

function makeTree(summary?: DecisionStyleSummary): LifeTree {
  return {
    id: "tree-1",
    profile: {
      name: "Jerry",
      age: 30,
      education: "bachelor",
      major: "",
      occupation: "",
      salary: "5to10",
      hasSideHustle: false,
      sideHustle: "",
      hobbies: "",
      relationship: "single",
      location: "",
      status: "",
      snapshot: "",
      areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 },
      crossroad: "",
      riskAppetite: "balanced",
      decisionStyle: summary,
    },
    horizonYears: 10,
    paths: [],
    decisions: [],
    goals: [],
    tasks: [],
    choices: [],
    activity: [],
    calendarFeeds: [],
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe("decisionStyleStorage", () => {
  it("returns safe defaults for corrupted JSON and wrong versions", () => {
    sessionStorage.setItem(STYLE_DRAFT_KEY, "{bad");
    localStorage.setItem(STYLE_DETAIL_KEY, JSON.stringify({ version: 1 }));
    sessionStorage.setItem(STYLE_SUMMARY_KEY, JSON.stringify({ version: 1 }));

    expect(loadDecisionStyleDraft()).toBeNull();
    expect(loadDecisionStyleDetail()).toBeNull();
    expect(loadDecisionStyleSummaryHandoff()).toBeNull();
  });

  it("restores a saved draft from sessionStorage", () => {
    saveDecisionStyleDraft(detail);

    expect(sessionStorage.getItem(STYLE_DRAFT_KEY)).toBeTruthy();
    expect(loadDecisionStyleDraft()).toEqual(detail);
  });

  it("persists local result detail in localStorage", () => {
    saveDecisionStyleDetail(detail);

    expect(loadDecisionStyleDetail()).toEqual(detail);
    expect(sessionStorage.getItem(STYLE_DRAFT_KEY)).toBeNull();
  });

  it("stores a summary handoff in sessionStorage", () => {
    saveDecisionStyleSummaryHandoff(quickSummary);

    expect(loadDecisionStyleSummaryHandoff()).toEqual(quickSummary);
  });

  it("clears draft, detail, and summary together for reset flows", () => {
    saveDecisionStyleDraft(detail);
    saveDecisionStyleDetail(detail);
    saveDecisionStyleSummaryHandoff(quickSummary);

    clearDecisionStyleLocalData();

    expect(sessionStorage.getItem(STYLE_DRAFT_KEY)).toBeNull();
    expect(localStorage.getItem(STYLE_DETAIL_KEY)).toBeNull();
    expect(sessionStorage.getItem(STYLE_SUMMARY_KEY)).toBeNull();
  });

  it("swallows storage exceptions and returns safe defaults", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(loadDecisionStyleDraft()).toBeNull();
    expect(loadDecisionStyleDetail()).toBeNull();
    expect(loadDecisionStyleSummaryHandoff()).toBeNull();
    expect(() => saveDecisionStyleDraft(detail)).not.toThrow();
    expect(() => saveDecisionStyleDetail(detail)).not.toThrow();
    expect(() => saveDecisionStyleSummaryHandoff(quickSummary)).not.toThrow();
    expect(() => clearDecisionStyleLocalData()).not.toThrow();
  });

  it("returns safely when browser storage property getters throw", () => {
    const sessionStorageGetter = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("session storage blocked");
    });

    expect(loadDecisionStyleDraft()).toBeNull();
    expect(() => saveDecisionStyleDraft(detail)).not.toThrow();
    sessionStorageGetter.mockRestore();

    const localStorageGetter = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("local storage blocked");
    });

    expect(loadDecisionStyleDetail()).toBeNull();
    expect(() => saveDecisionStyleDetail(detail)).not.toThrow();
    localStorageGetter.mockRestore();
  });
});

describe("mergeDecisionStyleSummaryIntoTree", () => {
  it("merges a completed summary into an existing tree profile using summary precedence only", () => {
    const current = makeTree(quickSummary);

    const merged = mergeDecisionStyleSummaryIntoTree(current, fullSummary);

    expect(merged).not.toBe(current);
    expect(merged.profile.decisionStyle).toEqual(fullSummary);
    expect(merged.profile.riskAppetite).toBe(current.profile.riskAppetite);
    expect(merged.updatedAt).not.toBe(current.updatedAt);
  });

  it("keeps the stronger existing summary when a weaker retake comes in", () => {
    const current = makeTree(fullSummary);

    const merged = mergeDecisionStyleSummaryIntoTree(current, quickSummary);

    expect(merged.profile.decisionStyle).toEqual(fullSummary);
  });

  it("persists a merged summary into an existing tree", () => {
    const current = makeTree(quickSummary);

    persistDecisionStyleSummary(fullSummary, current);

    const persisted = new LocalStorageRepository().load();
    expect(persisted?.profile.decisionStyle).toEqual(fullSummary);
    expect(persisted?.profile.riskAppetite).toBe(current.profile.riskAppetite);
  });
});
