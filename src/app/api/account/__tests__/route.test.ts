import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { DELETE } from "../route";

function request(token = "valid-user-token"): Request {
  return new Request("http://localhost/api/account", {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "publishable-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");

  mocks.getUser.mockResolvedValue({
    data: { user: { id: "715ed5db-f090-4b8c-a067-640ecee36aa0" } },
    error: null,
  });
  mocks.deleteUser.mockResolvedValue({ data: null, error: null });
  mocks.createClient.mockImplementation((_url: string, key: string) =>
    key === "publishable-test-key"
      ? { auth: { getUser: mocks.getUser } }
      : { auth: { admin: { deleteUser: mocks.deleteUser } } },
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("DELETE /api/account", () => {
  it("verifies the bearer token before deleting exactly that Auth user", async () => {
    const response = await DELETE(request());

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.getUser).toHaveBeenCalledWith("valid-user-token");
    expect(mocks.deleteUser).toHaveBeenCalledWith("715ed5db-f090-4b8c-a067-640ecee36aa0");
  });

  it("rejects requests without a valid bearer header", async () => {
    const response = await DELETE(new Request("http://localhost/api/account", { method: "DELETE" }));

    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("fails closed when the server-only admin key is absent", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await DELETE(request());

    expect(response.status).toBe(503);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("does not delete anything when Supabase rejects the user token", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });

    const response = await DELETE(request("expired-token"));

    expect(response.status).toBe(401);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("surfaces an upstream deletion failure without clearing the account client-side", async () => {
    mocks.deleteUser.mockResolvedValue({ data: null, error: new Error("database unavailable") });

    const response = await DELETE(request());

    expect(response.status).toBe(502);
  });

  it("handles an unexpected Supabase network failure", async () => {
    mocks.getUser.mockRejectedValue(new Error("offline"));

    const response = await DELETE(request());

    expect(response.status).toBe(502);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("supports Supabase's current server secret key without exposing it as a public env", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");

    const response = await DELETE(request());

    expect(response.status).toBe(204);
    expect(mocks.createClient).toHaveBeenNthCalledWith(
      2,
      "https://example.supabase.co",
      "sb_secret_test",
      expect.any(Object),
    );
  });
});
