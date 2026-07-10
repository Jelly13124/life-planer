import { describe, expect, it } from "vitest";
import {
  decodeDecisionStylePublicPayload,
  encodeDecisionStylePublicPayload,
  validateDecisionStylePublicPayload,
  type DecisionStylePublicPayload,
} from "../decisionStyle";

const payload: DecisionStylePublicPayload = {
  version: 2,
  source: "quick",
  code: "FDBG",
  scores: { tempo: 76, focus: 64, engine: 82, drive: 91 },
};

describe("Decision Style public share payload", () => {
  it("encodes the exact portable payload with canonical key order", () => {
    expect(encodeDecisionStylePublicPayload(payload)).toBe(
      '{"version":2,"source":"quick","code":"FDBG","scores":{"tempo":76,"focus":64,"engine":82,"drive":91}}',
    );
  });

  it("round-trips an exact valid payload", () => {
    expect(decodeDecisionStylePublicPayload(encodeDecisionStylePublicPayload(payload))).toEqual(payload);
  });

  it("rejects non-integer and out-of-range scores", () => {
    expect(validateDecisionStylePublicPayload({ ...payload, scores: { ...payload.scores, tempo: 50.5 } })).toBeNull();
    expect(validateDecisionStylePublicPayload({ ...payload, scores: { ...payload.scores, focus: 101 } })).toBeNull();
  });

  it("recomputes every non-tied code letter from its score", () => {
    expect(validateDecisionStylePublicPayload({ ...payload, code: "SWBG" })).toBeNull();
  });

  it.each([
    ["tempo", "FDBG"], ["tempo", "SDBG"],
    ["focus", "FDBG"], ["focus", "FWBG"],
    ["engine", "FDBG"], ["engine", "FDLG"],
    ["drive", "FDBG"], ["drive", "FDBV"],
  ] as const)("preserves the explicit %s tie letter without synthesizing a default", (axis, code) => {
    const tied = { ...payload, code, scores: { ...payload.scores, [axis]: 50 } };
    expect(validateDecisionStylePublicPayload(tied)).toEqual(tied);
  });

  it("rejects unknown versions and every non-public field", () => {
    expect(decodeDecisionStylePublicPayload('{"version":3,"source":"quick","code":"FDBG","scores":{"tempo":76,"focus":64,"engine":82,"drive":91}}')).toBeNull();
    for (const extra of ["completedAt", "answers", "name", "token", "id"]) {
      expect(validateDecisionStylePublicPayload({ ...payload, [extra]: "private" })).toBeNull();
    }
  });
});
