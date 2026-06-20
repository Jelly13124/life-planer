"use client";

import { AppProvider, useApp } from "@/state/AppContext";
import { Onboarding } from "@/components/Onboarding";
import { TreeScreen } from "@/components/TreeScreen";
import { PathDetail } from "@/components/PathDetail";
import { PlanScreen } from "@/components/PlanScreen";
import { CalendarPlannerScreen } from "@/components/CalendarPlannerScreen";
import { AppShell } from "@/components/AppShell";
import { HabitsSection } from "@/components/HabitsSection";
import { AreasSection } from "@/components/AreasSection";
import { InsightsSection } from "@/components/InsightsSection";
import { PlanningAssistant } from "@/components/PlanningAssistant";
import { PredictionOverlay } from "@/components/PredictionOverlay";
import { SafetyCare } from "@/components/SafetyCare";

function Screen() {
  const { view, tree, activePathId, hydrated, backToTree, predicting, aiEnabled, safetyHold, continueAfterSafety } = useApp();

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

  // 危机信号检测到时展示的温和关怀覆层（z-[70]，高于推演动画）
  const safetyOverlay = safetyHold ? (
    <SafetyCare onContinue={continueAfterSafety} />
  ) : null;

  if (view === "onboarding" || !tree) {
    return (
      <>
        <Onboarding />
        {overlay}
        {safetyOverlay}
      </>
    );
  }

  // 详情页是聚焦子视图，不进外壳：它有自己的返回按钮，全屏沉浸。
  if (view === "detail" && activePathId) {
    return (
      <>
        <PathDetail tree={tree} pathId={activePathId} onBack={backToTree} />
        <PlanningAssistant />
        {overlay}
      </>
    );
  }

  // 主区块都套进左侧栏外壳；section 由当前 view 决定。
  return (
    <>
      <AppShell active={view}>
        {view === "plan" ? (
          <PlanScreen />
        ) : view === "tree" ? (
          <TreeScreen />
        ) : view === "habits" ? (
          <HabitsSection />
        ) : view === "areas" ? (
          <AreasSection />
        ) : view === "insights" ? (
          <InsightsSection />
        ) : (
          <CalendarPlannerScreen />
        )}
      </AppShell>
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
