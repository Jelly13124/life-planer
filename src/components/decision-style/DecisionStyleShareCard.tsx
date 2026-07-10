import { AXES, decisionStyleTypeByCode, type DecisionStylePublicPayload } from "@/domain/decisionStyle";

function tendencyFor(score: number) {
  return score >= 45 && score <= 55 ? "轻微倾向" : "明显倾向";
}

export function DecisionStyleShareCard({
  payload,
}: {
  payload: DecisionStylePublicPayload;
}) {
  const type = decisionStyleTypeByCode(payload.code);

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        borderRadius: 32,
        padding: 48,
        background: "linear-gradient(160deg, #18181b 0%, #27272a 48%, #0f172a 100%)",
        color: "#f8fafc",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", fontSize: 18, letterSpacing: 2, color: "#cbd5e1" }}>
          职业决策风格测试
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 58, fontWeight: 700 }}>{payload.code}</div>
            <div style={{ display: "flex", fontSize: 28, color: "#e2e8f0" }}>{type?.label ?? "当前倾向"}</div>
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#cbd5e1" }}>
            {payload.source === "full" ? "28 题完整版" : "12 题快测"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {AXES.map((axis) => {
          const score = payload.scores[axis.key];
          return (
            <div key={axis.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 20 }}>
                <div style={{ display: "flex", color: "#f8fafc" }}>
                  {axis.a.label} / {axis.b.label}
                </div>
                <div style={{ display: "flex", color: "#cbd5e1" }}>
                  {score} / 100 · {tendencyFor(score)}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: 14,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: `${score}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #fb923c 0%, #f97316 100%)",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 16, color: "#94a3b8" }}>
                <div style={{ display: "flex" }}>
                  {axis.a.letter} · {axis.a.label}
                </div>
                <div style={{ display: "flex" }}>
                  {axis.b.letter} · {axis.b.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
        <div style={{ display: "flex", fontSize: 22, color: "#e2e8f0" }}>当前倾向，不是固定人格。</div>
        <div style={{ display: "flex", fontSize: 18, color: "#94a3b8" }}>
          公开分享仅展示四轴当前倾向，不包含原始答案或本地依据。
        </div>
      </div>
    </div>
  );
}
