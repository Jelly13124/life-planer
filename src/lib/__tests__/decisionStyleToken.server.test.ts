import { describe, expect, it } from "vitest";
import { signDecisionStylePayload, verifyDecisionStyleToken } from "@/lib/decisionStyleToken.server";
import type { DecisionStylePublicPayload } from "@/domain/decisionStyle";

const payload: DecisionStylePublicPayload = {
  version: 2,
  source: "full",
  code: "FDBG",
  scores: { tempo: 51, focus: 52, engine: 53, drive: 54 },
};

describe("Decision Style share tokens", () => {
  it("signs and verifies the canonical public payload", () => {
    const token = signDecisionStylePayload(payload, "test-secret");
    expect(verifyDecisionStyleToken(token, "test-secret")).toEqual(payload);
  });

  it("rejects one-byte payload or signature tampering", () => {
    const [encodedPayload, signature] = signDecisionStylePayload(payload, "test-secret").split(".");
    expect(verifyDecisionStyleToken(`${encodedPayload.slice(0, -1)}A.${signature}`, "test-secret")).toBeNull();
    expect(verifyDecisionStyleToken(`${encodedPayload}.${signature.slice(0, -1)}A`, "test-secret")).toBeNull();
  });

  it("rejects a token signed with another secret or malformed base64url", () => {
    const token = signDecisionStylePayload(payload, "test-secret");
    expect(verifyDecisionStyleToken(token, "another-secret")).toBeNull();
    expect(verifyDecisionStyleToken("%%.%%", "test-secret")).toBeNull();
  });
});
