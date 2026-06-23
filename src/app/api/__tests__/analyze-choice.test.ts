import { describe, expect, it } from "vitest";
import { localChoiceAnalysis } from "@/lib/choiceAnalysis";

// localChoiceAnalysis 是纯函数离线兜底：为每个传入的选项 id 给出可立即用的有效结构。
describe("localChoiceAnalysis", () => {
  it("returns a well-formed analysis for every option id", () => {
    const options = [
      { id: "a", label: "去大厂" },
      { id: "b", label: "创业" },
      { id: "c", label: "" }, // 空 label 也要给有效结构
    ];
    const out = localChoiceAnalysis(options);

    for (const o of options) {
      const a = out[o.id];
      expect(a).toBeDefined();
      expect(typeof a.pros).toBe("string");
      expect(a.pros.length).toBeGreaterThan(0);
      expect(typeof a.cons).toBe("string");
      expect(a.cons.length).toBeGreaterThan(0);
      expect(typeof a.cost).toBe("string");
      expect(a.cost.length).toBeGreaterThan(0);
      expect(["one-way", "two-way"]).toContain(a.reversibility);
      expect(typeof a.note).toBe("string"); // note 兜底可为空串
    }
  });

  it("flags one-way doors from label keywords, defaults others to two-way", () => {
    const out = localChoiceAnalysis([
      { id: "quit", label: "辞职创业" },
      { id: "stay", label: "留在现在的公司" },
    ]);
    expect(out.quit.reversibility).toBe("one-way");
    expect(out.stay.reversibility).toBe("two-way");
  });

  it("is pure/deterministic: same input → identical output", () => {
    const opts = [{ id: "x", label: "读研" }];
    expect(localChoiceAnalysis(opts)).toEqual(localChoiceAnalysis(opts));
  });

  it("skips options without an id and never throws on empty input", () => {
    expect(localChoiceAnalysis([])).toEqual({});
    // @ts-expect-error — exercising defensive runtime guard on malformed input
    const out = localChoiceAnalysis([{ label: "no id" }, { id: "ok", label: "fine" }]);
    expect(Object.keys(out)).toEqual(["ok"]);
  });
});
