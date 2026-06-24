// 首页：顶部本周条 + 当天竖向时间轴 + 未排托盘 + 目标进度 + 悬浮加号。
// 月历在独立 Tab；这里不再有 日/月/年 切换。拖拽 P7 延后（轻点排期已可用）。
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
import { useApp, type DayAction } from "../state/store";
import { Button, Card, Checkbox, Dot, Input, Muted, Progress, SectionTitle } from "../ui";
import { colors, AREA_COLORS, space } from "../theme";
import { hourTicks, hourTop, timelineHeight, blockLayout } from "../lib/timeline";
import { WeekStrip } from "../components/calendar";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function fmtDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日 ${WEEKDAYS[weekdayOf(date)]}`;
}

type PickMode = "schedule" | "retime";

export default function ScheduleScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [pick, setPick] = useState<{ id: string; mode: PickMode } | null>(null);

  const win = app.dayWin;
  const timed = app.dayActions.filter((a) => a.item.startTime);
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

  const submitAdd = () => {
    if (addText.trim()) app.addTimelineTask(addText.trim());
    setAddText("");
    setAddOpen(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* 头部：日期 + 今天 */}
        <View style={styles.headRow}>
          <Text style={styles.h1}>{fmtDate(app.viewDate)}</Text>
          {!app.isViewToday ? (
            <Pressable onPress={app.goToday} hitSlop={8}>
              <Text style={styles.todayBtn}>今天</Text>
            </Pressable>
          ) : null}
        </View>

        {/* 本周条 */}
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
            <Muted style={{ marginBottom: 6 }}>本日 · 未定时（点一下选时间）</Muted>
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

        {/* 时间轴 */}
        <View style={[styles.timeline, { height: timelineHeight(win.start, win.end) + 8 }]}>
          {hourTicks(win.start, win.end).map((h) => (
            <View key={h} style={[styles.hourRow, { top: hourTop(h, win.start) }]}>
              <Text style={styles.hourLabel}>{h}</Text>
              <View style={styles.hourLine} />
            </View>
          ))}
          {timed.map((a) => {
            const { top, height } = blockLayout(a.item.startTime!, a.item.durationMin, win.start);
            const c = colorOf(a);
            const habit = isHabit(a);
            return (
              <Pressable
                key={a.item.id}
                onPress={() => blockPressed(a)}
                style={[
                  styles.block,
                  { top, height },
                  habit
                    ? { borderColor: c, borderStyle: "dashed", borderWidth: 1, backgroundColor: "transparent" }
                    : { borderLeftColor: c, backgroundColor: "#fff" },
                ]}
              >
                <View style={styles.blockInner}>
                  <Checkbox
                    checked={a.done}
                    accent={c}
                    onPress={() => app.toggleDoneOn(a.item.id, app.viewDate, a.done)}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.blockText, a.done && styles.blockDone]} numberOfLines={1}>
                      {a.item.text}
                    </Text>
                    <Text style={styles.blockMeta}>
                      {a.item.startTime}
                      {a.goal ? ` · ${GOAL_AREA_LABELS[a.goal.area]}` : ""}
                      {habit ? " · 习惯" : ""}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* 未排托盘 */}
        <SectionTitle>未排 · 点一下选时间排进当天</SectionTitle>
        <Card>
          {app.unscheduled.length === 0 ? (
            <Muted>没有未排任务。右下角 ＋ 添加，或在「目标」里给目标加任务。</Muted>
          ) : (
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
          )}
          <View style={{ marginTop: 12 }}>
            <Button label="AI 排今天" kind="ghost" onPress={() => app.arrangeToday(app.viewDate)} />
          </View>
        </Card>
      </ScrollView>

      {/* 悬浮加号 */}
      <Pressable style={[styles.fab, { bottom: 20 }]} onPress={() => setAddOpen(true)}>
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

      {/* 添加任务 */}
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
            <Muted style={{ marginTop: 8 }}>先进未排托盘，再点它选时间排进当天。</Muted>
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
  timeline: { position: "relative", marginBottom: 16, paddingLeft: 34 },
  hourRow: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center" },
  hourLabel: { width: 30, fontSize: 11, color: colors.fgMuted, textAlign: "right", marginRight: 4 },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  block: {
    position: "absolute",
    left: 34,
    right: 0,
    borderLeftWidth: 3,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: "hidden",
  },
  blockInner: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 6 },
  blockText: { fontSize: 14, color: colors.fg, fontWeight: "600" },
  blockDone: { textDecorationLine: "line-through", color: colors.fgMuted },
  blockMeta: { fontSize: 11, color: colors.fgMuted, marginTop: 2 },
  fab: {
    position: "absolute",
    right: 20,
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
});
