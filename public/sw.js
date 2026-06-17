// 极简 service worker：满足 PWA 可安装 + 已访问页面的轻量离线。
// 不碰 /api/*（AI 调用始终走网络），不缓存出问题。
const CACHE = "lifeplanner-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
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
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 第三方（如 DeepSeek）不管
  if (url.pathname.startsWith("/api/")) return; // AI 接口永远走网络

  // 网络优先，成功就顺手缓存；断网回退到缓存。
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
