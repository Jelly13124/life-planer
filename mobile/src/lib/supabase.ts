// Supabase 手机端客户端 —— 镜像网页 src/lib/supabaseClient.ts。
// 未配置 EXPO_PUBLIC_SUPABASE_*（本地开发/未注入）时全部安静 no-op，绝不抛错。
// auth 会话持久化到 AsyncStorage；手机走邮箱 OTP 验证码流（无深链）。
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LifeTree } from "@lifeplanner/core/types";
import type { CloudStore } from "@lifeplanner/core/repository/supabaseRepo";
import type { SharePayload } from "@lifeplanner/core/share";
import { API_BASE_URL } from "./api";

const SUPA_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const SUPA_ANON = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export function isCloudEnabled(): boolean {
  return SUPA_URL.length > 0 && SUPA_ANON.length > 0;
}

let cached: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  if (!isCloudEnabled()) return null;
  cached = createClient(SUPA_URL, SUPA_ANON, {
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

// Supabase auth 错误 → 用户可见中文（登录 UI 直接展示；未匹配时给通用文案兜底）。
function zhAuthError(message: string, status?: number): string {
  const m = message.toLowerCase();
  if (status === 429 || m.includes("rate limit") || m.includes("only request this after"))
    return "发送太频繁，请稍后再试";
  if (m.includes("expired") || m.includes("invalid") || m.includes("token"))
    return "验证码错误或已过期";
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to"))
    return "网络异常，请重试";
  return "操作失败，请稍后再试";
}

// OTP 登录流：发码 → 验码。返回错误文案（null = 成功）。
export async function sendOtp(email: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return "云同步未配置";
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return error ? zhAuthError(error.message, error.status) : null;
}
export async function verifyOtp(email: string, token: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return "云同步未配置";
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  return error ? zhAuthError(error.message, error.status) : null;
}
export async function signOut(): Promise<void> {
  const sb = getSupabase();
  // 即使服务端 revoke 失败，signOut 也会清掉本地会话；这里忽略错误，不阻塞退出登录。
  if (sb) await sb.auth.signOut().catch(() => {});
}

// 删除账户必须由可信服务端完成：客户端只发送当前用户 access token，绝不持有管理员密钥。
// 成功时 Auth 用户及带 on delete cascade 的 trees/shares 会一并删除；本地数据由 store 随后清理。
export async function deleteAccount(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return "云同步未配置";
  if (!API_BASE_URL) return "账户删除服务暂不可用";

  try {
    const { data, error } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token) return "登录已过期，请重新登录后再试";

    const response = await fetch(`${API_BASE_URL}/api/account`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.status === 204) {
      // 服务端删除用户后全局登出可能返回用户已不存在；无论结果如何都要清掉本机会话。
      await sb.auth.signOut().catch(() => {});
      return null;
    }
    if (response.status === 401) return "登录已过期，请重新登录后再试";
    return "账户删除失败，请稍后重试";
  } catch {
    return "网络异常，请联网后重试";
  }
}

// 分享卡 payload：类型定义在共享核心（@lifeplanner/core/share），与网页 /s/[id] 页面
// 共用同一份契约（TypeScript 强制同步，而非注释承诺）。这里重新导出，调用方
// （如 ./shareCard.ts）无需改动导入路径。绝不能带完整 tree/goals/tasks——
// 只允许 SharePayload 允许的几个字段（隐私 + 页面本来也读不出别的字段）。
export type { SharePayload };

// 分享域名：与 web 的 src/lib/shareConfig.ts 保持一致（换正式域名时两处一起改，或都走 env）。
export const SHARE_BASE_URL =
  (process.env.EXPO_PUBLIC_SHARE_DOMAIN ?? "").trim() || "https://life-planer-opal.vercel.app";
export function shareUrl(id: string): string {
  return `${SHARE_BASE_URL}/s/${id}`;
}

// 创建分享卡（写 shares 表一行，返回分享 id）。需登录（RLS: auth.uid() = user_id）；
// 未登录/未配置/失败 → null，调用方给「登录后可分享」/「稍后再试」提示。
export async function createShare(payload: SharePayload): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const uid = (await sb.auth.getSession()).data.session?.user?.id ?? null;
    if (!uid) return null;
    const { data, error } = await sb.from("shares").insert({ user_id: uid, payload }).select("id").single();
    if (error) return null;
    return (data?.id as string) ?? null;
  } catch {
    return null;
  }
}
