import { ImageResponse } from "next/og";
import { createElement } from "react";
import {
  DecisionStyleShareArtwork,
  PORTRAIT_SIZE,
} from "@/components/decision-style/DecisionStyleShareArtwork";
import {
  decisionStyleQrDataUrl,
  loadDecisionStyleCharacterDataUrl,
} from "@/lib/decisionStyleShareAssets.server";
import { resolveDecisionStyleSharePayload } from "../page";

export const runtime = "nodejs";

export async function GET(
  request: Request,
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

  const resultUrl = request.url.replace(/\/card\.png(?:\?.*)?$/, "");
  const [characterSrc, qrSrc] = await Promise.all([
    loadDecisionStyleCharacterDataUrl(payload.code),
    decisionStyleQrDataUrl(resultUrl),
  ]);

  return new ImageResponse(createElement(DecisionStyleShareArtwork, {
    payload,
    characterSrc,
    qrSrc,
    variant: "portrait",
  }), {
    ...PORTRAIT_SIZE,
    headers: { "content-type": "image/png" },
  });
}
