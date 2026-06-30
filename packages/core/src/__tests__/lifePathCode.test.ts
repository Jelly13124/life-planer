import { describe, it, expect } from "vitest";
import { AXES, codeOf, type Axes } from "../lifePathCode/axes";
import { LIFE_PATH_TYPES, typeByCode, allTypes } from "../lifePathCode/types";

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
