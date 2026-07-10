import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const validBody = {
  event: "style_complete",
  surface: "web",
  source: "direct",
  test_version: 2,
} as const;

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function post(body: BodyInit, ip = "198.51.100.10") {
  return POST(
    new Request("http://localhost/api/style-events", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body,
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 201 })));
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});

describe("POST /api/style-events", () => {
  it("accepts the exact privacy-minimal event shape and lets the server own created_at", async () => {
    const response = await post(JSON.stringify(validBody), "198.51.100.11");

    expect(response.status).toBe(202);
    expect(fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/style_events",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "service-test-key",
          authorization: "Bearer service-test-key",
        }),
        body: JSON.stringify(validBody),
      }),
    );
    expect(JSON.stringify((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0])).not.toMatch(
      /answers|scores|code|token|name|user|device|flow|free text/i,
    );
  });

  it("returns a success no-op when server configuration is absent", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await post(JSON.stringify(validBody), "198.51.100.12");

    expect(response.status).toBe(202);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a success no-op when Supabase is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await post(JSON.stringify(validBody), "198.51.100.13");

    expect(response.status).toBe(202);
  });

  it("rejects extra keys and invalid enum/version values", async () => {
    expect((await post(JSON.stringify({ ...validBody, extra: true }), "198.51.100.14")).status).toBe(400);
    expect((await post(JSON.stringify({ ...validBody, event: "style_answer" }), "198.51.100.15")).status).toBe(400);
    expect((await post(JSON.stringify({ ...validBody, test_version: 1 }), "198.51.100.16")).status).toBe(400);
  });

  it("rejects request bodies over 512 bytes", async () => {
    const body = `${JSON.stringify(validBody)}${" ".repeat(512)}`;
    expect((await post(body, "198.51.100.17")).status).toBe(413);
  });

  it("rate limits an IP in memory without persisting its address", async () => {
    const ip = "198.51.100.18";
    const responses = await Promise.all(Array.from({ length: 31 }, () => post(JSON.stringify(validBody), ip)));

    expect(responses.filter((response) => response.status === 429)).toHaveLength(1);
    const requestBodies = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) => String(call[1]?.body));
    expect(requestBodies.join("\n")).not.toContain(ip);
  });
});
