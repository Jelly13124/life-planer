import { describe, expect, it } from "vitest";
import { resolveSignedStyleShareResponse } from "../decisionStyleShareResponse";

describe("resolveSignedStyleShareResponse", () => {
  it("builds trusted absolute result and PNG URLs", () => {
    expect(
      resolveSignedStyleShareResponse(
        { token: "signed", path: "/style/FDBG/signed" },
        "https://lifeplanner.test",
        "FDBG",
      ),
    ).toEqual({
      token: "signed",
      url: "https://lifeplanner.test/style/FDBG/signed",
      pngUrl: "https://lifeplanner.test/style/FDBG/signed/card.png",
    });
  });

  it("rejects malformed and code-mismatched paths", () => {
    expect(
      resolveSignedStyleShareResponse(
        { token: "signed", path: "/style/SDBG/signed" },
        "https://lifeplanner.test",
        "FDBG",
      ),
    ).toBeNull();
    expect(
      resolveSignedStyleShareResponse(
        { url: "https://evil.test" },
        "https://lifeplanner.test",
        "FDBG",
      ),
    ).toBeNull();
  });
});
