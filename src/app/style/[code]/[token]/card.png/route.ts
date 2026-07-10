import { ImageResponse } from "next/og";
import { createElement } from "react";
import { DecisionStyleShareCard } from "@/components/decision-style/DecisionStyleShareCard";
import { resolveDecisionStyleSharePayload } from "../page";
import { contentType, size } from "../opengraph-image";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<unknown>;
  },
) {
  const payload = await resolveDecisionStyleSharePayload(
    params as Promise<{ code: string; token: string }>,
  );
  if (!payload) return new Response("Not found", { status: 404 });

  return new ImageResponse(createElement(DecisionStyleShareCard, { payload }), {
    ...size,
    headers: { "content-type": contentType },
  });
}
