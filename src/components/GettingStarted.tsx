"use client";

import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { firstRunSteps } from "@/domain/guide";
import type { LifeTree } from "@/domain/types";

// 首次上手引导卡：三步走通核心闭环（加长期目标 → 排进日历 → 勾掉完成），
// 每步从现有 tree 状态自动打勾。可一键关闭（持久化在 tree.guideDismissed）。
export function GettingStarted({ tree }: { tree: LifeTree }) {
  const { openPlan, openDashboard, dismissGuide } = useApp();
  const { t } = useT();
  const steps = firstRunSteps(tree);

  const rows: { done: boolean; label: string; onClick: () => void }[] = [
    {
      done: steps.hasLongGoal,
      label: t("加第一个长期目标 —— 它会在你的人生树上长出一条路"),
      onClick: openPlan,
    },
    {
      done: steps.hasScheduled,
      label: t("把一条行动排进日历某天"),
      onClick: openDashboard,
    },
    {
      done: steps.hasCompletion,
      label: t("勾掉它 —— 看你离那个未来近一步"),
      onClick: openDashboard,
    },
  ];

  return (
    <Card pad="md" className="mb-6 animate-fade">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--fg)]">{t("上手 3 步")}</div>
        <button
          onClick={dismissGuide}
          aria-label={t("关闭引导")}
          className="-mr-1 -mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--fg-faint)] transition hover:bg-black/[0.06] hover:text-[var(--fg)]"
        >
          ✕
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] ${
                row.done
                  ? "border-[var(--c-emerald)] bg-[var(--c-emerald)] text-white"
                  : "border-[var(--line)] text-transparent"
              }`}
            >
              ✓
            </span>
            <span
              className={`min-w-0 flex-1 text-sm ${
                row.done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg-dim)]"
              }`}
            >
              {row.label}
            </span>
            {!row.done && (
              <button
                onClick={row.onClick}
                className="flex-shrink-0 rounded-full border border-[var(--accent)]/50 px-3 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
              >
                {t("去做")}
              </button>
            )}
          </li>
        ))}
      </ul>

      {steps.allDone && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
          <span className="text-sm text-[var(--c-emerald)]">{t("🎉 你已经走通了一圈！")}</span>
          <Button variant="primary" onClick={dismissGuide} className="px-4 py-2">
            {t("开始用")}
          </Button>
        </div>
      )}
    </Card>
  );
}
