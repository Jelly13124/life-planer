// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { DecisionStyleSummary } from "@/domain/decisionStyle";
import {
  SHARE_UNAVAILABLE_MESSAGE,
  isDecisionStyleNativeShareAvailable,
  requestDecisionStyleShareLink,
  shareDecisionStyleLink,
} from "@/lib/decisionStyleShareClient";

const summary: DecisionStyleSummary = {
  version: 2,
  source: "full",
  code: "FDBG",
  scores: { tempo: 76, focus: 61, engine: 58, drive: 84 },
  completedAt: "2026-07-10T12:00:00.000Z",
};

describe("decisionStyleShareClient", () => {
  it("posts exactly the public payload and returns the verified public and png URLs", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe("/api/style-share-token");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "content-type": "application/json" });
      expect(JSON.parse(String(init?.body))).toEqual({
        version: 2,
        source: "full",
        code: "FDBG",
        scores: { tempo: 76, focus: 61, engine: 58, drive: 84 },
      });

      return new Response(
        JSON.stringify({
          token: "signed-token",
          path: "/style/FDBG/signed-token",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    await expect(
      requestDecisionStyleShareLink(summary, {
        fetchImpl,
        origin: "https://lifeplanner.test",
      }),
    ).resolves.toEqual({
      token: "signed-token",
      path: "/style/FDBG/signed-token",
      url: "https://lifeplanner.test/style/FDBG/signed-token",
      pngUrl: "https://lifeplanner.test/style/FDBG/signed-token/card.png",
    });
  });

  it("maps 503 signing failures to the explicit share unavailable message", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "missing secret" }), { status: 503 }));

    await expect(
      requestDecisionStyleShareLink(summary, {
        fetchImpl,
        origin: "https://lifeplanner.test",
      }),
    ).rejects.toThrow(SHARE_UNAVAILABLE_MESSAGE);
  });

  it("maps offline and network failures to the explicit share unavailable message", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(
      requestDecisionStyleShareLink(summary, {
        fetchImpl,
        origin: "https://lifeplanner.test",
      }),
    ).rejects.toThrow(SHARE_UNAVAILABLE_MESSAGE);
  });

  it("reports native share availability only when navigator.share exists", () => {
    expect(isDecisionStyleNativeShareAvailable({ share: vi.fn() } as unknown as Navigator)).toBe(true);
    expect(isDecisionStyleNativeShareAvailable({} as Navigator)).toBe(false);
  });

  it("uses the system share sheet when available and otherwise falls back to copying the verified URL", async () => {
    const share = vi.fn(async () => undefined);
    const copyText = vi.fn(async () => undefined);

    await expect(
      shareDecisionStyleLink("https://lifeplanner.test/style/FDBG/signed-token", {
        navigatorLike: { share } as unknown as Navigator,
        copyText,
      }),
    ).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: "职业决策风格测试",
      text: "看看我的当前职业决策倾向",
      url: "https://lifeplanner.test/style/FDBG/signed-token",
    });
    expect(copyText).not.toHaveBeenCalled();

    share.mockReset();
    copyText.mockClear();

    await expect(
      shareDecisionStyleLink("https://lifeplanner.test/style/FDBG/signed-token", {
        navigatorLike: {} as Navigator,
        copyText,
      }),
    ).resolves.toBe("copied");
    expect(copyText).toHaveBeenCalledWith("https://lifeplanner.test/style/FDBG/signed-token");
  });

  it("rejects mismatched code or token paths instead of constructing an unsigned URL", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          token: "signed-token",
          path: "/style/SWLV/signed-token",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      requestDecisionStyleShareLink(summary, {
        fetchImpl,
        origin: "https://lifeplanner.test",
      }),
    ).rejects.toThrow("Invalid share token response");
  });
});
