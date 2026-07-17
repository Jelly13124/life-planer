/* eslint-disable @next/next/no-img-element */

import {
  decisionPersonalityPresentationByCode,
  type DecisionStylePublicPayload,
} from "@/domain/decisionStyle";

export const PORTRAIT_SIZE = { width: 1080, height: 1350 } as const;
export const OG_SIZE = { width: 1200, height: 630 } as const;

export function DecisionStyleShareArtwork({
  payload,
  characterSrc,
  variant,
  qrSrc,
}: {
  payload: DecisionStylePublicPayload;
  characterSrc: string;
  variant: "portrait" | "og";
  qrSrc?: string;
}) {
  const item = decisionPersonalityPresentationByCode(payload.code);
  if (!item) return null;

  const portrait = variant === "portrait";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: portrait ? "column" : "row",
        position: "relative",
        overflow: "hidden",
        background: "#f4eadf",
        color: "#251f1a",
        padding: portrait ? 64 : 52,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: "#7b6c60" }}>
          LIFEPLANNER · 决策人格
        </div>
        <div
          style={{
            display: "flex",
            marginTop: portrait ? 48 : 28,
            fontSize: portrait ? 112 : 92,
            lineHeight: 0.9,
            fontWeight: 900,
            letterSpacing: -7,
          }}
        >
          {payload.code}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: portrait ? 38 : 30,
            fontWeight: 700,
          }}
        >
          {item.label}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 30,
            maxWidth: portrait ? 820 : 610,
            fontSize: portrait ? 34 : 28,
            lineHeight: 1.45,
            fontWeight: 600,
          }}
        >
          {item.tagline}
        </div>
        {portrait ? (
          <div style={{ display: "flex", marginTop: 34, gap: 18 }}>
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                borderRadius: 24,
                background: "rgba(255,255,255,0.72)",
                padding: 24,
              }}
            >
              <div style={{ display: "flex", color: "#9a4c25", fontSize: 18 }}>你的高光</div>
              <div style={{ display: "flex", marginTop: 10, fontSize: 24, lineHeight: 1.45 }}>
                {item.highlight}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                borderRadius: 24,
                background: "#2d2925",
                color: "#fffaf4",
                padding: 24,
              }}
            >
              <div style={{ display: "flex", color: "#d9b99d", fontSize: 18 }}>容易翻车</div>
              <div style={{ display: "flex", marginTop: 10, fontSize: 24, lineHeight: 1.45 }}>
                {item.roast}
              </div>
            </div>
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            fontSize: portrait ? 26 : 22,
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex" }}>我是 {payload.code}，你是什么？</div>
          {portrait && qrSrc ? (
            <img src={qrSrc} width={150} height={150} alt="测试入口二维码" />
          ) : null}
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 15, color: "#7b6c60" }}>
          当前自报倾向，不是固定人格或心理诊断。
        </div>
      </div>
      <img
        src={characterSrc}
        alt=""
        width={portrait ? 540 : 470}
        height={portrait ? 540 : 470}
        style={{
          position: portrait ? "absolute" : "relative",
          right: portrait ? 10 : 0,
          top: portrait ? 140 : 25,
          objectFit: "contain",
          opacity: 1,
        }}
      />
    </div>
  );
}
