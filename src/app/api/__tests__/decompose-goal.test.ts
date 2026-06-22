import { describe, expect, it } from "vitest";
import { localDecompose } from "@/lib/decompose";
import { LIFE_AREAS } from "@/domain/types";

// localDecompose 是纯函数离线兜底：每个领域都该给出可立即用的非空指标/任务/习惯。
describe("localDecompose", () => {
  it("returns non-empty, well-formed metrics/tasks/habits for every life area", () => {
    for (const area of LIFE_AREAS) {
      const dec = localDecompose({ title: "测试目标", area });

      // 指标：1-3 条，每条带数字 target + 字符串 unit + 非空 label。
      expect(dec.metrics.length).toBeGreaterThan(0);
      expect(dec.metrics.length).toBeLessThanOrEqual(3);
      for (const m of dec.metrics) {
        expect(m.label.trim().length).toBeGreaterThan(0);
        expect(typeof m.target).toBe("number");
        expect(Number.isFinite(m.target)).toBe(true);
        expect(typeof m.unit).toBe("string");
        expect(m.unit.length).toBeGreaterThan(0);
      }

      // 任务：3-6 条具体一次性任务，文本非空。
      expect(dec.tasks.length).toBeGreaterThanOrEqual(3);
      expect(dec.tasks.length).toBeLessThanOrEqual(6);
      for (const task of dec.tasks) expect(task.text.trim().length).toBeGreaterThan(0);

      // 习惯：1-3 条，repeat 是 daily/weekly。
      expect(dec.habits.length).toBeGreaterThan(0);
      expect(dec.habits.length).toBeLessThanOrEqual(3);
      for (const h of dec.habits) {
        expect(h.text.trim().length).toBeGreaterThan(0);
        expect(["daily", "weekly"]).toContain(h.repeat);
      }

      // 子目标：可选 0-3 个。
      expect(dec.subgoals.length).toBeLessThanOrEqual(3);
    }
  });

  it("is pure/deterministic: same area → identical output", () => {
    expect(localDecompose({ title: "A", area: "career" })).toEqual(
      localDecompose({ title: "B", area: "career" }),
    );
  });

  it("falls back to a sensible template (growth) for unknown/missing area", () => {
    const unknown = localDecompose({ title: "X", area: "nonsense" });
    expect(unknown).toEqual(localDecompose({ title: "X", area: "growth" }));
    const missing = localDecompose({ title: "X" });
    expect(missing.metrics.length).toBeGreaterThan(0);
    expect(missing.tasks.length).toBeGreaterThanOrEqual(3);
  });
});
