// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DecisionStyleCharacter } from "@/components/decision-style/DecisionStyleCharacter";

vi.mock("@/domain/decisionStyle", () => ({
  decisionPersonalityPresentationByCode: (code: string) => ({
    characterId: code === "FDBG" ? "SDBG" : "FWBV",
  }),
}));

describe("DecisionStyleCharacter", () => {
  it("recovers from an image error when the presentation character changes", () => {
    const { rerender } = render(<DecisionStyleCharacter code="FDBG" />);

    const image = screen.getByRole("img", { name: "SDBG 人格角色" });
    expect(image).toHaveAttribute("src", "/decision-style/characters/SDBG.png");

    fireEvent.error(image);
    expect(screen.getByRole("img", { name: "SDBG 人格角色" })).not.toHaveAttribute("src");

    rerender(<DecisionStyleCharacter code="FDBV" />);
    expect(screen.getByRole("img", { name: "FWBV 人格角色" })).toHaveAttribute(
      "src",
      "/decision-style/characters/FWBV.png",
    );
  });
});
