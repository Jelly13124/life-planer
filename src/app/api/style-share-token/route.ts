import { validateDecisionStylePublicPayload } from "@/domain/decisionStyle";
import { getDecisionStyleShareSecret, signDecisionStylePayload } from "@/lib/decisionStyleToken.server";

const MAX_BODY_BYTES = 1024;

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

export async function POST(request: Request) {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  const secret = getDecisionStyleShareSecret();
  if (!secret) return Response.json({ error: "Share signing unavailable" }, { status: 503 });

  const text = await readCappedBody(request);
  if (text === null) return Response.json({ error: "Invalid payload" }, { status: 400 });

  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = validateDecisionStylePublicPayload(input);
  if (!payload) return Response.json({ error: "Invalid payload" }, { status: 400 });

  const token = signDecisionStylePayload(payload, secret);
  return Response.json({ token, path: `/style/${payload.code}/${token}` });
}
