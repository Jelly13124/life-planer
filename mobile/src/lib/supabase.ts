// Supabase 手机端客户端 —— 镜像网页 src/lib/supabaseClient.ts。
// 未配置 EXPO_PUBLIC_SUPABASE_*（本地开发/未注入）时全部安静 no-op，绝不抛错。
// auth 会话持久化到 AsyncStorage；手机走邮箱 OTP 验证码流（无深链）。
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LifeTree } from "@lifeplanner/core/types";
import type { CloudStore } from "@lifeplanner/core/repository/supabaseRepo";

const URL_ = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const ANON = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export function isCloudEnabled(): boolean {
  return URL_.length > 0 && ANON.length > 0;
}

let cached: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  if (!isCloudEnabled()) return null;
  cached = createClient(URL_, ANON, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return cached;
}

export async function getCurrentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

// trees 表适配成 domain 的窄接口（一人一行，data 为 jsonb；RLS 只允许读写自己那行）。
export function getCloudStore(): CloudStore | null {
  const sb = getSupabase();
  if (!sb) return null;
  return {
    async getTree(userId) {
      const { data, error } = await sb.from("trees").select("data").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data?.data ?? null;
    },
    async putTree(userId, tree: LifeTree) {
      const { error } = await sb
        .from("trees")
        .upsert({ user_id: userId, data: tree, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
    async deleteTree(userId) {
      const { error } = await sb.from("trees").delete().eq("user_id", userId);
      if (error) throw error;
    },
  };
}

// OTP 登录流：发码 → 验码。返回错误文案（null = 成功）。
export async function sendOtp(email: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return "云同步未配置";
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return error ? error.message : null;
}
export async function verifyOtp(email: string, token: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return "云同步未配置";
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  return error ? error.message : null;
}
export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}
