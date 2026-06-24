// 今日屏：今天该做的一次性任务 ∪ 到期习惯，勾选完成 → 喂连续天数。
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GOAL_AREA_LABELS } from "@lifeplanner/core/types";
import { useApp } from "../state/store";
import { Card, Checkbox, Dot, Muted, SectionTitle } from "../ui";
import { colors, AREA_COLORS, space } from "../theme";

export default function TodayScreen() {
  const { today, todayRows, streak, toggleTodayDone } = useApp();
  const doneCount = todayRows.filter((r) => r.doneToday).length;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.h1}>今日</Text>
      <View style={styles.metaRow}>
        <Muted>{today}</Muted>
        <View style={styles.streakChip}>
          <Dot color={colors.accent} />
          <Text style={styles.streakText}>连续 {streak} 天</Text>
        </View>
      </View>

      {todayRows.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>今天还没有安排</Text>
          <Muted>去「目标」把任务加到今天，或添加每日习惯。</Muted>
        </Card>
      ) : (
        <>
          <SectionTitle>
            待办 · {doneCount}/{todayRows.length}
          </SectionTitle>
          {todayRows.map((row) => {
            const areaColor =
              row.goal ? AREA_COLORS[row.goal.area] : colors.fgMuted;
            const text = "text" in row.item ? row.item.text : "";
            return (
              <Card key={row.item.id} style={styles.rowCard}>
                <Checkbox
                  checked={row.doneToday}
                  accent={areaColor}
                  onPress={() => toggleTodayDone(row.item.id, row.doneToday)}
                />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowText, row.doneToday && styles.rowTextDone]}>{text}</Text>
                  <View style={styles.rowMeta}>
                    <Dot color={areaColor} />
                    <Muted>
                      {row.goal ? `${GOAL_AREA_LABELS[row.goal.area]} · ${row.goal.title}` : "无目标"}
                      {row.kind === "habit" ? " · 习惯" : ""}
                    </Muted>
                  </View>
                </View>
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space, paddingBottom: 48 },
  h1: { fontSize: 30, fontWeight: "700", color: colors.fg, marginBottom: 6 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  streakText: { color: colors.accent, fontWeight: "600", fontSize: 13 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.fg, marginBottom: 4 },
  rowCard: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  rowBody: { flex: 1 },
  rowText: { fontSize: 16, color: colors.fg, lineHeight: 22 },
  rowTextDone: { textDecorationLine: "line-through", color: colors.fgMuted },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
});
