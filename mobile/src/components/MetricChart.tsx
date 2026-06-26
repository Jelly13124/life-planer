// 单领域指标小卡:某方面(0-100)随年龄的折线。详情页五领域各一张。纯展示,无动画。
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import type { MetricPoint } from "@lifeplanner/core/types";
import { colors, radii } from "../theme";

const H = 56;
const PAD = 6;

function buildPath(points: MetricPoint[], w: number): string {
  if (points.length === 0) return "";
  const ages = points.map((p) => p.age);
  const minA = Math.min(...ages);
  const maxA = Math.max(...ages);
  const spanA = Math.max(1, maxA - minA);
  const x = (a: number) => PAD + ((a - minA) / spanA) * (w - PAD * 2);
  const y = (v: number) => PAD + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - PAD * 2);
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.age).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");
}

export function MetricChart({
  label,
  points,
  color,
  width = 150,
}: {
  label: string;
  points: MetricPoint[];
  color: string;
  width?: number;
}) {
  const last = points.length ? points[points.length - 1].value : null;
  const d = buildPath(points, width);
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        {last != null ? <Text style={[styles.val, { color }]}>{Math.round(last)}</Text> : null}
      </View>
      <Svg width={width - 20} height={H}>
        {/* 50 基准线 */}
        <Line
          x1={PAD}
          y1={PAD + (1 - 0.5) * (H - PAD * 2)}
          x2={width - 20 - PAD}
          y2={PAD + (1 - 0.5) * (H - PAD * 2)}
          stroke={colors.line}
          strokeWidth={1}
          strokeDasharray="3 5"
        />
        {d ? <Path d={buildPath(points, width - 20)} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 10,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "600", color: colors.fg },
  val: { fontSize: 15, fontWeight: "700" },
});
