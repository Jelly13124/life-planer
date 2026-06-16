"use client";

import { AppProvider, useApp } from "@/state/AppContext";
import { Onboarding } from "@/components/Onboarding";
import { TreeScreen } from "@/components/TreeScreen";
import { PathDetail } from "@/components/PathDetail";
import { PlanningAssistant } from "@/components/PlanningAssistant";

function Screen() {
  const { view, tree, activePathId, hydrated, backToTree, enrichingIds } = useApp();

  // 首帧还没读取本地数据时给个安静的占位，避免闪烁
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-[var(--fg-faint)]">载入中…</span>
      </div>
    );
  }

  if (view === "onboarding" || !tree) return <Onboarding />;

  return (
    <>
      {view === "detail" && activePathId ? (
        <PathDetail
          tree={tree}
          pathId={activePathId}
          onBack={backToTree}
          enriching={enrichingIds.includes(activePathId)}
        />
      ) : (
        <TreeScreen />
      )}
      {/* 常驻规划助手（有树时才出现） */}
      <PlanningAssistant />
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
