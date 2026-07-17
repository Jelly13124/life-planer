import { ImageResponse } from "next/og";
import {
  DecisionStyleShareArtwork,
  OG_SIZE,
} from "@/components/decision-style/DecisionStyleShareArtwork";
import { loadDecisionStyleCharacterDataUrl } from "@/lib/decisionStyleShareAssets.server";
import { resolveDecisionStyleSharePayload } from "./page";

export const runtime = "nodejs";
export const alt = "职业决策风格测试分享卡";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ code: string; token: string }>;
}) {
  const payload = await resolveDecisionStyleSharePayload(params);
  if (!payload) return new Response("Not found", { status: 404 });
  const characterSrc = await loadDecisionStyleCharacterDataUrl(payload.code);

  return new ImageResponse(<DecisionStyleShareArtwork payload={payload} characterSrc={characterSrc} variant="og" />, {
    ...size,
  });
}
