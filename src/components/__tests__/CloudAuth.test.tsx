// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CloudAuth } from "@/components/CloudAuth";

// 受控的会话 mock：每个用例改 session 再渲染。
let session: {
  enabled: boolean;
  ready: boolean;
  userId: string | null;
  email: string | null;
  signInWithEmail: (e: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

vi.mock("@/lib/useCloudSession", () => ({
  useCloudSession: () => session,
}));

vi.mock("@/prefs/PreferencesContext", () => ({
  useT: () => ({ t: (zh: string) => zh, locale: "zh" }),
}));

describe("CloudAuth", () => {
  beforeEach(() => {
    cleanup();
    session = {
      enabled: false,
      ready: true,
      userId: null,
      email: null,
      signInWithEmail: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => {}),
    };
  });

  it("renders nothing when the flag is off (the default no-op guarantee)", () => {
    session.enabled = false;
    const { container } = render(<CloudAuth />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the session is not yet ready", () => {
    session.enabled = true;
    session.ready = false;
    const { container } = render(<CloudAuth />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the cloud-sync entry and a magic-link form when enabled + signed out", async () => {
    session.enabled = true;
    render(<CloudAuth />);
    // 入口可见
    const entry = screen.getByText("云同步");
    expect(entry).toBeTruthy();
    // 展开表单
    fireEvent.click(entry);
    const input = screen.getByPlaceholderText("你的邮箱") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "me@example.com" } });
    fireEvent.submit(input.closest("form")!);
    expect(session.signInWithEmail).toHaveBeenCalledWith("me@example.com");
  });

  it("rejects an invalid email without calling signInWithEmail", () => {
    session.enabled = true;
    render(<CloudAuth />);
    fireEvent.click(screen.getByText("云同步"));
    const input = screen.getByPlaceholderText("你的邮箱") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "not-an-email" } });
    fireEvent.submit(input.closest("form")!);
    expect(session.signInWithEmail).not.toHaveBeenCalled();
    expect(screen.getByText("请输入有效的邮箱地址")).toBeTruthy();
  });

  it("shows the signed-in email and sign-out when a user is present", () => {
    session.enabled = true;
    session.userId = "user-1";
    session.email = "me@example.com";
    render(<CloudAuth />);
    expect(screen.getByText("me@example.com")).toBeTruthy();
    fireEvent.click(screen.getByText("退出登录"));
    expect(session.signOut).toHaveBeenCalledTimes(1);
  });
});
