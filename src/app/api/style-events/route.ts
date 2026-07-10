const EVENTS = [
  "style_view",
  "style_start",
  "style_skip",
  "style_complete",
  "style_share",
  "style_share_open",
  "style_compare_start",
  "style_compare_complete",
  "style_continue_tree",
] as const;

const SURFACES = ["web", "app"] as const;
const SOURCES = ["direct", "shared", "compare"] as const;
const MAX_BODY_BYTES = 512;
const MAX_REQUESTS_PER_WINDOW = 30;
const WINDOW_MS = 60_000;

type StyleEvent = (typeof EVENTS)[number];
type StyleSurface = (typeof SURFACES)[number];
type StyleSource = (typeof SOURCES)[number];

interface StyleEventRequest {
  event: StyleEvent;
  surface: StyleSurface;
  source: StyleSource;
  test_version: 2;
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function allowRequest(request: Request, now = Date.now()): boolean {
  const key = clientIp(request);
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets) {
        if (now >= bucket.resetAt) buckets.delete(bucketKey);
      }
    }
    return true;
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) return false;
  existing.count += 1;
  return true;
}

async function readCappedBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequest(value: unknown): StyleEventRequest | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.join(",") !== "event,source,surface,test_version") return null;
  if (
    typeof value.event !== "string" ||
    !EVENTS.includes(value.event as StyleEvent) ||
    typeof value.surface !== "string" ||
    !SURFACES.includes(value.surface as StyleSurface) ||
    typeof value.source !== "string" ||
    !SOURCES.includes(value.source as StyleSource) ||
    value.test_version !== 2
  ) {
    return null;
  }
  return value as unknown as StyleEventRequest;
}

async function insertEvent(event: StyleEventRequest): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return;

  try {
    await fetch(`${url.replace(/\/$/, "")}/rest/v1/style_events`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(event),
    });
  } catch {
    // Analytics is best effort. A database outage must never block the test.
  }
}

export async function POST(request: Request) {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  if (!allowRequest(request)) return Response.json({ error: "Too many requests" }, { status: 429 });

  const text = await readCappedBody(request);
  if (text === null) return Response.json({ error: "Request body too large" }, { status: 413 });

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }

  const event = parseRequest(value);
  if (!event) return Response.json({ error: "Invalid event" }, { status: 400 });

  await insertEvent(event);
  return new Response(null, { status: 202 });
}
