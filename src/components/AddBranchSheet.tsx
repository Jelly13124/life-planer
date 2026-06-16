"use client";

import { useState } from "react";
import type { LifeTree } from "@/domain/types";
import { suggestFor, wildCardSuggestions } from "@/domain/suggestions";
import type { AddPathOptions } from "@/domain/tree";
import { Button } from "./ui/Button";

// 在某个未来节点处加岔路时的上下文（R6 递归用）
export interface ForkContext {
  parentId: string | null;
  forkAge: number;
  atLabel: string; // 例："在 38 岁这里"
}

export function AddBranchSheet({
  tree,
  onAdd,
  onClose,
  fork,
}: {
  tree: LifeTree;
  onAdd: (label: string, opts?: AddPathOptions) => void;
  onClose: () => void;
  fork?: ForkContext;
}) {
  const [label, setLabel] = useState("");
  const alternatives = suggestFor(tree.profile);
  const wild = wildCardSuggestions(tree.profile);

  function confirm() {
    const v = label.trim();
    if (!v) return;
    onAdd(v, fork ? { parentId: fork.parentId, forkAge: fork.forkAge } : undefined);
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
        <h3 className="text-lg font-bold">
          {fork ? `${fork.atLabel}，再选一次` : "添加一条岔路"}
        </h3>
        <p className="mt-1 text-sm text-[var(--fg-dim)]">
          {fork
            ? "从这一刻起，如果做个不同的选择，人生会怎样？AI 会接着往下推演。"
            : "写下一个你想尝试的选择，AI 会推演出它的人生走向。"}
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

        {/* Odyssey：替代路 */}
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
            替代路 · 现实的另一种选择
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {alternatives.map((s) => (
              <Chip key={s} text={s} onPick={() => setLabel(s)} />
            ))}
          </div>
        </div>

        {/* Odyssey：疯狂路 */}
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
            疯狂路 · 不计代价、不顾眼光
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {wild.map((s) => (
              <Chip key={s} text={s} onPick={() => setLabel(s)} wild />
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

function Chip({
  text,
  onPick,
  wild = false,
}: {
  text: string;
  onPick: () => void;
  wild?: boolean;
}) {
  return (
    <button
      onClick={onPick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        wild
          ? "border-[var(--c-fuchsia)]/40 text-[var(--c-fuchsia)] hover:bg-[var(--c-fuchsia)]/10"
          : "border-[var(--line)] bg-white/5 text-[var(--fg-dim)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
      }`}
    >
      {text}
    </button>
  );
}
