"use client";

import { useEffect, useState } from "react";
import { useT } from "@/prefs/PreferencesContext";

// 注册 service worker（仅生产，避免 dev 缓存困扰）+ iOS 的「加到主屏」提示
// （iOS 不会自动弹安装提示，需要手动引导；安卓/Chrome 会自动提示，无需此条）。
export function PwaSetup() {
  const { t } = useT();
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }
    // 延到下一帧再判断/设状态：避免在 effect 内同步 setState + 服务端/客户端首帧一致。
    const raf = requestAnimationFrame(() => {
      try {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as unknown as { standalone?: boolean }).standalone === true;
        const dismissed = localStorage.getItem("lp.iosHintDismissed") === "1";
        if (isIOS && !standalone && !dismissed) setShowHint(true);
      } catch {
        /* 读取失败则不提示 */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!showHint) return null;

  function dismiss() {
    setShowHint(false);
    try {
      localStorage.setItem("lp.iosHintDismissed", "1");
    } catch {
      /* 忽略 */
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--bg-1)]/95 p-3 text-sm shadow-2xl backdrop-blur">
      <div className="font-medium text-[var(--fg)]">
        {t("把「人生树」加到主屏，像 app 一样用")}
      </div>
      <div className="mt-1 text-xs text-[var(--fg-dim)]">
        {t("点底部分享按钮，选「添加到主屏幕」")}
      </div>
      <div className="mt-2 text-right">
        <button
          onClick={dismiss}
          className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--fg)]"
        >
          {t("知道了")}
        </button>
      </div>
    </div>
  );
}
