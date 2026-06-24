import { describe, it, expect } from "vitest";
import { classifyChoice, ARCHETYPES, getArchetype } from "@/domain/archetypes";

describe("archetypes", () => {
  it("classifies by keyword", () => {
    expect(classifyChoice("我想辞职创业").key).toBe("startup");
    expect(classifyChoice("换个公司跳槽").key).toBe("jobhop");
    expect(classifyChoice("去读研深造").key).toBe("study");
    expect(classifyChoice("打算出国移民").key).toBe("relocate");
    expect(classifyChoice("准备结婚成家").key).toBe("family");
    expect(classifyChoice("想躺平休息一年").key).toBe("slowdown");
  });

  it("falls back to bold for unknown / empty", () => {
    expect(classifyChoice("asdfqwer").key).toBe("bold");
    expect(classifyChoice("").key).toBe("bold");
  });

  it("every archetype has color, summaries and node templates per mood", () => {
    for (const a of ARCHETYPES) {
      expect(a.color).toMatch(/^#/);
      expect(a.summaries.length).toBeGreaterThanOrEqual(3);
      expect(a.nodes.high.length).toBeGreaterThanOrEqual(2);
      expect(a.nodes.mid.length).toBeGreaterThanOrEqual(2);
      expect(a.nodes.low.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("getArchetype returns bold for unknown key", () => {
    expect(getArchetype("does-not-exist").key).toBe("bold");
    expect(getArchetype("startup").key).toBe("startup");
  });
});
