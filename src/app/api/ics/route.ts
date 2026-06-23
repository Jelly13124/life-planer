// 服务端只读 ICS 代取：避开浏览器对第三方日历域的 CORS 限制。
// GET ?url=<编码过的 https ICS 地址> → 服务端拉取 → parseIcs → { events }。
// 安全：仅 https；超时 ~8s；体积上限 ~2MB；按 IP 限流（与 arrange-day 一致）。
// 任何坏输入 / 非 https / 拉取失败 / 过大 → 4xx + { events: [] }（优雅降级，前端照常渲染空）。
import { allowRequest } from "@/lib/rateLimit";
import { parseIcs } from "@/domain/ics";

const TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) return Response.json({ events: [] }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return Response.json({ events: [] }, { status: 400 });
  }
  // 仅放行 https（避免被当作 SSRF 代理打内网 http/file 等）。
  if (target.protocol !== "https:") {
    return Response.json({ events: [] }, { status: 400 });
  }

  if (!allowRequest(request, Date.now())) {
    return Response.json({ events: [] }, { status: 429 });
  }

  try {
    const res = await fetch(target.toString(), {
      // 有些日历服务用 webcal/text/calendar；带个常见 Accept，失败也不强求。
      headers: { accept: "text/calendar, text/plain, */*" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      return Response.json({ events: [] }, { status: 502 });
    }
    // 体积上限：Content-Length 先挡一手；无该头时流式累加，超限即中止。
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) {
      return Response.json({ events: [] }, { status: 413 });
    }
    const text = await readCapped(res, MAX_BYTES);
    if (text === null) {
      return Response.json({ events: [] }, { status: 413 });
    }
    return Response.json({ events: parseIcs(text) });
  } catch (e) {
    console.error("[ics] fetch failed:", e);
    return Response.json({ events: [] }, { status: 502 });
  }
}

// 流式读取并在累计字节超过上限时中止，返回 null（避免把超大响应整块读进内存）。
async function readCapped(res: Response, max: number): Promise<string | null> {
  if (!res.body) {
    const text = await res.text();
    return Buffer.byteLength(text, "utf8") > max ? null : text;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > max) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}
