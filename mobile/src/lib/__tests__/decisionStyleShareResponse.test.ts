import { describe, expect, it } from "vitest";
import { resolveSignedStyleShareResponse } from "../decisionStyleShareResponse";

describe("resolveSignedStyleShareResponse", () => {
  it("builds trusted absolute result and PNG URLs", () => {
    expect(
      resolveSignedStyleShareResponse(
        { token: "signed-token", path: "/style/FDBG/signed-token" },
        "https://lifeplanner.test",
        "FDBG",
      ),
    ).toEqual({
      token: "signed-token",
      url: "https://lifeplanner.test/style/FDBG/signed-token",
      pngUrl: "https://lifeplanner.test/style/FDBG/signed-token/card.png",
    });
  });

  it("preserves a real dot-separated signed token", () => {
    expect(
      resolveSignedStyleShareResponse(
        { token: "payload.signature", path: "/style/FDBG/payload.signature" },
        "https://lifeplanner.test",
        "FDBG",
      ),
    ).toEqual({
      token: "payload.signature",
      url: "https://lifeplanner.test/style/FDBG/payload.signature",
      pngUrl: "https://lifeplanner.test/style/FDBG/payload.signature/card.png",
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

  it.each([
    ["traversal", "../signed", "/style/FDBG/../signed"],
    ["slash", "payload/signature", "/style/FDBG/payload/signature"],
    ["query", "signed?admin=true", "/style/FDBG/signed?admin=true"],
    ["fragment", "signed#profile", "/style/FDBG/signed#profile"],
    ["percent escape", "signed%2Ftoken", "/style/FDBG/signed%2Ftoken"],
    ["whitespace", "signed token", "/style/FDBG/signed token"],
    ["empty token", "", "/style/FDBG/"],
    ["dot-dot token", "..", "/style/FDBG/.."],
  ])("rejects a %s token", (_case, token, path) => {
    expect(
      resolveSignedStyleShareResponse(
        { token, path },
        "https://lifeplanner.test",
        "FDBG",
      ),
    ).toBeNull();
  });

  it("rejects arrays", () => {
    const arrayResponse = Object.assign([], {
      token: "signed",
      path: "/style/FDBG/signed",
    });

    expect(
      resolveSignedStyleShareResponse(
        arrayResponse,
        "https://lifeplanner.test",
        "FDBG",
      ),
    ).toBeNull();
  });

  it("rejects responses with extra own keys", () => {
    expect(
      resolveSignedStyleShareResponse(
        { token: "signed", path: "/style/FDBG/signed", url: "https://evil.test" },
        "https://lifeplanner.test",
        "FDBG",
      ),
    ).toBeNull();
  });

  it("requires token and path to be own properties", () => {
    const inheritedResponse = Object.create({
      token: "signed",
      path: "/style/FDBG/signed",
    });

    expect(
      resolveSignedStyleShareResponse(
        inheritedResponse,
        "https://lifeplanner.test",
        "FDBG",
      ),
    ).toBeNull();
  });
});
