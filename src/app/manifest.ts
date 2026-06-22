import type { MetadataRoute } from "next";

// PWA 清单：让网页能"加到主屏"像个 app（双端）。图标由 scripts/make-icons.mjs 生成。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "人生树 · Life Planner",
    short_name: "人生树",
    description: "把人生路口变成一棵会生长的树：看见多重人生、和未来的自己聊聊、把选择落地成计划。",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
