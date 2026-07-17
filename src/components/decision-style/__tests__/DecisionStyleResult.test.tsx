// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DecisionStyleSummary } from "@/domain/decisionStyle";
import { DecisionPersonalityHero } from "@/components/decision-style/DecisionPersonalityHero";
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

function setReducedMotionPreference(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

beforeEach(() => {
  setReducedMotionPreference(true);
  requestDecisionStyleShareLink.mockReset();
  shareDecisionStyleLink.mockReset();
  copyDecisionStyleLink.mockReset();
  downloadDecisionStylePng.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DecisionPersonalityHero", () => {
  it("reveals immediately when reveal is disabled", () => {
    setReducedMotionPreference(false);
    const setTimeout = vi.spyOn(window, "setTimeout");

    render(<DecisionPersonalityHero summary={summary} reveal={false} />);

    expect(screen.getByRole("heading", { name: summary.code })).toBeInTheDocument();
    expect(setTimeout).not.toHaveBeenCalled();
  });

  it("reveals immediately when reduced motion is preferred", () => {
    const setTimeout = vi.spyOn(window, "setTimeout");

    render(<DecisionPersonalityHero summary={summary} />);

    expect(screen.getByRole("heading", { name: summary.code })).toBeInTheDocument();
    expect(setTimeout).not.toHaveBeenCalled();
  });

  it("waits for the reveal delay when motion is allowed", () => {
    vi.useFakeTimers();
    setReducedMotionPreference(false);

    try {
      render(<DecisionPersonalityHero summary={summary} />);

      expect(screen.queryByRole("heading", { name: summary.code })).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(449));
      expect(screen.queryByRole("heading", { name: summary.code })).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByRole("heading", { name: summary.code })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("DecisionStyleResult", () => {
  it("renders identity first and keeps diagnostics and secondary actions in a disclosure", () => {
    render(
      <DecisionStyleResult
        summary={summary}
        evidence={evidence}
        onContinue={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "FDBG" })).toBeInTheDocument();
    expect(screen.getByText("务实攻坚者")).toBeInTheDocument();
    expect(screen.getByText("你不是没耐心，只是觉得今天能解决的事，不该开三次会。")).toBeInTheDocument();
    expect(screen.getByText("目标一清楚，你通常是最先把事情推起来的人。")).toBeInTheDocument();
    expect(screen.getByText("推进太快时，别人和后手可能还没跟上。")).toBeInTheDocument();
    expect(screen.getByText(/^给你的提醒：/)).toBeInTheDocument();
    expect(screen.queryByText(/76 \/ 100/)).not.toBeInTheDocument();
    expect(screen.queryByText("本地结果依据")).not.toBeInTheDocument();

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "分享我的人格",
      "看看我为什么是这个类型",
    ]);

    const disclosure = screen.getByRole("button", { name: "看看我为什么是这个类型" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disclosure);

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/76 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/61 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/58 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText(/84 \/ 100/)).toBeInTheDocument();
    expect(screen.getByText("本地结果依据")).toBeInTheDocument();
    expect(screen.getByText("先做一个小范围尝试，再根据反馈调整")).toBeInTheDocument();
    expect(screen.getByText("当前自报倾向，不是固定人格或心理诊断。")).toBeInTheDocument();

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "分享我的人格",
      "收起人格详情",
      "复制链接",
      "保存 PNG",
      "继续生成人生树",
      "重新测试",
    ]);

    expect(screen.queryByText(/feasibility/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/probability/i)).not.toBeInTheDocument();
    expect(screen.queryByText("AI 粗估")).not.toBeInTheDocument();
    expect(screen.queryByText(/tempo|focus|engine|drive/i)).not.toBeInTheDocument();
  });

  it("cleans the pending personality reveal timer when unmounted", () => {
    setReducedMotionPreference(false);
    const clearTimeout = vi.spyOn(window, "clearTimeout");
    const { unmount } = render(
      <DecisionStyleResult
        summary={summary}
        evidence={evidence}
        onContinue={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("正在揭晓你的决策人格")).toBeInTheDocument();
    unmount();
    expect(clearTimeout).toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole("button", { name: "看看我为什么是这个类型" }));

    const shareButton = screen.getByRole("button", { name: "分享我的人格" });
    const copyButton = screen.getByRole("button", { name: "复制链接" });
    const pngButton = screen.getByRole("button", { name: "保存 PNG" });

    expect(shareButton).toBeEnabled();
    expect(copyButton).toBeEnabled();
    expect(pngButton).toBeEnabled();

    fireEvent.click(shareButton);
    await waitFor(() => expect(requestDecisionStyleShareLink).toHaveBeenCalledWith(summary));
    expect(shareDecisionStyleLink).toHaveBeenCalledWith(
      "https://lifeplanner.test/style/FDBG/signed-token",
      "FDBG",
    );

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

    fireEvent.click(screen.getByRole("button", { name: "分享我的人格" }));

    expect(await screen.findByText(SHARE_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(shareDecisionStyleLink).not.toHaveBeenCalled();
  });
});
