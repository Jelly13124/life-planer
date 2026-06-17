"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { LifeMap } from "./LifeMap";
import { AddBranchSheet, type ForkContext } from "./AddBranchSheet";
import { Button } from "./ui/Button";
import { dueDecisions } from "@/domain/decisions";
import { ReviewSheet } from "./ReviewSheet";
import type { Decision } from "@/domain/types";

// 导入时取一次"今天"作初值（render 内不可调用 new Date）；挂载后用 effect 刷新。
const _bootISO = new Date().toISOString();

export function TreeScreen() {
  const { tree, openPath, addBranch, reset, aiEnabled } = useApp();
  const { t } = useT();
  const [adding, setAdding] = useState(false);
  // 在某条路的某个未来节点处加岔路（R6 递归）；null = 关闭
  const [fork, setFork] = useState<ForkContext | null>(null);
  const [reviewing, setReviewing] = useState<Decision | null>(null);
  // "今天"放进 state：挂载即取真实当下，并在标签页重新可见时刷新——
  // 避免长时间挂着的页面用过期的"今天"，导致到期的复盘提示不出现。
  const [todayISO, setTodayISO] = useState(_bootISO);
  useEffect(() => {
    const update = () => setTodayISO(new Date().toISOString());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  if (!tree) return null;
  const choiceCount = tree.paths.filter((p) => p.kind === "choice").length;
  const due = dueDecisions(tree, todayISO);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-8">
      {/* 头部 */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="animate-fade">
          <div className="text-xs uppercase tracking-[3px] text-[var(--fg-faint)]">
            Life Planner
          </div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {t("{name} 的人生树", { name: tree.profile.name })}
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-dim)]">
            {t("灰色虚线是维持现状，每条彩色曲线是一个不同的选择。点曲线看那段人生。")}
          </p>
          {aiEnabled ? (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--fg-faint)]">
              {t("✨ 由真实 AI 生成")}
            </div>
          ) : null}
          {due.length > 0 && (
            <button
              onClick={() => setReviewing(due[0])}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--c-amber)]/50 bg-[var(--c-amber)]/10 px-3 py-1 text-xs text-[var(--c-amber)] transition hover:bg-[var(--c-amber)]/20"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--c-amber)]" />
              {t("有 {n} 个决定该复盘了", { n: due.length })} · {t("去复盘")}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setAdding(true)}>
            {t("＋ 添加岔路")}
          </Button>
          <Button variant="ghost" onClick={reset} title={t("清空并重新开始")}>
            {t("↺ 重置")}
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
          ? t("还没有岔路。点「添加岔路」，看看另一种人生。")
          : t("已有 {n} 条岔路 · 点曲线上的节点，还能在那里再长一条岔路", { n: choiceCount })}
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

      {reviewing && (
        <ReviewSheet
          decision={reviewing}
          onClose={() => setReviewing(null)}
          onReplan={(label) => addBranch(label)}
        />
      )}
    </div>
  );
}
