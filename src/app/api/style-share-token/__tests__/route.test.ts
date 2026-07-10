import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../route";

const body = {
  version: 2,
  source: "quick",
  code: "FDBG",
  scores: { tempo: 76, focus: 64, engine: 82, drive: 91 },
};
const originalSecret = process.env.DECISION_STYLE_SHARE_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.DECISION_STYLE_SHARE_SECRET;
  else process.env.DECISION_STYLE_SHARE_SECRET = originalSecret;
});

const post = (value: BodyInit) => POST(new Request("http://localhost/api/style-share-token", { method: "POST", body: value }));

describe("POST /api/style-share-token", () => {
  it("returns a signed token and its code-bound public path", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";
    const response = await post(JSON.stringify(body));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ path: expect.stringMatching(/^\/style\/FDBG\//), token: expect.any(String) });
    expect(result.path).toBe(`/style/FDBG/${result.token}`);
  });

  it("returns 503 when the signing secret is not configured", async () => {
    delete process.env.DECISION_STYLE_SHARE_SECRET;
    expect((await post(JSON.stringify(body))).status).toBe(503);
  });

  it("rejects invalid payloads, including an invalid path code and extra fields", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";
    expect((await post(JSON.stringify({ ...body, code: "SWLV" }))).status).toBe(400);
    expect((await post(JSON.stringify({ ...body, path: "/style/SWLV/x" }))).status).toBe(400);
  });

  it("rejects over-limit and non-JSON request bodies", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";
    expect((await post("x".repeat(1025))).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
  });

  it("allows POST only", async () => {
    process.env.DECISION_STYLE_SHARE_SECRET = "test-secret";
    expect((await POST(new Request("http://localhost/api/style-share-token", { method: "GET" }))).status).toBe(405);
  });
});
