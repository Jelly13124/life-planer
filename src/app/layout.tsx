import type { Metadata, Viewport } from "next";
import { Geist, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

// 编辑感 Latin 展示字体（标题/品牌/数字/eyebrow）。中文仍走系统栈，避免 CJK 网络字体开销。
// Fraunces：有性格的 old-style 衬线，光学尺寸 + 暖意，与 Geist 几何无衬线对比鲜明，远离默认 SaaS 观感。
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  // 可变字体：保留 wght 全轴 + 光学尺寸 opsz + 一点 SOFT 柔化字形末端。
  // 用 axes 时不可再指定 weight（否则会被当作非可变字体）。
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "人生规划 · Life Planner",
  description: "把“如果我做了不同选择”变成一棵会生长的人生树。",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "人生树", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0b1a",
};

// 首屏前把已保存的语言写到 <html lang>，避免中英闪烁。
const NO_FLASH = `(function(){try{var l=localStorage.getItem('lp.locale');if(l==='en'||l==='zh')document.documentElement.setAttribute('lang',l);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      suppressHydrationWarning
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
