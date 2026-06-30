import { describe, it, expect } from "vitest";
import { AXES, codeOf, type Axes } from "../lifePathCode/axes";
import { LIFE_PATH_TYPES, typeByCode, allTypes } from "../lifePathCode/types";
import { STATEMENTS } from "../lifePathCode/statements";
import { scoreQuiz, riskAppetiteFromAxes, styleHintForCode, type QuizAnswer } from "../lifePathCode/score";

describe("lifePathCode/axes", () => {
  it("has 4 axes in fixed order with 8 distinct letters", () => {
    expect(AXES.map((a) => a.axis)).toEqual(["tempo", "focus", "engine", "drive"]);
    expect(new Set(AXES.flatMap((a) => [a.a, a.b])).size).toBe(8);
  });
  it("codeOf concatenates poles in axis order", () => {
    const axes: Axes = { tempo: "F", focus: "D", engine: "B", drive: "V" };
    expect(codeOf(axes)).toBe("FDBV");
  });
});

describe("lifePathCode/types", () => {
  it("covers all 16 codes exactly", () => {
    const codes = allTypes().map((t) => t.code).sort();
    expect(codes.length).toBe(16);
    expect(new Set(codes).size).toBe(16);
    for (const c of codes) expect(/^[FS][DW][BL][GV]$/.test(c)).toBe(true);
  });
  it("every type has non-empty content + a hex color + feasibility in band", () => {
    for (const t of allTypes()) {
      for (const s of [t.nickname, t.light, t.shadow, t.workStyle, t.teaser]) {
        expect(s.length).toBeGreaterThan(0);
      }
      expect(/^#[0-9a-fA-F]{6}$/.test(t.color)).toBe(true);
      expect(t.feasibility).toBeGreaterThanOrEqual(20);
      expect(t.feasibility).toBeLessThanOrEqual(85);
    }
  });
  it("typeByCode resolves or returns undefined", () => {
    expect(typeByCode("FDBV")?.nickname).toBe("孤勇拓荒者");
    expect(typeByCode("ZZZZ")).toBeUndefined();
  });
});

describe("lifePathCode/statements", () => {
  it("has 28 statements, 7 per axis, each leaning a valid pole of its axis", () => {
    expect(STATEMENTS.length).toBe(28);
    for (const def of AXES) {
      const forAxis = STATEMENTS.filter((s) => s.axis === def.axis);
      expect(forAxis.length).toBe(7);
      for (const s of forAxis) expect([def.a, def.b]).toContain(s.pole);
      // mixed-keyed: each axis has at least one of each pole (reduces acquiescence bias)
      expect(forAxis.some((s) => s.pole === def.a)).toBe(true);
      expect(forAxis.some((s) => s.pole === def.b)).toBe(true);
    }
  });
  it("statement ids are unique and non-empty text", () => {
    expect(new Set(STATEMENTS.map((s) => s.id)).size).toBe(28);
    for (const s of STATEMENTS) expect(s.text.length).toBeGreaterThan(0);
  });
});

// helper: answer every statement "非常符合" (+2) → each axis resolves to the pole the
// majority of its statements lean. With mixed keying, majority pole per axis = whichever
// pole has ≥4 of the 7 statements.
function agreeAll(): QuizAnswer[] {
  return STATEMENTS.map((s) => ({ statementId: s.id, value: 2 as const }));
}

describe("lifePathCode/score", () => {
  it("is deterministic and returns a content-backed code", () => {
    const a = agreeAll();
    const r1 = scoreQuiz(a);
    const r2 = scoreQuiz(a);
    expect(r1.code).toBe(r2.code);
    expect(/^[FS][DW][BL][GV]$/.test(r1.code)).toBe(true);
  });
  it("all-neutral (or empty) → TIE_DEFAULT code SDLG", () => {
    expect(scoreQuiz([]).code).toBe("SDLG");
    expect(scoreQuiz(STATEMENTS.map((s) => ({ statementId: s.id, value: 0 as const }))).code).toBe("SDLG");
  });
  it("strongly agreeing only with F/D/B/V statements yields FDBV", () => {
    const ans: QuizAnswer[] = STATEMENTS.map((s) => ({
      statementId: s.id,
      value: (["F", "D", "B", "V"].includes(s.pole) ? 2 : -2) as QuizAnswer["value"],
    }));
    expect(scoreQuiz(ans).code).toBe("FDBV");
  });
  it("riskAppetiteFromAxes maps tempo F→aggressive, S→conservative", () => {
    expect(riskAppetiteFromAxes({ tempo: "F", focus: "D", engine: "B", drive: "V" })).toBe("aggressive");
    expect(riskAppetiteFromAxes({ tempo: "S", focus: "D", engine: "L", drive: "G" })).toBe("conservative");
  });
  it("styleHintForCode returns a non-empty clause naming the type", () => {
    const h = styleHintForCode("FDBV");
    expect(h).toContain("孤勇拓荒者");
    expect(h.length).toBeGreaterThan(10);
    expect(styleHintForCode("ZZZZ")).toBe(""); // unknown code → empty (no injection)
  });
});
