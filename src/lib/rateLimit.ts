// 服务端轻量限流：按 IP 的固定窗口计数，挡住"链接被转发后有人狂刷烧 key"。
// 诚实声明：这是内存级、尽力而为——在 serverless 上每个实例各算各的、冷启动会重置，
// 不是分布式精确限流。真正的兜底请在 DeepSeek 后台设每月消费上限。
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000; // 1 分钟窗口
const MAX_PER_WINDOW = 20; // 每 IP 每分钟最多 20 次 AI 调用（够一个人用，挡住狂刷）

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// 超限返回 false。命中即放行并计数。偶发清理过期桶，避免无限增长。
export function allowRequest(req: Request, now: number): boolean {
  const ip = clientIp(req);
  const b = buckets.get(ip);
  if (!b || now >= b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    }
    return true;
  }
  if (b.count >= MAX_PER_WINDOW) return false;
  b.count += 1;
  return true;
}
