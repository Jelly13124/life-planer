import { describe, it, expect } from "vitest";
import { LocalPathGenerator } from "@/domain/generator/localGenerator";
import { LIFE_AREAS, type Profile } from "@/domain/types";
import type { GenerateInput } from "@/domain/generator/types";

const profile: Profile = {
  name: "阿明",
  age: 28,
  education: "bachelor",
  major: "计算机",
  occupation: "后端工程师",
  salary: "10to20",
  hasSideHustle: false,
  sideHustle: "",
  hobbies: "跑步",
  relationship: "single",
  location: "上海",
  status: "工作3年",
  snapshot: "普通程序员",
  crossroad: "要不要创业",
  areas: { career: 55, wealth: 40, relationships: 60, health: 65, growth: 50 },
};

const gen = new LocalPathGenerator();
const inp: GenerateInput = {
  profile,
  choiceLabel: "辞职创业",
  kind: "choice",
  horizonYears: 15,
  index: 1,
};

describe("LocalPathGenerator", () => {
  it("is deterministic (same input -> same output)", () => {
    expect(JSON.stringify(gen.generate(inp))).toEqual(JSON.stringify(gen.generate(inp)));
  });

  it("keeps metrics within 0-100 and nodes age-ordered", () => {
    const p = gen.generate(inp);
    for (const a of LIFE_AREAS) {
      for (const pt of p.metrics[a]) {
        expect(pt.value).toBeGreaterThanOrEqual(0);
        expect(pt.value).toBeLessThanOrEqual(100);
      }
    }
    const ages = p.nodes.map((n) => n.age);
    expect(ages).toEqual([...ages].sort((x, y) => x - y));
    expect(p.nodes.length).toBeGreaterThanOrEqual(3);
    expect(p.nodes.length).toBeLessThanOrEqual(5);
  });

  it("classifies the choice into an archetype (startup)", () => {
    const p = gen.generate(inp);
    expect(p.id).toContain("startup");
    expect(p.curve).toBe("dip-rise");
  });

  it("injects the user's name into stories", () => {
    const p = gen.generate(inp);
    expect(p.nodes.some((n) => n.story.includes("阿明"))).toBe(true);
  });

  it("status-quo path is flat and labeled", () => {
    const p = gen.generate({ ...inp, kind: "status-quo", choiceLabel: "", index: 0 });
    expect(p.kind).toBe("status-quo");
    expect(p.choiceLabel).toBe("维持现状");
    expect(p.curve).toBe("flat");
  });

  it("different choices produce different paths", () => {
    const a = gen.generate(inp);
    const b = gen.generate({ ...inp, choiceLabel: "去读研深造", index: 2 });
    expect(a.endValue === b.endValue && a.summary === b.summary).toBe(false);
  });
});
