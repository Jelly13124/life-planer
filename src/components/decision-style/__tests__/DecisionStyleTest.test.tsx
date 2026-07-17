// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { act, cleanup, fireEvent, render, screen, within, type RenderResult } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DECISION_STYLE_SCALE_VALUES,
  FULL_QUESTIONS,
  decisionStyleScaleAccessibilityLabel,
  type DecisionStyleAnswerValue,
} from "@/domain/decisionStyle";
import { DecisionStyleTest } from "@/components/decision-style/DecisionStyleTest";
import {
  STYLE_DETAIL_KEY,
  STYLE_DRAFT_KEY,
  STYLE_SUMMARY_KEY,
  loadDecisionStyleDetail,
  saveDecisionStyleDraft,
} from "@/lib/decisionStyleStorage";

const { requestDecisionStyleShareLink } = vi.hoisted(() => ({
  requestDecisionStyleShareLink: vi.fn(),
}));

vi.mock("@/lib/decisionStyleShareClient", () => ({
  requestDecisionStyleShareLink,
}));

vi.mock("@/lib/decisionStyleAnalytics", () => ({
  trackDecisionStyleEvent: vi.fn(),
}));

const mockApplyDecisionStyleSummary = vi.fn();
const mockApp = {
  tree: null,
  applyDecisionStyleSummary: mockApplyDecisionStyleSummary,
};

vi.mock("@/state/AppContext", () => ({
  useApp: () => mockApp,
}));

async function renderTest(ui: ReactElement): Promise<RenderResult> {
  let result: RenderResult | undefined;
  await act(async () => {
    result = render(ui);
  });
  return result as RenderResult;
}

function answerValue(questionIndex: number, choice: "neutral" | "a"): DecisionStyleAnswerValue {
  if (choice === "neutral") return 0;
  return FULL_QUESTIONS[questionIndex].left.pole === "a" ? -2 : 2;
}

function chooseAndAdvance(questionIndex: number, value: DecisionStyleAnswerValue) {
  fireEvent.click(screen.getByRole("button", {
    name: decisionStyleScaleAccessibilityLabel(FULL_QUESTIONS[questionIndex], value),
  }));
  act(() => vi.advanceTimersByTime(200));
}

function chooseTieAndFinish(label: string) {
  fireEvent.click(screen.getByRole("radio", { name: label }));
  act(() => vi.advanceTimersByTime(200));
}

beforeEach(() => {
  vi.useFakeTimers();
  mockApp.tree = null;
  requestDecisionStyleShareLink.mockReset();
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  sessionStorage.clear();
  localStorage.clear();
  mockApplyDecisionStyleSummary.mockReset();
  mockApp.tree = null;
  vi.restoreAllMocks();
});

describe("DecisionStyleTest", () => {
  it("renders the exact intro and a five-dot scale without visible intensity wording or question submit buttons", async () => {
    await renderTest(<DecisionStyleTest onContinueToTree={vi.fn()} />);

    expect(screen.getByText("决策人格测试")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "28 道选择题，看看你做重大决定时像哪种人" })).toBeInTheDocument();
    expect(screen.getByText("按最近真实发生的选择回答。原始答案只保存在本设备；结果描述当前倾向，不是固定人格或心理诊断。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "开始测试" }));

    const first = FULL_QUESTIONS[0];
    const scale = screen.getByRole("group", { name: first.prompt });
    expect(within(scale).getByText(first.left.label)).toBeInTheDocument();
    expect(within(scale).getByText(first.right.label)).toBeInTheDocument();
    expect(within(scale).getAllByRole("button")).toHaveLength(5);
    for (const value of DECISION_STYLE_SCALE_VALUES) {
      expect(within(scale).getByRole("button", {
        name: decisionStyleScaleAccessibilityLabel(first, value),
      })).toHaveAttribute("aria-pressed", "false");
    }
    expect(within(scale).queryByText(/强烈偏向|稍微偏向|两边差不多/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下一题" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看结果" })).not.toBeInTheDocument();
  });

  it("auto-advances once, ignores a second rapid choice, and preserves back edits", async () => {
    await renderTest(<DecisionStyleTest onContinueToTree={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "开始测试" }));
    const first = FULL_QUESTIONS[0];
    const leftChoice = screen.getByRole("button", {
      name: decisionStyleScaleAccessibilityLabel(first, -2),
    });
    const rightChoice = screen.getByRole("button", {
      name: decisionStyleScaleAccessibilityLabel(first, 2),
    });

    fireEvent.click(leftChoice);
    fireEvent.click(rightChoice);
    act(() => vi.advanceTimersByTime(199));
    expect(screen.getByText("01 / 28")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("02 / 28")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "上一题" }));
    expect(screen.getByRole("button", {
      name: decisionStyleScaleAccessibilityLabel(first, -2),
    })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", {
      name: decisionStyleScaleAccessibilityLabel(first, 2),
    })).toHaveAttribute("aria-pressed", "false");

    chooseAndAdvance(0, 2);
    fireEvent.click(screen.getByRole("button", { name: "上一题" }));
    expect(screen.getByRole("button", {
      name: decisionStyleScaleAccessibilityLabel(first, 2),
    })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores a saved draft after refresh and can restart with confirmation", async () => {
    const onContinueToTree = vi.fn();
    const { unmount } = await renderTest(<DecisionStyleTest onContinueToTree={onContinueToTree} />);

    fireEvent.click(screen.getByRole("button", { name: "开始测试" }));
    expect(screen.getByText("01 / 28")).toBeInTheDocument();

    const firstValue = answerValue(0, "a");
    chooseAndAdvance(0, firstValue);
    expect(screen.getByText("02 / 28")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "上一题" }));
    expect(screen.getByRole("button", {
      name: decisionStyleScaleAccessibilityLabel(FULL_QUESTIONS[0], firstValue),
    })).toHaveAttribute("aria-pressed", "true");

    chooseAndAdvance(0, firstValue);
    unmount();

    await renderTest(<DecisionStyleTest onContinueToTree={onContinueToTree} />);
    expect(screen.getByText("02 / 28")).toBeInTheDocument();

    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "重新测试" }));
    expect(screen.getByText("02 / 28")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新测试" }));
    expect(screen.getByRole("button", { name: "开始测试" })).toBeInTheDocument();
    expect(sessionStorage.getItem(STYLE_DRAFT_KEY)).toBeNull();
  });

  it("runs intro to result, asks only for required tie-breakers, clears draft, saves local detail, and hands off to onboarding", async () => {
    const onContinueToTree = vi.fn();
    await renderTest(<DecisionStyleTest onContinueToTree={onContinueToTree} />);

    fireEvent.click(screen.getByRole("button", { name: "开始测试" }));

    for (let index = 0; index < FULL_QUESTIONS.length; index += 1) {
      const choice = FULL_QUESTIONS[index].axis === "tempo" ? "neutral" : "a";
      chooseAndAdvance(index, answerValue(index, choice));
    }

    expect(screen.getByText("加赛题")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "信息还不完整、成本也可控时，你这次更愿意：" })).toBeInTheDocument();
    chooseTieAndFinish("先试一次再调整");

    expect(screen.getByText("本地结果依据")).toBeInTheDocument();
    expect(sessionStorage.getItem(STYLE_DRAFT_KEY)).toBeNull();
    expect(loadDecisionStyleDetail()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "继续生成人生树" }));
    expect(onContinueToTree).toHaveBeenCalledTimes(1);
    expect(mockApplyDecisionStyleSummary).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(STYLE_SUMMARY_KEY)).toContain('"version":2');
    expect(localStorage.getItem(STYLE_DETAIL_KEY)).toContain('"version":2');
  });

  it("can resume from a persisted draft written outside the component", async () => {
    saveDecisionStyleDraft({
      version: 2,
      answers: [{ questionId: FULL_QUESTIONS[0].id, value: -2 }],
      tieBreaks: {},
    });

    await renderTest(<DecisionStyleTest onContinueToTree={vi.fn()} />);

    expect(screen.getByText("02 / 28")).toBeInTheDocument();
  });

  it("uses an inviter token only for the current completion flow, then clears invite state", async () => {
    requestDecisionStyleShareLink.mockResolvedValue({
      token: "friend-signed-token",
      path: "/style/FDBG/friend-signed-token",
      url: "https://lifeplanner.test/style/FDBG/friend-signed-token",
      pngUrl: "https://lifeplanner.test/style/FDBG/friend-signed-token/card.png",
    });

    const onCompareReady = vi.fn();
    const onInviteCleared = vi.fn();

    await renderTest(
      <DecisionStyleTest
        onContinueToTree={vi.fn()}
        inviteToken="inviter-signed-token"
        onCompareReady={onCompareReady}
        onInviteCleared={onInviteCleared}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "开始测试" }));

    for (let index = 0; index < FULL_QUESTIONS.length; index += 1) {
      const choice = FULL_QUESTIONS[index].axis === "tempo" ? "neutral" : "a";
      chooseAndAdvance(index, answerValue(index, choice));
    }

    chooseTieAndFinish("先试一次再调整");

    await act(async () => {
      await Promise.resolve();
    });
    expect(requestDecisionStyleShareLink).toHaveBeenCalledTimes(1);
    expect(requestDecisionStyleShareLink.mock.calls[0]?.[0]).toMatchObject({
      version: 2,
      source: "full",
      code: "FDBG",
    });
    expect(onCompareReady).toHaveBeenCalledWith("/compare/inviter-signed-token/friend-signed-token");
    expect(onInviteCleared).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STYLE_SUMMARY_KEY)).toBeNull();
    expect(localStorage.getItem(STYLE_DETAIL_KEY)).toContain('"version":2');
  });

  it("clears invite state on restart without persisting the inviter token", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onInviteCleared = vi.fn();

    await renderTest(
      <DecisionStyleTest
        onContinueToTree={vi.fn()}
        inviteToken="inviter-signed-token"
        onInviteCleared={onInviteCleared}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "开始测试" }));
    fireEvent.click(screen.getByRole("button", { name: "重新测试" }));

    expect(onInviteCleared).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STYLE_DRAFT_KEY)).toBeNull();
    expect(sessionStorage.getItem(STYLE_SUMMARY_KEY)).toBeNull();
    expect(localStorage.getItem(STYLE_DETAIL_KEY)).toBeNull();
    expect(JSON.stringify({ session: sessionStorage, local: localStorage })).not.toContain("inviter-signed-token");
  });
});
