"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { isSupabaseCloudEnabled } from "@/lib/featureFlags";

// 云端会话状态（全部在 flag 之后）。flag 关时永远是稳定的 disabled 态：
//   enabled=false / ready=true / userId=null —— 调用方据此走本地，零网络、零订阅。
export interface CloudSession {
  enabled: boolean; // flag 是否开（两个 env 都配齐）
  ready: boolean; // 是否已确定首个会话状态（flag 关时立即 true）
  userId: string | null; // 已登录用户 id
  email: string | null; // 已登录邮箱（用于显示）
  // 发魔法链接到该邮箱。返回 { error } —— null 表示成功。flag 关 → 返回错误占位（UI 不会被渲染）。
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const DISABLED: Omit<CloudSession, "signInWithEmail" | "signOut"> = {
  enabled: false,
  ready: true,
  userId: null,
  email: null,
};

export function useCloudSession(): CloudSession {
  // flag 在模块加载时即固定（env 编译期注入）；不会在运行时变。
  const enabled = isSupabaseCloudEnabled();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  // flag 关：立即 ready（不订阅、不取会话）。flag 开：等首个 onAuthStateChange / getSession 回来。
  const [ready, setReady] = useState<boolean>(!enabled);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // flag 关，或拿不到客户端（理论上 enabled 时不会发生）：彻底不碰 supabase。
    // ready 已在初始 state 处理：enabled 时初值 false，下面订阅回来再置 true。
    const sb = enabled ? getSupabase() : null;
    if (!sb) return;
    // 先读一次现有会话（刷新后从 localStorage 恢复），再订阅变化（魔法链接回来 / 登出）。
    void sb.auth.getSession().then(({ data }) => {
      if (!mounted.current) return;
      setUserId(data.session?.user?.id ?? null);
      setEmail(data.session?.user?.email ?? null);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (!mounted.current) return;
      setUserId(session?.user?.id ?? null);
      setEmail(session?.user?.email ?? null);
      setReady(true);
    });
    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, [enabled]);

  const signInWithEmail = useCallback(async (addr: string): Promise<{ error: string | null }> => {
    const sb = getSupabase();
    if (!sb) return { error: "cloud-disabled" };
    try {
      const { error } = await sb.auth.signInWithOtp({
        email: addr.trim(),
        options: {
          // 魔法链接点开后回到当前页；detectSessionInUrl 会消化 URL 里的 token。
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      return { error: error ? error.message : null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "unknown" };
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const sb = getSupabase();
    if (!sb) return;
    try {
      await sb.auth.signOut();
    } catch {
      // 静默：登出失败不阻塞 UI
    }
  }, []);

  if (!enabled) {
    return { ...DISABLED, signInWithEmail, signOut };
  }
  return { enabled, ready, userId, email, signInWithEmail, signOut };
}
