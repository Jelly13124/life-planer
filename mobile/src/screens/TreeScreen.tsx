// 人生树（只读预测视图）—— 路线 A 的核心差异化屏。
// 把每条人生路径画成「综合人生指数」随年龄变化的曲线：维持现状=灰色虚线，
// 选择路径=彩色实线，终点标注现实可行度 %。曲线由各领域指标按年龄平均得到（真实数据，非编造）。
//
// 这里是只读视图：加分支需要 AI 推演（predictAndCommit），那条链路在 Phase 3 后续/网页端。
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, {
  Path,
  Line,
  Circle,
  Text as SvgText,
  Rect,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  G,
} from "react-native-svg";
import { LIFE_AREAS, type LifePath } from "@lifeplanner/core/types";
import { useApp } from "../state/store";
import { Button, Card, Input, Muted, SkeletonCard } from "../ui";
import { colors, space } from "../theme";

// 暗色「媒体面板」配色（对应 web 的 .lp-media-dark）。
const DARK = {
  bg: "#0e0e12",
  bgGlow: "#15131c", // 顶部细微暖晕，避免死黑
  grid: "#23232c",
  gridMid: "#2c2c37",
  axis: "#33333d",
  statusQuo: "#6f6f7e",
  text: "#f2f2f5",
  textMuted: "#9a9aa6",
  textFaint: "#6b6b78",
};

// 把 #rrggbb 转成 rgba()，用于渐变填充与光晕（react-native-svg 用 stopOpacity 也行，
// 但显式 rgba 更直观且跨平台一致）。
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

// Catmull-Rom → 三次贝塞尔：把离散点连成顺滑曲线（确定性，无随机）。
// tension 控制弯曲程度；0.16 给出温和、不过冲的弧度。
function smoothPath(pts: { px: number; py: number }[], tension = 0.16): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].px.toFixed(2)} ${pts[0].py.toFixed(2)}`;
  let d = `M ${pts[0].px.toFixed(2)} ${pts[0].py.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.px + (p2.px - p0.px) * tension;
    const c1y = p1.py + (p2.py - p0.py) * tension;
    const c2x = p2.px - (p3.px - p1.px) * tension;
    const c2y = p2.py - (p3.py - p1.py) * tension;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.px.toFixed(2)} ${p2.py.toFixed(2)}`;
  }
  return d;
}

export default function TreeScreen() {
  const { tree, addChoiceBranch, removeBranch, enriching } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [label, setLabel] = useState("");

  const submitBranch = () => {
    if (!label.trim()) return;
    addChoiceBranch(label);
    setLabel("");
  };

  const confirmRemove = (p: LifePath) =>
    Alert.alert("删除这条路", `删除「${p.choiceLabel}」分支？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => removeBranch(p.id) },
    ]);

  const { width } = useWindowDimensions();

  if (!tree) return null;

  const paths = tree.paths;
  const statusQuo = paths.find((p) => p.kind === "status-quo");
  const choices = paths.filter((p) => p.kind === "choice");

  const minAge = tree.profile.age;
  const maxAge = tree.profile.age + tree.horizonYears;

  // 画布尺寸（面板内）。
  const W = Math.max(280, width - space * 2 - 2); // 减去外边距 + 卡片描边
  const H = 280;
  const padL = 18;
  const padR = 22;
  const padT = 22;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const baselineY = padT + plotH; // 面积填充的底边

  const x = (age: number) =>
    padL + ((age - minAge) / Math.max(1, maxAge - minAge)) * plotW;
  const y = (v: number) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH;

  // 把数据点映射到像素坐标。
  const toPx = (pts: { age: number; value: number }[]) =>
    pts.map((p) => ({ px: x(p.age), py: y(p.value) }));

  // 平滑曲线 d。
  const lineD = (pts: { age: number; value: number }[]) => smoothPath(toPx(pts));

  // 曲线下方面积 d：沿平滑线 → 落到底边 → 回到起点。
  const areaD = (pts: { age: number; value: number }[]) => {
    const px = toPx(pts);
    if (px.length < 2) return "";
    const top = smoothPath(px);
    const first = px[0];
    const last = px[px.length - 1];
    return `${top} L ${last.px.toFixed(2)} ${baselineY.toFixed(2)} L ${first.px.toFixed(2)} ${baselineY.toFixed(2)} Z`;
  };

  const ageTicks = [minAge, Math.round((minAge + maxAge) / 2), maxAge];
  const gridLines = [25, 50, 75, 100];

  const statusPts = statusQuo ? compositePoints(statusQuo) : [];
  const statusStart = statusPts[0];

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space }]}>
      <Text style={styles.h1}>人生树</Text>
      <Muted style={{ marginBottom: 14 }}>
        每条线是一种可能的人生走向 · 纵轴为综合人生指数，横轴为年龄
      </Muted>

      {/* 暗色媒体面板 + SVG 曲线 */}
      <View style={styles.panel}>
        <Svg width={W} height={H}>
          <Defs>
            {/* 面板背景：自上而下极淡的暖晕 → 死黑，给画面纵深 */}
            <LinearGradient id="lp-panel" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={DARK.bgGlow} />
              <Stop offset="0.55" stopColor={DARK.bg} />
              <Stop offset="1" stopColor={DARK.bg} />
            </LinearGradient>
            {/* 维持现状面积：极淡灰 */}
            <LinearGradient id="lp-area-sq" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={hexToRgba(DARK.statusQuo, 0.1)} />
              <Stop offset="1" stopColor={hexToRgba(DARK.statusQuo, 0)} />
            </LinearGradient>
            {/* 每条选择路径一套渐变（面积填充 + 终点光晕） */}
            {choices.map((p) => (
              <React.Fragment key={`def-${p.id}`}>
                <LinearGradient id={`lp-area-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={hexToRgba(p.color, 0.32)} />
                  <Stop offset="0.7" stopColor={hexToRgba(p.color, 0.06)} />
                  <Stop offset="1" stopColor={hexToRgba(p.color, 0)} />
                </LinearGradient>
                <RadialGradient id={`lp-glow-${p.id}`} cx="0.5" cy="0.5" r="0.5">
                  <Stop offset="0" stopColor={hexToRgba(p.color, 0.55)} />
                  <Stop offset="1" stopColor={hexToRgba(p.color, 0)} />
                </RadialGradient>
              </React.Fragment>
            ))}
          </Defs>

          {/* 面板底 */}
          <Rect x={0} y={0} width={W} height={H} rx={14} fill="url(#lp-panel)" />

          {/* 横向网格（很淡，50 处略亮作为「中位」参考） */}
          {gridLines.map((v) => (
            <Line
              key={v}
              x1={padL}
              y1={y(v)}
              x2={W - padR}
              y2={y(v)}
              stroke={v === 50 ? DARK.gridMid : DARK.grid}
              strokeWidth={1}
              strokeDasharray={v === 50 ? "2 6" : undefined}
            />
          ))}

          {/* 纵向引导（年龄刻度处的极淡竖线） */}
          {ageTicks.map((a) => (
            <Line
              key={`v-${a}`}
              x1={x(a)}
              y1={padT}
              x2={x(a)}
              y2={baselineY}
              stroke={DARK.grid}
              strokeWidth={1}
              strokeOpacity={0.5}
            />
          ))}

          {/* 基线（年龄轴） */}
          <Line x1={padL} y1={baselineY} x2={W - padR} y2={baselineY} stroke={DARK.axis} strokeWidth={1} />
          {ageTicks.map((a) => (
            <SvgText
              key={a}
              x={x(a)}
              y={baselineY + 18}
              fill={DARK.textFaint}
              fontSize={10.5}
              fontWeight="500"
              textAnchor={a === minAge ? "start" : a === maxAge ? "end" : "middle"}
            >
              {a}岁
            </SvgText>
          ))}

          {/* 维持现状：面积 + 灰色虚线 */}
          {statusQuo && statusPts.length > 1 ? (
            <>
              <Path d={areaD(statusPts)} fill="url(#lp-area-sq)" />
              <Path
                d={lineD(statusPts)}
                stroke={DARK.statusQuo}
                strokeWidth={1.75}
                strokeDasharray="2 6"
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : null}

          {/* 选择路径：面积渐变 + 彩色平滑实线 + 终点光晕节点 */}
          {choices.map((p) => {
            const pts = compositePoints(p);
            if (pts.length === 0) return null;
            const last = pts[pts.length - 1];
            const ex = x(last.age);
            const ey = y(last.value);
            return (
              <React.Fragment key={p.id}>
                <Path d={areaD(pts)} fill={`url(#lp-area-${p.id})`} />
                <Path
                  d={lineD(pts)}
                  stroke={p.color}
                  strokeWidth={2.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* 终点：外层柔和光晕 → 同色实心点 → 白色高光内环 */}
                <Circle cx={ex} cy={ey} r={16} fill={`url(#lp-glow-${p.id})`} />
                <Circle cx={ex} cy={ey} r={5.5} fill={p.color} />
                <Circle cx={ex} cy={ey} r={2.2} fill="#ffffff" fillOpacity={0.92} />
              </React.Fragment>
            );
          })}

          {/* 「现在」起点标记：所有路径同一起点（用维持现状的起点） */}
          {statusStart ? (
            <G>
              <Circle cx={x(statusStart.age)} cy={y(statusStart.value)} r={9} fill={hexToRgba(DARK.text, 0.08)} />
              <Circle
                cx={x(statusStart.age)}
                cy={y(statusStart.value)}
                r={3.4}
                fill={DARK.bg}
                stroke={DARK.text}
                strokeWidth={1.6}
              />
              <SvgText
                x={x(statusStart.age)}
                y={y(statusStart.value) - 14}
                fill={DARK.textMuted}
                fontSize={10}
                fontWeight="600"
                textAnchor="start"
              >
                现在
              </SvgText>
            </G>
          ) : null}
        </Svg>

        {/* 面板内图例：色块 + 路径名 + 约X%（横向滚动避免拥挤） */}
        {(choices.length > 0 || statusQuo) ? (
          <View style={styles.legend}>
            {statusQuo ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendDash, { backgroundColor: DARK.statusQuo }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  维持现状
                </Text>
              </View>
            ) : null}
            {choices.map((p) => (
              <View key={`lg-${p.id}`} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: p.color }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {p.choiceLabel}
                </Text>
                {typeof p.feasibility === "number" ? (
                  <Text style={styles.legendPct}>约{p.feasibility}%</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* 加人生选择 */}
      <Card>
        <Text style={styles.composerTitle}>加一条人生选择</Text>
        <Muted style={{ marginBottom: 10 }}>
          输入一个选择（如「去创业」「出国读研」），立刻在树上长出这条路。
        </Muted>
        <Input
          value={label}
          onChangeText={setLabel}
          placeholder="这条路是…"
          onSubmitEditing={submitBranch}
          returnKeyType="done"
        />
        <View style={{ height: 10 }} />
        <Button label="推演这条路" onPress={submitBranch} disabled={!label.trim()} />
        {enriching ? <Muted style={{ marginTop: 8, textAlign: "center" }}>AI 推演中…</Muted> : null}
      </Card>

      {/* AI 推演中：骨架占位（匹配下方路径卡形状） */}
      {enriching ? <SkeletonCard /> : null}

      {/* 路径清单 */}
      {choices.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>暂时只有「维持现状」</Text>
          <Muted>
            上面加一条人生选择，这里就会长出不同的彩色分支。（离线即时推演；接入后端后会换成更贴近你的 AI 预测 + 现实可行度。）
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
            <View style={styles.cardActions}>
              <Pressable onPress={() => router.push(`/chat/${p.id}`)} hitSlop={6}>
                <Text style={styles.chatLink}>和未来的自己聊聊 ›</Text>
              </Pressable>
              <Pressable onPress={() => confirmRemove(p)} hitSlop={6}>
                <Text style={styles.removeBranchText}>删除</Text>
              </Pressable>
            </View>
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
    borderCurve: "continuous",
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: DARK.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#26262f",
    boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    maxWidth: "100%",
  },
  legendSwatch: { width: 9, height: 9, borderRadius: 5 },
  legendDash: { width: 12, height: 2.5, borderRadius: 2 },
  legendLabel: { fontSize: 12, color: DARK.text, fontWeight: "500", flexShrink: 1 },
  legendPct: { fontSize: 12, color: DARK.textMuted, fontWeight: "600" },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.fg, marginBottom: 4 },
  composerTitle: { fontSize: 16, fontWeight: "700", color: colors.fg, marginBottom: 4 },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  chatLink: { fontSize: 14, fontWeight: "600", color: colors.accent },
  removeBranchText: { fontSize: 13, color: colors.danger },
  legendHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.fg },
  feasibility: { fontSize: 14, fontWeight: "700", color: colors.accent },
  feasNote: { fontSize: 12, color: colors.fgMuted, marginTop: 6 },
  disclaimer: { fontSize: 12, color: colors.fgMuted, marginTop: 4, textAlign: "center" },
  resetBtn: { marginTop: 32, alignItems: "center", paddingVertical: 8 },
  resetText: { fontSize: 13, color: colors.danger },
});
