"use client";

import dynamic from "next/dynamic";
import { AppProvider, useApp } from "@/state/AppContext";
import { Onboarding } from "@/components/Onboarding";
import { CalendarPlannerScreen } from "@/components/CalendarPlannerScreen";
import { AppShell } from "@/components/AppShell";
import { PredictionOverlay } from "@/components/PredictionOverlay";
import { SafetyCare } from "@/components/SafetyCare";
import { ReminderScheduler } from "@/components/ReminderScheduler";
import { CloudNotice } from "@/components/CloudNotice";
import { FeasibilityToast } from "@/components/FeasibilityToast";

// 首屏只需要 onboarding + 日历首页（最常访问、回访即见）+ 外壳，保持静态导入＝即时渲染。
// 其余屏幕都在「进树之后」才会用到，用 next/dynamic 拆成独立 chunk，缩小首屏 JS。
// 客户端渲染（ssr:false）——整棵应用在 hydrated 之前本就不渲染，SSR 这些没意义。
// loading 占位用统一的 ScreenLoader（撑满屏高，避免视图切换时跳动）。
const ScreenLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <span
      aria-label="loading"
      className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]"
    />
  </div>
);

const TreeScreen = dynamic(() => import("@/components/TreeScreen").then((m) => m.TreeScreen), { ssr: false, loading: ScreenLoader });
const PathDetail = dynamic(() => import("@/components/PathDetail").then((m) => m.PathDetail), { ssr: false, loading: ScreenLoader });
const PlanScreen = dynamic(() => import("@/components/PlanScreen").then((m) => m.PlanScreen), { ssr: false, loading: ScreenLoader });
const HabitsSection = dynamic(() => import("@/components/HabitsSection").then((m) => m.HabitsSection), { ssr: false, loading: ScreenLoader });
const AreasSection = dynamic(() => import("@/components/AreasSection").then((m) => m.AreasSection), { ssr: false, loading: ScreenLoader });
const InsightsSection = dynamic(() => import("@/components/InsightsSection").then((m) => m.InsightsSection), { ssr: false, loading: ScreenLoader });
const TodayView = dynamic(() => import("@/components/TodayView").then((m) => m.TodayView), { ssr: false, loading: ScreenLoader });
const UpcomingTimeline = dynamic(() => import("@/components/UpcomingTimeline").then((m) => m.UpcomingTimeline), { ssr: false, loading: ScreenLoader });
const AllTasksView = dynamic(() => import("@/components/AllTasksView").then((m) => m.AllTasksView), { ssr: false, loading: ScreenLoader });
const CompletedView = dynamic(() => import("@/components/CompletedView").then((m) => m.CompletedView), { ssr: false, loading: ScreenLoader });
const TagView = dynamic(() => import("@/components/TagView").then((m) => m.TagView), { ssr: false, loading: ScreenLoader });
const ChoicePanel = dynamic(() => import("@/components/ChoicePanel").then((m) => m.ChoicePanel), { ssr: false, loading: ScreenLoader });
// 常驻浮层组件：无需占位（loading 返回 null），加载好再出现。
const PlanningAssistant = dynamic(() => import("@/components/PlanningAssistant").then((m) => m.PlanningAssistant), { ssr: false, loading: () => null });

// 首帧未读取本地数据时的启动占位：品牌小标记 + 一圈轻旋转，比裸文字更稳。
function BootLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <svg viewBox="0 0 28 28" className="h-9 w-9" fill="none" aria-hidden="true">
        <path d="M3 22 H25" stroke="var(--fg-faint)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 3" />
        <path d="M7 22 C12 22 13 8 24 6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="7" cy="22" r="2.4" fill="var(--accent)" />
      </svg>
      <span
        aria-label="loading"
        className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]"
      />
    </div>
  );
}

function Screen() {
  const { view, tree, activePathId, hydrated, backToTree, predicting, aiEnabled, safetyHold, continueAfterSafety } = useApp();

  // 首帧还没读取本地数据时给个安静的占位，避免闪烁
  if (!hydrated) {
    return <BootLoader />;
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
        {safetyOverlay}
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
        ) : view === "today" ? (
          <TodayView />
        ) : view === "alltasks" ? (
          <AllTasksView />
        ) : view === "completed" ? (
          <CompletedView />
        ) : view === "tag" ? (
          <TagView />
        ) : view === "upcoming" ? (
          <UpcomingTimeline />
        ) : view === "choices" ? (
          <ChoicePanel />
        ) : (
          <CalendarPlannerScreen />
        )}
      </AppShell>
      {/* 常驻规划助手（有树时才出现） */}
      <PlanningAssistant />
      {overlay}
      {safetyOverlay}
    </>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <Screen />
      {/* 应用开着时的到点提醒调度器（权限+偏好开启才工作；渲染 null） */}
      <ReminderScheduler />
      {/* P5：云端加载失败回退本地时的小提示（flag 关时渲染 null） */}
      <CloudNotice />
      {/* Part 1：完成行动把某条路的可行度整 5 推上去时的即时反馈 toast（无 toast 时渲染 null） */}
      <FeasibilityToast />
    </AppProvider>
  );
}
