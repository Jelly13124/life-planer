"use client";

import { useRef, useState } from "react";
import type { LifeTree } from "@/domain/types";
import { parseIcs } from "@/domain/ics";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Card } from "./ui/Card";
import { IconCalendar, IconPlus, IconX } from "./ui/icons";

// 导入日历（P4 ICS，只读）：粘贴 https .ics 订阅链接，或上传 .ics 文件（客户端解析内联存）。
// 列出当前订阅源 + 移除按钮。导入的事件以只读形式叠加在月/日视图（不参与拖拽/AI 排程）。
export function CalendarImportCard({ tree }: { tree: LifeTree }) {
  const { addCalendarFeed, removeCalendarFeed } = useApp();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const feeds = tree.calendarFeeds ?? [];

  function addUrl() {
    const u = url.trim();
    if (!u) return;
    if (!/^https:\/\//i.test(u)) {
      setErr(t("请用 https 开头的 .ics 链接"));
      return;
    }
    // 名称用链接的主机名兜底，便于辨认。
    let name = u;
    try {
      name = new URL(u).hostname;
    } catch {
      /* 用原链接兜底 */
    }
    addCalendarFeed({ name, url: u });
    setUrl("");
    setErr(null);
  }

  async function onFile(file: File) {
    setErr(null);
    try {
      const text = await file.text();
      const events = parseIcs(text);
      if (!events.length) {
        setErr(t("没从这个文件里读到日历事件"));
        return;
      }
      addCalendarFeed({ name: file.name.replace(/\.ics$/i, ""), events });
    } catch {
      setErr(t("读取文件失败"));
    }
  }

  return (
    <Card pad="sm" className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="lp-tap flex w-full items-center gap-2 text-left"
      >
        <IconCalendar className="h-4 w-4 flex-shrink-0 text-[var(--fg-faint)]" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">{t("导入日历")}</span>
        {feeds.length > 0 && (
          <span className="text-[10px] text-[var(--fg-faint)]">· {t("{n} 个日历订阅", { n: feeds.length })}</span>
        )}
        <span aria-hidden="true" className="ml-auto text-[var(--fg-faint)]">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-[11px] leading-relaxed text-[var(--fg-faint)]">
            {t("粘贴日历的 .ics 订阅链接，或上传 .ics 文件。导入的事件以只读日历事件显示，不参与排程。")}
          </p>

          {/* 粘贴 .ics 链接 */}
          <div className="flex items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
              placeholder={t("粘贴 .ics 链接")}
              aria-label={t("粘贴 .ics 链接")}
              className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
            />
            <button
              type="button"
              onClick={addUrl}
              disabled={!url.trim()}
              aria-label={t("添加")}
              className="lp-tap inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
            >
              <IconPlus className="h-4 w-4" />
              {t("添加")}
            </button>
          </div>

          {/* 上传 .ics 文件 */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = ""; // 允许重复选同一文件
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="lp-tap inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--line)] px-3 py-1.5 text-xs text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
            >
              <IconPlus className="h-3.5 w-3.5" />
              {t("上传 .ics 文件")}
            </button>
          </div>

          {err && <div className="text-[11px] text-[var(--c-rose)]">{err}</div>}

          {/* 当前订阅源列表 + 移除 */}
          {feeds.length > 0 && (
            <ul className="flex flex-col gap-1.5 border-t border-[var(--line)]/60 pt-3">
              {feeds.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-xs">
                  <IconCalendar className="h-3.5 w-3.5 flex-shrink-0 text-[var(--fg-faint)]" />
                  <span className="min-w-0 flex-1 truncate text-[var(--fg-dim)]" title={f.url ?? f.name}>
                    {f.name}
                    <span className="ml-1.5 text-[10px] text-[var(--fg-faint)]">
                      {f.url ? t("日历订阅") : t("上传文件")}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCalendarFeed(f.id)}
                    aria-label={t("移除")}
                    title={t("移除")}
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[var(--fg-faint)] transition hover:bg-black/[0.06] hover:text-[var(--c-rose)]"
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
