"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EN } from "@/i18n/messages";

// 偏好：语言（中/英），持久化在本地。
// i18n 采用"中文原文作 key"的方案：t("添加岔路") 在中文下原样返回，在英文下查
// EN 字典。可带 {var} 插值。这样无需为每条文案另起 key，包裹成本最低。
export type Locale = "zh" | "en";

type Vars = Record<string, string | number>;

function translate(locale: Locale, zh: string, vars?: Vars): string {
  let s = locale === "en" ? EN[zh] ?? zh : zh;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.split(`{${k}}`).join(String(vars[k]));
    }
  }
  return s;
}

interface PrefsApi {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  t: (zh: string, vars?: Vars) => string;
}

const PrefsContext = createContext<PrefsApi | null>(null);

const LOCALE_KEY = "lp.locale";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  // 挂载后从本地读取（延到下一帧再 setState，避免在 effect 内同步触发级联渲染；
  // 首屏无闪烁由 layout 里的内联脚本先处理 <html lang>）
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const l = localStorage.getItem(LOCALE_KEY);
        if (l === "en" || l === "zh") setLocaleState(l);
      } catch {
        /* localStorage 不可用则用默认值 */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // 应用到 <html lang>
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* 忽略写入失败 */
    }
  }, []);

  const t = useCallback((zh: string, vars?: Vars) => translate(locale, zh, vars), [locale]);

  const value = useMemo<PrefsApi>(
    () => ({
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === "zh" ? "en" : "zh"),
      t,
    }),
    [locale, setLocale, t],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsApi {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PreferencesProvider");
  return ctx;
}

// 便捷：只取翻译函数 + 当前语言
export function useT(): { t: PrefsApi["t"]; locale: Locale } {
  const { t, locale } = usePrefs();
  return { t, locale };
}
