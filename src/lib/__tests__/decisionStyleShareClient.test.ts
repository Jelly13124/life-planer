// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { DecisionStyleSummary } from "@/domain/decisionStyle";
import {
  SHARE_UNAVAILABLE_MESSAGE,
  downloadDecisionStylePng,
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

  it("downloads the fetched PNG blob via an object URL when the response is ok and image/png", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "content-type": "image/png" } }),
    );
    const anchor = { click: vi.fn() } as unknown as HTMLAnchorElement;
    const createObjectUrl = vi.fn(() => "blob:decision-style");
    const revokeObjectUrl = vi.fn();

    await expect(
      downloadDecisionStylePng("https://lifeplanner.test/style/FDBG/signed-token/card.png", {
        fetchImpl,
        createAnchor: () => anchor,
        createObjectUrl,
        revokeObjectUrl,
      }),
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledWith("https://lifeplanner.test/style/FDBG/signed-token/card.png");
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    const downloadBlob = (createObjectUrl.mock.calls as unknown[][])[0]?.[0];
    expect(downloadBlob).toMatchObject({ type: "image/png" });
    expect(anchor.href).toBe("blob:decision-style");
    expect(anchor.download).toBe("decision-style-card.png");
    expect(anchor.rel).toBe("noopener");
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:decision-style");
  });

  it("rejects non-ok PNG download responses so the caller can show a failure state", async () => {
    const fetchImpl = vi.fn(async () => new Response("missing", { status: 404, headers: { "content-type": "text/plain" } }));

    await expect(
      downloadDecisionStylePng("https://lifeplanner.test/style/FDBG/signed-token/card.png", {
        fetchImpl,
        createAnchor: () => ({ click: vi.fn() } as unknown as HTMLAnchorElement),
        createObjectUrl: vi.fn(() => "blob:decision-style"),
        revokeObjectUrl: vi.fn(),
      }),
    ).rejects.toThrow("PNG download failed");
  });

  it("rejects network PNG download failures so the caller can show a failure state", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(
      downloadDecisionStylePng("https://lifeplanner.test/style/FDBG/signed-token/card.png", {
        fetchImpl,
        createAnchor: () => ({ click: vi.fn() } as unknown as HTMLAnchorElement),
        createObjectUrl: vi.fn(() => "blob:decision-style"),
        revokeObjectUrl: vi.fn(),
      }),
    ).rejects.toThrow("PNG download failed");
  });
});
