import type { DecisionStyleLocalDetail, DecisionStyleSummary } from "@/domain/decisionStyle";

export const STYLE_DRAFT_KEY = "lifeplanner.decision-style.v2.draft";
export const STYLE_DETAIL_KEY = "lifeplanner.decision-style.v2.detail";
export const STYLE_SUMMARY_KEY = "lifeplanner.decision-style.v2.summary";

function isAxisKey(value: string): value is keyof DecisionStyleSummary["scores"] {
  return value === "tempo" || value === "focus" || value === "engine" || value === "drive";
}

function isDecisionStyleDetail(value: unknown): value is DecisionStyleLocalDetail {
  if (!value || typeof value !== "object") return false;
  const detail = value as Record<string, unknown>;
  if (detail.version !== 2 || !Array.isArray(detail.answers) || !detail.tieBreaks || typeof detail.tieBreaks !== "object") {
    return false;
  }
  return detail.answers.every((answer) => {
    if (!answer || typeof answer !== "object") return false;
    const item = answer as Record<string, unknown>;
    return typeof item.questionId === "string" && [-2, -1, 0, 1, 2].includes(item.value as number);
  }) && Object.entries(detail.tieBreaks).every(([axis, pole]) => isAxisKey(axis) && (pole === "a" || pole === "b"));
}

function isDecisionStyleSummary(value: unknown): value is DecisionStyleSummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Record<string, unknown>;
  if (summary.version !== 2 || (summary.source !== "quick" && summary.source !== "full") || typeof summary.code !== "string" || typeof summary.completedAt !== "string") {
    return false;
  }
  if (!summary.scores || typeof summary.scores !== "object") return false;
  const scores = summary.scores as Record<string, unknown>;
  return ["tempo", "focus", "engine", "drive"].every((axis) => Number.isFinite(scores[axis]));
}

function readJson<T>(storage: Storage, key: string, guard: (value: unknown) => value is T): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore blocked storage */
  }
}

function removeKey(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore blocked storage */
  }
}

function resolveBrowserStorage(kind: "sessionStorage" | "localStorage"): Storage | null {
  try {
    return typeof window === "undefined" ? null : window[kind];
  } catch {
    return null;
  }
}

export function loadDecisionStyleDraft(): DecisionStyleLocalDetail | null {
  const storage = resolveBrowserStorage("sessionStorage");
  return storage ? readJson(storage, STYLE_DRAFT_KEY, isDecisionStyleDetail) : null;
}

export function saveDecisionStyleDraft(detail: DecisionStyleLocalDetail) {
  const storage = resolveBrowserStorage("sessionStorage");
  if (storage) writeJson(storage, STYLE_DRAFT_KEY, detail);
}

export function clearDecisionStyleDraft() {
  const storage = resolveBrowserStorage("sessionStorage");
  if (storage) removeKey(storage, STYLE_DRAFT_KEY);
}

export function loadDecisionStyleDetail(): DecisionStyleLocalDetail | null {
  const storage = resolveBrowserStorage("localStorage");
  return storage ? readJson(storage, STYLE_DETAIL_KEY, isDecisionStyleDetail) : null;
}

export function saveDecisionStyleDetail(detail: DecisionStyleLocalDetail) {
  const storage = resolveBrowserStorage("localStorage");
  if (storage) writeJson(storage, STYLE_DETAIL_KEY, detail);
}

export function loadDecisionStyleSummaryHandoff(): DecisionStyleSummary | null {
  const storage = resolveBrowserStorage("sessionStorage");
  return storage ? readJson(storage, STYLE_SUMMARY_KEY, isDecisionStyleSummary) : null;
}

export function saveDecisionStyleSummaryHandoff(summary: DecisionStyleSummary) {
  const storage = resolveBrowserStorage("sessionStorage");
  if (storage) writeJson(storage, STYLE_SUMMARY_KEY, summary);
}

export function clearDecisionStyleLocalData() {
  const session = resolveBrowserStorage("sessionStorage");
  if (session) {
    removeKey(session, STYLE_DRAFT_KEY);
    removeKey(session, STYLE_SUMMARY_KEY);
  }
  const local = resolveBrowserStorage("localStorage");
  if (local) removeKey(local, STYLE_DETAIL_KEY);
}
