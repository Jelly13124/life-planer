// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DecisionStyleSummary } from "@/domain/decisionStyle";
import { DecisionStyleResult } from "@/components/decision-style/DecisionStyleResult";

const {
  SHARE_UNAVAILABLE_MESSAGE,
  requestDecisionStyleShareLink,
  shareDecisionStyleLink,
  copyDecisionStyleLink,
  downloadDecisionStylePng,
} = vi.hoisted(() => ({
  SHARE_UNAVAILABLE_MESSAGE: "分享暂不可用，请联网后重试",
  requestDecisionStyleShareLink: vi.fn(),
  shareDecisionStyleLink: vi.fn(),
  copyDecisionStyleLink: vi.fn(),
  downloadDecisionStylePng: vi.fn(),
}));

vi.mock("@/lib/decisionStyleShareClient", () => ({
  SHARE_UNAVAILABLE_MESSAGE,
  requestDecisionStyleShareLink,
  shareDecisionStyleLink,
  copyDecisionStyleLink,
  downloadDecisionStylePng,
}));

vi.mock("@/lib/decisionStyleAnalytics", () => ({
  trackDecisionStyleEvent: vi.fn(),
}));

const summary: DecisionStyleSummary = {
  version: 2,
  source: "full",
  code: "FDBG",
  scores: { tempo: 76, focus: 61, engine: 58, drive: 84 },
  completedAt: "2026-07-10T12:00:00.000Z",
};

const evidence = [
  { questionId: "tempo-1", axis: "tempo" as const, choiceLabel: "先做一个小范围尝试，再根据反馈调整", value: -2 as const },
  { questionId: "focus-1", axis: "focus" as const, choiceLabel: "持续把大部分时间放在一个核心方向", value: -2 as const },
  { questionId: "drive-1", axis: "drive" as const, choiceLabel: "回报、稳定性和可持续的保障", value: -2 as const },
];

beforeEach(() => {
  requestDecisionStyleShareLink.mockReset();
  shareDecisionStyleLink.mockReset();
  copyDecisionStyleLink.mockReset();
  downloadDecisionStylePng.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DecisionStyleResult", () => {
  it("renders the code, text score bars, evidence, and ordered actions without forbidden wording", () => {
    render(
      <DecisionStyleResult
        summary={summary}
        evidence={evidence}
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
    expect(screen.getByText(/84 \/ 100/)).toBeInTheDocument();
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

  it("requests a signed link before share, copy, and PNG actions", async () => {
    requestDecisionStyleShareLink.mockResolvedValue({
      token: "signed-token",
      path: "/style/FDBG/signed-token",
      url: "https://lifeplanner.test/style/FDBG/signed-token",
      pngUrl: "https://lifeplanner.test/style/FDBG/signed-token/card.png",
    });
    shareDecisionStyleLink.mockResolvedValue("shared");
    copyDecisionStyleLink.mockResolvedValue(undefined);
    downloadDecisionStylePng.mockResolvedValue(undefined);

    render(
      <DecisionStyleResult
        summary={summary}
        evidence={evidence}
        onContinue={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    const shareButton = screen.getByRole("button", { name: "一键分享" });
    const copyButton = screen.getByRole("button", { name: "复制链接" });
    const pngButton = screen.getByRole("button", { name: "保存 PNG" });

    expect(shareButton).toBeEnabled();
    expect(copyButton).toBeEnabled();
    expect(pngButton).toBeEnabled();

    fireEvent.click(shareButton);
    await waitFor(() => expect(requestDecisionStyleShareLink).toHaveBeenCalledWith(summary));
    expect(shareDecisionStyleLink).toHaveBeenCalledWith("https://lifeplanner.test/style/FDBG/signed-token");

    fireEvent.click(copyButton);
    await waitFor(() => expect(copyDecisionStyleLink).toHaveBeenCalledWith("https://lifeplanner.test/style/FDBG/signed-token"));

    fireEvent.click(pngButton);
    await waitFor(() =>
      expect(downloadDecisionStylePng).toHaveBeenCalledWith("https://lifeplanner.test/style/FDBG/signed-token/card.png"),
    );
  });

  it("shows the explicit degraded share message when signing is unavailable", async () => {
    requestDecisionStyleShareLink.mockRejectedValue(new Error(SHARE_UNAVAILABLE_MESSAGE));

    render(
      <DecisionStyleResult
        summary={summary}
        evidence={evidence}
        onContinue={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "一键分享" }));

    expect(await screen.findByText(SHARE_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(shareDecisionStyleLink).not.toHaveBeenCalled();
  });
});
