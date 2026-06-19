import { describe, it, expect } from "vitest";
import { detectCrisisSignal, anyCrisisSignal, CRISIS_RESOURCES } from "@/domain/safety";

// ─── CRISIS_RESOURCES shape ────────────────────────────────────────────────
describe("CRISIS_RESOURCES", () => {
  it("is a non-empty array with label and contact fields", () => {
    expect(Array.isArray(CRISIS_RESOURCES)).toBe(true);
    expect(CRISIS_RESOURCES.length).toBeGreaterThan(0);
    for (const r of CRISIS_RESOURCES) {
      expect(typeof r.label).toBe("string");
      expect(r.label.length).toBeGreaterThan(0);
      expect(typeof r.contact).toBe("string");
      expect(r.contact.length).toBeGreaterThan(0);
    }
  });
});

// ─── detectCrisisSignal — POSITIVE cases (must detect) ────────────────────
describe("detectCrisisSignal — positive (high-confidence crisis signals)", () => {
  it("detects 我想自杀", () => {
    expect(detectCrisisSignal("我想自杀")).toBe(true);
  });

  it("detects 最近真的不想活了", () => {
    expect(detectCrisisSignal("最近真的不想活了")).toBe(true);
  });

  it("detects 感觉活不下去了", () => {
    expect(detectCrisisSignal("感觉活不下去了")).toBe(true);
  });

  it("detects I want to die", () => {
    expect(detectCrisisSignal("I want to die")).toBe(true);
  });

  it("detects thinking about killing myself", () => {
    expect(detectCrisisSignal("thinking about killing myself")).toBe(true);
  });

  it("detects ending my life", () => {
    expect(detectCrisisSignal("ending my life")).toBe(true);
  });

  it("detects feeling suicidal", () => {
    expect(detectCrisisSignal("feeling suicidal")).toBe(true);
  });

  it("detects 轻生 phrase", () => {
    expect(detectCrisisSignal("有过轻生的念头")).toBe(true);
  });

  it("detects 结束自己的生命", () => {
    expect(detectCrisisSignal("想结束自己的生命")).toBe(true);
  });

  it("detects 了结自己", () => {
    expect(detectCrisisSignal("想了结自己")).toBe(true);
  });

  it("detects kill myself", () => {
    expect(detectCrisisSignal("I just want to kill myself")).toBe(true);
  });

  it("detects want to die (variant)", () => {
    expect(detectCrisisSignal("honestly just want to die")).toBe(true);
  });

  it("detects wanna die", () => {
    expect(detectCrisisSignal("wanna die rn")).toBe(true);
  });

  it("detects self-harm", () => {
    expect(detectCrisisSignal("I've been doing self-harm")).toBe(true);
  });

  it("detects hurt myself", () => {
    expect(detectCrisisSignal("I want to hurt myself")).toBe(true);
  });

  it("detects cut myself", () => {
    expect(detectCrisisSignal("I cut myself again")).toBe(true);
  });

  it("detects don't want to live", () => {
    expect(detectCrisisSignal("I don't want to live anymore")).toBe(true);
  });

  it("detects suicide (noun form)", () => {
    expect(detectCrisisSignal("I'm thinking about suicide")).toBe(true);
  });

  it("detects 不想活下去", () => {
    expect(detectCrisisSignal("真的不想活下去了")).toBe(true);
  });

  it("detects 活不下去", () => {
    expect(detectCrisisSignal("感觉活不下去")).toBe(true);
  });

  it("detects 结束生命", () => {
    expect(detectCrisisSignal("想结束生命")).toBe(true);
  });

  it("is case-insensitive for English", () => {
    expect(detectCrisisSignal("FEELING SUICIDAL")).toBe(true);
    expect(detectCrisisSignal("Kill Myself")).toBe(true);
  });
});

// ─── detectCrisisSignal — NEGATIVE cases (must NOT detect / no false positives) ─
describe("detectCrisisSignal — negative (no false positives on hyperbole)", () => {
  it("does NOT detect 我快累死了", () => {
    expect(detectCrisisSignal("我快累死了")).toBe(false);
  });

  it("does NOT detect 这个 deadline 要我命", () => {
    expect(detectCrisisSignal("这个 deadline 要我命")).toBe(false);
  });

  it("does NOT detect 笑死我了", () => {
    expect(detectCrisisSignal("笑死我了")).toBe(false);
  });

  it("does NOT detect 忙到想杀时间", () => {
    expect(detectCrisisSignal("忙到想杀时间")).toBe(false);
  });

  it("does NOT detect 我想换一种活法", () => {
    expect(detectCrisisSignal("我想换一种活法")).toBe(false);
  });

  it("does NOT detect 工作压力大到想辞职", () => {
    expect(detectCrisisSignal("工作压力大到想辞职")).toBe(false);
  });

  it("does NOT detect I'm dead tired", () => {
    expect(detectCrisisSignal("I'm dead tired")).toBe(false);
  });

  it("does NOT detect this deadline is killing me", () => {
    expect(detectCrisisSignal("this deadline is killing me")).toBe(false);
  });

  it("does NOT detect empty string", () => {
    expect(detectCrisisSignal("")).toBe(false);
  });

  it("does NOT detect whitespace-only string", () => {
    expect(detectCrisisSignal("  ")).toBe(false);
  });
});

// ─── anyCrisisSignal ───────────────────────────────────────────────────────
describe("anyCrisisSignal", () => {
  it("returns true when any element is a crisis signal, ignoring undefined", () => {
    expect(anyCrisisSignal(["普通文本", undefined, "我不想活了"])).toBe(true);
  });

  it("returns false when no element is a crisis signal, tolerating null", () => {
    expect(anyCrisisSignal(["都挺好", "工作顺利", null])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(anyCrisisSignal([])).toBe(false);
  });

  it("returns false for all null/undefined", () => {
    expect(anyCrisisSignal([null, undefined, null])).toBe(false);
  });

  it("returns true when solo positive element present", () => {
    expect(anyCrisisSignal(["feeling suicidal"])).toBe(true);
  });
});
