// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AppShell } from "@/components/AppShell";

const nav = {
  openDashboard: vi.fn(),
  openPlan: vi.fn(),
  openHabits: vi.fn(),
  openAreas: vi.fn(),
  openInsights: vi.fn(),
  openTree: vi.fn(),
  reset: vi.fn(),
};

vi.mock("@/state/AppContext", () => ({
  useApp: () => nav,
}));

vi.mock("@/prefs/PreferencesContext", () => ({
  useT: () => ({ t: (zh: string) => zh, locale: "zh" }),
}));

describe("AppShell", () => {
  beforeEach(() => {
    cleanup();
    Object.values(nav).forEach((f) => (f as ReturnType<typeof vi.fn>).mockClear());
  });

  it("renders a nav landmark with all six sections", () => {
    render(<AppShell active="dashboard">content</AppShell>);
    const navs = screen.getAllByRole("navigation", { name: "Sections" });
    expect(navs.length).toBeGreaterThanOrEqual(1);
    for (const label of ["日历", "目标", "习惯", "人生面", "洞察", "人生树"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("marks the active section with aria-current=page", () => {
    render(<AppShell active="habits">content</AppShell>);
    const current = screen.getAllByRole("button", { current: "page" });
    expect(current.length).toBe(1);
    expect(current[0]).toHaveTextContent("习惯");
  });

  it("clicking a section calls its nav method", () => {
    render(<AppShell active="dashboard">content</AppShell>);
    fireEvent.click(screen.getByText("洞察"));
    expect(nav.openInsights).toHaveBeenCalledTimes(1);
  });

  it("exposes a mobile menu trigger", () => {
    render(<AppShell active="dashboard">content</AppShell>);
    expect(screen.getByLabelText("打开菜单")).toBeTruthy();
  });

  it("renders children in the content area", () => {
    render(
      <AppShell active="tree">
        <span>HELLO_CONTENT</span>
      </AppShell>,
    );
    expect(screen.getByText("HELLO_CONTENT")).toBeTruthy();
  });
});
