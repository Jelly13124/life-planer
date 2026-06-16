"use client";

import { useState } from "react";
import { useApp } from "@/state/AppContext";
import { LifeMap } from "./LifeMap";
import { AddBranchSheet, type ForkContext } from "./AddBranchSheet";
import { Button } from "./ui/Button";

export function TreeScreen() {
  const { tree, openPath, addBranch, reset, enrichingIds, aiEnabled } = useApp();
  const [adding, setAdding] = useState(false);
  // 在某条路的某个未来节点处加岔路（R6 递归）；null = 关闭
  const [fork, setFork] = useState<ForkContext | null>(null);

  if (!tree) return null;
  const choiceCount = tree.paths.filter((p) => p.kind === "choice").length;
  const enriching = enrichingIds.length > 0;

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
          {enriching ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-xs text-[var(--accent)]">
              <span className="inline-block h-2 w-2 animate-ping rounded-full bg-[var(--accent)]" />
              AI 正在生成更真实的人生…
            </div>
          ) : aiEnabled ? (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--fg-faint)]">
              ✨ 由真实 AI 生成
            </div>
          ) : null}
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

      {/* 地图：可平移缩放的多层人生决策树 */}
      <div className="mt-4 flex flex-1 items-center">
        <div className="w-full overflow-hidden rounded-3xl border border-[var(--line)] bg-black/20 p-2 sm:p-4">
          <LifeMap
            tree={tree}
            onSelectPath={openPath}
            onForkAtNode={(parentId, forkAge, atLabel) =>
              setFork({ parentId, forkAge, atLabel })
            }
          />
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-[var(--fg-faint)]">
        {choiceCount === 0
          ? "还没有岔路。点「添加岔路」，看看另一种人生。"
          : `已有 ${choiceCount} 条岔路 · 点曲线上的节点，还能在那里再长一条岔路`}
      </p>

      {/* 根分叉：从"现在"加一条新路 */}
      {adding && (
        <AddBranchSheet
          tree={tree}
          onAdd={addBranch}
          onClose={() => setAdding(false)}
        />
      )}

      {/* 递归分叉：从某条路的某个未来节点再长一条岔路 */}
      {fork && (
        <AddBranchSheet
          tree={tree}
          onAdd={addBranch}
          onClose={() => setFork(null)}
          fork={fork}
        />
      )}
    </div>
  );
}
