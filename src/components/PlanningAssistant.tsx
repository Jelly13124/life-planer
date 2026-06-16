"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/state/AppContext";
import {
  sendAssistant,
  ASSISTANT_PROMPTS,
  type ChatMessage,
} from "@/lib/assistantClient";
import { Button } from "./ui/Button";

// 常驻浮窗的规划助手（P4）：帮你理清选择、提出新可能、一键加进树。
export function PlanningAssistant() {
  const { tree, addBranch } = useApp();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  if (!tree) return null;

  async function send(text: string) {
    const content = text.trim();
    if (!content || thinking || !tree) return;
    setFailed(false);
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setThinking(true);
    const reply = await sendAssistant(tree, next);
    setThinking(false);
    if (reply) setMessages([...next, { role: "assistant", content: reply }]);
    else setFailed(true);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-[var(--accent)]/50 bg-[var(--bg-1)]/90 px-4 py-2.5 text-sm font-medium text-[var(--fg)] shadow-xl backdrop-blur transition hover:bg-[var(--accent)]/15"
      >
        <span className="text-base">💬</span> 规划助手
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[70vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--bg-1)] shadow-2xl animate-scale-in">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div className="text-sm font-bold">💬 规划助手</div>
        <button
          onClick={() => setOpen(false)}
          aria-label="收起"
          className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--fg-dim)] transition hover:text-[var(--fg)]"
        >
          ✕
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !thinking && (
          <p className="mt-2 text-center text-sm text-[var(--fg-dim)]">
            迷茫的时候，跟我说说你在纠结什么。我会帮你理清，也会提一些你没想到的路。
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "assistant" ? "flex justify-start" : "flex justify-end"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === "assistant"
                  ? "rounded-tl-sm border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--fg)]"
                  : "rounded-tr-sm border border-[var(--line)] bg-white/5 text-[var(--fg)]"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="text-xs text-[var(--fg-faint)]">助手正在想…</div>
        )}
        {failed && (
          <div className="rounded-xl border border-[var(--line)] bg-white/5 px-3 py-2 text-center text-xs text-[var(--fg-faint)]">
            （没接上 AI——确认 .env.local 配了 DEEPSEEK_API_KEY）
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {ASSISTANT_PROMPTS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={thinking}
              className="rounded-full border border-[var(--line)] bg-white/5 px-2.5 py-1 text-[11px] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--fg)] disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 把聊出的选择加进树 */}
      {(input.trim() || added) && (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-4 pt-2 text-xs">
          {added ? (
            <span className="text-[var(--c-emerald)]">🌱 已加进人生树：{added}</span>
          ) : (
            <>
              <span className="truncate text-[var(--fg-faint)]">加「{input.trim()}」当一条新岔路？</span>
              <button
                onClick={() => {
                  const v = input.trim();
                  if (!v) return;
                  addBranch(v);
                  setInput("");
                  setAdded(v);
                  setTimeout(() => setAdded(null), 2600);
                }}
                className="flex-shrink-0 rounded-full border border-[var(--c-fuchsia)]/50 px-2.5 py-1 text-[var(--c-fuchsia)] transition hover:bg-[var(--c-fuchsia)]/10"
              >
                ＋ 加进树
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) send(input);
          }}
          placeholder="说说你在纠结什么…"
          className="flex-1 rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-3.5 py-2 text-sm text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
        />
        <Button variant="primary" disabled={!input.trim() || thinking} onClick={() => send(input)}>
          发送
        </Button>
      </div>
    </div>
  );
}
