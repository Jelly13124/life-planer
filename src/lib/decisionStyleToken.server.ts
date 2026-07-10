import { createHmac, timingSafeEqual } from "node:crypto";
import {
  decodeDecisionStylePublicPayload,
  encodeDecisionStylePublicPayload,
  type DecisionStylePublicPayload,
} from "@/domain/decisionStyle";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): Buffer | null {
  if (!BASE64URL_PATTERN.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

function sign(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedPayload, "utf8").digest();
}

export function signDecisionStylePayload(payload: DecisionStylePublicPayload, secret: string): string {
  if (!secret) throw new TypeError("Decision Style share secret is required");
  const encodedPayload = encodeBase64Url(encodeDecisionStylePublicPayload(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret).toString("base64url")}`;
}

export function verifyDecisionStyleToken(token: string, secret: string): DecisionStylePublicPayload | null {
  if (!secret || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSignature] = parts;
  const payloadBytes = decodeBase64Url(encodedPayload);
  const receivedSignature = decodeBase64Url(encodedSignature);
  if (!payloadBytes || !receivedSignature) return null;

  const expectedSignature = sign(encodedPayload, secret);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) return null;

  const payload = decodeDecisionStylePublicPayload(payloadBytes.toString("utf8"));
  if (!payload || encodeBase64Url(encodeDecisionStylePublicPayload(payload)) !== encodedPayload) return null;
  return payload;
}

export function getDecisionStyleShareSecret(): string | null {
  const secret = process.env.DECISION_STYLE_SHARE_SECRET;
  return secret && secret.trim() ? secret : null;
}
