import { describe, it, expect, expectTypeOf } from "vitest";
import { deriveAreas, buildSnapshot } from "@/domain/profile";
import { LIFE_AREAS, type Profile } from "@/domain/types";
import type { DecisionStyleSummary } from "@/domain/decisionStyle";

type Inputs = Omit<Profile, "areas" | "snapshot">;

const base: Inputs = {
  name: "阿明",
  age: 28,
  education: "bachelor",
  major: "计算机",
  occupation: "后端工程师",
  salary: "10to20",
  hasSideHustle: false,
  sideHustle: "",
  hobbies: "",
  relationship: "single",
  location: "上海",
  status: "工作3年",
  crossroad: "要不要辞职创业",
};

describe("deriveAreas", () => {
  it("returns all areas within 0-100", () => {
    const a = deriveAreas(base);
    for (const k of LIFE_AREAS) {
      expect(a[k]).toBeGreaterThanOrEqual(0);
      expect(a[k]).toBeLessThanOrEqual(100);
    }
  });

  it("higher salary -> higher wealth", () => {
    expect(deriveAreas({ ...base, salary: "gt50" }).wealth).toBeGreaterThan(
      deriveAreas({ ...base, salary: "lt5" }).wealth,
    );
  });

  it("higher education -> higher career", () => {
    expect(deriveAreas({ ...base, education: "phd" }).career).toBeGreaterThan(
      deriveAreas({ ...base, education: "highschool" }).career,
    );
  });

  it("side hustle and hobbies raise growth", () => {
    const plain = deriveAreas(base).growth;
    const richer = deriveAreas({ ...base, hasSideHustle: true, hobbies: "摄影" }).growth;
    expect(richer).toBeGreaterThan(plain);
  });

  it("relationship status changes relationships", () => {
    expect(deriveAreas({ ...base, relationship: "married" }).relationships).toBeGreaterThan(
      deriveAreas({ ...base, relationship: "divorced" }).relationships,
    );
  });
});

describe("buildSnapshot", () => {
  it("includes the key concrete fields", () => {
    const s = buildSnapshot({
      ...base,
      hasSideHustle: true,
      sideHustle: "做自媒体",
      hobbies: "跑步",
    });
    expect(s).toContain("后端工程师");
    expect(s).toContain("做自媒体");
    expect(s).toContain("跑步");
    expect(s).toContain("28 岁");
  });
});

describe("Profile decision style", () => {
  it("accepts a v2 decision-style summary without changing explicit risk appetite", () => {
    const summary: DecisionStyleSummary = {
      version: 2,
      source: "full",
      code: "FDBG",
      scores: { tempo: 76, focus: 64, engine: 82, drive: 91 },
      completedAt: "2026-07-10T09:00:00.000Z",
    };
    const profile: Pick<Profile, "decisionStyle" | "riskAppetite"> = {
      decisionStyle: summary,
      riskAppetite: "conservative",
    };

    expect(profile).toEqual({ decisionStyle: summary, riskAppetite: "conservative" });
    expectTypeOf<Profile["decisionStyle"]>().toEqualTypeOf<DecisionStyleSummary | undefined>();
  });

});
