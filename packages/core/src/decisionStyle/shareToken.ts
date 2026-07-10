import { AXIS_KEYS, letterFor, type DecisionStyleCode } from "./axes";
import type { DecisionStyleAxisScores } from "./scoring";

export interface DecisionStylePublicPayload {
  version: 2;
  source: "quick" | "full";
  code: DecisionStyleCode;
  scores: DecisionStyleAxisScores;
}

const PUBLIC_KEYS = ["version", "source", "code", "scores"];
const SCORE_KEYS = ["tempo", "focus", "engine", "drive"];
const CODE_PATTERN = /^[FS][DW][BL][GV]$/;

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateDecisionStylePublicPayload(value: unknown): DecisionStylePublicPayload | null {
  if (!isRecord(value) || !hasExactKeys(value, PUBLIC_KEYS)) return null;
  if (value.version !== 2 || (value.source !== "quick" && value.source !== "full")) return null;
  if (typeof value.code !== "string" || !CODE_PATTERN.test(value.code) || !isRecord(value.scores) || !hasExactKeys(value.scores, SCORE_KEYS)) return null;

  const scores = {} as DecisionStyleAxisScores;
  for (const axis of AXIS_KEYS) {
    const score = value.scores[axis];
    if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 100) return null;
    const letter = value.code[AXIS_KEYS.indexOf(axis)];
    if (score !== 50 && letter !== letterFor(axis, score > 50 ? "a" : "b")) return null;
    scores[axis] = score;
  }

  return { version: 2, source: value.source, code: value.code as DecisionStyleCode, scores };
}

export function encodeDecisionStylePublicPayload(payload: DecisionStylePublicPayload): string {
  const valid = validateDecisionStylePublicPayload(payload);
  if (!valid) throw new TypeError("Invalid Decision Style public payload");
  return JSON.stringify({
    version: valid.version,
    source: valid.source,
    code: valid.code,
    scores: {
      tempo: valid.scores.tempo,
      focus: valid.scores.focus,
      engine: valid.scores.engine,
      drive: valid.scores.drive,
    },
  });
}

export function decodeDecisionStylePublicPayload(json: string): DecisionStylePublicPayload | null {
  try {
    return validateDecisionStylePublicPayload(JSON.parse(json));
  } catch {
    return null;
  }
}
