"use client";

import { useState } from "react";
import type { LifeTree } from "@/domain/types";
import { suggestFor } from "@/domain/suggestions";
import { Button } from "./ui/Button";

export function AddBranchSheet({
  tree,
  onAdd,
  onClose,
}: {
  tree: LifeTree;
  onAdd: (label: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const suggestions = suggestFor(tree.profile);

  function confirm() {
    const v = label.trim();
    if (!v) return;
    onAdd(v);
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
        <h3 className="text-lg font-bold">添加一条岔路</h3>
        <p className="mt-1 text-sm text-[var(--fg-dim)]">
          写下一个你想尝试的选择，AI 会推演出它的人生走向。
        </p>

        <textarea
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          rows={2}
          autoFocus
          placeholder="比如：辞职创业 / 去读研 / 搬到深圳……"
          className="mt-4 w-full resize-none px-4 py-3 text-base"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) confirm();
          }}
        />

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
            ✨ 试试这些
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setLabel(s)}
                className="rounded-full border border-[var(--line)] bg-white/5 px-3 py-1.5 text-sm text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--fg)]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" disabled={!label.trim()} onClick={confirm}>
            生成这条路 →
          </Button>
        </div>
      </div>
    </div>
  );
}
