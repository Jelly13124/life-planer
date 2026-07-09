// 服务端专用：按 id 从 Supabase REST 端点拉取分享卡片 payload。
// 不复用浏览器单例 getSupabase()（那个只在客户端生效、且未配置时返回 null）——
// 这里用最简单的 fetch 直连 REST（anon key 本就是公开的，RLS 已保证只能 select 到 shares 行）。
// 任何一步失败（id 不是合法 UUID / 环境变量缺失 / 网络错误 / 查无此行 / payload 形状不对）
// 一律返回 null，调用方统一 notFound()——绝不抛错、绝不让页面崩溃。
import { cache } from "react";
import type { ShareItem, ShareKind, SharePayload } from "@/domain/share";

// 类型定义在共享核心（@/domain/share，即 packages/core/src/share.ts）——手机端建卡用的是
// 同一份类型，避免两端各自维护一份同形状的类型、靠注释承诺同步。这里重新导出，让本文件
// 内的其他函数与页面/OG 组件（如 ./ShareCard 的 `import type { SharePayload } from "./shareData"`）
// 无需改动导入路径。
export type { ShareItem, ShareKind, SharePayload };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isShareKind(v: unknown): v is ShareKind {
  return v === "tree" || v === "future-self" || v === "path";
}

// 最小校验 + 裁剪：只信任形状匹配的字段，未知字段一律丢弃；items 至多留 3 条。
function sanitizePayload(raw: unknown): SharePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isShareKind(r.kind) || typeof r.title !== "string" || r.title.length === 0) return null;

  const payload: SharePayload = { kind: r.kind, title: r.title.slice(0, 80) };
  if (typeof r.subtitle === "string" && r.subtitle.length > 0) payload.subtitle = r.subtitle.slice(0, 60);
  if (typeof r.name === "string" && r.name.length > 0) payload.name = r.name.slice(0, 60);
  if (typeof r.quote === "string" && r.quote.length > 0) payload.quote = r.quote.slice(0, 200);

  if (Array.isArray(r.items)) {
    const items: ShareItem[] = [];
    for (const raw of r.items) {
      if (!raw || typeof raw !== "object") continue;
      const it = raw as Record<string, unknown>;
      if (typeof it.label !== "string" || it.label.length === 0) continue;
      const label = it.label.slice(0, 60);
      const feasibility =
        typeof it.feasibility === "number" && Number.isFinite(it.feasibility) ? it.feasibility : undefined;
      items.push(feasibility === undefined ? { label } : { label, feasibility });
      if (items.length >= 3) break;
    }
    if (items.length > 0) payload.items = items;
  }

  return payload;
}

// React cache()：同一请求内 generateMetadata + page 组件重复调用只打一次网络请求。
export const fetchSharePayload = cache(async (id: string): Promise<SharePayload | null> => {
  if (!UUID_RE.test(id)) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  try {
    const res = await fetch(`${url}/rest/v1/shares?id=eq.${encodeURIComponent(id)}&select=payload`, {
      headers: { apikey: anon, authorization: `Bearer ${anon}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0] as Record<string, unknown>;
    return sanitizePayload(row.payload);
  } catch {
    return null;
  }
});
