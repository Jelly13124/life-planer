import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DecisionStylePublicPayload } from "@/domain/decisionStyle";
import { signDecisionStylePayload } from "@/lib/decisionStyleToken.server";
import Page, { generateMetadata } from "./page";

const originalSecret = process.env.DECISION_STYLE_SHARE_SECRET;

const leftPayload: DecisionStylePublicPayload = {
  version: 2,
  source: "full",
  code: "FDBG",
  scores: { tempo: 76, focus: 61, engine: 58, drive: 84 },
};

const rightPayload: DecisionStylePublicPayload = {
  version: 2,
  source: "full",
  code: "FDLG",
  scores: { tempo: 70, focus: 65, engine: 41, drive: 88 },
};

const equalDiffLeft: DecisionStylePublicPayload = {
  version: 2,
  source: "full",
  code: "FDBG",
  scores: { tempo: 60, focus: 60, engine: 60, drive: 60 },
};

const equalDiffRight: DecisionStylePublicPayload = {
  version: 2,
  source: "full",
  code: "SWLV",
  scores: { tempo: 50, focus: 50, engine: 50, drive: 50 },
};

function signedParams(left: DecisionStylePublicPayload, right: DecisionStylePublicPayload) {
  return Promise.resolve({
    left: signDecisionStylePayload(left, "test-secret"),
    right: signDecisionStylePayload(right, "test-secret"),
  });
}

function invalidParams() {
  return Promise.resolve({
    left: signDecisionStylePayload(leftPayload, "test-secret"),
    right: `${signDecisionStylePayload(rightPayload, "test-secret")}broken`,
  });
}

afterEach(() => {
  if (originalSecret === undefined) delete process.env.DECISION_STYLE_SHARE_SECRET;
  else process.env.DECISION_STYLE_SHARE_SECRET = originalSecret;
});

describe("Decision Style compare route", () => {
  it("renders a verified comparison with deterministic closest and largest-difference axes", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";

    const html = renderToStaticMarkup(await Page({ params: signedParams(leftPayload, rightPayload) }));
    expect(html).toContain("你们做决定，像两套不同的操作系统");
    expect(html).toContain("FDBG");
    expect(html).toContain("务实攻坚者");
    expect(html).toContain("FDLG");
    expect(html).toContain("借势攀登者");
    expect(html).toContain("/decision-style/characters/FDBG.png");
    expect(html).toContain("/decision-style/characters/FDLG.png");
    expect(html.match(/人格角色/g)).toHaveLength(2);
    expect(html).toContain("你习惯自己握方向盘，TA 更擅长借力把路走宽。");
    expect(html).toContain("最接近：集中深耕 / 多线探索");
    expect(html).toContain("差异最大：自主掌控 / 平台借势");
    expect(html).toContain("76 / 100");
    expect(html).toContain("70 / 100");
    expect(html).toContain("58 / 100");
    expect(html).toContain("41 / 100");
    expect(html).toContain("先试再调");
    expect(html).toContain("先验证再动");
    expect(html).toContain("明显倾向");
  });

  it("uses AXIS_KEYS order to break equal-difference ties and respects verified 50-point code letters", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";

    const html = renderToStaticMarkup(await Page({ params: signedParams(equalDiffLeft, equalDiffRight) }));
    expect(html).toContain("最接近：先试再调 / 先验证再动");
    expect(html).toContain("差异最大：先试再调 / 先验证再动");
    expect(html).toContain("50 / 100");
    expect(html).toContain("轻微倾向");
    expect(html).toContain("F · 先试再调");
    expect(html).toContain("S · 先验证再动");
  });

  it("returns the safe retest entry for invalid tokens and never shows forbidden wording", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";

    const html = renderToStaticMarkup(await Page({ params: invalidParams() }));
    expect(html).toContain("这个分享链接已失效");
    expect(html).toContain("重新测试");
    expect(html).not.toContain("76 / 100");

    const validHtml = renderToStaticMarkup(await Page({ params: signedParams(leftPayload, rightPayload) }));
    for (const forbidden of [
      "兼容度",
      "匹配度",
      "适合",
      "不适合",
      "科学",
      "诊断",
      "预测",
      "胜负",
      "排名",
      "winner",
      "ranking",
      "第 1",
      "第一名",
      "按固定轴顺序稳定判定",
    ]) {
      expect(validHtml).not.toContain(forbidden);
    }
  });

  it("generates compare metadata only for verified tokens", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";

    const metadata = await generateMetadata({ params: signedParams(leftPayload, rightPayload) });
    expect(metadata.title).toContain("对照");
    expect(metadata.description).toContain("四轴");

    const invalidMetadata = await generateMetadata({ params: invalidParams() });
    expect(invalidMetadata.title).toContain("职业决策风格测试");
    expect(invalidMetadata.title).not.toContain("对照");
  });
});
