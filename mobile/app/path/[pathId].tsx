// 岔路详情(完整预测展示)—— 对齐网页 PathDetail 的预测部分:
// 头部 + 现实可行度 + 高光/平稳/低谷三情景(带可能性比率)+ 五领域指标曲线 + 关键时刻时间线 + 聊天入口。
// 不含:把这条路变成计划/复盘、补充信息重推(本轮不做)。
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AREA_LABELS,
  DIMENSION_LABELS,
  LIFE_AREAS,
  type Mood,
  type Scenario,
} from "@lifeplanner/core/types";
import { effectiveFeasibility } from "@lifeplanner/core/feasibility";
import { scenarioOdds } from "@lifeplanner/core/scenarioOdds";
import { isEnriched } from "@lifeplanner/core/pathEnriched";
import { useApp } from "../../src/state/store";
import { futureAgeOf } from "../../src/lib/api";
import { MetricChart } from "../../src/components/MetricChart";
import { colors, space, radii } from "../../src/theme";

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "optimistic", label: "高光" },
  { value: "likely", label: "平稳" },
  { value: "conservative", label: "低谷" },
];
const MOOD_COLOR: Record<Mood, string> = { high: "#0f9d6a", mid: "#c77600", low: "#e84a6f" };
const MOOD_LABEL: Record<Mood, string> = { high: "高光", mid: "平稳", low: "低谷" };
const round5 = (n: number) => Math.round(n / 5) * 5;

export default function PathDetailScreen() {
  const { pathId } = useLocalSearchParams<{ pathId: string }>();
  const app = useApp();
  const { tree, addScenario, enriching, decomposing } = app;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const path = tree?.paths.find((p) => p.id === pathId) ?? null;
  const isChosen = app.chosenPathId === path?.id;
  const linkedGoals = app.longGoals.filter((g) => g.pathId === path?.id && g.status === "active");

  const [scenario, setScenario] = useState<Scenario | null>(path?.scenario ?? null);

  useEffect(() => {
    setScenario(path?.scenario ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path?.id]);

  const variantFor = (s: Scenario) =>
    path
      ? tree?.paths.find(
          (p) =>
            p.kind === path.kind &&
            p.choiceLabel === path.choiceLabel &&
            p.parentId === path.parentId &&
            p.scenario === s,
        )
      : undefined;

  // 预取:首次进入时若基础路径已推演完成,提前把另外两种情景生成好,
  // 让三个 tab 切换时都能立刻显示,不用等一次生成。
  useEffect(() => {
    if (!path || !isEnriched(path)) return;
    (["optimistic", "conservative"] as const).forEach((s) => {
      if (!variantFor(s)) addScenario(path.id, s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path?.id, path?.enriched]);

  if (!tree || !path) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>这条路找不到了。</Text>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginTop: 12 }}>
          <Text style={styles.back}>‹ 返回人生树</Text>
        </Pressable>
      </View>
    );
  }

  // 「维持现状」也是一条可选人生路线：和 choice 一样能选定、看三种可能、拆计划。
  const isRoute = path.kind === "choice" || path.kind === "status-quo";
  const eff = effectiveFeasibility(tree, path);
  const odds = scenarioOdds(eff?.value ?? path.feasibility);
  const shownPath = (scenario ? variantFor(scenario) : undefined) ?? path;

  const pickScenario = (s: Scenario) => {
    setScenario(s);
    if (!variantFor(s)) addScenario(path.id, s);
  };

  const chartW = Math.min(170, (width - space * 2 - 12) / 2);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Text style={styles.back}>‹ 返回人生树</Text>
      </Pressable>

      {/* 头部 */}
      <View style={styles.headRow}>
        <View style={[styles.dot, { backgroundColor: shownPath.color }]} />
        <Text style={styles.title}>{path.choiceLabel}</Text>
      </View>
      {shownPath.summary ? <Text style={styles.summary}>{shownPath.summary}</Text> : null}
      <View style={styles.indexPill}>
        <Text style={styles.indexLabel}>{tree.profile.name || "你"} 的综合人生指数 · </Text>
        <Text style={[styles.indexVal, { color: shownPath.color }]}>{shownPath.endValue}</Text>
        <Text style={styles.indexLabel}>/100</Text>
      </View>
      <Text style={styles.disclaimer}>这是一种可能的人生,不是预测。数字代表综合状态感受,仅供想象参考。</Text>

      {isRoute ? (
        <View style={styles.commitBox}>
          {isChosen ? (
            <>
              <View style={styles.commitRow}>
                <Text style={styles.commitOn}>✓ 正在走这条路</Text>
                <Pressable onPress={() => app.clearChosenPath()} hitSlop={8}>
                  <Text style={styles.commitCancel}>取消</Text>
                </Pressable>
              </View>
              <Text style={styles.commitHint}>完成下面的目标任务，会把这条路的乐观未来往上推。</Text>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  app.choosePath(path.id);
                  if (linkedGoals.length === 0) void app.decomposePathIntoGoals(path.id);
                }}
                style={({ pressed }) => [styles.commitBtn, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.commitBtnText}>选这条路</Text>
              </Pressable>
              <Text style={styles.commitHint}>选定后 AI 会把它拆成几个目标，完成任务即推高乐观未来。</Text>
            </>
          )}
        </View>
      ) : null}

      {/* 现实可行度 + 三种可能的未来：仅在 AI 已确认基线（isEnriched）后展示——
          本地占位可行度只是粗估，展示出来会误导用户，所以先不展示可能性。 */}
      {isRoute && eff && isEnriched(path) ? (
        <View style={styles.feasBox}>
          <Text style={styles.feasLine}>
            现实可行度 <Text style={styles.feasVal}>约 {round5(eff.value)}%</Text>
            {path.feasibilityNote ? <Text style={styles.feasNote}> — {path.feasibilityNote}</Text> : null}
          </Text>
          {eff.bump > 0 ? (
            <Text style={styles.feasSub}>
              起步 {round5(eff.baseline)}% · <Text style={{ color: colors.success, fontWeight: "700" }}>你的行动 +{eff.bump}%</Text>
            </Text>
          ) : null}
          <Text style={styles.feasFaint}>AI 粗估,非精确概率</Text>
        </View>
      ) : null}

      {/* 推演/重试：任何未经 AI 确认的路（含「维持现状」基线）都能触发一次真 AI 推演。 */}
      {!isEnriched(path) ? (
        enriching ? (
          <Text style={styles.feasFaint}>AI 正在推演…</Text>
        ) : (
          <Pressable
            onPress={() => app.retryEnrich(path.id)}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.retryBtnText}>
              {path.kind === "status-quo" ? "推演现状" : "重试推演"}
            </Text>
          </Pressable>
        )
      ) : null}

      {isRoute && isEnriched(path) ? (
        <View style={styles.climbBox}>
          <Text style={styles.climbTitle}>三种可能的未来</Text>
          {([
            { key: "optimistic", label: "高光", color: "#0f9d6a" },
            { key: "likely", label: "平稳", color: "#c77600" },
            { key: "conservative", label: "低谷", color: "#e84a6f" },
          ] as const).map((row) => (
            <View key={row.key} style={styles.climbRow}>
              <Text style={styles.climbLabel}>{row.label}</Text>
              <View style={styles.climbTrack}>
                <View style={[styles.climbFill, { width: `${odds[row.key]}%`, backgroundColor: row.color }]} />
              </View>
              <Text style={[styles.climbPct, row.key === "optimistic" && { color: row.color, fontWeight: "800" }]}>
                {odds[row.key]}%
              </Text>
            </View>
          ))}
          {eff && eff.bump > 0 ? (
            <Text style={styles.climbNote}>你的行动已把乐观未来推高 +{eff.bump}%。</Text>
          ) : (
            <Text style={styles.climbNote}>完成挂在这条路上的任务，乐观占比会往上爬。</Text>
          )}
        </View>
      ) : null}

      {/* 三情景切换(带可能性比率——比率仅在 AI 已确认基线后展示) */}
      {isRoute ? (
        <View style={{ marginTop: 18 }}>
          <Text style={styles.sectionLabel}>换个走向看看</Text>
          <View style={styles.segRow}>
            {SCENARIOS.map((s) => {
              const active = scenario === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => pickScenario(s.value)}
                  style={({ pressed }) => [
                    styles.seg,
                    active && styles.segOn,
                    pressed && !active && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.segLabel, active && { color: "#fff" }]}>{s.label}</Text>
                  {isEnriched(path) ? (
                    <Text style={[styles.segPct, active && { color: "#fff" }]}>{odds[s.value]}%</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {isEnriched(path) ? (
            <Text style={styles.feasFaint}>概率为 AI 粗估,非精确;三者相加 = 100%。</Text>
          ) : null}
        </View>
      ) : null}

      {/* 五领域指标曲线 */}
      <Text style={[styles.sectionLabel, { marginTop: 22 }]}>各方面随时间的变化</Text>
      <View style={styles.chartGrid}>
        {LIFE_AREAS.map((a) => (
          <MetricChart key={a} label={AREA_LABELS[a]} points={shownPath.metrics[a] ?? []} color={shownPath.color} width={chartW} />
        ))}
      </View>

      {/* 关键时刻时间线 */}
      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>这条路上的关键时刻</Text>
      <View style={styles.timeline}>
        {shownPath.nodes.map((n, i) => (
          <View key={`${n.age}-${i}`} style={styles.tlRow}>
            <View style={styles.tlLeft}>
              <View style={[styles.tlDot, { backgroundColor: MOOD_COLOR[n.mood] }]} />
              {i < shownPath.nodes.length - 1 ? <View style={styles.tlSpine} /> : null}
            </View>
            <View style={styles.tlBody}>
              <View style={styles.tlHead}>
                <Text style={styles.tlAge}>{n.age} 岁</Text>
                <View style={[styles.moodTag, { backgroundColor: `${MOOD_COLOR[n.mood]}22` }]}>
                  <Text style={[styles.moodText, { color: MOOD_COLOR[n.mood] }]}>{MOOD_LABEL[n.mood]}</Text>
                </View>
              </View>
              <Text style={styles.tlTitle}>{n.title}</Text>
              {n.story ? <Text style={styles.tlStory}>{n.story}</Text> : null}
              {n.dimensions?.length ? (
                <View style={styles.dimRow}>
                  {n.dimensions.map((d) => (
                    <View key={d} style={styles.dimChip}>
                      <Text style={styles.dimText}>{DIMENSION_LABELS[d]}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {isChosen ? (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.sectionLabel}>这条路的计划</Text>
          {linkedGoals.length === 0 ? (
            <Pressable
              onPress={() => void app.decomposePathIntoGoals(path.id)}
              disabled={decomposing}
              style={({ pressed }) => [styles.planBtn, pressed && { opacity: 0.9 }, decomposing && { opacity: 0.6 }]}
            >
              <Text style={styles.planBtnText}>{decomposing ? "AI 拆解中…" : "让 AI 拆一版目标"}</Text>
            </Pressable>
          ) : (
            linkedGoals.map((g) => (
              <View key={g.id} style={styles.planRow}>
                <Text style={styles.planGoalTitle} numberOfLines={1}>{g.title}</Text>
                <Text style={styles.planGoalPct}>{app.progressOf(g)}%</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {/* 聊天入口 */}
      <Pressable
        onPress={() => router.push(`/chat/${path.id}`)}
        style={({ pressed }) => [styles.chatBtn, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.chatBtnText}>和 {futureAgeOf(path)} 岁的你聊聊</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  muted: { color: colors.fgMuted, fontSize: 15 },
  back: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { flex: 1, fontSize: 24, fontWeight: "700", color: colors.fg },
  summary: { fontSize: 15, color: colors.fgMuted, marginTop: 8, lineHeight: 21 },
  indexPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radii.pill,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  indexLabel: { fontSize: 13, color: colors.fgMuted },
  indexVal: { fontSize: 15, fontWeight: "700" },
  disclaimer: { fontSize: 12, color: colors.fgMuted, marginTop: 8, lineHeight: 18 },
  feasBox: {
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: "#fff",
    padding: 12,
  },
  feasLine: { fontSize: 14, color: colors.fg, lineHeight: 20 },
  feasVal: { fontWeight: "700", color: colors.fg },
  feasNote: { color: colors.fgMuted },
  feasSub: { fontSize: 12, color: colors.fgMuted, marginTop: 5 },
  feasFaint: { fontSize: 11, color: colors.fgMuted, marginTop: 6 },
  retryBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryBtnText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: colors.fgMuted, marginBottom: 8 },
  segRow: { flexDirection: "row", gap: 8 },
  seg: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: "#fff",
    paddingVertical: 10,
  },
  segOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  segLabel: { fontSize: 14, fontWeight: "600", color: colors.fg },
  segPct: { fontSize: 12, color: colors.fgMuted, marginTop: 2 },
  chartGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  timeline: { marginTop: 4 },
  tlRow: { flexDirection: "row", gap: 12 },
  tlLeft: { width: 16, alignItems: "center" },
  tlDot: { width: 14, height: 14, borderRadius: 7, marginTop: 3 },
  tlSpine: { width: 2, flex: 1, backgroundColor: colors.line, marginTop: 3 },
  tlBody: { flex: 1, paddingBottom: 22 },
  tlHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  tlAge: { fontSize: 14, fontWeight: "700", color: colors.fg },
  moodTag: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  moodText: { fontSize: 11, fontWeight: "600" },
  tlTitle: { fontSize: 15, fontWeight: "600", color: colors.fg, marginTop: 4 },
  tlStory: { fontSize: 14, color: colors.fgMuted, marginTop: 4, lineHeight: 20 },
  dimRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  dimChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#fff",
  },
  dimText: { fontSize: 10, color: colors.fgMuted },
  chatBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  chatBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  commitBox: { marginTop: 14 },
  commitRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commitOn: { fontSize: 16, fontWeight: "700", color: "#0f9d6a" },
  commitCancel: { fontSize: 13, color: colors.fgMuted },
  commitBtn: { backgroundColor: colors.accent, borderRadius: radii.sm, paddingVertical: 13, alignItems: "center" },
  commitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  commitHint: { fontSize: 12, color: colors.fgMuted, marginTop: 6, lineHeight: 17 },
  climbBox: { marginTop: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radii.md, backgroundColor: "#fff", padding: 14 },
  climbTitle: { fontSize: 13, fontWeight: "700", color: colors.fg, marginBottom: 10 },
  climbRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  climbLabel: { width: 32, fontSize: 13, color: colors.fg },
  climbTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: "#eee", overflow: "hidden" },
  climbFill: { height: 10, borderRadius: 5 },
  climbPct: { width: 44, textAlign: "right", fontSize: 13, color: colors.fg },
  climbNote: { fontSize: 12, color: colors.fgMuted, marginTop: 4 },
  planBtn: { borderWidth: 1, borderColor: colors.accent, borderRadius: radii.sm, paddingVertical: 12, alignItems: "center" },
  planBtnText: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  planRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  planGoalTitle: { flex: 1, fontSize: 15, color: colors.fg },
  planGoalPct: { fontSize: 13, fontWeight: "700", color: colors.accent, marginLeft: 12 },
});
