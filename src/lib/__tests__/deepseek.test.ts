import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/deepseek";

describe("extractJson", () => {
  it("extracts a fenced JSON object", () => {
    expect(extractJson("```json\n{\"ok\":true}\n```")).toBe('{"ok":true}');
  });

  it("extracts JSON surrounded by prose", () => {
    expect(extractJson("Here is the result: {\"count\":2}.")).toBe('{"count":2}');
  });

  it("returns null when no object is present", () => {
    expect(extractJson("not json")).toBeNull();
  });
});
