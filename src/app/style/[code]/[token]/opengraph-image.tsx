import { ImageResponse } from "next/og";
import { DecisionStyleShareCard } from "@/components/decision-style/DecisionStyleShareCard";
import { resolveDecisionStyleSharePayload } from "./page";

export const runtime = "nodejs";
export const alt = "职业决策风格测试分享卡";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ code: string; token: string }>;
}) {
  const payload = await resolveDecisionStyleSharePayload(params);
  if (!payload) return new Response("Not found", { status: 404 });

  return new ImageResponse(<DecisionStyleShareCard payload={payload} />, {
    ...size,
  });
}
