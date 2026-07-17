import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DecisionStylePublicPayload } from "@/domain/decisionStyle";
import { signDecisionStylePayload } from "@/lib/decisionStyleToken.server";
import {
  DecisionStyleShareArtwork,
  OG_SIZE,
  PORTRAIT_SIZE,
} from "@/components/decision-style/DecisionStyleShareArtwork";
import {
  decisionStyleQrDataUrl,
  loadDecisionStyleCharacterDataUrl,
} from "@/lib/decisionStyleShareAssets.server";
import Page, { generateMetadata, resolveDecisionStyleSharePayload } from "./page";
import Image, { contentType } from "./opengraph-image";
import { GET } from "./card.png/route";

const originalSecret = process.env.DECISION_STYLE_SHARE_SECRET;
const payload: DecisionStylePublicPayload = {
  version: 2,
  source: "full",
  code: "FDBG",
  scores: { tempo: 76, focus: 61, engine: 58, drive: 84 },
};
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function expectPngDimensions(
  response: Response,
  width: number,
  height: number,
) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect(Array.from(bytes.subarray(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
  expect(new TextDecoder().decode(bytes.subarray(12, 16))).toBe("IHDR");

  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(header.getUint32(16)).toBe(width);
  expect(header.getUint32(20)).toBe(height);
}

function validParams() {
  const token = signDecisionStylePayload(payload, "test-secret");
  return Promise.resolve({ code: payload.code, token });
}

function invalidParams() {
  const token = signDecisionStylePayload(payload, "test-secret");
  return Promise.resolve({ code: "SWLV", token });
}

afterEach(() => {
  if (originalSecret === undefined) delete process.env.DECISION_STYLE_SHARE_SECRET;
  else process.env.DECISION_STYLE_SHARE_SECRET = originalSecret;
});

describe("public Decision Style share route", () => {
  it("resolves the same validated payload and rejects invalid signatures or path mismatches", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";

    await expect(resolveDecisionStyleSharePayload(validParams())).resolves.toEqual(payload);
    await expect(resolveDecisionStyleSharePayload(invalidParams())).resolves.toBeNull();
  });

  it("renders verified metadata and falls back to a safe generic entry for invalid links", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";

    const metadata = await generateMetadata({ params: validParams() });
    expect(metadata.title).toBe("FDBG · 务实攻坚者 | Life Planner");
    expect(metadata.description).toBe("你不是没耐心，只是觉得今天能解决的事，不该开三次会。");
    expect(metadata.description).not.toContain("AI 粗估");

    const invalidMetadata = await generateMetadata({ params: invalidParams() });
    expect(invalidMetadata.title).toContain("职业决策风格测试");
    expect(invalidMetadata.title).not.toContain("FDBG");
  });

  it("renders a presentation-led public result without diagnostic or local-only details", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";

    const token = signDecisionStylePayload(payload, "test-secret");
    const pageHtml = renderToStaticMarkup(await Page({ params: validParams() }));
    expect(pageHtml).toContain("FDBG");
    expect(pageHtml).toContain("务实攻坚者");
    expect(pageHtml).toContain("你不是没耐心，只是觉得今天能解决的事，不该开三次会。");
    expect(pageHtml).toContain("TA 的高光");
    expect(pageHtml).toContain("容易翻车");
    expect(pageHtml).toContain("当前自报倾向，不是固定人格或心理诊断。公开结果不包含原始答案。");
    expect(pageHtml).toContain("测测我是什么，和 TA 对比");
    expect(pageHtml).toContain(`/test?invite=${token}`);
    expect(pageHtml).toContain("/decision-style/characters/FDBG.png");
    for (const hidden of [
      "76 / 100",
      "84 / 100",
      "先试再调",
      "先验证再动",
      "本地结果依据",
      "answers",
      "evidence",
      "completedAt",
      "feasibility",
      "data:image/svg+xml",
      "AI 粗估",
    ]) {
      expect(pageHtml).not.toContain(hidden);
    }

    const invalidPageHtml = renderToStaticMarkup(await Page({ params: invalidParams() }));
    expect(invalidPageHtml).toContain("重新测试");
    expect(invalidPageHtml).not.toContain("76 / 100");
  });

  it("uses separate portrait and OG dimensions and generates local share assets", async () => {
    expect(PORTRAIT_SIZE).toEqual({ width: 1080, height: 1350 });
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
    expect(decisionStyleQrDataUrl("https://lifeplanner.test/style/FDBG/token")).toMatch(
      /^data:image\/svg\+xml;base64,/,
    );
    await expect(loadDecisionStyleCharacterDataUrl("FDBG")).resolves.toMatch(/^data:image\/png;base64,/);
    await expect(loadDecisionStyleCharacterDataUrl("NOPE")).rejects.toThrow("Unknown decision personality code");

    const portraitHtml = renderToStaticMarkup(
      <DecisionStyleShareArtwork
        payload={payload}
        characterSrc="data:image/png;base64,character"
        qrSrc="data:image/svg+xml;base64,qr"
        variant="portrait"
      />,
    );
    expect(portraitHtml).toContain("你不是没耐心，只是觉得今天能解决的事，不该开三次会。");
    expect(portraitHtml).toContain("我是 FDBG，你是什么？");
  });

  it(
    "returns image responses for valid routes and rejects invalid signatures for OG and PNG",
    async () => {
      process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";
      const warnSpy = vi.spyOn(console, "warn");

      try {
        const og = await Image({ params: validParams() });
        expect(og.headers.get("content-type")).toContain(contentType);
        await expectPngDimensions(og, 1200, 630);

        const png = await GET(new Request("http://localhost/style/FDBG/token/card.png"), {
          params: validParams(),
        });
        expect(png.headers.get("content-type")).toContain(contentType);
        await expectPngDimensions(png, 1080, 1350);

        const invalidOg = await Image({ params: invalidParams() });
        expect(invalidOg.status).toBe(404);

        const invalidPng = await GET(new Request("http://localhost/style/SWLV/token/card.png"), {
          params: invalidParams(),
        });
        expect(invalidPng.status).toBe(404);

        const unsupportedStyleWarnings = warnSpy.mock.calls.filter(([message]) =>
          typeof message === "string" && /z-?index/i.test(message),
        );
        expect(unsupportedStyleWarnings).toEqual([]);
      } finally {
        warnSpy.mockRestore();
      }
    },
    20_000,
  );
});
