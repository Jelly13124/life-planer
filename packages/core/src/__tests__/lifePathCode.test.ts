import { describe, it, expect } from "vitest";
import { AXES, codeOf, type Axes } from "../lifePathCode/axes";

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
