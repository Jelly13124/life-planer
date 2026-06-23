import { describe, it, expect, afterEach, vi } from "vitest";
import { getSupabase, getCloudStore, getCurrentUserId } from "@/lib/supabaseClient";

// flag 关（默认，无 env）时的"零副作用"保证：客户端工厂全部返回 null / 安全值，绝不抛错。
// 不测试已配置路径（会创建并缓存真实客户端 / 触发网络），那条留给用户早上验。
describe("supabaseClient (unconfigured / flag off)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("getSupabase() returns null when env vars are absent", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(getSupabase()).toBeNull();
  });

  it("getCloudStore() returns null when unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(getCloudStore()).toBeNull();
  });

  it("getCurrentUserId() resolves to null (no throw) when unconfigured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    await expect(getCurrentUserId()).resolves.toBeNull();
  });
});
