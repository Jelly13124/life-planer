import { afterEach, describe, expect, it, vi } from "vitest";
import type { DecisionStyleSummary } from "@lifeplanner/core/decisionStyle";

vi.mock("react-native", () => ({
  Share: { share: vi.fn() },
}));

vi.mock("expo-file-system", () => ({
  File: class MockFile {},
  Paths: { cache: "test-cache" },
}));

vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

vi.mock("../supabase", () => ({
  SHARE_BASE_URL: "https://lifeplanner.test",
}));

import { shareDecisionStyle } from "../decisionStyleShare";

const summary: DecisionStyleSummary = {
  version: 2,
  source: "full",
  code: "FDBG",
  scores: { tempo: 76, focus: 61, engine: 58, drive: 84 },
  completedAt: "2026-07-10T10:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shareDecisionStyle", () => {
  it("normalizes response JSON syntax failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(shareDecisionStyle(summary)).rejects.toThrow("share-token-failed");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
