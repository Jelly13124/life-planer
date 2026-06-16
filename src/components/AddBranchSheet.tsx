"use client";

import { useState } from "react";
import type { LifeTree } from "@/domain/types";
import { suggestFor, wildCardSuggestions } from "@/domain/suggestions";
import { inferForkDelayYears, MAX_FORK_DELAY } from "@/domain/forkTiming";
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
  // 用户手动设的"几年后"；null = 跟随按选择的推测值。仅根分支可调。
  const [delayOverride, setDelayOverride] = useState<number | null>(null);
  const alternatives = suggestFor(tree.profile);
  const wild = wildCardSuggestions(tree.profile);

  const effDelay = delayOverride ?? inferForkDelayYears(label);
  const forkAge = tree.profile.age + effDelay;

  function confirm() {
    const v = label.trim();
    if (!v) return;
    if (fork) {
      onAdd(v, { parentId: fork.parentId, forkAge: fork.forkAge });
    } else {
      onAdd(v, { forkAge }); // 根分支：从推测/用户选定的人生时间点分叉
    }
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

        {/* 何时分叉（仅根分支）：从现实的人生时间点长出，而不是都从"现在" */}
        {!fork && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
              什么时候走上这条路
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                aria-label="提前一年"
                onClick={() => setDelayOverride(Math.max(0, effDelay - 1))}
                disabled={effDelay <= 0}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-base leading-none text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--fg)] disabled:opacity-30"
              >
                −
              </button>
              <div className="min-w-[9rem] text-center text-sm font-medium text-[var(--fg)]">
                {effDelay === 0 ? "现在就开始" : `${effDelay} 年后 · ${forkAge} 岁`}
              </div>
              <button
                type="button"
                aria-label="推后一年"
                onClick={() => setDelayOverride(Math.min(MAX_FORK_DELAY, effDelay + 1))}
                disabled={effDelay >= MAX_FORK_DELAY}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-base leading-none text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--fg)] disabled:opacity-30"
              >
                ＋
              </button>
              {delayOverride === null && label.trim() && (
                <span className="text-xs text-[var(--fg-faint)]">按这个选择推测，可调整</span>
              )}
            </div>
          </div>
        )}

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
