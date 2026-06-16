// 客户端安全：读取当前语言（给 fetch 请求带上 lang，让 AI 用对应语言生成）。
// 不依赖 React 上下文，可在普通的 lib 函数里调用。
export type Lang = "zh" | "en";

export function currentLocale(): Lang {
  if (typeof window === "undefined") return "zh";
  try {
    return localStorage.getItem("lp.locale") === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}
