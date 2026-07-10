import { describe, expect, expectTypeOf, it } from "vitest";
import {
  AXES,
  AXIS_KEYS,
  FULL_QUESTIONS,
  QUICK_QUESTIONS,
  TIE_BREAKERS,
  allDecisionStyleTypes,
  mergeDecisionStyleSummary,
  scoreDecisionStyle,
  type DecisionStyleAnswerValue,
  type DecisionStyleSummary,
} from "../decisionStyle";

const APPROVED_LABELS = {
  FDBG: "务实攻坚者", FDBV: "信念开拓者", FDLG: "借势攀登者", FDLV: "组织破局者",
  FWBG: "多线经营者", FWBV: "自由开拓者", FWLG: "机会整合者", FWLV: "跨界理想家",
  SDBG: "稳健匠人", SDBV: "长期创造者", SDLG: "深耕积累者", SDLV: "价值深耕者",
  SWBG: "稳健多面手", SWBV: "自在探索者", SWLG: "稳健多栖者", SWLV: "从容连接者",
};

describe("decisionStyle inventory", () => {
  it("contains the approved four-axis question inventory and type labels", () => {
    expect(FULL_QUESTIONS).toHaveLength(28);
    expect(QUICK_QUESTIONS).toHaveLength(12);
    expect(TIE_BREAKERS).toHaveLength(4);
    for (const axis of AXIS_KEYS) {
      expect(FULL_QUESTIONS.filter((question) => question.axis === axis)).toHaveLength(7);
      expect(QUICK_QUESTIONS.filter((question) => question.axis === axis)).toHaveLength(3);
    }
    expect(allDecisionStyleTypes()).toHaveLength(16);
    expect(allDecisionStyleTypes().every((type) => !("feasibility" in type))).toBe(true);
    expect(Object.fromEntries(allDecisionStyleTypes().map((type) => [type.code, type.label]))).toEqual(APPROVED_LABELS);
  });

  it("uses unique concrete questions with opposite poles on their own axis", () => {
    const questions = [...FULL_QUESTIONS, ...TIE_BREAKERS];
    expect(new Set(questions.map((question) => question.id)).size).toBe(32);
    for (const question of questions) {
      expect(question.prompt.length).toBeGreaterThan(12);
      expect(question.left.label.length).toBeGreaterThan(1);
      expect(question.right.label.length).toBeGreaterThan(1);
      expect(question.left.pole).not.toBe(question.right.pole);
      const axis = AXES.find((item) => item.key === question.axis)!;
      expect([question.left.pole, question.right.pole].sort()).toEqual(["a", "b"]);
      expect(axis.key).toBe(question.axis);
    }
  });

  it("exports immutable inventories and exact type content keys", () => {
    for (const inventory of [AXIS_KEYS, AXES, FULL_QUESTIONS, QUICK_QUESTIONS, TIE_BREAKERS]) {
      expect(Object.isFrozen(inventory)).toBe(true);
    }
    for (const question of [...FULL_QUESTIONS, ...TIE_BREAKERS]) {
      expect(Object.isFrozen(question)).toBe(true);
      expect(Object.isFrozen(question.left)).toBe(true);
      expect(Object.isFrozen(question.right)).toBe(true);
    }
    for (const type of allDecisionStyleTypes()) {
      expect(Object.keys(type).sort()).toEqual(["advice", "code", "cost", "label", "strength", "tension"]);
      expect(Object.isFrozen(type)).toBe(true);
      expect(type.code).toMatch(/^[FS][DW][BL][GV]$/);
    }
  });

  it("limits answer values to the public five-value union", () => {
    expectTypeOf<DecisionStyleAnswerValue>().toEqualTypeOf<-2 | -1 | 0 | 1 | 2>();
  });
});

describe("decisionStyle scoring", () => {
  it("requests every tie-break for neutral answers and resolves only explicit ties", () => {
    const neutral = FULL_QUESTIONS.map((question) => ({ questionId: question.id, value: 0 as const }));
    const pending = scoreDecisionStyle("full", neutral);
    expect(pending.scores).toEqual({ tempo: 50, focus: 50, engine: 50, drive: 50 });
    expect(pending.pendingTieBreaks).toEqual(AXIS_KEYS);
    expect(pending.code).toBeUndefined();

    const complete = scoreDecisionStyle("full", neutral, { tempo: "a", focus: "b", engine: "a", drive: "b" });
    expect(complete.scores).toEqual({ tempo: 50, focus: 50, engine: 50, drive: 50 });
    expect(complete.pendingTieBreaks).toEqual([]);
    expect(complete.code).toBe("FWBV");
  });

  it("requests tie-breaks only for axes that remain balanced", () => {
    const result = scoreDecisionStyle("full", [{ questionId: "tempo-1", value: -2 }]);
    expect(result.pendingTieBreaks).toEqual(["focus", "engine", "drive"]);
    expect(result.scores.tempo).toBeGreaterThan(50);
  });

  it("scores A and B extremes, including reversed visual poles", () => {
    const allA = FULL_QUESTIONS.map((question) => ({
      questionId: question.id,
      value: (question.left.pole === "a" ? -2 : 2) as DecisionStyleAnswerValue,
    }));
    const allB = FULL_QUESTIONS.map((question) => ({
      questionId: question.id,
      value: (question.left.pole === "b" ? -2 : 2) as DecisionStyleAnswerValue,
    }));
    expect(scoreDecisionStyle("full", allA).scores).toEqual({ tempo: 100, focus: 100, engine: 100, drive: 100 });
    expect(scoreDecisionStyle("full", allA).code).toBe("FDBG");
    expect(scoreDecisionStyle("full", allB).scores).toEqual({ tempo: 0, focus: 0, engine: 0, drive: 0 });
    expect(scoreDecisionStyle("full", allB).code).toBe("SWLV");
  });

  it("clamps duplicate/excess answers and labels the inclusive 45/55 band as slight", () => {
    const tempo = FULL_QUESTIONS.filter((question) => question.axis === "tempo");
    const answers = [
      ...tempo.map((question) => ({
        questionId: question.id,
        value: (question.left.pole === "a" ? -2 : 2) as DecisionStyleAnswerValue,
      })),
      ...Array.from({ length: 4 }, () => ({ questionId: tempo[0].id, value: -2 as const })),
    ];
    const result = scoreDecisionStyle("full", answers, { focus: "a", engine: "a", drive: "a" });
    expect(result.scores.tempo).toBe(100);
    expect(result.tendencies.tempo).toBe("明显倾向");
    expect(result.tendencies.focus).toBe("轻微倾向");
    expect(result.axisStrength(45)).toBe("轻微倾向");
    expect(result.axisStrength(55)).toBe("轻微倾向");
    expect(result.axisStrength(44)).toBe("明显倾向");
  });

  it("selects up to three strongest non-neutral local answers with axis diversity", () => {
    const answers = [
      { questionId: "tempo-1", value: -2 as const },
      { questionId: "tempo-2", value: -2 as const },
      { questionId: "focus-1", value: -2 as const },
      { questionId: "engine-1", value: 1 as const },
      { questionId: "drive-1", value: 0 as const },
    ];
    const evidence = scoreDecisionStyle("full", answers, { drive: "a" }).evidence;
    expect(evidence).toHaveLength(3);
    expect(evidence.map((item) => item.questionId)).toEqual(["tempo-1", "focus-1", "engine-1"]);
    expect(new Set(evidence.map((item) => item.axis)).size).toBe(3);
    expect(evidence.every((item) => item.choiceLabel.length > 0)).toBe(true);
  });

  it("fills all three evidence slots when eligible answers are concentrated in one axis", () => {
    const evidence = scoreDecisionStyle("full", [
      { questionId: "tempo-1", value: -2 },
      { questionId: "tempo-2", value: -2 },
      { questionId: "tempo-3", value: -2 },
    ]).evidence;
    expect(evidence.map((item) => item.questionId)).toEqual(["tempo-1", "tempo-2", "tempo-3"]);
  });

  it("fills remaining evidence slots after selecting strongest distinct axes", () => {
    const evidence = scoreDecisionStyle("full", [
      { questionId: "tempo-1", value: -2 },
      { questionId: "tempo-2", value: -2 },
      { questionId: "focus-1", value: -2 },
      { questionId: "focus-2", value: -2 },
    ]).evidence;
    expect(evidence.map((item) => item.questionId)).toEqual(["tempo-1", "focus-1", "tempo-2"]);
  });

  it("keeps the strongest completed summary by source and completion time", () => {
    const quick: DecisionStyleSummary = {
      version: 2, source: "quick", code: "FDBG", scores: { tempo: 100, focus: 100, engine: 100, drive: 100 }, completedAt: "2026-07-10T10:00:00.000Z",
    };
    const full: DecisionStyleSummary = { ...quick, source: "full", code: "SWLV", completedAt: "2026-07-10T09:00:00.000Z" };
    expect(mergeDecisionStyleSummary(quick, full)).toBe(full);
    expect(mergeDecisionStyleSummary(full, quick)).toBe(full);
    const laterQuick = { ...quick, completedAt: "2026-07-10T11:00:00.000Z" };
    expect(mergeDecisionStyleSummary(quick, laterQuick)).toBe(laterQuick);
    expect(mergeDecisionStyleSummary(laterQuick, quick)).toBe(laterQuick);
  });
});
