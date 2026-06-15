import { describe, it, expect } from "vitest";
import { suggestFor } from "@/domain/suggestions";
import type { Profile } from "@/domain/types";

const base: Profile = {
  name: "测试",
  age: 28,
  snapshot: "",
  crossroad: "",
  areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 },
};

describe("suggestFor", () => {
  it("returns non-empty unique string list", () => {
    const s = suggestFor(base);
    expect(s.length).toBeGreaterThan(0);
    expect(new Set(s).size).toBe(s.length);
    s.forEach((x) => expect(typeof x).toBe("string"));
  });

  it("surfaces keyword-matched picks", () => {
    const s = suggestFor({ ...base, crossroad: "要不要辞职创业" });
    expect(s.some((x) => x.includes("创业") || x.includes("副业"))).toBe(true);
  });

  it("caps at 5", () => {
    expect(suggestFor({ ...base, crossroad: "城市 工作 读研 感情 创业" }).length).toBeLessThanOrEqual(5);
  });
});
