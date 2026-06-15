import { describe, it, expect } from "vitest";
import { makeRng, hashSeed, rngPick } from "@/domain/seed";

describe("seed", () => {
  it("same seed -> same sequence", () => {
    const a = makeRng("x");
    const b = makeRng("x");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("values in [0,1)", () => {
    const r = makeRng("y");
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds differ", () => {
    expect(makeRng("a")()).not.toEqual(makeRng("b")());
  });

  it("hashSeed is stable and numeric", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
    expect(typeof hashSeed("hello")).toBe("number");
  });

  it("rngPick stays in array and is deterministic", () => {
    const arr = ["a", "b", "c", "d"];
    const r1 = makeRng("pick");
    const r2 = makeRng("pick");
    const p1 = rngPick(r1, arr);
    const p2 = rngPick(r2, arr);
    expect(p1).toBe(p2);
    expect(arr).toContain(p1);
  });
});
