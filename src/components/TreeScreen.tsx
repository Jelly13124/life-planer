"use client";

import { useState } from "react";
import { useApp } from "@/state/AppContext";
import { LifeTreeCanvas } from "./LifeTreeCanvas";
import { AddBranchSheet } from "./AddBranchSheet";
import { Button } from "./ui/Button";

export function TreeScreen() {
  const { tree, openPath, addBranch, reset } = useApp();
  const [adding, setAdding] = useState(false);

  if (!tree) return null;
  const choiceCount = tree.paths.filter((p) => p.kind === "choice").length;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-8">
      {/* 头部 */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="animate-fade">
          <div className="text-xs uppercase tracking-[3px] text-[var(--fg-faint)]">
            Life Planner
          </div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {tree.profile.name} 的人生树
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-dim)]">
            灰色虚线是维持现状，每条彩色曲线是一个不同的选择。点曲线看那段人生。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setAdding(true)}>
            ＋ 添加岔路
          </Button>
          <Button variant="ghost" onClick={reset} title="清空并重新开始">
            ↺ 重置
          </Button>
        </div>
      </header>

      {/* 画布 */}
      <div className="mt-4 flex flex-1 items-center">
        <div className="w-full rounded-3xl border border-[var(--line)] bg-black/20 p-2 sm:p-4">
          <LifeTreeCanvas tree={tree} onSelect={openPath} />
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-[var(--fg-faint)]">
        {choiceCount === 0
          ? "还没有岔路。点「添加岔路」，看看另一种人生。"
          : `已有 ${choiceCount} 条岔路 · 这些都是可能的人生，不是预测`}
      </p>

      {adding && (
        <AddBranchSheet
          tree={tree}
          onAdd={addBranch}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
