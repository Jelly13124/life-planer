// 共享 UI 原子（对应 web 的 components/ui）：卡片、复选框、按钮、领域圆点、进度条、章节标题。
// 极简线条风、无 emoji。文案走中文（i18n 在 Phase 3 接）。
import React from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, radii } from "./theme";

// 读取系统「减少动态效果」开关（骨架屏脉冲据此降级为静态）。
function useReduceMotion(): boolean {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
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

// 骨架块：缓慢呼吸的占位条（载入态用，匹配最终内容形状，而非通用转圈）。
export function Skeleton({
  width = "100%",
  height = 14,
  radius = radii.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const reduce = useReduceMotion();
  const [op] = React.useState(() => new Animated.Value(0.5));
  React.useEffect(() => {
    if (reduce) {
      op.setValue(0.7);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, op]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.line, opacity: op }, style]}
    />
  );
}

// 骨架卡：标题条 + 两行正文，用于 AI 推演/建议这类异步等待。
export function SkeletonCard() {
  return (
    <Card>
      <Skeleton width="55%" height={16} />
      <View style={{ height: 12 }} />
      <Skeleton width="100%" height={12} />
      <View style={{ height: 6 }} />
      <Skeleton width="82%" height={12} />
    </Card>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

// 复选框：勾选画一个紫色对勾框，未勾是空心圆角方框。
export function Checkbox({
  checked,
  onPress,
  accent = colors.accent,
}: {
  checked: boolean;
  onPress: () => void;
  accent?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[
        styles.checkbox,
        checked ? { backgroundColor: accent, borderColor: accent } : { borderColor: colors.line },
      ]}
    >
      {checked ? <Text style={styles.checkmark}>✓</Text> : null}
    </Pressable>
  );
}

export function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

export function Progress({ value, color = colors.accent }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = "primary",
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
}) {
  const isPrimary = kind === "primary";
  const isDanger = kind === "danger";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isPrimary && styles.btnPrimary,
        kind === "ghost" && styles.btnGhost,
        isDanger && styles.btnDanger,
        disabled || loading ? { opacity: 0.5 } : null,
        pressed && !(disabled || loading) ? { opacity: 0.9, transform: [{ scale: 0.98 }] } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary || isDanger ? "#fff" : colors.accent} />
      ) : (
        <Text
          style={[
            styles.btnText,
            isPrimary && { color: "#fff" },
            isDanger && { color: "#fff" },
            kind === "ghost" && { color: colors.accent },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.fgMuted}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function Spinner() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderCurve: "continuous",
    padding: 16,
    marginBottom: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.fgMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 6,
  },
  muted: { color: colors.fgMuted, fontSize: 14, lineHeight: 20 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: { color: "#fff", fontSize: 15, fontWeight: "800", lineHeight: 17 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 3 },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radii.sm,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnGhost: { backgroundColor: "transparent" },
  btnDanger: { backgroundColor: colors.danger },
  btnText: { fontSize: 15, fontWeight: "600", color: colors.fg },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.fg,
    backgroundColor: "#fff",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
