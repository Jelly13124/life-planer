"use client";

import { useEffect, useRef, useState } from "react";
import type { LifePath, LifeTree } from "@/domain/types";
import {
  futureAgeOf,
  sendChat,
  QUICK_PROMPTS,
  FRAMEWORK_PROMPTS,
  type ChatMessage,
} from "@/lib/chatClient";
import { useT } from "@/prefs/PreferencesContext";
import { detectCrisisSignal } from "@/domain/safety";
import { crisisCareText } from "@/lib/crisisMessage";
import { Button } from "./ui/Button";

export function FutureSelfChat({
  tree,
  path,
  onClose,
  onAddBranch,
}: {
  tree: LifeTree;
  path: LifePath;
  onClose: () => void;
  onAddBranch?: (label: string) => void; // R7：把聊出来的选择加进人生树
}) {
  const { t } = useT();
  const fAge = futureAgeOf(path);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [branched, setBranched] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Esc 关闭 + 进来就聚焦输入框
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 新消息 / 思考状态变化时滚到底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || thinking) return;

    if (detectCrisisSignal(content)) {
      setMessages([...messages, { role: "user", content }, { role: "assistant", content: crisisCareText(t) }]);
      setInput("");
      return;
    }

    setFailed(false);
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setThinking(true);

    const reply = await sendChat(tree, path, next);
    setThinking(false);

    if (reply) {
      setMessages([...next, { role: "assistant", content: reply }]);
    } else {
      setFailed(true);
    }
  }

  const accent = path.color;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("和 {age} 岁的你聊聊", { age: fAge })}
    >
      <div
        className="animate-scale-in flex h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--bg-1)] shadow-2xl sm:h-[80vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <span
                className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{
                  backgroundColor: accent,
                  boxShadow: `0 0 12px ${accent}`,
                }}
              />
              {t("和 {age} 岁的你聊聊", { age: fAge })}
            </h3>
            <p className="mt-1 truncate text-sm text-[var(--fg-dim)]">
              <span style={{ color: accent }}>{path.choiceLabel}</span>
              {path.summary ? ` · ${path.summary}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("关闭")}
            className="flex-shrink-0 rounded-full border border-[var(--line)] px-2.5 py-1 text-sm text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--fg)]"
          >
            ✕
          </button>
        </header>

        {/* 消息区 */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 && !thinking && (
            <div className="animate-fade flex h-full flex-col items-center justify-center text-center">
              <div
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                style={{
                  backgroundColor: `${accent}22`,
                  border: `1px solid ${accent}55`,
                }}
              >
                🕰️
              </div>
              <p className="max-w-xs text-sm text-[var(--fg-dim)]">
                {t("问问那个走了这条路的你…")}
              </p>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="animate-fade flex justify-start">
                <div
                  className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed"
                  style={{
                    backgroundColor: `${accent}1f`,
                    border: `1px solid ${accent}44`,
                    color: "var(--fg)",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="animate-fade flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-[var(--line)] bg-white/5 px-4 py-2.5 text-sm leading-relaxed text-[var(--fg)]">
                  {m.content}
                </div>
              </div>
            ),
          )}

          {thinking && (
            <div className="animate-fade flex justify-start">
              <div
                className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-[var(--fg-dim)]"
                style={{
                  backgroundColor: `${accent}14`,
                  border: `1px solid ${accent}33`,
                }}
              >
                {t("对方正在回想…")}
              </div>
            </div>
          )}

          {failed && (
            <div className="animate-fade rounded-2xl border border-[var(--line)] bg-white/5 px-4 py-3 text-center text-xs text-[var(--fg-faint)]">
              {t("（没接上 AI，先聊不了——确认 .env.local 里配了 DEEPSEEK_API_KEY）")}
            </div>
          )}
        </div>

        {/* 快捷追问 */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 px-5 pb-3">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={thinking}
                className="rounded-full border border-[var(--line)] bg-white/5 px-3 py-1.5 text-xs text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--fg)] disabled:opacity-40"
              >
                {t(q)}
              </button>
            ))}
          </div>
        )}

        {/* 决策框架 */}
        {messages.length === 0 && (
          <div className="px-5 pb-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--fg-faint)]">
              {t("想清楚这个决定")}
            </div>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={thinking}
                  className="rounded-full border border-[var(--c-fuchsia)]/40 bg-[var(--c-fuchsia)]/5 px-3 py-1.5 text-xs text-[var(--c-fuchsia)] transition hover:bg-[var(--c-fuchsia)]/10 disabled:opacity-40"
                >
                  {t(q)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 解锁岔路：把聊出来的选择加进树（R7） */}
        {onAddBranch && (input.trim() || branched) && (
          <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-5 pt-3 text-xs">
            {branched ? (
              <span className="text-[var(--c-emerald)]">
                {t("🌱 已把「{label}」加进你的人生树", { label: branched })}
              </span>
            ) : (
              <>
                <span className="truncate text-[var(--fg-faint)]">
                  {t("把「{label}」当作一个新选择？", { label: input.trim() })}
                </span>
                <button
                  onClick={() => {
                    const v = input.trim();
                    if (!v) return;
                    onAddBranch(v);
                    setInput("");
                    setBranched(v);
                    setTimeout(() => setBranched(null), 2600);
                  }}
                  className="flex-shrink-0 rounded-full border border-[var(--c-fuchsia)]/50 px-3 py-1 text-[var(--c-fuchsia)] transition hover:bg-[var(--c-fuchsia)]/10"
                >
                  {t("＋ 加进人生树")}
                </button>
              </>
            )}
          </div>
        )}

        {/* 输入区 */}
        <div className="flex items-center gap-2 border-t border-[var(--line)] px-5 py-4">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) send(input);
            }}
            placeholder={t("跟 {age} 岁的自己说点什么…", { age: fAge })}
            className="flex-1 rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-4 py-2.5 text-sm text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
          />
          <Button
            variant="primary"
            disabled={!input.trim() || thinking}
            onClick={() => send(input)}
          >
            {t("发送")}
          </Button>
        </div>
      </div>
    </div>
  );
}
