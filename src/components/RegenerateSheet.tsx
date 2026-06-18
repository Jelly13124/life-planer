"use client";

import { useState } from "react";
import type { LifePath } from "@/domain/types";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Button } from "./ui/Button";

// 补充/更正信息后，让 AI 带着它把这条路重新推演（修正时间线/前提）。
export function RegenerateSheet({
  path,
  onClose,
}: {
  path: LifePath;
  onClose: () => void;
}) {
  const { t } = useT();
  const { regeneratePath } = useApp();
  const [note, setNote] = useState(path.note ?? "");

  function submit() {
    if (!note.trim()) return;
    regeneratePath(path.id, note);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-lg rounded-t-3xl border border-[var(--line)] bg-[var(--bg-1)] p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">{t("补充信息，重新推演")}</h3>
        <p className="mt-1 text-sm text-[var(--fg-dim)]">{path.choiceLabel}</p>
        <p className="mt-3 text-xs text-[var(--fg-faint)]">
          {t("哪里不对、漏说了什么？写下来，AI 会据此修正时间线重新推演。")}
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          autoFocus
          placeholder={t("比如：我已经拿到 offer，23 岁就入学，不用备考")}
          className="mt-2 w-full resize-none px-4 py-3 text-base"
        />
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {t("取消")}
          </Button>
          <Button variant="primary" disabled={!note.trim()} onClick={submit}>
            {t("重新推演 →")}
          </Button>
        </div>
      </div>
    </div>
  );
}
