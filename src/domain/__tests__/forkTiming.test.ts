import { describe, it, expect } from "vitest";
import { inferForkDelayYears, inferForkAge, MAX_FORK_DELAY } from "@/domain/forkTiming";
import type { Profile } from "@/domain/types";

const profile = { age: 28 } as Profile;

describe("forkTiming", () => {
  it("gives staggered, keyword-based delays (not all 'now')", () => {
    expect(inferForkDelayYears("辞职做自媒体")).toBe(2);
    expect(inferForkDelayYears("去读研")).toBe(1);
    expect(inferForkDelayYears("申请加拿大EE移民")).toBe(1);
    expect(inferForkDelayYears("搬去成都")).toBe(1);
    expect(inferForkDelayYears("结婚生孩子")).toBe(3);
  });

  it("honors an explicit 'now' intent", () => {
    expect(inferForkDelayYears("现在就辞职")).toBe(0); // '现在' 规则在前，优先命中
    expect(inferForkDelayYears("今年换工作")).toBe(0);
  });

  it("falls back to a sensible default for unknown choices", () => {
    expect(inferForkDelayYears("做点不一样的事")).toBe(2);
    expect(inferForkDelayYears("")).toBe(0);
  });

  it("inferForkAge = age + delay", () => {
    expect(inferForkAge(profile, "辞职做自媒体")).toBe(30);
    expect(inferForkAge(profile, "现在就开始")).toBe(28);
  });

  it("delay never exceeds the cap", () => {
    expect(inferForkDelayYears("买房成家结婚")).toBeLessThanOrEqual(MAX_FORK_DELAY);
  });
});
