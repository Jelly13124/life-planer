"use client";

import { AppProvider, useApp } from "@/state/AppContext";
import { Onboarding } from "@/components/Onboarding";
import { TreeScreen } from "@/components/TreeScreen";
import { PathDetail } from "@/components/PathDetail";

function Screen() {
  const { view, tree, activePathId, hydrated, backToTree } = useApp();

  // 首帧还没读取本地数据时给个安静的占位，避免闪烁
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-[var(--fg-faint)]">载入中…</span>
      </div>
    );
  }

  if (view === "detail" && tree && activePathId) {
    return <PathDetail tree={tree} pathId={activePathId} onBack={backToTree} />;
  }
  if (view === "tree" && tree) {
    return <TreeScreen />;
  }
  return <Onboarding />;
}

export default function Home() {
  return (
    <AppProvider>
      <Screen />
    </AppProvider>
  );
}
