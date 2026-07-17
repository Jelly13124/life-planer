import { describe, expect, it } from "vitest";
import {
  DECISION_STYLE_SCALE_VALUES,
  FULL_QUESTIONS,
  allDecisionPersonalityPresentations,
  allDecisionStyleTypes,
  decisionPersonalityPresentationByCode,
  decisionPersonalityRelationshipLine,
  decisionStyleScaleAccessibilityLabel,
  upsertDecisionStyleAnswer,
} from "../decisionStyle";

describe("decision personality presentation", () => {
  it("covers every approved code with unique complete social copy", () => {
    const presentations = allDecisionPersonalityPresentations();
    const codes = allDecisionStyleTypes().map((type) => type.code).sort();
    expect(presentations.map((item) => item.code).sort()).toEqual(codes);
    expect(new Set(presentations.map((item) => item.tagline)).size).toBe(16);
    for (const item of presentations) {
      expect(item.characterId).toBe(item.code);
      expect(item.label.length).toBeGreaterThan(3);
      expect(item.tagline.length).toBeGreaterThan(12);
      expect(item.highlight.length).toBeGreaterThan(12);
      expect(item.roast.length).toBeGreaterThan(12);
      expect(item.advice.length).toBeGreaterThan(8);
    }
    expect(decisionPersonalityPresentationByCode("FDBG")?.tagline).toBe(
      "你不是没耐心，只是觉得今天能解决的事，不该开三次会。",
    );
    expect(decisionPersonalityPresentationByCode("NOPE")).toBeUndefined();
  });

  it("creates directional but non-judgmental friend comparison lines", () => {
    const cases = [
      ["FDBG", "SDBV", "tempo", "你负责踩油门，TA 负责确认前面有没有路。"],
      ["SDBV", "FDBG", "tempo", "TA 负责踩油门，你负责确认前面有没有路。"],
      ["FDBG", "FWBG", "focus", "你负责把一件事挖深，TA 负责确认还有哪些路。"],
      ["FWBG", "FDBG", "focus", "TA 负责把一件事挖深，你负责确认还有哪些路。"],
      ["FDBG", "FDLG", "engine", "你习惯自己握方向盘，TA 更擅长借力把路走宽。"],
      ["FDLG", "FDBG", "engine", "TA 习惯自己握方向盘，你更擅长借力把路走宽。"],
      ["FDBG", "FDBV", "drive", "你先确认结果站得住，TA 先确认这件事值得做。"],
      ["FDBV", "FDBG", "drive", "TA 先确认结果站得住，你先确认这件事值得做。"],
    ] as const;

    for (const [left, right, axis, expected] of cases) {
      expect(decisionPersonalityRelationshipLine(left, right, axis)).toBe(expected);
    }
  });

  it("creates stable same-pole friend comparison lines for both poles on every axis", () => {
    const cases = [
      ["FDBG", "FWLV", "tempo", "你们都不爱空想，聊完往往已经开始动了。"],
      ["SDBG", "SWLV", "tempo", "你们都会多看一眼，决定通常不靠冲动。"],
      ["FDBG", "SDBV", "focus", "你们都习惯把一件重要的事先做深。"],
      ["FWBG", "SWLV", "focus", "你们都能同时看见不止一条路。"],
      ["FDBG", "SWBG", "engine", "你们都喜欢把关键方向握在自己手里。"],
      ["FDLG", "SWLV", "engine", "你们都很会借助现有结构把事情做大。"],
      ["FDBG", "FDLG", "drive", "你们都会先确认结果能不能站得住。"],
      ["FDBV", "SWLV", "drive", "你们都会先确认这件事到底值不值得。"],
    ] as const;

    for (const [left, right, axis, expected] of cases) {
      expect(decisionPersonalityRelationshipLine(left, right, axis)).toBe(expected);
    }
  });

  it("exposes five stable values and concrete accessible labels", () => {
    const question = FULL_QUESTIONS[0];
    expect(DECISION_STYLE_SCALE_VALUES).toEqual([-2, -1, 0, 1, 2]);
    expect(decisionStyleScaleAccessibilityLabel(question, -2)).toBe(`强烈偏向：${question.left.label}`);
    expect(decisionStyleScaleAccessibilityLabel(question, -1)).toBe(`稍微偏向：${question.left.label}`);
    expect(decisionStyleScaleAccessibilityLabel(question, 0)).toBe("两边差不多");
    expect(decisionStyleScaleAccessibilityLabel(question, 1)).toBe(`稍微偏向：${question.right.label}`);
    expect(decisionStyleScaleAccessibilityLabel(question, 2)).toBe(`强烈偏向：${question.right.label}`);
  });

  it("replaces an answer instead of duplicating it", () => {
    const initial = { version: 2 as const, answers: [], tieBreaks: {} };
    const first = upsertDecisionStyleAnswer(initial, "tempo-1", -2);
    const replaced = upsertDecisionStyleAnswer(first, "tempo-1", 2);
    expect(replaced.answers).toEqual([{ questionId: "tempo-1", value: 2 }]);
  });

  it("preserves answer order while editing an earlier answer", () => {
    const initial = { version: 2 as const, answers: [], tieBreaks: {} };
    const first = upsertDecisionStyleAnswer(initial, "tempo-1", -2);
    const second = upsertDecisionStyleAnswer(first, "focus-1", 1);
    const edited = upsertDecisionStyleAnswer(second, "tempo-1", 2);
    expect(edited.answers).toEqual([
      { questionId: "tempo-1", value: 2 },
      { questionId: "focus-1", value: 1 },
    ]);
  });
});
