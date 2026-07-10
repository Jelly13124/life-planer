import { describe, expect, it, vi } from "vitest";
import { trackDecisionStyleEvent } from "../decisionStyleAnalytics";

describe("trackDecisionStyleEvent", () => {
  it("sends only the approved fields and never blocks the caller on failure", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(
      trackDecisionStyleEvent("style_share", { source: "shared", fetchImpl }),
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/style-events",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        body: JSON.stringify({ event: "style_share", surface: "web", source: "shared", test_version: 2 }),
      }),
    );
    expect(JSON.stringify(fetchImpl.mock.calls[0])).not.toMatch(
      /answers|scores|code|token|name|user|device|flow|free text/i,
    );
  });

  it("defaults direct web events and ignores a failed response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));

    await expect(trackDecisionStyleEvent("style_view", { fetchImpl })).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ event: "style_view", surface: "web", source: "direct", test_version: 2 }),
    );
  });
});
