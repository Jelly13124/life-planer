// 首页：本周条 + 任务驱动的竖向时间轴（Structured 风：彩色圆角图标 + 竖线 + 时间 + 勾选）。
// 默认空；加任务并选时间后才出现在轴上。＋ 可把任务绑定到目标（闭环：完成→目标进度↑→树）。
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { GOAL_AREA_LABELS, type Task, type Habit } from "@lifeplanner/core/types";
import { weekdayOf } from "@lifeplanner/core/calendar";
import { toMinutes, toHHMM } from "@lifeplanner/core/schedule";
import { useApp, type DayAction } from "../state/store";
import { Button, Card, Checkbox, Dot, Input, Muted, Progress, SectionTitle } from "../ui";
import { colors, AREA_COLORS, space } from "../theme";
import { WeekStrip } from "../components/calendar";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function fmtDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日 ${WEEKDAYS[weekdayOf(date)]}`;
}
function rangeLabel(start: string, durMin?: number): string {
  const dur = durMin && durMin > 0 ? durMin : 60;
  return `${start}–${toHHMM(toMinutes(start) + dur)} · ${dur}分钟`;
}

type PickMode = "schedule" | "retime";

export default function ScheduleScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [addGoalId, setAddGoalId] = useState<string | null>(null); // null = 无目标
  const [pick, setPick] = useState<{ id: string; mode: PickMode } | null>(null);

  const timed = app.dayActions
    .filter((a) => a.item.startTime)
    .sort((a, b) => toMinutes(a.item.startTime!) - toMinutes(b.item.startTime!));
  const untimed = app.dayActions.filter((a) => !a.item.startTime);
  const activeGoals = app.longGoals.filter((g) => g.status === "active");

  const nudge = app.nudge;
  const clearNudge = app.clearNudge;
  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(clearNudge, 2800);
    return () => clearTimeout(t);
  }, [nudge, clearNudge]);

  const colorOf = (a: DayAction) => (a.goal ? AREA_COLORS[a.goal.area] : colors.fgMuted);
  const isHabit = (a: DayAction) => a.kind !== "scheduled";

  const onPickTime = (e: { type: string }, dt?: Date) => {
    const picking = pick;
    setPick(null);
    if (e.type !== "set" || !dt || !picking) return;
    const time = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
    if (picking.mode === "schedule") app.scheduleAtTime(picking.id, app.viewDate, time);
    else app.setActionTimeById(picking.id, time);
  };

  const blockPressed = (a: DayAction) => {
    const opts: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [
      { text: "改时间", onPress: () => setPick({ id: a.item.id, mode: "retime" }) },
    ];
    if (!isHabit(a)) opts.push({ text: "移回未排", onPress: () => app.unschedule(a.item.id) });
    opts.push({ text: "取消", style: "cancel" });
    Alert.alert((a.item as Task | Habit).text, a.item.startTime ?? "", opts);
  };

  const openAdd = () => {
    setAddText("");
    setAddGoalId(null);
    setAddOpen(true);
  };
  const submitAdd = () => {
    const text = addText.trim();
    if (text) {
      if (addGoalId) app.addTaskToGoal(addGoalId, text);
      else app.addTimelineTask(text);
    }
    setAddText("");
    setAddOpen(false);
  };

  const empty = timed.length === 0 && untimed.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headRow}>
          <Text style={styles.h1}>{fmtDate(app.viewDate)}</Text>
          {!app.isViewToday ? (
            <Pressable onPress={app.goToday} hitSlop={8}>
              <Text style={styles.todayBtn}>今天</Text>
            </Pressable>
          ) : null}
        </View>

        <WeekStrip
          viewDate={app.viewDate}
          today={app.today}
          densityOf={(d) => app.actionsOn(d).length}
          onPickDay={app.setViewDate}
        />

        {/* 目标进度小条 */}
        {activeGoals.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.goalStrip}
            contentContainerStyle={{ gap: 8, paddingRight: space }}
          >
            {activeGoals.map((g) => {
              const p = app.progressOf(g);
              const c = AREA_COLORS[g.area];
              return (
                <View key={g.id} style={styles.goalChip}>
                  <Text style={styles.goalChipTitle} numberOfLines={1}>
                    {g.title}
                  </Text>
                  <View style={{ marginVertical: 5 }}>
                    <Progress value={p} color={c} />
                  </View>
                  <Text style={styles.goalChipPct}>{p}% · 离目标更近</Text>
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        {/* 本日未定时 */}
        {untimed.length > 0 ? (
          <View style={styles.untimedWrap}>
            <Muted style={{ marginBottom: 6 }}>未定时（点一下选时间）</Muted>
            <View style={styles.chipRow}>
              {untimed.map((a) => (
                <Pressable
                  key={a.item.id}
                  onPress={() => setPick({ id: a.item.id, mode: "retime" })}
                  style={[styles.chip, { borderColor: colorOf(a) }]}
                >
                  <Dot color={colorOf(a)} />
                  <Text style={styles.chipText}>{a.item.text}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* 任务驱动时间轴 */}
        {empty ? (
          <Card style={{ marginTop: 8 }}>
            <Text style={styles.emptyTitle}>今天还没有安排</Text>
            <Muted>点右下角 ＋ 添加任务、选个时间，它就会出现在这条时间轴上。</Muted>
          </Card>
        ) : (
          <View style={styles.timeline}>
            {timed.map((a, i) => {
              const c = colorOf(a);
              const habit = isHabit(a);
              const initial = a.goal ? GOAL_AREA_LABELS[a.goal.area].slice(0, 1) : "";
              const last = i === timed.length - 1;
              return (
                <View key={a.item.id} style={styles.tlRow}>
                  <View style={styles.tlLeft}>
                    <Text style={styles.tlTime}>{a.item.startTime}</Text>
                    <View
                      style={[
                        styles.tlPill,
                        habit
                          ? { borderColor: c, borderWidth: 2, borderStyle: "dashed" }
                          : { backgroundColor: c },
                      ]}
                    >
                      <Text style={[styles.tlPillText, habit && { color: c }]}>{initial}</Text>
                    </View>
                    {!last ? <View style={styles.tlSpine} /> : null}
                  </View>
                  <Pressable style={styles.tlContent} onPress={() => blockPressed(a)}>
                    <Text style={[styles.tlTitle, a.done && styles.tlDone]} numberOfLines={2}>
                      {a.item.text}
                    </Text>
                    <Text style={styles.tlMeta}>
                      {rangeLabel(a.item.startTime!, a.item.durationMin)}
                      {habit ? " · 习惯" : ""}
                      {a.goal ? ` · ${GOAL_AREA_LABELS[a.goal.area]}` : ""}
                    </Text>
                  </Pressable>
                  <Checkbox
                    checked={a.done}
                    accent={c}
                    onPress={() => app.toggleDoneOn(a.item.id, app.viewDate, a.done)}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* 未排托盘 */}
        {app.unscheduled.length > 0 ? (
          <>
            <SectionTitle>未排 · 点一下选时间排进当天</SectionTitle>
            <Card>
              <View style={styles.chipRow}>
                {app.unscheduled.map(({ goal, item }) => {
                  const c = goal ? AREA_COLORS[goal.area] : colors.fgMuted;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setPick({ id: item.id, mode: "schedule" })}
                      style={[styles.chip, { borderColor: c }]}
                    >
                      <Dot color={c} />
                      <Text style={styles.chipText}>{item.text}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ marginTop: 12 }}>
                <Button label="AI 排今天" kind="ghost" onPress={() => app.arrangeToday(app.viewDate)} />
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>

      {/* 悬浮加号 */}
      <Pressable style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      {/* 完成动力提示 */}
      {app.nudge ? (
        <View style={[styles.nudge, { top: insets.top + 8 }]} pointerEvents="none">
          <Text style={styles.nudgeText}>
            你的努力让「{app.nudge.title}」+{app.nudge.delta}%
          </Text>
        </View>
      ) : null}

      {/* 时间选择器 */}
      {pick ? (
        <DateTimePicker
          value={new Date()}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPickTime}
        />
      ) : null}

      {/* 添加任务（可选绑定目标） */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>添加任务</Text>
            <Input
              value={addText}
              onChangeText={setAddText}
              placeholder="要做什么？"
              autoFocus
              onSubmitEditing={submitAdd}
              returnKeyType="done"
            />
            <Text style={styles.modalLabel}>绑定目标（可选，完成后计入目标进度）</Text>
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => setAddGoalId(null)}
                style={[styles.goalPick, addGoalId === null && styles.goalPickActive]}
              >
                <Text style={[styles.goalPickText, addGoalId === null && { color: "#fff" }]}>无目标</Text>
              </Pressable>
              {activeGoals.map((g) => {
                const on = addGoalId === g.id;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => setAddGoalId(g.id)}
                    style={[
                      styles.goalPick,
                      on ? { backgroundColor: AREA_COLORS[g.area], borderColor: AREA_COLORS[g.area] } : null,
                    ]}
                  >
                    <Text style={[styles.goalPickText, on && { color: "#fff" }]} numberOfLines={1}>
                      {g.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Muted style={{ marginTop: 8 }}>加好后它进未排，点它选时间排进当天。</Muted>
            <View style={{ height: 12 }} />
            <Button label="添加" onPress={submitAdd} disabled={!addText.trim()} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space, paddingBottom: 96 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  h1: { fontSize: 24, fontWeight: "700", color: colors.fg },
  todayBtn: { fontSize: 14, fontWeight: "600", color: colors.accent },
  goalStrip: { marginBottom: 12 },
  goalChip: {
    width: 150,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 10,
  },
  goalChipTitle: { fontSize: 13, fontWeight: "600", color: colors.fg },
  goalChipPct: { fontSize: 11, color: colors.fgMuted },
  untimedWrap: { marginBottom: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  chipText: { fontSize: 13, color: colors.fg, maxWidth: 160 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.fg, marginBottom: 4 },
  // 任务驱动时间轴
  timeline: { marginTop: 4 },
  tlRow: { flexDirection: "row", alignItems: "stretch", minHeight: 66 },
  tlLeft: { width: 56, alignItems: "center" },
  tlTime: { fontSize: 12, color: colors.fgMuted, marginBottom: 4 },
  tlPill: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  tlPillText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  tlSpine: { width: 2, flex: 1, backgroundColor: colors.line, marginTop: 4 },
  tlContent: { flex: 1, paddingHorizontal: 12, paddingTop: 18, justifyContent: "flex-start" },
  tlTitle: { fontSize: 16, fontWeight: "700", color: colors.fg },
  tlDone: { textDecorationLine: "line-through", color: colors.fgMuted },
  tlMeta: { fontSize: 12, color: colors.fgMuted, marginTop: 3 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
  },
  fabText: { color: "#fff", fontSize: 30, fontWeight: "400", lineHeight: 34 },
  nudge: {
    position: "absolute",
    left: 24,
    right: 24,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  nudgeText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", paddingHorizontal: 28 },
  modalCard: { backgroundColor: "#fff", borderRadius: 16, padding: 18 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.fg, marginBottom: 12 },
  modalLabel: { fontSize: 13, color: colors.fgMuted, marginTop: 14, marginBottom: 8 },
  goalPick: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  goalPickActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  goalPickText: { fontSize: 13, color: colors.fg, maxWidth: 140 },
});
