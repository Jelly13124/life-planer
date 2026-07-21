// 全屏「正在推演」蒙层（对应 web 的 PredictionOverlay）——加岔路 / 首次建图时的等待态。
// 暗色媒体面板质感 + 主时间线分叉自绘入场 + 原点呼吸，营造「AI 正在认真计算」的观感。
// 复用 TreeScreen 的 useReduceMotion 模式：减少动态效果时渲染静态版本（曲线常亮、原点不脉动）。
import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, Text } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { colors } from "../theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DARK = {
  bg: "#0e0e12",
  bgGlow: "#1b1f3a",
  text: "#f2f2f5",
  textMuted: "#9a9aa6",
  textFaint: "#6b6b78",
};

// 三条分叉曲线：与 web PredictionOverlay 同一套配色语言（accent / fuchsia / emerald）。
const BRANCHES = [
  { d: "M 40 130 C 120 130 158 86 240 78", color: colors.accent },
  { d: "M 40 130 C 120 130 156 132 232 130", color: "#d6409f" },
  { d: "M 40 130 C 120 130 156 176 236 190", color: "#0a7d33" },
] as const;
const DASH = 260;

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

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export interface PredictingOverlayProps {
  visible: boolean;
  label?: string; // 正在推演的选择标签（可选）
  onDismiss?: () => void; // 点一下收起（AI 继续在后台跑）——防止慢/卡的推演把整棵树盖死
}

export default function PredictingOverlay({ visible, label, onDismiss }: PredictingOverlayProps) {
  const reduce = useReduceMotion();
  const [draw] = useState(() => new Animated.Value(0)); // 曲线自绘 0→1，循环
  const [pulse] = useState(() => new Animated.Value(0)); // 原点呼吸

  useEffect(() => {
    if (!visible || reduce) {
      draw.setValue(1);
      return;
    }
    draw.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(draw, {
          toValue: 1,
          duration: 1700,
          easing: Easing.bezier(0.2, 0.7, 0.2, 1),
          useNativeDriver: false, // strokeDashoffset 非 transform，须走 JS 驱动
        }),
        Animated.delay(280),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, reduce, draw]);

  useEffect(() => {
    if (!visible || reduce) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, reduce, pulse]);

  if (!visible) return null;

  const pulseR = pulse.interpolate({ inputRange: [0, 1], outputRange: [7, 13] });
  const pulseO = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <Pressable
        style={styles.root}
        onPress={onDismiss}
        accessibilityRole="alert"
        accessibilityLabel="AI 正在推演这条路"
      >
        <Svg viewBox="0 0 280 220" width={260} height={204}>
          <Defs>
            {BRANCHES.map((b, i) => (
              <RadialGradient key={`g${i}`} id={`po-glow-${i}`} cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor={b.color} stopOpacity={0.55} />
                <Stop offset="1" stopColor={b.color} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>

          {/* 现状基线：灰色虚线，恒定 */}
          <Path
            d="M 40 130 L 240 130"
            stroke="#4a4a58"
            strokeWidth={2}
            strokeDasharray="6 8"
            strokeLinecap="round"
            opacity={0.6}
          />

          {/* 三条命运分叉：依次自绘 */}
          {BRANCHES.map((b, i) => {
            const offset = reduce
              ? 0
              : draw.interpolate({
                  inputRange: [
                    Math.max(0, i * 0.18),
                    Math.min(1, i * 0.18 + 0.55),
                    1,
                  ],
                  outputRange: [DASH, 0, 0],
                  extrapolate: "clamp",
                });
            const endX = Number(b.d.split(" ").slice(-2)[0]);
            const endY = Number(b.d.split(" ").slice(-1)[0]);
            return (
              <React.Fragment key={i}>
                <AnimatedPath
                  d={b.d}
                  stroke={b.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={reduce ? undefined : DASH}
                  strokeDashoffset={reduce ? undefined : offset}
                  opacity={0.95}
                />
                <Circle cx={endX} cy={endY} r={9} fill={`url(#po-glow-${i})`} />
                <Circle cx={endX} cy={endY} r={3.5} fill={b.color} />
              </React.Fragment>
            );
          })}

          {/* 起点：呼吸脉冲的「现在」 */}
          <AnimatedCircle cx={40} cy={130} r={pulseR} fill="#ffffff" opacity={pulseO} />
          <Circle cx={40} cy={130} r={6} fill={DARK.bg} stroke="#ffffff" strokeWidth={2} />
        </Svg>

        <Text style={styles.title}>正在推演…</Text>
        <Text style={styles.sub}>AI 正在描绘这条路的未来</Text>
        {label ? <Text style={styles.label}>{truncate(label, 20)}</Text> : null}
        {onDismiss ? <Text style={styles.dismiss}>点一下继续 · AI 会在后台完成</Text> : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: DARK.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: "700",
    color: DARK.text,
    textAlign: "center",
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    color: DARK.textMuted,
    textAlign: "center",
  },
  label: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "600",
    color: DARK.textFaint,
    textAlign: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#33333d",
    overflow: "hidden",
  },
  dismiss: {
    marginTop: 22,
    fontSize: 12,
    color: DARK.textFaint,
    textAlign: "center",
  },
});
