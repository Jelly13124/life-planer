// 人生树（只读预测地图）—— 与网页端 LifeMap 一致：从「现在」原点分叉出的彩色曲线树。
// 复用 web 同一套 mapLayout 几何（曲线形状/分叉/节点完全相同），用 react-native-svg 渲染。
// 动画：曲线自绘入场（staggered）+ 原点呼吸；横向可滚动看更远的年龄。点曲线 → 和未来的自己聊。
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, {
  Path,
  Circle,
  Line,
  Text as SvgText,
  Rect,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from "react-native-svg";
import type { LifePath } from "@lifeplanner/core/types";
import { isEnriched } from "@lifeplanner/core/pathEnriched";
import { effectiveFeasibility } from "@lifeplanner/core/feasibility";
import { layoutMap } from "../lib/mapLayout";
import { shareCard } from "../lib/shareCard";
import { useApp } from "../state/store";
import { Button, Card, Input, Muted } from "../ui";
import { colors, radii, space } from "../theme";
import PredictingOverlay from "../components/PredictingOverlay";
import { Icon } from "../components/icons";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// 暗色「媒体面板」配色（对应 web 的 .lp-media-dark）。
const DARK = {
  bg: "#0e0e12",
  bgGlow: "#15131c",
  grid: "#23232c",
  axis: "#33333d",
  statusQuo: "#7681a3",
  text: "#f2f2f5",
  textMuted: "#9a9aa6",
  textFaint: "#6b6b78",
};

const DASH = 3000; // 自绘用的 dash 长度（> 任一曲线长度，保证不重复）
const PANEL_H = 360; // 面板固定高度；宽度按布局比例算，横向滚动

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
function roundFeasibility(x: number): number {
  return Math.round(x / 5) * 5;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduce(v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

export default function TreeScreen() {
  const {
    tree,
    addChoiceBranch,
    addChoiceBranchAt,
    removeBranch,
    enriching,
    chosenPathId,
    streak,
    freezesLeft,
    freezeNotice,
    clearFreezeNotice,
  } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const [label, setLabel] = useState("");
  const [forkSheet, setForkSheet] = useState<{ parentId: string; age: number } | null>(null);
  const [forkText, setForkText] = useState("");
  const [predictingLabel, setPredictingLabel] = useState<string | undefined>(undefined); // 正在推演的选择标签（提交后输入框会被清空，需单独存一份给蒙层用）
  const [overlayDismissed, setOverlayDismissed] = useState(false); // 用户点掉推演蒙层（AI 在后台继续），防止慢/卡的推演盖死整棵树
  const [anim] = useState(() => new Animated.Value(0)); // 曲线自绘进度 0→1
  const [pulse] = useState(() => new Animated.Value(0)); // 原点呼吸
  const [streakScale] = useState(() => new Animated.Value(1)); // 连击数字：上升时轻微放大回弹
  const prevStreakRef = useRef(streak);

  // 连续天数上升时轻微放大回弹一下（reduce motion 时跳过）。
  useEffect(() => {
    if (streak > prevStreakRef.current && !reduce) {
      streakScale.setValue(1);
      Animated.sequence([
        Animated.spring(streakScale, { toValue: 1.15, useNativeDriver: true, speed: 20, bounciness: 8 }),
        Animated.spring(streakScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
      ]).start();
    }
    prevStreakRef.current = streak;
  }, [streak, reduce, streakScale]);

  // 自动补签提示：轻提示，~3s 后自动消失。
  useEffect(() => {
    if (!freezeNotice) return;
    const t = setTimeout(clearFreezeNotice, 3000);
    return () => clearTimeout(t);
  }, [freezeNotice, clearFreezeNotice]);

  // 几何布局（与 web 完全一致；tree 为空时 null，hooks 仍无条件调用）。
  const layout = useMemo(
    () => (tree ? layoutMap(tree.paths, tree.profile.age, tree.horizonYears, {}) : null),
    [tree],
  );
  const itemCount = layout?.items.length ?? 0;

  // 自绘入场：路径数变化时重跑。
  useEffect(() => {
    if (reduce) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    const a = Animated.timing(anim, {
      toValue: 1,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // strokeDashoffset 非 transform，须走 JS 驱动
    });
    a.start();
    return () => a.stop();
  }, [anim, reduce, itemCount]);

  // 原点呼吸（reduced motion 时静止）。
  useEffect(() => {
    if (reduce) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);

  const submitBranch = () => {
    if (!label.trim()) return;
    setPredictingLabel(label.trim());
    setOverlayDismissed(false);
    addChoiceBranch(label);
    setLabel("");
  };

  const submitFork = () => {
    if (!forkSheet || !forkText.trim()) return;
    setPredictingLabel(forkText.trim());
    setOverlayDismissed(false);
    addChoiceBranchAt(forkSheet.parentId, forkSheet.age, forkText);
    setForkText("");
    setForkSheet(null);
  };
  const confirmRemove = (p: LifePath) =>
    Alert.alert("删除这条路", `删除「${p.choiceLabel}」分支？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => removeBranch(p.id) },
    ]);

  if (!tree || !layout) return null;

  const choices = tree.paths.filter((p) => p.kind === "choice");
  const name = tree.profile.name || "你";

  // 晒人生树：取可行度最高的前 3 条选择路。
  // 只把 AI 已确认的路带可行度上卡（与详情页的展示口径一致：eff.value 含行动加成）；
  // 一条都没推演过 → 退化为只有标签、不带百分比（本地占位可行度绝不外泄）。
  const handleShareTree = () => {
    const enriched = choices.filter((p) => isEnriched(p));
    const ranked = enriched
      .map((p) => ({ p, v: effectiveFeasibility(tree, p)?.value ?? p.feasibility ?? 0 }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map(({ p, v }) => ({ label: p.choiceLabel, feasibility: v }));
    const top = ranked.length > 0 ? ranked : choices.slice(0, 3).map((p) => ({ label: p.choiceLabel }));
    void shareCard(
      { kind: "tree", title: "我的人生树", name: tree.profile.name || undefined, items: top },
      "这是我的人生树，三条可能的路：",
    );
  };

  // 渲染尺寸：固定高度，宽度按布局宽高比，横向滚动看更远年龄。
  const renderH = PANEL_H;
  const renderW = Math.max(width - space * 2, renderH * (layout.width / layout.height));
  const { origin } = layout;

  const pulseR = pulse.interpolate({ inputRange: [0, 1], outputRange: [10, 20] });
  const pulseO = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.05] });

  // 年龄刻度（每 ~5 年）。
  const ticks: number[] = [];
  {
    const stepYears =
      layout.maxAge - layout.minAge > 24 ? 5 : layout.maxAge - layout.minAge > 10 ? 3 : 2;
    for (let a = layout.minAge; a <= layout.maxAge + 0.001; a += stepYears) ticks.push(a);
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space }]}>
      <Text style={styles.h1}>人生树</Text>
      <Muted style={{ marginBottom: 14 }}>
        从「现在」分叉出的每条路 · 点下方卡片(或曲线)看这条路的未来 · 点节点在那年加岔路 · 左右滑看更远
      </Muted>

      {/* 自动补签提示：漏签时补签卡自动桥接连击，~3s 后自动消失 */}
      {freezeNotice ? (
        <View style={styles.freezeBanner}>
          <Text style={styles.freezeBannerText}>{freezeNotice}</Text>
        </View>
      ) : null}

      {/* 连击条：新用户（无连击且补签卡未用）不展示，避免噪音 */}
      {streak > 0 || freezesLeft < 2 ? (
        <View style={styles.streakRow}>
          <View style={styles.streakLeft}>
            <Icon name="fire" size={18} color="#c77600" />
            <Animated.Text style={[styles.streakText, { transform: [{ scale: streakScale }] }]}>
              连续 {streak} 天
            </Animated.Text>
          </View>
          <Muted>补签卡 ×{freezesLeft}</Muted>
        </View>
      ) : null}

      {/* 晒人生树：至少有一条选择路径时才给分享入口 */}
      {choices.length > 0 ? (
        <Pressable
          onPress={handleShareTree}
          hitSlop={8}
          style={({ pressed }) => [styles.shareTreeLink, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.shareTreeLinkText}>晒我的人生树 ›</Text>
        </Pressable>
      ) : null}

      {/* 暗色媒体面板 + 分支地图（横向可滚动） */}
      <View style={styles.panel}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Svg width={renderW} height={renderH} viewBox={`0 0 ${layout.width} ${layout.height}`}>
            <Defs>
              <LinearGradient id="lm-panel" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={DARK.bgGlow} />
                <Stop offset="0.6" stopColor={DARK.bg} />
                <Stop offset="1" stopColor={DARK.bg} />
              </LinearGradient>
              {layout.items.map((p) =>
                p.kind === "status-quo" ? null : (
                  <RadialGradient key={`g-${p.id}`} id={`lm-glow-${p.id}`} cx="0.5" cy="0.5" r="0.5">
                    <Stop offset="0" stopColor={hexToRgba(p.color, 0.6)} />
                    <Stop offset="1" stopColor={hexToRgba(p.color, 0)} />
                  </RadialGradient>
                ),
              )}
            </Defs>

            <Rect x={0} y={0} width={layout.width} height={layout.height} fill="url(#lm-panel)" />

            {/* 年龄刻度（极淡竖虚线 + 标签） */}
            {ticks.map((age) => {
              const tx = layout.xFor(age);
              return (
                <React.Fragment key={`t-${age}`}>
                  <Line
                    x1={tx}
                    y1={origin.y - layout.height * 0.4}
                    x2={tx}
                    y2={origin.y + layout.height * 0.4}
                    stroke={DARK.grid}
                    strokeWidth={1}
                    strokeDasharray="2 10"
                  />
                  <SvgText x={tx} y={layout.height - 24} fill={DARK.textFaint} fontSize={17} textAnchor="middle">
                    {age}岁
                  </SvgText>
                </React.Fragment>
              );
            })}

            {/* 路径：先 halo 后主线，choice 自绘入场；status-quo 灰色虚线静态 */}
            {layout.items.map((p, i) => {
              const isSq = p.kind === "status-quo";
              const color = isSq ? DARK.statusQuo : p.color;
              const slot = itemCount > 1 ? i / itemCount : 0;
              const offset = anim.interpolate({
                inputRange: [slot * 0.55, Math.min(1, slot * 0.55 + 0.45)],
                outputRange: [DASH, 0],
                extrapolate: "clamp",
              });
              return (
                <React.Fragment key={p.id}>
                  {/* 透明加粗命中区：点曲线 → 聊未来 */}
                  <Path
                    d={p.dPath}
                    stroke="transparent"
                    strokeWidth={34}
                    fill="none"
                    onPress={() => router.push(`/path/${p.id}`)}
                  />
                  {isSq ? (
                    <Path
                      d={p.dPath}
                      stroke={color}
                      strokeWidth={3}
                      strokeDasharray="9 9"
                      strokeLinecap="round"
                      fill="none"
                    />
                  ) : (
                    <>
                      {/* 光晕 halo */}
                      <AnimatedPath
                        d={p.dPath}
                        stroke={hexToRgba(p.color, 0.22)}
                        strokeWidth={11}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={DASH}
                        strokeDashoffset={offset}
                      />
                      {/* 主线 */}
                      <AnimatedPath
                        d={p.dPath}
                        stroke={color}
                        strokeWidth={4}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={DASH}
                        strokeDashoffset={offset}
                      />
                    </>
                  )}

                  {/* 节点（沿曲线的小点）：点它 = 在这一年加一条岔路 */}
                  {p.nodes.map((n, ni) =>
                    ni === 0 ? null : (
                      <React.Fragment key={`${p.id}-n-${n.age}`}>
                        <Circle
                          cx={n.x}
                          cy={n.y}
                          r={18}
                          fill="transparent"
                          onPress={() => setForkSheet({ parentId: p.id, age: n.age })}
                        />
                        <Circle cx={n.x} cy={n.y} r={4} fill={DARK.bg} stroke={color} strokeWidth={2} />
                      </React.Fragment>
                    ),
                  )}

                  {/* 终点：光晕 + 实心点 + 标签（choice 带可行度） */}
                  {!isSq && (
                    <Circle cx={p.end.x} cy={p.end.y} r={16} fill={`url(#lm-glow-${p.id})`} />
                  )}
                  <Circle cx={p.end.x} cy={p.end.y} r={isSq ? 5 : 6} fill={color} />
                  {/* 终点命中区不在这里画：统一挪到最上层(见下方 endpoint hit layer)，
                      否则先渲染的「维持现状」末端会被后画的彩色路命中层盖住、点不动。 */}
                  <SvgText
                    x={p.end.x + 16}
                    y={p.end.y - 2}
                    fill={isSq ? DARK.textMuted : DARK.text}
                    fontSize={19}
                    fontWeight="700"
                  >
                    {(p.id === chosenPathId ? "✓ " : "") + truncate(p.choiceLabel, 10)}
                  </SvgText>
                  <SvgText x={p.end.x + 16} y={p.end.y + 20} fill={DARK.textMuted} fontSize={15}>
                    {truncate(p.summary, 16)}
                  </SvgText>
                  {!isSq && typeof p.feasibility === "number" && (
                    <SvgText x={p.end.x + 16} y={p.end.y + 40} fill={DARK.textFaint} fontSize={14}>
                      约 {roundFeasibility(p.feasibility)}%
                    </SvgText>
                  )}
                </React.Fragment>
              );
            })}

            {/* 原点：呼吸光晕 + 「现在 · 名字」 */}
            <AnimatedCircle cx={origin.x} cy={origin.y} r={pulseR} fill="#ffffff" opacity={pulseO} />
            <Circle cx={origin.x} cy={origin.y} r={9} fill={DARK.bg} stroke="#fff" strokeWidth={2.5} />
            <SvgText x={origin.x} y={origin.y - 22} fill={DARK.text} fontSize={17} fontWeight="700" textAnchor="middle">
              现在
            </SvgText>
            <SvgText x={origin.x} y={origin.y + 32} fill={DARK.textMuted} fontSize={15} textAnchor="middle">
              {truncate(name, 8)}
            </SvgText>

            {/* 终点命中层(最上层)：每条路的末端圆点 + 文字标签都做成触控区，
                统一画在所有路径之上，保证「维持现状」的末端也点得中(它先渲染，
                否则会被后画的彩色路命中区盖住)。全透明，不改变观感。 */}
            {layout.items.map((p) => (
              <React.Fragment key={`hit-${p.id}`}>
                <Circle
                  cx={p.end.x}
                  cy={p.end.y}
                  r={26}
                  fill="transparent"
                  onPress={() => router.push(`/path/${p.id}`)}
                />
                <Rect
                  x={p.end.x + 6}
                  y={p.end.y - 22}
                  width={168}
                  height={48}
                  fill="transparent"
                  onPress={() => router.push(`/path/${p.id}`)}
                />
              </React.Fragment>
            ))}
          </Svg>
        </ScrollView>
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
      </Card>

      {/* 路径清单 */}
      {choices.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>暂时只有「维持现状」</Text>
          <Muted>
            上面加一条人生选择，地图上就会长出不同的彩色分支。（离线即时推演；接入后端后会换成更贴近你的 AI 预测 + 现实可行度。）
          </Muted>
        </Card>
      ) : (
        choices.map((p) => (
          <Card key={p.id}>
            <Pressable onPress={() => router.push(`/path/${p.id}`)}>
              <View style={styles.legendHead}>
                <View style={[styles.swatch, { backgroundColor: p.color }]} />
                <Text style={styles.legendTitle}>{(p.id === chosenPathId ? "✓ " : "") + p.choiceLabel}</Text>
                {typeof p.feasibility === "number" ? (
                  <Text style={styles.feasibility}>约 {p.feasibility}%</Text>
                ) : null}
              </View>
              {p.summary ? <Muted style={{ marginTop: 6 }}>{p.summary}</Muted> : null}
              {p.feasibilityNote ? (
                <Text style={styles.feasNote}>可行度依据：{p.feasibilityNote}</Text>
              ) : null}
              <Text style={styles.detailHint}>查看这条路的未来（指标 · 情景 · 关键时刻）›</Text>
            </Pressable>
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

      {/* AI 推演中：全屏动画蒙层（加岔路 / 首次建图时） */}
      <PredictingOverlay
        visible={enriching && !overlayDismissed}
        label={predictingLabel}
        onDismiss={() => setOverlayDismissed(true)}
      />

      {/* 点节点 → 在那一年加岔路 */}
      <Modal visible={!!forkSheet} transparent animationType="fade" onRequestClose={() => setForkSheet(null)}>
        <Pressable style={styles.forkBg} onPress={() => setForkSheet(null)}>
          <Pressable style={styles.forkCard} onPress={() => {}}>
            <Text style={styles.composerTitle}>
              在这里加一条岔路{forkSheet ? `（${forkSheet.age} 岁）` : ""}
            </Text>
            <Muted style={{ marginBottom: 10 }}>从这一年分出一条新的人生路。</Muted>
            <Input
              value={forkText}
              onChangeText={setForkText}
              placeholder="这条路是…"
              autoFocus
              onSubmitEditing={submitFork}
              returnKeyType="done"
            />
            <View style={{ height: 10 }} />
            <Button label="推演这条路" onPress={submitFork} disabled={!forkText.trim()} />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space, paddingBottom: 48 },
  h1: { fontSize: 30, fontWeight: "700", color: colors.fg, marginBottom: 6 },
  panel: {
    height: PANEL_H,
    borderRadius: 16,
    borderCurve: "continuous",
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: DARK.bg,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  streakLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  streakText: { fontSize: 15, fontWeight: "700", color: colors.fg },
  freezeBanner: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  freezeBannerText: { color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center" },
  shareTreeLink: { alignSelf: "flex-start", marginBottom: 14 },
  shareTreeLinkText: { fontSize: 13, fontWeight: "600", color: colors.accent },
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
  detailHint: { fontSize: 13, fontWeight: "600", color: colors.accent, marginTop: 10 },
  removeBranchText: { fontSize: 13, color: colors.danger },
  legendHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.fg },
  feasibility: { fontSize: 14, fontWeight: "700", color: colors.accent },
  feasNote: { fontSize: 12, color: colors.fgMuted, marginTop: 6 },
  disclaimer: { fontSize: 12, color: colors.fgMuted, marginTop: 4, textAlign: "center" },
  forkBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", paddingHorizontal: 28 },
  forkCard: { backgroundColor: "#fff", borderRadius: 16, borderCurve: "continuous", padding: 18 },
});
