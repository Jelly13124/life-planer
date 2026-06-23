"use client";

import { useState, type FormEvent } from "react";
import { useT } from "@/prefs/PreferencesContext";
import { useCloudSession } from "@/lib/useCloudSession";
import { IconCloud, IconCloudCheck } from "@/components/ui/icons";

// 云同步入口（P5）。全部在 isSupabaseCloudEnabled() flag 之后：
//   flag 关（默认，无 env）→ useCloudSession().enabled=false → 整个组件渲染 null，
//   侧栏、视觉、行为与现在完全一致，零差异。
// flag 开 → 侧栏底部出现一个克制的「云同步」入口：未登录展开魔法链接登录表单，
//   已登录显示邮箱 + 退出。Apple-white 主题、线性图标，无彩色 emoji。
export function CloudAuth() {
  const { enabled, ready, userId, email, signInWithEmail, signOut } = useCloudSession();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [addr, setAddr] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // flag 关 → 什么都不渲染（关键的"零影响"保证）。
  if (!enabled) return null;
  // flag 开但首个会话状态还没确定 → 先不闪烁，渲染 null（很快 ready）。
  if (!ready) return null;

  const signedIn = userId != null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = addr.trim();
    if (!/.+@.+\..+/.test(v)) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    const { error } = await signInWithEmail(v);
    setStatus(error ? "error" : "sent");
  };

  return (
    <div className="mt-2 border-t border-[var(--line)] px-2 pt-3">
      {signedIn ? (
        // ── 已登录：邮箱 + 已同步提示 + 退出 ──
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[var(--accent)]">
              <IconCloudCheck className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-medium text-[var(--fg)]" title={email ?? undefined}>
                {email ?? t("已登录")}
              </div>
              <div className="text-[10px] text-[var(--fg-faint)]">{t("已同步到云端")}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="self-start rounded-lg px-2 py-1 text-[11px] text-[var(--fg-dim)] transition hover:bg-black/[0.04] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {t("退出登录")}
          </button>
        </div>
      ) : (
        // ── 未登录：可展开的「云同步」入口 + 魔法链接表单 ──
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm text-[var(--fg-dim)] transition hover:bg-black/[0.04] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
              <IconCloud className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{t("云同步")}</span>
            <svg
              viewBox="0 0 16 16"
              className={`h-3.5 w-3.5 flex-shrink-0 text-[var(--fg-faint)] transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              aria-hidden="true"
            >
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {open && (
            <form onSubmit={submit} className="mt-1 flex flex-col gap-2 px-1 pb-1 animate-fade" style={{ animationDuration: "0.2s" }}>
              <p className="text-[11px] leading-snug text-[var(--fg-faint)]">
                {t("登录后，你的人生树会安全同步到云端，多设备可用。")}
              </p>
              <label className="sr-only" htmlFor="cloud-email">
                {t("邮箱")}
              </label>
              <input
                id="cloud-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={addr}
                onChange={(e) => {
                  setAddr(e.target.value);
                  if (status === "error" || status === "sent") setStatus("idle");
                }}
                placeholder={t("你的邮箱")}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-2.5 py-1.5 text-xs text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {status === "sending" ? t("发送中") : t("发送登录链接")}
              </button>
              {status === "sent" && (
                <p className="text-[11px] leading-snug text-[var(--accent)]">
                  {t("登录链接已发到你的邮箱，点开即可登录。")}
                </p>
              )}
              {status === "error" && (
                <p className="text-[11px] leading-snug text-[var(--c-rose,#e11d48)]">
                  {/.+@.+\..+/.test(addr.trim()) ? t("发送失败，请稍后再试。") : t("请输入有效的邮箱地址")}
                </p>
              )}
            </form>
          )}
        </>
      )}
    </div>
  );
}
