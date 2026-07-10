import type { Metadata } from "next";
import { decisionStyleTypeByCode, type DecisionStylePublicPayload } from "@/domain/decisionStyle";
import { DecisionStyleShareCard } from "@/components/decision-style/DecisionStyleShareCard";
import { getDecisionStyleShareSecret, verifyDecisionStyleToken } from "@/lib/decisionStyleToken.server";

const FALLBACK_TITLE = "职业决策风格测试分享 | Life Planner";
const FALLBACK_DESCRIPTION = "查看公开分享的四轴当前倾向，或重新测试后和朋友对比。";

function SafeRetestEntry() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          borderRadius: 24,
          padding: 32,
          background: "#ffffff",
          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
          color: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", fontSize: 14, letterSpacing: 2, color: "#64748b" }}>
            职业决策风格测试
          </div>
          <h1 style={{ margin: 0, fontSize: 32 }}>这个分享链接已失效</h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "#475569" }}>
            为了保护隐私，这个公开结果无法继续展示。你可以重新测试，生成自己的当前倾向卡片。
          </p>
        </div>
        <a
          href="/test"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
            borderRadius: 999,
            background: "linear-gradient(90deg, #fb923c 0%, #f97316 100%)",
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 600,
            textDecoration: "none",
            padding: "0 24px",
          }}
        >
          重新测试
        </a>
      </div>
    </main>
  );
}

export async function resolveDecisionStyleSharePayload(
  params: Promise<{ code: string; token: string }>,
  secret = getDecisionStyleShareSecret(),
): Promise<DecisionStylePublicPayload | null> {
  if (!secret) return null;
  const { code, token } = await params;
  const payload = verifyDecisionStyleToken(token, secret);
  if (!payload || payload.code !== code) return null;
  return payload;
}

function metadataForPayload(payload: DecisionStylePublicPayload): Metadata {
  const type = decisionStyleTypeByCode(payload.code);
  return {
    title: `${type?.label ?? "职业决策风格测试"} · ${payload.code} | Life Planner`,
    description: "公开分享仅展示四轴当前倾向与分数，不包含原始答案或本地依据。",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string; token: string }>;
}): Promise<Metadata> {
  const payload = await resolveDecisionStyleSharePayload(params);
  return payload ? metadataForPayload(payload) : { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION };
}

export default async function Page({
  params,
}: {
  params: Promise<{ code: string; token: string }>;
}) {
  const payload = await resolveDecisionStyleSharePayload(params);
  if (!payload) return <SafeRetestEntry />;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        padding: "32px 16px 48px",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 820,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          fontFamily: "sans-serif",
        }}
      >
        <DecisionStyleShareCard payload={payload} />
        <a
          href="/test"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
            borderRadius: 999,
            background: "#0f172a",
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 600,
            textDecoration: "none",
            padding: "0 24px",
            alignSelf: "flex-start",
          }}
        >
          测完和 TA 比
        </a>
      </div>
    </main>
  );
}
