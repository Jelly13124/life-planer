// 自定义"选时间"面板（仿 Structured）：图标 + 任务名 + 时间滚轮(显示 开始–结束 区间)
// + 持续时间滑块 + 确定。滚轮纯 RN ScrollView 吸附,不依赖 reanimated。
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import Slider from "@react-native-community/slider";
import type { GoalArea } from "@lifeplanner/core/types";
import { toMinutes, toHHMM } from "@lifeplanner/core/schedule";
import { colors, radii } from "../theme";
import { AreaTile, Icon } from "./icons";

const ROW = 48;
const VISIBLE = 5; // 奇数：中间为选中
const PAD = ROW * Math.floor(VISIBLE / 2);
const STEP = 15; // 每 15 分钟一档

// 时长 → 中文（15 分步进:整小时说"X小时",含半说"X.5小时",不足 60 说"X分钟"）。
function fmtDur(m: number): string {
  if (m < 60) return `${m} 分钟`;
  const h = m / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} 小时`;
}

// 就近档位（纯函数；供 useState 初始化用）。
function nearestIndex(times: string[], target: string, dayStart: string): number {
  const startMin = target ? toMinutes(target) : toMinutes(dayStart) + 60;
  let nearest = 0;
  let best = Infinity;
  times.forEach((t, i) => {
    const d = Math.abs(toMinutes(t) - startMin);
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  return nearest;
}

export function TimePickSheet({
  title,
  area,
  initialStart,
  initialDuration = 60,
  dayStart = "07:00",
  dayEnd = "23:00",
  onConfirm,
  onClose,
}: {
  // 由父级按需挂载（每次打开 = 全新挂载,初始档由 useState 初始化器算出）。
  title: string;
  area?: GoalArea | null;
  initialStart?: string;
  initialDuration?: number;
  dayStart?: string;
  dayEnd?: string;
  onConfirm: (start: string, durationMin: number) => void;
  onClose: () => void;
}) {
  const times = useMemo(() => {
    const out: string[] = [];
    const s = toMinutes(dayStart);
    // 退化窗兜底：睡<=醒 时退回到一整天，保证滚轮永远非空（否则 idx 越界、面板空白）。
    const e = toMinutes(dayEnd) > s ? toMinutes(dayEnd) : 24 * 60 - STEP;
    for (let m = s; m <= e; m += STEP) out.push(toHHMM(m));
    if (out.length === 0) out.push(toHHMM(s)); // 双保险：s==e 也至少一档
    return out;
  }, [dayStart, dayEnd]);

  const [idx, setIdx] = useState(() => nearestIndex(times, initialStart ?? "", dayStart));
  const [dur, setDur] = useState(initialDuration);
  const scrollRef = useRef<ScrollView>(null);

  // 仅定位滚轮到初始档（更新外部系统,非 setState）。挂载时跑一次。
  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: idx * ROW, animated: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ROW);
    if (i >= 0 && i < times.length && i !== idx) setIdx(i);
  };

  const start = times[idx] ?? dayStart;
  const end = toHHMM(toMinutes(start) + dur);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          {/* 头部 */}
          <View style={styles.head}>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="关闭"
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            >
              <Icon name="close" size={20} color={colors.fg} />
            </Pressable>
            <AreaTile area={area ?? null} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {title || "任务"}
              </Text>
              <Text style={styles.range}>
                {start} – {end} · {dur >= 60 ? `${dur / 60}小时`.replace(".5", ".5") : `${dur}分钟`}
              </Text>
            </View>
          </View>

          {/* 时间滚轮 */}
          <View style={styles.wheelWrap}>
            <View style={styles.centerBand} pointerEvents="none" />
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ROW}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={onScroll}
              contentContainerStyle={{ paddingVertical: PAD }}
            >
              {times.map((t, i) => {
                const sel = i === idx;
                return (
                  <View key={t} style={styles.timeRow}>
                    {sel ? (
                      <View style={styles.selPill}>
                        <Text style={styles.selText}>
                          {t} – {toHHMM(toMinutes(t) + dur)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.dimText}>{t}</Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* 持续时间（滑块,15 分钟 – 4 小时,15 分步进） */}
          <View style={styles.durHead}>
            <Text style={styles.durLabel}>持续时间</Text>
            <Text style={styles.durValue}>{fmtDur(dur)}</Text>
          </View>
          <Slider
            minimumValue={15}
            maximumValue={240}
            step={15}
            value={dur}
            onValueChange={setDur}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.line}
            thumbTintColor={colors.accent}
            style={styles.slider}
          />

          <Pressable
            style={({ pressed }) => [styles.confirm, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
            onPress={() => onConfirm(start, dur)}
          >
            <Text style={styles.confirmText}>确定</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderCurve: "continuous",
    padding: 18,
    paddingBottom: 32,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.fg },
  range: { fontSize: 13, color: colors.fgMuted, marginTop: 2 },
  wheelWrap: {
    height: ROW * VISIBLE,
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderCurve: "continuous",
    overflow: "hidden",
    marginBottom: 18,
    justifyContent: "center",
  },
  centerBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: PAD,
    height: ROW,
  },
  timeRow: { height: ROW, alignItems: "center", justifyContent: "center" },
  selPill: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  selText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  dimText: { color: colors.fgMuted, fontSize: 15 },
  durHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 },
  durLabel: { fontSize: 16, fontWeight: "700", color: colors.fg },
  durValue: { fontSize: 15, fontWeight: "700", color: colors.accent },
  slider: { width: "100%", height: 40, marginBottom: 12 },
  confirm: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    borderCurve: "continuous",
    paddingVertical: 15,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
