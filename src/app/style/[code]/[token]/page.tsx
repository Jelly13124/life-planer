import type { Metadata } from "next";
import {
  decisionPersonalityPresentationByCode,
  type DecisionStylePublicPayload,
} from "@/domain/decisionStyle";
import { DecisionStyleAnalyticsBeacon } from "@/components/decision-style/DecisionStyleAnalyticsBeacon";
import { DecisionStyleCharacter } from "@/components/decision-style/DecisionStyleCharacter";
import { getDecisionStyleShareSecret, verifyDecisionStyleToken } from "@/lib/decisionStyleToken.server";

export const FALLBACK_TITLE = "职业决策风格测试分享 | Life Planner";
export const FALLBACK_DESCRIPTION = "查看公开分享的四轴当前倾向，或重新测试后和朋友对比。";

export function SafeRetestEntry() {
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
  const presentation = decisionPersonalityPresentationByCode(payload.code);
  return {
    title: `${payload.code} · ${presentation?.label ?? "决策人格"} | Life Planner`,
    description: presentation?.tagline ?? "测测你的四字母决策人格。",
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

  const presentation = decisionPersonalityPresentationByCode(payload.code);
  if (!presentation) return <SafeRetestEntry />;

  const { token } = await params;

  return (
    <main
      className="min-h-dvh px-4 pb-14 pt-6 text-[#251f1a] sm:px-6 sm:pb-20 sm:pt-10"
      style={{
        background:
          "radial-gradient(circle at 78% 8%, rgba(255,253,249,0.98) 0, rgba(255,253,249,0) 34%), #f4eadf",
      }}
    >
      <div
        className="mx-auto flex w-full max-w-[56.25rem] flex-col gap-5 font-display"
      >
        <DecisionStyleAnalyticsBeacon event="style_share_open" source="shared" />
        <section
          aria-labelledby="decision-personality-title"
          className="animate-fade overflow-hidden rounded-[1.75rem] bg-[#fffdf9] px-5 pb-6 pt-6 shadow-[0_1.5rem_4rem_rgba(88,57,37,0.12)] sm:rounded-[2rem] sm:px-8 sm:pb-8 sm:pt-8"
        >
          <p className="m-0 text-xs font-semibold tracking-[0.18em] text-[#6d5f54] sm:text-[0.8125rem]">
            TA 的决策人格
          </p>

          <div className="mt-1 grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-5">
            <div className="relative z-10 min-w-0 py-4 sm:py-6">
              <h1
                id="decision-personality-title"
                className="m-0 text-[clamp(3.75rem,16vw,5.5rem)] font-black leading-[0.88] tracking-[-0.07em] text-[#251f1a]"
              >
                {payload.code}
              </h1>
              <p className="mt-3 text-[clamp(1.375rem,5vw,1.75rem)] font-bold tracking-[-0.025em] text-[#4a3528]">
                {presentation.label}
              </p>
              <p className="mt-6 max-w-[33rem] text-balance text-[clamp(1.125rem,3.5vw,1.5rem)] font-semibold leading-[1.55] tracking-[-0.02em] text-[#302821]">
                {presentation.tagline}
              </p>
            </div>

            <div className="animate-scale-in -mb-8 flex justify-center self-end md:-mr-5 md:justify-end">
              <DecisionStyleCharacter
                code={payload.code}
                size={320}
                className="h-auto w-full max-w-[20rem] drop-shadow-[0_1.25rem_1.5rem_rgba(92,58,34,0.16)]"
              />
            </div>
          </div>

          <div className="relative z-10 mt-5 grid gap-3 md:grid-cols-[1.08fr_0.92fr] md:gap-3.5">
            <article className="rounded-[1.125rem] bg-[#f4eadf] p-5 sm:rounded-[1.25rem]">
              <h2 className="m-0 text-sm font-bold tracking-[0.08em] text-[#7a3d22]">TA 的高光</h2>
              <p className="mb-0 mt-3 text-[1.0625rem] leading-7 text-[#46382e]">
                {presentation.highlight}
              </p>
            </article>
            <article className="rounded-[1.125rem] bg-[#2d2925] p-5 text-[#fffaf4] sm:rounded-[1.25rem]">
              <h2 className="m-0 text-sm font-bold tracking-[0.08em] text-[#e6b99d]">容易翻车</h2>
              <p className="mb-0 mt-3 text-[1.0625rem] leading-7 text-[#fffaf4]">
                {presentation.roast}
              </p>
            </article>
          </div>

          <p className="mb-0 mt-5 max-w-[48rem] text-sm leading-6 text-[#695c52]">
            当前自报倾向，不是固定人格或心理诊断。公开结果不包含原始答案。
          </p>
        </section>

        <a
          href={`/test?invite=${encodeURIComponent(token)}`}
          className="animate-pop inline-flex min-h-12 w-full items-center justify-center rounded-[0.875rem] bg-[#b54722] px-6 py-3 font-bold text-white no-underline shadow-[0_0.75rem_1.75rem_rgba(137,55,25,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#9f3d1c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a321b] active:translate-y-px sm:w-fit"
        >
          测测我是什么，和 TA 对比
        </a>
      </div>
    </main>
  );
}
