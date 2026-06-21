"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";

export function InboxSection() {
  const { tree, captureToInbox, removeInboxItem, promoteInboxToGoal } = useApp();
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!tree) return null;

  const inbox = tree.inbox ?? [];

  function handleCapture() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    captureToInbox(trimmed);
    setDraft("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCapture();
    }
  }

  // 成长为分支：建目标 + 在人生树上长出一条预测分支。
  function handleGrowBranch(itemId: string) {
    promoteInboxToGoal(itemId, { withBranch: true });
  }

  // 设为目标：只建一个简单目标，不长分支。
  function handleMakeGoal(itemId: string) {
    promoteInboxToGoal(itemId);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Inbox"
        title={t("收件箱")}
        subtitle={t("想到什么先丢进来，回头再归类。")}
      />

      {/* Quick-add input */}
      <div className="mb-6 flex gap-2 animate-fade">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("随手记一条…")}
          className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] outline-none transition focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/40"
          aria-label={t("快速捕获")}
        />
        <button
          type="button"
          onClick={handleCapture}
          disabled={!draft.trim()}
          className="flex-shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--bg-0)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("添加")}
        </button>
      </div>

      {/* Hint about long-term goal routing */}
      <p className="mb-5 text-[11px] leading-relaxed text-[var(--fg-faint)] animate-fade">
        {t("提示：设成长期目标会在你的人生树上长出一条新的路（预测树枝）。")}
      </p>

      {inbox.length === 0 ? (
        <EmptyState
          icon="📥"
          accent="var(--c-sky)"
          description={t("收件箱是空的。想到什么先丢进来，回头再归类。")}
        />
      ) : (
        <ul className="space-y-2 animate-fade">
          {inbox.map((item) => (
            <li
              key={item.id}
              className="group flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 transition hover:border-[var(--accent)]/40 hover:bg-[var(--bg-2)] sm:flex-row sm:items-center"
            >
              {/* Item text */}
              <span className="flex-1 text-sm font-medium text-[var(--fg)]">
                {item.text}
              </span>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleGrowBranch(item.id)}
                  className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/[0.08] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/[0.18]"
                  title={t("成长为分支")}
                >
                  {t("🌱 成长为分支")}
                </button>
                <button
                  type="button"
                  onClick={() => handleMakeGoal(item.id)}
                  className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--fg-dim)] transition hover:border-[var(--accent)]/40 hover:text-[var(--fg)]"
                  title={t("设为目标")}
                >
                  {t("🎯 设为目标")}
                </button>
                <button
                  type="button"
                  onClick={() => removeInboxItem(item.id)}
                  className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--fg-faint)] transition hover:border-red-500/40 hover:text-red-400"
                  title={t("删除")}
                >
                  {t("删除")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
