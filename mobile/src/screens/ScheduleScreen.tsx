// 安排（首页）：当日竖向时间轴 + 未排托盘 + 轻点排期 + AI 排今天。
// 日/月/年 切换：日视图本阶段完成；月/年占位（P3 接）。拖拽排期 P7 叠加（轻点是兜底）。
import React, { useState } from "react";
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
import { Button, Card, Checkbox, Dot, Input, Muted, SectionTitle } from "../ui";
import { colors, AREA_COLORS, space } from "../theme";
import { hourTicks, hourTop, timelineHeight, blockLayout, PX_PER_MIN } from "../lib/timeline";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function fmtDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日 ${WEEKDAYS[weekdayOf(date)]}`;
}

type PickMode = "schedule" | "retime";

export default function ScheduleScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<"day" | "month" | "year">("day");
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [pick, setPick] = useState<{ id: string; mode: PickMode } | null>(null);

  const win = app.dayWin;
  const timed = app.dayActions.filter((a) => a.item.startTime);
  const untimed = app.dayActions.filter((a) => !a.item.startTime);

  const colorOf = (a: DayAction) => (a.goal ? AREA_COLORS[a.goal.area] : colors.fgMuted);
  const isHabit = (a: DayAction) => a.kind !== "scheduled";

  const onPickTime = (e: { type: string }, dt?: Date) => {
    const picking = pick;
    setPick(null);
    if (e.type !== "set" || !dt || !picking) return;
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    const time = `${hh}:${mm}`;
    if (picking.mode === "schedule") app.scheduleAtTime(picking.id, app.viewDate, time);
    else app.setActionTimeById(picking.id, time);
  };

  const blockPressed = (a: DayAction) => {
    const opts: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [
      { text: "改时间", onPress: () => setPick({ id: a.item.id, mode: "retime" }) },
    ];
    if (!isHabit(a)) {
      opts.push({ text: "移回未排", onPress: () => app.unschedule(a.item.id) });
    }
    opts.push({ text: "取消", style: "cancel" });
    Alert.alert((a.item as Task | Habit).text, a.item.startTime ?? "", opts);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* 头部：日期导航 + 今天 */}
        <View style={styles.headRow}>
          <Text style={styles.h1}>安排</Text>
          <View style={styles.dateNav}>
            <Pressable onPress={() => app.shiftViewDate(-1)} hitSlop={8}>
              <Text style={styles.navArrow}>‹</Text>
            </Pressable>
            <Pressable onPress={app.goToday}>
              <Text style={styles.dateText}>{fmtDate(app.viewDate)}</Text>
            </Pressable>
            <Pressable onPress={() => app.shiftViewDate(1)} hitSlop={8}>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>
        </View>

        {/* 日/月/年 切换 */}
        <View style={styles.toggle}>
          {(["day", "month", "year"] as const).map((v) => {
            const active = v === view;
            const label = v === "day" ? "日" : v === "month" ? "月" : "年";
            return (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                style={[styles.toggleItem, active && styles.toggleItemActive]}
              >
                <Text style={[styles.toggleText, active && { color: "#fff" }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {view !== "day" ? (
          <Card>
            <Text style={styles.emptyTitle}>{view === "month" ? "月视图" : "年视图"}</Text>
            <Muted>即将到来。先用「日」视图安排今天。</Muted>
          </Card>
        ) : (
          <>
            {!app.isViewToday ? (
              <Pressable onPress={app.goToday} style={styles.backToday}>
                <Text style={styles.backTodayText}>回到今天</Text>
              </Pressable>
            ) : null}

            {/* 本日未定时（已排到这天但没给时间） */}
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
              {/* 小时刻度 */}
              {hourTicks(win.start, win.end).map((h) => (
                <View key={h} style={[styles.hourRow, { top: hourTop(h, win.start) }]}>
                  <Text style={styles.hourLabel}>{h}</Text>
                  <View style={styles.hourLine} />
                </View>
              ))}
              {/* 时间块 */}
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
            <SectionTitle>未排 · 点一下选时间排进今天</SectionTitle>
            <Card>
              {app.unscheduled.length === 0 ? (
                <Muted>没有未排任务。＋ 添加任务，或在「目标」里给目标加任务。</Muted>
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
              <View style={styles.trayActions}>
                <Button label="＋ 添加任务" kind="ghost" onPress={() => setAddOpen(true)} />
                <Button label="AI 排今天" kind="ghost" onPress={() => app.arrangeToday(app.viewDate)} />
              </View>
            </Card>
          </>
        )}
      </ScrollView>

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

      {/* 添加任务 modal */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>添加任务</Text>
            <Input
              value={addText}
              onChangeText={setAddText}
              placeholder="要做什么？"
              autoFocus
              onSubmitEditing={() => {
                if (addText.trim()) app.addTimelineTask(addText.trim());
                setAddText("");
                setAddOpen(false);
              }}
              returnKeyType="done"
            />
            <Muted style={{ marginTop: 8 }}>先进未排托盘，再点它选时间排进当天。</Muted>
            <View style={{ height: 12 }} />
            <Button
              label="添加"
              onPress={() => {
                if (addText.trim()) app.addTimelineTask(addText.trim());
                setAddText("");
                setAddOpen(false);
              }}
              disabled={!addText.trim()}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space, paddingBottom: 64 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: 28, fontWeight: "700", color: colors.fg },
  dateNav: { flexDirection: "row", alignItems: "center", gap: 10 },
  navArrow: { fontSize: 24, color: colors.fgMuted, paddingHorizontal: 4 },
  dateText: { fontSize: 14, fontWeight: "600", color: colors.fg },
  toggle: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    marginBottom: 14,
    backgroundColor: colors.line,
    borderRadius: 10,
    padding: 3,
  },
  toggleItem: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8 },
  toggleItemActive: { backgroundColor: colors.accent },
  toggleText: { fontSize: 14, fontWeight: "600", color: colors.fg },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.fg, marginBottom: 4 },
  backToday: { alignSelf: "flex-start", marginBottom: 8 },
  backTodayText: { color: colors.accent, fontWeight: "600", fontSize: 13 },
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
  timeline: {
    position: "relative",
    marginBottom: 16,
    paddingLeft: 34,
  },
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
  trayActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, gap: 8 },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 16, padding: 18 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.fg, marginBottom: 12 },
});
