import { describe, it, expect, afterEach, vi } from "vitest";
import { isSupabaseCloudEnabled } from "@/lib/featureFlags";

// flag 由两个公开 env 的"是否都配齐"驱动。默认（都没配）→ false，App 走纯本地。
describe("isSupabaseCloudEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when neither env var is set (the default)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(isSupabaseCloudEnabled()).toBe(false);
  });

  it("is false when only the URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(isSupabaseCloudEnabled()).toBe(false);
  });

  it("is false when only the anon key is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(isSupabaseCloudEnabled()).toBe(false);
  });

  it("is true only when BOTH env vars are non-empty", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(isSupabaseCloudEnabled()).toBe(true);
  });
});
