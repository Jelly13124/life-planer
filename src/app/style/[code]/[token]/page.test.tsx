import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DecisionStylePublicPayload } from "@/domain/decisionStyle";
import { signDecisionStylePayload } from "@/lib/decisionStyleToken.server";
import { DecisionStyleShareCard } from "@/components/decision-style/DecisionStyleShareCard";
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
    expect(metadata.title).toContain("FDBG");
    expect(metadata.title).toContain("务实攻坚者");
    expect(metadata.description).toContain("四轴");
    expect(metadata.description).not.toContain("AI 粗估");

    const invalidMetadata = await generateMetadata({ params: invalidParams() });
    expect(invalidMetadata.title).toContain("职业决策风格测试");
    expect(invalidMetadata.title).not.toContain("FDBG");
  });

  it("renders the public page and share card without local-only evidence or forbidden copy", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";

    const pageHtml = renderToStaticMarkup(await Page({ params: validParams() }));
    expect(pageHtml).toContain("FDBG");
    expect(pageHtml).toContain("务实攻坚者");
    expect(pageHtml).toContain("76 / 100");
    expect(pageHtml).toContain("84 / 100");
    expect(pageHtml).toContain("当前倾向，不是固定人格");
    expect(pageHtml).toContain("测完和 TA 比");
    expect(pageHtml).not.toContain("本地结果依据");
    expect(pageHtml).not.toContain("AI 粗估");

    const invalidPageHtml = renderToStaticMarkup(await Page({ params: invalidParams() }));
    expect(invalidPageHtml).toContain("重新测试");
    expect(invalidPageHtml).not.toContain("76 / 100");

    const cardHtml = renderToStaticMarkup(<DecisionStyleShareCard payload={payload} />);
    expect(cardHtml).toContain("FDBG");
    expect(cardHtml).toContain("76 / 100");
    expect(cardHtml).toContain("84 / 100");
    expect(cardHtml).not.toContain("answers");
    expect(cardHtml).not.toContain("evidence");
    expect(cardHtml).not.toContain("completedAt");
    expect(cardHtml).not.toContain("feasibility");
    expect(cardHtml).not.toContain("AI 粗估");
  });

  it("returns image responses for valid routes and rejects invalid signatures for OG and PNG", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";

    const og = await Image({ params: validParams() });
    expect(og.headers.get("content-type")).toContain(contentType);

    const png = await GET(new Request("http://localhost/style/FDBG/token/card.png"), {
      params: validParams(),
    });
    expect(png.headers.get("content-type")).toContain(contentType);

    const invalidOg = await Image({ params: invalidParams() });
    expect(invalidOg.status).toBe(404);

    const invalidPng = await GET(new Request("http://localhost/style/SWLV/token/card.png"), {
      params: invalidParams(),
    });
    expect(invalidPng.status).toBe(404);
  });
});
