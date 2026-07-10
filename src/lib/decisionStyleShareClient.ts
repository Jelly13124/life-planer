import type { DecisionStylePublicPayload, DecisionStyleSummary } from "@/domain/decisionStyle";

export const SHARE_UNAVAILABLE_MESSAGE = "分享暂不可用，请联网后重试";
export const INVALID_SHARE_RESPONSE_MESSAGE = "Invalid share token response";

export interface DecisionStyleSignedShareLink {
  token: string;
  path: string;
  url: string;
  pngUrl: string;
}

export interface RequestDecisionStyleShareLinkOptions {
  fetchImpl?: typeof fetch;
  origin?: string;
}

export interface ShareDecisionStyleLinkOptions {
  navigatorLike?: Navigator | undefined;
  copyText?: (value: string) => Promise<void>;
}

export interface DownloadDecisionStylePngOptions {
  createAnchor?: () => HTMLAnchorElement;
}

function toPublicPayload(summary: DecisionStyleSummary): DecisionStylePublicPayload {
  return {
    version: 2,
    source: summary.source,
    code: summary.code,
    scores: summary.scores,
  };
}

function getOrigin(origin?: string): string {
  if (origin) return origin;
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  throw new Error("Missing origin for Decision Style sharing");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertValidSignedPath(payload: DecisionStylePublicPayload, token: string, path: string) {
  if (path !== `/style/${payload.code}/${token}`) {
    throw new Error(INVALID_SHARE_RESPONSE_MESSAGE);
  }
}

export function isDecisionStyleNativeShareAvailable(navigatorLike: Navigator | undefined = globalThis.navigator) {
  return typeof navigatorLike?.share === "function";
}

export async function copyDecisionStyleLink(
  url: string,
  { copyText = globalThis.navigator?.clipboard?.writeText?.bind(globalThis.navigator.clipboard) }: ShareDecisionStyleLinkOptions = {},
) {
  if (!copyText) throw new Error("Clipboard unavailable");
  await copyText(url);
}

export async function shareDecisionStyleLink(
  url: string,
  {
    navigatorLike = globalThis.navigator,
    copyText,
  }: ShareDecisionStyleLinkOptions = {},
): Promise<"shared" | "copied"> {
  if (isDecisionStyleNativeShareAvailable(navigatorLike)) {
    await navigatorLike.share({
      title: "职业决策风格测试",
      text: "看看我的当前职业决策倾向",
      url,
    });
    return "shared";
  }

  await copyDecisionStyleLink(url, { copyText });
  return "copied";
}

export async function requestDecisionStyleShareLink(
  summary: DecisionStyleSummary,
  { fetchImpl = globalThis.fetch, origin }: RequestDecisionStyleShareLinkOptions = {},
): Promise<DecisionStyleSignedShareLink> {
  const payload = toPublicPayload(summary);

  let response: Response;
  try {
    response = await fetchImpl("/api/style-share-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(SHARE_UNAVAILABLE_MESSAGE);
  }

  if (response.status === 503) throw new Error(SHARE_UNAVAILABLE_MESSAGE);
  if (!response.ok) throw new Error(INVALID_SHARE_RESPONSE_MESSAGE);

  const body = await response.json().catch(() => null);
  if (!isRecord(body) || typeof body.token !== "string" || typeof body.path !== "string") {
    throw new Error(INVALID_SHARE_RESPONSE_MESSAGE);
  }

  assertValidSignedPath(payload, body.token, body.path);

  const url = new URL(body.path, getOrigin(origin)).toString();
  return {
    token: body.token,
    path: body.path,
    url,
    pngUrl: `${url}/card.png`,
  };
}

export async function downloadDecisionStylePng(
  pngUrl: string,
  { createAnchor = () => document.createElement("a") }: DownloadDecisionStylePngOptions = {},
) {
  const anchor = createAnchor();
  anchor.href = pngUrl;
  anchor.download = "decision-style-card.png";
  anchor.rel = "noopener";
  anchor.click();
}
