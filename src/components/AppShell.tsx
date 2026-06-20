"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useApp, type View } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";

// 持久化左侧栏的应用外壳：左侧导航 + 右侧可独立滚动的内容区。
// 桌面端常驻侧栏；窄屏折叠成顶部栏 + 抽屉，避免内容被挤压。
// 视觉沿用本项目的深色电影感：var(--bg-*) / var(--fg-*) / var(--accent) / var(--line)。

type NavKey = "dashboard" | "inbox" | "plan" | "habits" | "areas" | "insights" | "tree";

interface NavItem {
  key: NavKey;
  icon: string;
  label: string; // 中文原文，t() 包裹
  go: () => void;
  active: boolean;
}

// 品牌小标记：一条笔直的"维持现状"线 + 一条分叉出去的彩色曲线——
// 与人生树的核心隐喻同源，给外壳一点专属性格，而不是放个通用 logo。
function TreeMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* 现状直线 */}
      <path
        d="M3 22 H25"
        stroke="var(--fg-faint)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 3"
      />
      {/* 分叉曲线 */}
      <path
        d="M7 22 C12 22 13 8 24 6"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7 22 C11 22 14 15 22 17"
        stroke="var(--c-sky)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* 当下原点 */}
      <circle cx="7" cy="22" r="2.4" fill="var(--accent)" />
    </svg>
  );
}

function NavButton({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => {
        item.go();
        onNavigate();
      }}
      aria-current={item.active ? "page" : undefined}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
        item.active
          ? "bg-[var(--accent)]/[0.14] text-[var(--fg)] font-semibold"
          : "text-[var(--fg-dim)] hover:bg-white/[0.05] hover:text-[var(--fg)]"
      }`}
    >
      {/* 左侧高亮条 */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--accent)] transition-all ${
          item.active ? "opacity-100" : "opacity-0 -translate-x-1"
        }`}
      />
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center text-base leading-none transition-transform ${
          item.active ? "" : "opacity-70 group-hover:scale-110 group-hover:opacity-100"
        }`}
      >
        {item.icon}
      </span>
      <span className="truncate">{t(item.label)}</span>
    </button>
  );
}

function NavList({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate: () => void;
}) {
  return (
    <nav aria-label="Sections" className="flex flex-col gap-1">
      {items.map((it) => (
        <NavButton key={it.key} item={it} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

export function AppShell({ active, children }: { active: View; children: ReactNode }) {
  const { openDashboard, openPlan, openHabits, openAreas, openInsights, openInbox, openTree } = useApp();
  const { t } = useT();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 抽屉打开时锁滚动；Esc 关闭。
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const items: NavItem[] = [
    { key: "dashboard", icon: "📅", label: "日历", go: openDashboard, active: active === "dashboard" },
    { key: "inbox", icon: "📥", label: "收件箱", go: openInbox, active: active === "inbox" },
    { key: "plan", icon: "🎯", label: "目标", go: openPlan, active: active === "plan" },
    { key: "habits", icon: "🔁", label: "习惯", go: openHabits, active: active === "habits" },
    { key: "areas", icon: "🧭", label: "人生面", go: openAreas, active: active === "areas" },
    { key: "insights", icon: "📊", label: "洞察", go: openInsights, active: active === "insights" },
    { key: "tree", icon: "🌳", label: "人生树", go: openTree, active: active === "tree" },
  ];

  // 侧栏内部：顶部品牌 + 导航。drawer 与桌面端共用。
  const sidebarInner = (onNavigate: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-3 pb-6 pt-1">
        <TreeMark className="h-7 w-7 flex-shrink-0" />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-[var(--fg)]">Life Planner</div>
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--fg-faint)]">{t("人生树")}</div>
        </div>
      </div>

      <div className="px-2">
        <NavList items={items} onNavigate={onNavigate} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* 桌面端常驻侧栏 */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-1)]/50 px-3 py-6 backdrop-blur-xl md:flex">
        {sidebarInner(() => {})}
      </aside>

      {/* 窄屏顶部栏：汉堡 + 品牌。右上角留给语言切换（z-[70]）。 */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--bg-1)]/85 px-4 py-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t("打开菜单")}
          aria-expanded={drawerOpen}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <TreeMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight text-[var(--fg)]">Life Planner</span>
        </div>
      </div>

      {/* 窄屏抽屉 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 animate-fade"
            style={{ animationDuration: "0.25s" }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="absolute left-0 top-0 flex h-full w-64 max-w-[80vw] flex-col border-r border-[var(--line)] bg-[var(--bg-1)] px-3 py-5 shadow-2xl animate-pop"
            style={{ animationDuration: "0.28s" }}
            role="dialog"
            aria-modal="true"
            aria-label="Sections"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label={t("关闭")}
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-faint)] transition hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            {sidebarInner(() => setDrawerOpen(false))}
          </aside>
        </div>
      )}

      {/* 内容区：独立滚动，min-h 兜底让屏幕组件的布局成立 */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
