import { ImageResponse } from "next/og";
import { fetchSharePayload } from "./shareData";

export const alt = "人生树 Life Planner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 与卡片页/feasibility 展示口径一致（约 X%，取整到 5，封顶 95）。
function roundFeasibility(n: number): number {
  return Math.min(95, Math.max(0, Math.round(n / 5) * 5));
}

// 深色媒体面板视觉语言（对齐 globals.css 的 .lp-media-dark），系统字体、无外部字体加载。
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await fetchSharePayload(id);

  const title = payload?.title ?? "人生树 Life Planner";
  const meta = [payload?.subtitle, payload?.name].filter((s): s is string => !!s).join(" · ");
  const quote = payload?.kind === "future-self" ? payload.quote : undefined;
  const items = (payload?.items ?? []).slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background: "linear-gradient(160deg, #1b1f3a 0%, #11132a 48%, #0e0e12 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color: "#9aa0c7" }}>人生树 · Life Planner</div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.25,
            color: "#e8eaf6",
          }}
        >
          {title}
        </div>
        {meta ? (
          <div style={{ display: "flex", marginTop: 16, fontSize: 28, color: "#9aa0c7" }}>{meta}</div>
        ) : null}

        {quote ? (
          <div
            style={{
              display: "flex",
              marginTop: 44,
              fontSize: 34,
              lineHeight: 1.5,
              fontStyle: "italic",
              color: "#e8eaf6",
            }}
          >
            {`“${quote}”`}
          </div>
        ) : items.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 44, gap: 18 }}>
            {items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 30,
                  background: "rgba(255,255,255,0.07)",
                  borderRadius: 20,
                  padding: "22px 32px",
                  color: "#e8eaf6",
                }}
              >
                <span style={{ display: "flex" }}>{it.label}</span>
                {typeof it.feasibility === "number" ? (
                  <span style={{ display: "flex", color: "#fb923c", fontWeight: 700 }}>
                    约 {roundFeasibility(it.feasibility)}%
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", marginTop: 48, fontSize: 20, color: "#6b719e" }}>
          AI 推演的可能性，非预测 · 由朋友分享
        </div>
      </div>
    ),
    { ...size },
  );
}
