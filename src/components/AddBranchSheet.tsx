"use client";

import { useState } from "react";
import type { LifeTree } from "@/domain/types";
import { suggestFor, wildCardSuggestions } from "@/domain/suggestions";
import { useT } from "@/prefs/PreferencesContext";
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
  const { t } = useT();
  const [label, setLabel] = useState("");
  const alternatives = suggestFor(tree.profile);
  const wild = wildCardSuggestions(tree.profile);

  function confirm() {
    const v = label.trim();
    if (!v) return;
    // 分叉时机交给 AI：根分支不传 forkAge（先本地占位，AI 推演时再重定到现实的
    // 人生时间点）；在某节点上分叉的子分支，时机由那个节点决定。
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
          {fork ? t("{atLabel}，再选一次", { atLabel: fork.atLabel }) : t("添加一条岔路")}
        </h3>
        <p className="mt-1 text-sm text-[var(--fg-dim)]">
          {fork
            ? t("从这一刻起，如果做个不同的选择，人生会怎样？AI 会接着往下推演。")
            : t("写下一个你想尝试的选择，AI 会推演出它的人生走向。")}
        </p>

        <textarea
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          rows={2}
          autoFocus
          placeholder={t("比如：辞职创业 / 去读研 / 搬到深圳……")}
          className="mt-4 w-full resize-none px-4 py-3 text-base"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) confirm();
          }}
        />

        {/* Odyssey：替代路 */}
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
            {t("替代路 · 现实的另一种选择")}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {alternatives.map((s) => (
              <Chip key={s} text={t(s)} onPick={() => setLabel(s)} />
            ))}
          </div>
        </div>

        {/* Odyssey：疯狂路 */}
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
            {t("疯狂路 · 不计代价、不顾眼光")}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {wild.map((s) => (
              <Chip key={s} text={t(s)} onPick={() => setLabel(s)} wild />
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {t("取消")}
          </Button>
          <Button variant="primary" disabled={!label.trim()} onClick={confirm}>
            {t("生成这条路 →")}
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
          : "border-[var(--line)] bg-black/[0.03] text-[var(--fg-dim)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
      }`}
    >
      {text}
    </button>
  );
}
