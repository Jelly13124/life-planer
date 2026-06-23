// Supabase 浏览器客户端 —— 唯一 import @supabase/supabase-js 的地方（除 CloudAuth UI 用到的类型）。
// 全部在 isSupabaseCloudEnabled() flag 之后：没配两个 NEXT_PUBLIC_* 环境变量时 getSupabase() 返回 null，
// 绝不抛错、绝不建客户端，因此 flag 关时这条路径完全惰性、零副作用、零网络。
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { LifeTree } from "@/domain/types";
import type { CloudStore } from "@/domain/repository/supabaseRepo";
import { isSupabaseCloudEnabled } from "@/lib/featureFlags";

// 懒加载单例：第一次成功创建后缓存；未配置时始终返回 null。
let cached: SupabaseClient | null = null;

// 返回浏览器端 Supabase 客户端；未配置（flag 关）或在服务端 → null。
// 调用方必须处理 null（= 走本地 localStorage），永不假定它非空。
export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  if (!isSupabaseCloudEnabled()) return null;
  // isSupabaseCloudEnabled 已确认两者为非空字符串，这里断言安全。
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  cached = createClient(url, anon, {
    auth: {
      // 魔法链接回到本页时自动从 URL 解析会话；持久化到 localStorage，刷新后仍登录。
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}

// 当前登录用户 id（未配置 / 未登录 / 出错 → null）。
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

// 把 supabase-js 适配成 domain 层的窄接口 CloudStore（trees 表，一个用户一行，data 为 jsonb）。
// 未配置时返回 null —— 调用方据此退回本地。RLS 已保证只能读写自己那一行，这里仍按 user_id 过滤。
export function getCloudStore(): CloudStore | null {
  const sb = getSupabase();
  if (!sb) return null;
  return {
    async getTree(userId) {
      const { data, error } = await sb
        .from("trees")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle(); // 没有行时返回 data=null，而不是报错
      if (error) throw error;
      return data?.data ?? null; // data.data 就是存进去的 LifeTree JSON
    },
    async putTree(userId, tree: LifeTree) {
      const { error } = await sb
        .from("trees")
        .upsert(
          { user_id: userId, data: tree, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }, // 同一 user_id 已存在则覆盖
        );
      if (error) throw error;
    },
    async deleteTree(userId) {
      const { error } = await sb.from("trees").delete().eq("user_id", userId);
      if (error) throw error;
    },
  };
}
