// 首页：本周条 + 任务驱动竖向时间轴(图标块+竖线) + 未排托盘 + 目标进度 + 悬浮加号。
// 选时间统一走自定义 TimePickSheet(滚轮 + 持续时间胶囊),不用系统选择器。
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GOAL_AREA_LABELS, type GoalArea, type Task, type Habit } from "@lifeplanner/core/types";
import { weekdayOf } from "@lifeplanner/core/calendar";
import { toMinutes, toHHMM } from "@lifeplanner/core/schedule";
import { useApp, type DayAction } from "../state/store";
import { Button, Card, Checkbox, Input, Muted, Progress, SectionTitle } from "../ui";
import { colors, AREA_COLORS, radii, space } from "../theme";
import { WeekStrip } from "../components/calendar";
import { AreaTile, Icon } from "../components/icons";
import { TimePickSheet } from "../components/TimePickSheet";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function fmtDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日 ${WEEKDAYS[weekdayOf(date)]}`;
}
function rangeLabel(start: string, durMin?: number): string {
  const dur = durMin && durMin > 0 ? durMin : 60;
  return `${start}–${toHHMM(toMinutes(start) + dur)} · ${dur}分钟`;
}

interface TimeSheetState {
  mode: "schedule" | "retime" | "add";
  id?: string;
  title: string;
  area?: GoalArea | null;
  start?: string;
  duration: number;
}

export default function ScheduleScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [addGoalId, setAddGoalId] = useState<string | null>(null);
  const [addTime, setAddTime] = useState<string | null>(null);
  const [addDur, setAddDur] = useState(60);
  const [timeSheet, setTimeSheet] = useState<TimeSheetState | null>(null);

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

  const onTimeConfirm = (start: string, dur: number) => {
    const ts = timeSheet;
    setTimeSheet(null);
    if (!ts) return;
    if (ts.mode === "schedule" && ts.id) app.scheduleAtTime(ts.id, app.viewDate, start, dur);
    else if (ts.mode === "retime" && ts.id) app.setActionTimeById(ts.id, start, dur);
    else if (ts.mode === "add") {
      setAddTime(start);
      setAddDur(dur);
      setAddOpen(true); // 选完时间回到「添加任务」弹窗（不嵌套两层 Modal）
    }
  };

  const blockPressed = (a: DayAction) => {
    const opts: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [
      {
        text: "改时间",
        onPress: () =>
          setTimeSheet({
            mode: "retime",
            id: a.item.id,
            title: (a.item as Task | Habit).text,
            area: a.goal ? a.goal.area : null,
            start: a.item.startTime,
            duration: a.item.durationMin ?? 60,
          }),
      },
    ];
    if (!isHabit(a)) opts.push({ text: "移回未排", onPress: () => app.unschedule(a.item.id) });
    opts.push({ text: "取消", style: "cancel" });
    Alert.alert((a.item as Task | Habit).text, a.item.startTime ?? "", opts);
  };

  const openAdd = () => {
    setAddText("");
    setAddGoalId(null);
    setAddTime(null);
    setAddDur(60);
    setAddOpen(true);
  };
  const submitAdd = () => {
    const text = addText.trim();
    if (!text) return;
    if (!addTime) {
      // 时间必填：没选时间就直接弹出选时间面板，不允许无时间任务。先收起添加弹窗避免两层 Modal。
      setAddOpen(false);
      setTimeSheet({
        mode: "add",
        title: text || "新任务",
        area: addGoalId ? activeGoals.find((g) => g.id === addGoalId)?.area : null,
        start: addTime ?? undefined,
        duration: addDur,
      });
      return;
    }
    app.addScheduledTask({
      text,
      goalId: addGoalId,
      date: app.viewDate,
      time: addTime,
      durationMin: addDur,
    });
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

        {untimed.length > 0 ? (
          <View style={styles.untimedWrap}>
            <Muted style={{ marginBottom: 6 }}>未定时（点一下选时间）</Muted>
            <View style={styles.chipRow}>
              {untimed.map((a) => (
                <Pressable
                  key={a.item.id}
                  onPress={() =>
                    setTimeSheet({
                      mode: "retime",
                      id: a.item.id,
                      title: (a.item as Task | Habit).text,
                      area: a.goal ? a.goal.area : null,
                      duration: a.item.durationMin ?? 60,
                    })
                  }
                  style={[styles.chip, { borderColor: colorOf(a) }]}
                >
                  <AreaTile area={a.goal ? a.goal.area : null} size={22} />
                  <Text style={styles.chipText}>{a.item.text}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

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
              const last = i === timed.length - 1;
              return (
                <Swipeable
                  key={a.item.id}
                  overshootRight={false}
                  renderRightActions={() => (
                    <Pressable
                      style={styles.swipeDelete}
                      onPress={() => app.removeItem(a.item.id)}
                    >
                      <Icon name="trash-can-outline" size={20} color="#fff" />
                      <Text style={styles.swipeDeleteText}>删除</Text>
                    </Pressable>
                  )}
                >
                  <View style={styles.tlRow}>
                    <View style={styles.tlLeft}>
                      <Text style={styles.tlTime}>{a.item.startTime}</Text>
                      <AreaTile area={a.goal ? a.goal.area : null} size={40} outline={habit} />
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
                </Swipeable>
              );
            })}
          </View>
        )}

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
                      onPress={() =>
                        setTimeSheet({
                          mode: "schedule",
                          id: item.id,
                          title: item.text,
                          area: goal ? goal.area : null,
                          duration: item.durationMin ?? 60,
                        })
                      }
                      style={[styles.chip, { borderColor: c }]}
                    >
                      <AreaTile area={goal ? goal.area : null} size={22} />
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

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.92, transform: [{ scale: 0.95 }] }]}
        onPress={openAdd}
        accessibilityRole="button"
        accessibilityLabel="添加任务"
      >
        <Icon name="plus" size={28} color="#fff" />
      </Pressable>

      {app.nudge ? (
        <View style={[styles.nudge, { top: insets.top + 8 }]} pointerEvents="none">
          <Text style={styles.nudgeText}>
            你的努力让「{app.nudge.title}」+{app.nudge.delta}%
          </Text>
        </View>
      ) : null}

      {/* 自定义选时间面板（按需挂载） */}
      {timeSheet ? (
        <TimePickSheet
          title={timeSheet.title}
          area={timeSheet.area}
          initialStart={timeSheet.start}
          initialDuration={timeSheet.duration}
          dayStart={app.dayWin.start}
          dayEnd={app.dayWin.end}
          onConfirm={onTimeConfirm}
          onClose={() => {
            if (timeSheet?.mode === "add") setAddOpen(true); // 取消选时间也回到添加弹窗
            setTimeSheet(null);
          }}
        />
      ) : null}

      {/* 添加任务（文字 + 目标 + 时间） */}
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

            <Text style={styles.modalLabel}>时间（必填）</Text>
            <Pressable
              onPress={() => {
                setAddOpen(false); // 收起添加弹窗，避免在 Modal 上再叠 Modal（iOS 会无反应）
                setTimeSheet({
                  mode: "add",
                  title: addText.trim() || "新任务",
                  area: addGoalId ? activeGoals.find((g) => g.id === addGoalId)?.area : null,
                  start: addTime ?? undefined,
                  duration: addDur,
                });
              }}
              style={({ pressed }) => [
                styles.timeBtn,
                addTime ? styles.timeBtnOn : styles.timeBtnReq,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Icon name="clock-outline" size={18} color={addTime ? "#fff" : colors.accent} />
              <Text style={[styles.timeBtnText, addTime ? { color: "#fff" } : { color: colors.accent }]}>
                {addTime ? `今天 ${addTime} · ${addDur}分钟` : "选时间（必填）"}
              </Text>
            </Pressable>

            <Text style={styles.modalLabel}>绑定目标（可选，完成后计入目标进度）</Text>
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => setAddGoalId(null)}
                style={({ pressed }) => [
                  styles.goalPick,
                  addGoalId === null && styles.goalPickActive,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.goalPickText, addGoalId === null && { color: "#fff" }]}>无目标</Text>
              </Pressable>
              {activeGoals.map((g) => {
                const on = addGoalId === g.id;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => setAddGoalId(g.id)}
                    style={({ pressed }) => [
                      styles.goalPick,
                      on ? { backgroundColor: AREA_COLORS[g.area], borderColor: AREA_COLORS[g.area] } : null,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Text style={[styles.goalPickText, on && { color: "#fff" }]} numberOfLines={1}>
                      {g.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ height: 14 }} />
            <Button
              label={addTime ? "添加" : "先选时间"}
              onPress={submitAdd}
              disabled={!addText.trim()}
            />
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
    borderRadius: radii.sm,
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
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  chipText: { fontSize: 13, color: colors.fg, maxWidth: 160 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.fg, marginBottom: 4 },
  timeline: { marginTop: 4 },
  tlRow: { flexDirection: "row", alignItems: "stretch", minHeight: 66, backgroundColor: colors.bg },
  swipeDelete: {
    backgroundColor: colors.danger,
    width: 88,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
  },
  swipeDeleteText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  tlLeft: { width: 56, alignItems: "center" },
  tlTime: { fontSize: 12, color: colors.fgMuted, marginBottom: 4 },
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
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
  },
  nudge: {
    position: "absolute",
    left: 24,
    right: 24,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  nudgeText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", paddingHorizontal: 28 },
  modalCard: { backgroundColor: "#fff", borderRadius: radii.md, padding: 18 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.fg, marginBottom: 12 },
  modalLabel: { fontSize: 13, color: colors.fgMuted, marginTop: 14, marginBottom: 8 },
  timeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "#fff",
  },
  timeBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  timeBtnReq: { borderColor: colors.accent, borderWidth: 1.5 },
  timeBtnText: { fontSize: 14, fontWeight: "600", color: colors.fg },
  goalPick: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  goalPickActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  goalPickText: { fontSize: 13, color: colors.fg, maxWidth: 140 },
});
