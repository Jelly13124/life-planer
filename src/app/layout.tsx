import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./Providers";

// Apple 白色极简：正文走系统 SF 栈（在 globals.css body 定义），
// Geist 仍作为 --font-geist-sans 的 Latin 回退保留。展示字体不再用 Fraunces 衬线，
// --font-display 现已在 globals.css :root 指向系统无衬线栈。
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
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
  appleWebApp: { capable: true, title: "人生树", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
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
      className={`${geistSans.variable} h-full antialiased`}
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
