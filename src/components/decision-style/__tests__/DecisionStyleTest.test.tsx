// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FULL_QUESTIONS } from "@/domain/decisionStyle";
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

const mockApplyDecisionStyleSummary = vi.fn();
const mockApp = {
  tree: null,
  applyDecisionStyleSummary: mockApplyDecisionStyleSummary,
};

vi.mock("@/state/AppContext", () => ({
  useApp: () => mockApp,
}));

function answerQuestion(questionIndex: number, choice: "neutral" | "a") {
  const question = FULL_QUESTIONS[questionIndex];
  if (choice === "neutral") {
    fireEvent.click(screen.getByLabelText("两边都差不多"));
    return;
  }
  const label = question.left.pole === "a"
    ? `${question.left.label}（非常符合）`
    : `${question.right.label}（非常符合）`;
  fireEvent.click(screen.getByLabelText(label));
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  mockApplyDecisionStyleSummary.mockReset();
  mockApp.tree = null;
  vi.restoreAllMocks();
});

beforeEach(() => {
  mockApp.tree = null;
  requestDecisionStyleShareLink.mockReset();
});

describe("DecisionStyleTest", () => {
  it("restores a saved draft after refresh, preserves back navigation state, and can restart with confirmation", () => {
    const onContinueToTree = vi.fn();
    const { unmount } = render(<DecisionStyleTest onContinueToTree={onContinueToTree} />);

    fireEvent.click(screen.getByRole("button", { name: "开始测试" }));
    expect(screen.getByText(/第 1 \/ 28 题/)).toBeInTheDocument();

    answerQuestion(0, "a");
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    expect(screen.getByText(/第 2 \/ 28 题/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "上一题" }));
    expect(screen.getByRole("heading", { name: FULL_QUESTIONS[0].prompt })).toBeInTheDocument();
    const checked = screen.getByLabelText(
      FULL_QUESTIONS[0].left.pole === "a"
        ? `${FULL_QUESTIONS[0].left.label}（非常符合）`
        : `${FULL_QUESTIONS[0].right.label}（非常符合）`,
    ) as HTMLInputElement;
    expect(checked.checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    unmount();

    render(<DecisionStyleTest onContinueToTree={onContinueToTree} />);
    expect(screen.getByText(/第 2 \/ 28 题/)).toBeInTheDocument();

    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "重新测试" }));
    expect(screen.getByText(/第 2 \/ 28 题/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新测试" }));
    expect(screen.getByRole("button", { name: "开始测试" })).toBeInTheDocument();
    expect(sessionStorage.getItem(STYLE_DRAFT_KEY)).toBeNull();
  });

  it("runs intro to result, asks only for required tie-breakers, clears draft, saves local detail, and hands off to onboarding", () => {
    const onContinueToTree = vi.fn();
    render(<DecisionStyleTest onContinueToTree={onContinueToTree} />);

    fireEvent.click(screen.getByRole("button", { name: "开始测试" }));

    for (let index = 0; index < FULL_QUESTIONS.length; index += 1) {
      answerQuestion(index, FULL_QUESTIONS[index].axis === "tempo" ? "neutral" : "a");
      fireEvent.click(screen.getByRole("button", { name: index === FULL_QUESTIONS.length - 1 ? "查看结果" : "下一题" }));
    }

    expect(screen.getByText("还需要 1 个平分追问")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "信息还不完整、成本也可控时，你这次更愿意：" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("先试一次再调整"));
    fireEvent.click(screen.getByRole("button", { name: "查看结果" }));

    expect(screen.getByText("本地结果依据")).toBeInTheDocument();
    expect(sessionStorage.getItem(STYLE_DRAFT_KEY)).toBeNull();
    expect(loadDecisionStyleDetail()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "继续生成人生树" }));
    expect(onContinueToTree).toHaveBeenCalledTimes(1);
    expect(mockApplyDecisionStyleSummary).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(STYLE_SUMMARY_KEY)).toContain('"version":2');
    expect(localStorage.getItem(STYLE_DETAIL_KEY)).toContain('"version":2');
  });

  it("can resume from a persisted draft written outside the component", () => {
    saveDecisionStyleDraft({
      version: 2,
      answers: [{ questionId: FULL_QUESTIONS[0].id, value: -2 }],
      tieBreaks: {},
    });

    render(<DecisionStyleTest onContinueToTree={vi.fn()} />);

    expect(screen.getByText(/第 2 \/ 28 题/)).toBeInTheDocument();
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

    render(
      <DecisionStyleTest
        onContinueToTree={vi.fn()}
        inviteToken="inviter-signed-token"
        onCompareReady={onCompareReady}
        onInviteCleared={onInviteCleared}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "开始测试" }));

    for (let index = 0; index < FULL_QUESTIONS.length; index += 1) {
      answerQuestion(index, FULL_QUESTIONS[index].axis === "tempo" ? "neutral" : "a");
      fireEvent.click(screen.getByRole("button", { name: index === FULL_QUESTIONS.length - 1 ? "查看结果" : "下一题" }));
    }

    fireEvent.click(screen.getByLabelText("先试一次再调整"));
    fireEvent.click(screen.getByRole("button", { name: "查看结果" }));

    await waitFor(() => expect(requestDecisionStyleShareLink).toHaveBeenCalledTimes(1));
    expect(requestDecisionStyleShareLink.mock.calls[0]?.[0]).toMatchObject({
      version: 2,
      source: "full",
      code: "FDBG",
    });
    await waitFor(() => expect(onCompareReady).toHaveBeenCalledWith("/compare/inviter-signed-token/friend-signed-token"));
    expect(onInviteCleared).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STYLE_SUMMARY_KEY)).toBeNull();
    expect(localStorage.getItem(STYLE_DETAIL_KEY)).toContain('"version":2');
  });

  it("clears invite state on restart without persisting the inviter token", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onInviteCleared = vi.fn();

    render(
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
