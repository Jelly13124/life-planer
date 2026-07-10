// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecisionStyleSummary } from "@/domain/decisionStyle";
import { DecisionStyleResult } from "@/components/decision-style/DecisionStyleResult";

const summary: DecisionStyleSummary = {
  version: 2,
  source: "full",
  code: "FDBG",
  scores: { tempo: 76, focus: 61, engine: 58, drive: 42 },
  completedAt: "2026-07-10T12:00:00.000Z",
};

describe("DecisionStyleResult", () => {
  it("renders the code, text score bars, evidence, and ordered actions without forbidden wording", () => {
    render(
      <DecisionStyleResult
        summary={summary}
        evidence={[
          { questionId: "tempo-1", axis: "tempo", choiceLabel: "先做一个小范围尝试，再根据反馈调整", value: -2 },
          { questionId: "focus-1", axis: "focus", choiceLabel: "持续把大部分时间放在一个核心方向", value: -2 },
          { questionId: "drive-1", axis: "drive", choiceLabel: "回报、稳定性和可持续的保障", value: -2 },
        ]}
        onContinue={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.getByText("FDBG")).toBeInTheDocument();
    expect(screen.getByText("务实攻坚者")).toBeInTheDocument();
    expect(screen.getByText("当前倾向，不是固定人格。")).toBeInTheDocument();
    expect(screen.getByText(/76 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/61 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/58 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/42 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText("先做一个小范围尝试，再根据反馈调整")).toBeInTheDocument();

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "一键分享",
      "复制链接",
      "保存 PNG",
      "继续生成人生树",
      "重新测试",
    ]);

    expect(screen.queryByText(/feasibility/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/probability/i)).not.toBeInTheDocument();
    expect(screen.queryByText("AI 粗估")).not.toBeInTheDocument();
  });
});
