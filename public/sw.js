// 极简 Service Worker（P3）：只为 PWA 可安装 + 已访问页面的轻量离线。
// 注册仅在生产（见 components/ServiceWorkerRegister.tsx），dev 完全不装，不碰 HMR。
//
// 安全策略（不破坏数据/构建）：
//  - 永不拦截 /api/*（AI/数据接口始终走网络）与 /_next/*（构建产物，避免缓存到旧 chunk）。
//  - 导航请求（HTML）网络优先：在线拿最新页，离线才回退到缓存的应用壳。
//  - 仅缓存一个很小的静态壳（含离线兜底页）；其余 GET 网络优先、机会性缓存。
//  - 版本化缓存名；install 即 skipWaiting，activate 清旧缓存 + clients.claim 立即接管。
const VERSION = "v2";
const CACHE = `lifeplanner-shell-${VERSION}`;
// 小应用壳：根路由 + 已生成的静态图标（构建期就存在的稳定资源）。
const SHELL = ["/", "/icon.svg", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      // 逐个放，单个失败不拖垮整体（addAll 任一 404 会整批失败）。
      await Promise.all(SHELL.map((u) => c.add(u).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // 只管 GET
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 第三方（如 DeepSeek）不管
  if (url.pathname.startsWith("/api/")) return; // 数据/AI 接口永远走网络，绝不缓存
  if (url.pathname.startsWith("/_next/")) return; // 构建产物交给浏览器/Next，绝不缓存

  // 导航（打开/刷新页面）：网络优先，离线回退缓存壳（先精确匹配，再退到根 "/"）。
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(req)) || (await caches.match("/")) || Response.error()),
    );
    return;
  }

  // 其它同源 GET（图标等静态壳资源）：网络优先，成功顺手更新缓存，断网回退缓存。
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
