// 月历 Tab：整月日历 + 选中日的当天安排(带时间的任务/习惯 + 当天到期的目标)。
// 点某天 = 选中(不跳走);「在这天安排 ＋」才跳回首页那天加任务。
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { goalsDueOn } from "@lifeplanner/core/goals";
import { toMinutes } from "@lifeplanner/core/schedule";
import { useApp } from "../state/store";
import { MonthView } from "../components/calendar";
import { AreaTile } from "../components/icons";
import { Muted } from "../ui";
import { colors, space, radii } from "../theme";

function fmtSel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日`;
}

export default function MonthScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState(app.today);

  const vy = Number(selected.slice(0, 4));
  const vm = Number(selected.slice(5, 7));
  const timed = app
    .actionsOn(selected)
    .filter((a) => a.item.startTime)
    .sort((a, b) => toMinutes(a.item.startTime!) - toMinutes(b.item.startTime!));
  const due = app.tree ? goalsDueOn(app.tree, selected) : [];
  const overdue = selected < app.today;

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space }]}>
      <Text style={styles.h1}>月历</Text>
      <MonthView
        year={vy}
        month={vm}
        today={app.today}
        viewDate={selected}
        densityOf={(d) => app.actionsOn(d).length}
        dueOf={(d) => (app.tree ? goalsDueOn(app.tree, d).length > 0 : false)}
        onPickDay={setSelected}
        onShiftMonth={(d) => setSelected(d)}
      />

      <View style={styles.dayHead}>
        <Text style={styles.dayTitle}>
          {fmtSel(selected)}
          {selected === app.today ? " · 今天" : ""}
        </Text>
        <Pressable
          onPress={() => {
            app.setViewDate(selected);
            router.navigate("/");
          }}
          hitSlop={8}
        >
          <Text style={styles.planLink}>在这天安排 ＋</Text>
        </Pressable>
      </View>

      {due.map((g) => (
        <View key={g.id} style={styles.dueRow}>
          <View style={styles.duePill}>
            <Text style={styles.duePillText}>到期</Text>
          </View>
          <Text style={[styles.dueText, overdue && { color: colors.danger }]} numberOfLines={1}>
            「{g.title}」{overdue ? "已逾期" : "到期"}
          </Text>
        </View>
      ))}

      {timed.map((a) => (
        <View key={a.item.id} style={styles.row}>
          <Text style={styles.rowTime}>{a.item.startTime}</Text>
          <AreaTile area={a.goal ? a.goal.area : null} size={28} />
          <Text style={styles.rowTitle} numberOfLines={1}>
            {a.item.text}
          </Text>
        </View>
      ))}

      {timed.length === 0 && due.length === 0 ? (
        <Muted style={{ marginTop: 4 }}>这天还没有安排。</Muted>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space, paddingBottom: 48 },
  h1: { fontSize: 28, fontWeight: "700", color: colors.fg, marginBottom: 14 },
  dayHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 18,
    marginBottom: 8,
  },
  dayTitle: { fontSize: 17, fontWeight: "700", color: colors.fg },
  planLink: { fontSize: 14, fontWeight: "600", color: colors.accent },
  dueRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7 },
  duePill: { backgroundColor: "#c77600", borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  duePillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  dueText: { flex: 1, fontSize: 15, color: colors.fg },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  rowTime: { width: 44, fontSize: 13, color: colors.fgMuted, fontWeight: "600" },
  rowTitle: { flex: 1, fontSize: 15, color: colors.fg },
});
