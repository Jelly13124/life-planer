import { describe, expect, it } from "vitest";
import {
  DECISION_STYLE_SCALE_VALUES,
  FULL_QUESTIONS,
  allDecisionPersonalityPresentations,
  allDecisionStyleTypes,
  decisionPersonalityPresentationByCode,
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
