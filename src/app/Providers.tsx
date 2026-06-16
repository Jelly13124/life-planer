"use client";

import type { ReactNode } from "react";
import { PreferencesProvider } from "@/prefs/PreferencesContext";
import { PrefControls } from "@/components/PrefControls";

// 顶层客户端壳：注入偏好（主题/语言）上下文，并常驻右上角切换控件。
export function Providers({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      {children}
      <PrefControls />
    </PreferencesProvider>
  );
}
