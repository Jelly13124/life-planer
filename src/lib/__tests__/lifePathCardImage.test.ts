import { describe, it, expect } from "vitest";
import { buildLifePathCardSvg } from "../lifePathCardImage";
import { typeByCode } from "@/domain/lifePathCode";

describe("buildLifePathCardSvg", () => {
  it("self-contained SVG with code + nickname, no CSS vars", () => {
    const t = typeByCode("FDBV")!;
    const svg = buildLifePathCardSvg(t, { domain: "example.app", disclaimer: "AI 粗估" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("FDBV");
    expect(svg).toContain("孤勇拓荒者");
    expect(svg).not.toContain("var(--");
  });
});
