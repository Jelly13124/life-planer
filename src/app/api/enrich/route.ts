import { enrichPath, isEnrichEnabled, type EnrichInput } from "@/lib/enrich";
import { allowRequest } from "@/lib/rateLimit";

// 是否已接入真实大模型（前端用来显示"AI 已接入"徽章）
export async function GET() {
  return Response.json({ enabled: isEnrichEnabled() });
}

export async function POST(request: Request) {
  if (!allowRequest(request, Date.now())) {
    return Response.json({ result: null }, { status: 429 });
  }
  let body: EnrichInput;
  try {
    body = (await request.json()) as EnrichInput;
  } catch {
    return Response.json({ result: null }, { status: 400 });
  }
  if (!body || !body.profile || typeof body.kind !== "string") {
    return Response.json({ result: null }, { status: 400 });
  }
  const result = await enrichPath(body);
  return Response.json({ result });
}
