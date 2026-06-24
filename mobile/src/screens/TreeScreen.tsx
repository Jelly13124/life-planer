// 人生树（只读预测视图）—— 路线 A 的核心差异化屏。
// 把每条人生路径画成「综合人生指数」随年龄变化的曲线：维持现状=灰色虚线，
// 选择路径=彩色实线，终点标注现实可行度 %。曲线由各领域指标按年龄平均得到（真实数据，非编造）。
//
// 这里是只读视图：加分支需要 AI 推演（predictAndCommit），那条链路在 Phase 3 后续/网页端。
import React from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Line, Circle, Text as SvgText, Rect } from "react-native-svg";
import { LIFE_AREAS, type LifePath } from "@lifeplanner/core/types";
import { useApp } from "../state/store";
import { Card, Muted } from "../ui";
import { colors, space } from "../theme";

// 暗色「媒体面板」配色（对应 web 的 .lp-media-dark）。
const DARK = {
  bg: "#0e0e12",
  grid: "#2a2a33",
  axis: "#3a3a44",
  statusQuo: "#8a8a99",
  text: "#e7e7ea",
  textMuted: "#9a9aa6",
};

// 一条路径的综合指数随年龄序列：对 5 个领域在同一年龄点求平均。
function compositePoints(path: LifePath): { age: number; value: number }[] {
  const ref = path.metrics?.[LIFE_AREAS[0]] ?? [];
  return ref.map((_, i) => {
    let sum = 0;
    let n = 0;
    let age = ref[i]?.age ?? 0;
    for (const a of LIFE_AREAS) {
      const mp = path.metrics?.[a]?.[i];
      if (mp) {
        sum += mp.value;
        n += 1;
        age = mp.age;
      }
    }
    return { age, value: n ? sum / n : 50 };
  });
}

export default function TreeScreen() {
  const { tree } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (!tree) return null;

  const paths = tree.paths;
  const statusQuo = paths.find((p) => p.kind === "status-quo");
  const choices = paths.filter((p) => p.kind === "choice");

  const minAge = tree.profile.age;
  const maxAge = tree.profile.age + tree.horizonYears;

  // 画布尺寸（面板内）。
  const W = width - space * 2 - 2; // 减去外边距 + 卡片描边
  const H = 300;
  const padL = 30;
  const padR = 16;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const x = (age: number) =>
    padL + ((age - minAge) / Math.max(1, maxAge - minAge)) * plotW;
  const y = (v: number) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH;

  const toD = (pts: { age: number; value: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.age).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");

  const ageTicks = [minAge, Math.round((minAge + maxAge) / 2), maxAge];

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space }]}>
      <Text style={styles.h1}>人生树</Text>
      <Muted style={{ marginBottom: 14 }}>
        每条线是一种可能的人生走向 · 纵轴为综合人生指数，横轴为年龄
      </Muted>

      {/* 暗色媒体面板 + SVG 曲线 */}
      <View style={styles.panel}>
        <Svg width={W} height={H}>
          <Rect x={0} y={0} width={W} height={H} rx={14} fill={DARK.bg} />
          {/* 横向网格 0/50/100 */}
          {[0, 50, 100].map((v) => (
            <Line
              key={v}
              x1={padL}
              y1={y(v)}
              x2={W - padR}
              y2={y(v)}
              stroke={DARK.grid}
              strokeWidth={1}
              strokeDasharray={v === 50 ? "4 4" : undefined}
            />
          ))}
          {/* 年龄轴 */}
          <Line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={DARK.axis} strokeWidth={1} />
          {ageTicks.map((a) => (
            <SvgText
              key={a}
              x={x(a)}
              y={H - padB + 16}
              fill={DARK.textMuted}
              fontSize={10}
              textAnchor="middle"
            >
              {a}岁
            </SvgText>
          ))}

          {/* 维持现状：灰色虚线 */}
          {statusQuo ? (
            <Path
              d={toD(compositePoints(statusQuo))}
              stroke={DARK.statusQuo}
              strokeWidth={2}
              strokeDasharray="6 5"
              fill="none"
            />
          ) : null}

          {/* 选择路径：彩色实线 + 终点圆点 */}
          {choices.map((p) => {
            const pts = compositePoints(p);
            if (pts.length === 0) return null;
            const last = pts[pts.length - 1];
            return (
              <React.Fragment key={p.id}>
                <Path d={toD(pts)} stroke={p.color} strokeWidth={2.5} fill="none" />
                <Circle cx={x(last.age)} cy={y(last.value)} r={4} fill={p.color} />
              </React.Fragment>
            );
          })}
        </Svg>
      </View>

      {/* 路径清单 */}
      {choices.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>暂时只有「维持现状」</Text>
          <Muted>
            添加人生选择后，这里会长出不同的彩色分支，并给出每条路的现实可行度。加分支需要 AI 推演，将在后续版本接入手机端（目前可在网页端操作）。
          </Muted>
        </Card>
      ) : (
        choices.map((p) => (
          <Card key={p.id}>
            <View style={styles.legendHead}>
              <View style={[styles.swatch, { backgroundColor: p.color }]} />
              <Text style={styles.legendTitle}>{p.choiceLabel}</Text>
              {typeof p.feasibility === "number" ? (
                <Text style={styles.feasibility}>约 {p.feasibility}%</Text>
              ) : null}
            </View>
            {p.summary ? <Muted style={{ marginTop: 6 }}>{p.summary}</Muted> : null}
            {p.feasibilityNote ? (
              <Text style={styles.feasNote}>可行度依据：{p.feasibilityNote}</Text>
            ) : null}
          </Card>
        ))
      )}

      {choices.length > 0 ? (
        <Text style={styles.disclaimer}>可行度为 AI 粗估，非精确概率；随你的实际进度上升。</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space, paddingBottom: 48 },
  h1: { fontSize: 30, fontWeight: "700", color: colors.fg, marginBottom: 6 },
  panel: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: DARK.bg,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.fg, marginBottom: 4 },
  legendHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.fg },
  feasibility: { fontSize: 14, fontWeight: "700", color: colors.accent },
  feasNote: { fontSize: 12, color: colors.fgMuted, marginTop: 6 },
  disclaimer: { fontSize: 12, color: colors.fgMuted, marginTop: 4, textAlign: "center" },
});
