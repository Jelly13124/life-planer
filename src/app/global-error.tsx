"use client";

// 全局错误边界：连根布局都抛错时的最后兜底（error.tsx 抓不到根布局自身的错误）。
// 必须自带 <html>/<body>，且不能依赖 globals.css（此时样式表可能未加载）——全部用内联样式。
// 文案双语静态，从 localStorage 读语言，绝不二次崩溃。

import { useEffect } from "react";

function readLocale(): "zh" | "en" {
  try {
    const l = localStorage.getItem("lp.locale");
    if (l === "en" || l === "zh") return l;
  } catch {
    /* 回退中文 */
  }
  return "zh";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  const zh = readLocale() === "zh";

  return (
    <html lang={zh ? "zh" : "en"}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f7",
          color: "#1d1d1f",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "360px",
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: "16px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.05)",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
            {zh ? "出了点小问题" : "Something went wrong"}
          </h1>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#6e6e73", marginTop: "8px" }}>
            {zh
              ? "应用遇到了意外。你的数据仍安全地存在这台设备上——刷新通常就能恢复。"
              : "The app hit an unexpected error. Your data is safe on this device — reloading usually fixes it."}
          </p>
          <div style={{ marginTop: "20px", display: "flex", gap: "8px", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                minHeight: "40px",
                padding: "0 20px",
                borderRadius: "999px",
                border: "none",
                background: "linear-gradient(135deg, #c2410c 0%, #a8380a 100%)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {zh ? "重试" : "Try again"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              style={{
                minHeight: "40px",
                padding: "0 20px",
                borderRadius: "999px",
                border: "1px solid rgba(0,0,0,0.1)",
                background: "transparent",
                color: "#6e6e73",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              {zh ? "刷新页面" : "Reload"}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
