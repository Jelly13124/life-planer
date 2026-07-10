import type { Metadata } from "next";
import {
  AXES,
  AXIS_KEYS,
  decisionStyleAxisStrength,
  decisionStyleTypeByCode,
  type DecisionStyleAxis,
  type DecisionStyleLetter,
  type DecisionStylePublicPayload,
} from "@/domain/decisionStyle";
import { getDecisionStyleShareSecret, verifyDecisionStyleToken } from "@/lib/decisionStyleToken.server";
import {
  FALLBACK_DESCRIPTION,
  FALLBACK_TITLE,
  SafeRetestEntry,
} from "@/app/style/[code]/[token]/page";

interface ComparePayload {
  left: DecisionStylePublicPayload;
  right: DecisionStylePublicPayload;
}

function letterForAxis(payload: DecisionStylePublicPayload, axis: DecisionStyleAxis): DecisionStyleLetter {
  return payload.code[AXIS_KEYS.indexOf(axis)] as DecisionStyleLetter;
}

function axisDisplay(payload: DecisionStylePublicPayload, axis: DecisionStyleAxis) {
  const definition = AXES.find((item) => item.key === axis)!;
  const score = payload.scores[axis];
  const letter = score === 50
    ? letterForAxis(payload, axis)
    : score > 50
      ? definition.a.letter
      : definition.b.letter;
  const pole = letter === definition.a.letter ? definition.a : definition.b;
  return {
    score,
    letter,
    label: pole.label,
    tendency: decisionStyleAxisStrength(score),
  };
}

function differenceForAxis(compare: ComparePayload, axis: DecisionStyleAxis) {
  return Math.abs(compare.left.scores[axis] - compare.right.scores[axis]);
}

function closestAxis(compare: ComparePayload) {
  return AXIS_KEYS.reduce((best, axis) =>
    differenceForAxis(compare, axis) < differenceForAxis(compare, best) ? axis : best, AXIS_KEYS[0]);
}

function widestAxis(compare: ComparePayload) {
  return AXIS_KEYS.reduce((best, axis) =>
    differenceForAxis(compare, axis) > differenceForAxis(compare, best) ? axis : best, AXIS_KEYS[0]);
}

export async function resolveDecisionStyleComparePayload(
  params: Promise<{ left: string; right: string }>,
  secret = getDecisionStyleShareSecret(),
): Promise<ComparePayload | null> {
  if (!secret) return null;
  const { left, right } = await params;
  const leftPayload = verifyDecisionStyleToken(left, secret);
  const rightPayload = verifyDecisionStyleToken(right, secret);
  if (!leftPayload || !rightPayload) return null;
  return { left: leftPayload, right: rightPayload };
}

function metadataForPayload(compare: ComparePayload): Metadata {
  const leftType = decisionStyleTypeByCode(compare.left.code);
  const rightType = decisionStyleTypeByCode(compare.right.code);
  return {
    title: `${leftType?.label ?? compare.left.code} × ${rightType?.label ?? compare.right.code} 对照 | Life Planner`,
    description: "并排查看两份已验证的四轴当前倾向与分数差异，不做匹配评分或优劣判断。",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ left: string; right: string }>;
}): Promise<Metadata> {
  const compare = await resolveDecisionStyleComparePayload(params);
  return compare ? metadataForPayload(compare) : { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION };
}

export default async function Page({
  params,
}: {
  params: Promise<{ left: string; right: string }>;
}) {
  const compare = await resolveDecisionStyleComparePayload(params);
  if (!compare) return <SafeRetestEntry />;

  const nearest = closestAxis(compare);
  const furthest = widestAxis(compare);
  const nearestAxis = AXES.find((item) => item.key === nearest)!;
  const furthestAxis = AXES.find((item) => item.key === furthest)!;
  const leftType = decisionStyleTypeByCode(compare.left.code);
  const rightType = decisionStyleTypeByCode(compare.right.code);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        padding: "32px 16px 48px",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            borderRadius: 24,
            background: "#ffffff",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
            padding: 28,
          }}
        >
          <div style={{ fontSize: 14, letterSpacing: 2, color: "#64748b" }}>职业决策风格测试</div>
          <h1 style={{ margin: 0, fontSize: 34 }}>和朋友的决策风格对照</h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "#475569" }}>
            这里只展示两份已验证结果在四个轴上的当前倾向和分数差异，不给出兼容度、胜负或排序判断。
          </p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div style={{ borderRadius: 18, background: "#f8fafc", padding: 18 }}>
              <div style={{ fontSize: 12, color: "#64748b", letterSpacing: 1.5 }}>左侧结果</div>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700 }}>{compare.left.code}</div>
              <div style={{ marginTop: 4, color: "#475569" }}>{leftType?.label ?? "当前倾向"}</div>
            </div>
            <div style={{ borderRadius: 18, background: "#f8fafc", padding: 18 }}>
              <div style={{ fontSize: 12, color: "#64748b", letterSpacing: 1.5 }}>右侧结果</div>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700 }}>{compare.right.code}</div>
              <div style={{ marginTop: 4, color: "#475569" }}>{rightType?.label ?? "当前倾向"}</div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div style={{ borderRadius: 18, background: "#fff7ed", padding: 18 }}>
              <div style={{ fontSize: 14, color: "#9a3412" }}>
                最接近：{nearestAxis.a.label} / {nearestAxis.b.label}
              </div>
              <div style={{ marginTop: 6, color: "#7c2d12" }}>
                分差 {differenceForAxis(compare, nearest)}，按固定轴顺序稳定判定。
              </div>
            </div>
            <div style={{ borderRadius: 18, background: "#eff6ff", padding: 18 }}>
              <div style={{ fontSize: 14, color: "#1d4ed8" }}>
                差异最大：{furthestAxis.a.label} / {furthestAxis.b.label}
              </div>
              <div style={{ marginTop: 6, color: "#1e40af" }}>
                分差 {differenceForAxis(compare, furthest)}，仅表示当前差距更明显。
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {AXES.map((axis) => {
            const left = axisDisplay(compare.left, axis.key);
            const right = axisDisplay(compare.right, axis.key);
            return (
              <article
                key={axis.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  borderRadius: 24,
                  background: "#ffffff",
                  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
                  padding: 24,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>
                    {axis.a.label} / {axis.b.label}
                  </h2>
                  <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.5 }}>
                    两边都展示分数和当前倾向，不往外延伸成谁更好之类的结论。
                  </p>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  }}
                >
                  {[left, right].map((item, index) => (
                    <div key={`${axis.key}-${index}`} style={{ borderRadius: 18, background: "#f8fafc", padding: 16 }}>
                      <div style={{ fontSize: 12, color: "#64748b", letterSpacing: 1.5 }}>
                        {index === 0 ? "左侧" : "右侧"}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 700 }}>{item.score} / 100</div>
                      <div style={{ marginTop: 8, color: "#334155" }}>{item.tendency}</div>
                      <div style={{ marginTop: 4, color: "#475569" }}>
                        {item.letter} · {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
