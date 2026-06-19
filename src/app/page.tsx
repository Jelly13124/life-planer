"use client";

import { AppProvider, useApp } from "@/state/AppContext";
import { Onboarding } from "@/components/Onboarding";
import { TreeScreen } from "@/components/TreeScreen";
import { PathDetail } from "@/components/PathDetail";
import { PlanScreen } from "@/components/PlanScreen";
import { DashboardScreen } from "@/components/DashboardScreen";
import { PlanningAssistant } from "@/components/PlanningAssistant";
import { PredictionOverlay } from "@/components/PredictionOverlay";

function Screen() {
  const { view, tree, activePathId, hydrated, backToTree, predicting, aiEnabled } = useApp();

  // 首帧还没读取本地数据时给个安静的占位，避免闪烁
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-[var(--fg-faint)]">载入中…</span>
      </div>
    );
  }

  // 正在推演：全屏过场动画盖在当前画面上（首次引导 / 加岔路都用它）
  const overlay = predicting ? (
    <PredictionOverlay
      labels={predicting.labels}
      done={predicting.done}
      total={predicting.total}
      context={predicting.context}
      aiEnabled={aiEnabled}
    />
  ) : null;

  if (view === "onboarding" || !tree) {
    return (
      <>
        <Onboarding />
        {overlay}
      </>
    );
  }

  return (
    <>
      {view === "detail" && activePathId ? (
        <PathDetail tree={tree} pathId={activePathId} onBack={backToTree} />
      ) : view === "plan" ? (
        <PlanScreen />
      ) : view === "tree" ? (
        <TreeScreen />
      ) : (
        <DashboardScreen />
      )}
      {/* 常驻规划助手（有树时才出现） */}
      <PlanningAssistant />
      {overlay}
    </>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <Screen />
    </AppProvider>
  );
}
