// 目标屏（手机精简版）：只有「目标」和「任务」两个概念。
// 一个目标 = 标题 + 进度 + 到期日(可选) + 一条任务清单(任务 + 重复任务)。
// 习惯并进"重复任务"(加任务可选 无/每天/每周)；短期目标已从手机端拿掉(数据仍在,网页可用)。
import { useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  GOAL_AREAS,
  GOAL_AREA_LABELS,
  type GoalArea,
  type Goal,
} from "@lifeplanner/core/types";
import { useApp } from "../state/store";
import { hasBackend, type GoalSuggestion } from "../lib/api";
import { Button, Card, Checkbox, Dot, Input, Muted, Progress, SectionTitle, Skeleton } from "../ui";
import { colors, AREA_COLORS, radii, space } from "../theme";

type Repeat = "none" | "daily" | "weekly";
const REPEATS: { k: Repeat; l: string }[] = [
  { k: "none", l: "无" },
  { k: "daily", l: "每天" },
  { k: "weekly", l: "每周" },
];
const NEW = "__new__"; // 到期日选择器的特殊目标 id:建新目标时

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fmtMD = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日`;
};

export default function GoalsScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState<GoalArea>("career");
  const [title, setTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const [taskRepeat, setTaskRepeat] = useState<Record<string, Repeat>>({});
  const [duePicker, setDuePicker] = useState<string | null>(null); // 目标 id 或 NEW
  const [suggestions, setSuggestions] = useState<GoalSuggestion[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const setTaskInput = (key: string, v: string) => setTaskInputs((m) => ({ ...m, [key]: v }));
  const setRepeatFor = (key: string, v: Repeat) => setTaskRepeat((m) => ({ ...m, [key]: v }));

  // 到期日选择:Android 选完即关;iOS 滚轮实时更新,点完成关。写到"新目标"或某目标。
  const onPickDue = (e: { type: string }, dt?: Date) => {
    const target = duePicker;
    const apply = (d: Date) => {
      if (target === NEW) setNewDue(ymd(d));
      else if (target) app.setGoalDueDate(target, ymd(d));
    };
    if (Platform.OS === "android") {
      setDuePicker(null);
      if (e.type !== "set" || !dt || !target) return;
      apply(dt);
    } else if (dt) {
      apply(dt);
    }
  };
  const activeDue =
    duePicker === NEW
      ? newDue
      : duePicker
        ? app.longGoals.find((g) => g.id === duePicker)?.endDate ?? ""
        : "";

  const submitGoal = () => {
    if (!title.trim()) return;
    app.addLongGoal(area, title, undefined, newDue || undefined);
    setTitle("");
    setNewDue("");
  };

  const submitTask = (goalId: string) => {
    const text = (taskInputs[goalId] ?? "").trim();
    if (!text) return;
    const rep = taskRepeat[goalId] ?? "none";
    if (rep === "none") app.addTaskToGoal(goalId, text);
    else app.addHabitToGoal(goalId, text, rep);
    setTaskInput(goalId, "");
  };

  const runSuggest = async () => {
    if (!hasBackend()) {
      Alert.alert("需要连接后端", "设 EXPO_PUBLIC_API_BASE_URL 指向运行中的网页后端后可用 AI 建议。");
      return;
    }
    setSuggesting(true);
    try {
      setSuggestions(await app.suggestGoals());
    } finally {
      setSuggesting(false);
    }
  };

  const confirmRemoveGoal = (goal: Goal) =>
    Alert.alert("删除目标", `删除「${goal.title}」及其下任务？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => app.removeGoal(goal.id) },
    ]);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h1}>目标</Text>

      {/* 建立目标 */}
      <Card>
        <SectionTitle>建立目标</SectionTitle>
        <View style={styles.chipRow}>
          {GOAL_AREAS.map((a) => {
            const active = a === area;
            return (
              <Pressable
                key={a}
                onPress={() => setArea(a)}
                style={({ pressed }) => [
                  styles.chip,
                  active
                    ? { backgroundColor: AREA_COLORS[a], borderColor: AREA_COLORS[a] }
                    : { borderColor: colors.line },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.chipText, active && { color: "#fff" }]}>
                  {GOAL_AREA_LABELS[a]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="想达成什么？（如 转行做产品经理）"
          onSubmitEditing={submitGoal}
          returnKeyType="done"
        />
        <View style={styles.newDueRow}>
          <Pressable
            onPress={() => setDuePicker(NEW)}
            style={({ pressed }) => [styles.dueBtn, newDue && styles.dueBtnOn, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.dueBtnText, newDue && { color: "#fff" }]}>
              {newDue ? `到期 ${fmtMD(newDue)}` : "到期日（可选）"}
            </Text>
          </Pressable>
          {newDue ? (
            <Pressable onPress={() => setNewDue("")} hitSlop={6}>
              <Text style={styles.clearLink}>清除</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={{ height: 10 }} />
        <Button label="建立目标" onPress={submitGoal} disabled={!title.trim()} />
        <View style={{ height: 8 }} />
        <Button
          label={suggesting ? "AI 思考中…" : "AI 建议目标"}
          kind="ghost"
          onPress={runSuggest}
          loading={suggesting}
        />
        {suggesting && !suggestions ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Skeleton height={40} />
            <Skeleton height={40} />
            <Skeleton height={40} />
          </View>
        ) : suggestions && suggestions.length > 0 ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            {suggestions.map((s, i) => (
              <Pressable
                key={`${s.title}-${i}`}
                style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  app.addLongGoal(s.area, s.title, s.why);
                  setSuggestions((cur) => (cur ?? []).filter((x) => x !== s));
                }}
              >
                <Dot color={AREA_COLORS[s.area]} />
                <Text style={styles.suggestionText}>{s.title}</Text>
                <Text style={styles.suggestionAdd}>+ 加入</Text>
              </Pressable>
            ))}
          </View>
        ) : suggestions ? (
          <Muted style={{ marginTop: 8 }}>暂无建议。</Muted>
        ) : null}
      </Card>

      {/* 目标列表 */}
      {app.longGoals.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>还没有目标</Text>
          <Muted>建立第一个目标，开始把人生方向拆成可执行的任务。</Muted>
        </Card>
      ) : (
        app.longGoals.map((goal) => {
          const ac = AREA_COLORS[goal.area];
          const progress = app.progressOf(goal);
          const overdue = !!goal.endDate && goal.endDate < app.today;
          const rep = taskRepeat[goal.id] ?? "none";
          return (
            <Card key={goal.id}>
              <View style={styles.goalHead}>
                <Dot color={ac} />
                <Text style={styles.goalTitle}>{goal.title}</Text>
                <Text style={styles.goalPct}>{progress}%</Text>
              </View>
              <View style={{ marginVertical: 8 }}>
                <Progress value={progress} color={ac} />
              </View>
              {goal.why ? <Muted style={{ marginBottom: 8 }}>{goal.why}</Muted> : null}

              {/* 到期日 */}
              <Pressable
                onPress={() => setDuePicker(goal.id)}
                style={({ pressed }) => [styles.goalDueRow, pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.goalDueText, overdue && { color: colors.danger }]}>
                  {goal.endDate ? `到期 ${fmtMD(goal.endDate)}${overdue ? " · 已逾期" : ""}` : "设到期日"}
                </Text>
              </Pressable>

              {/* 任务清单（一个列表；重复任务内联"每天/每周"标签，不再分区） */}
              {goal.tasks.map((task) =>
                task.repeat ? (
                  <View key={task.id} style={styles.taskRow}>
                    <View style={[styles.repDot, { backgroundColor: ac }]} />
                    <Text style={styles.taskText} numberOfLines={2}>
                      {task.text}
                    </Text>
                    <View style={styles.repTag}>
                      <Text style={styles.repTagText}>{task.repeat === "daily" ? "每天" : "每周"}</Text>
                    </View>
                    <Pressable onPress={() => app.removeItem(task.id)} hitSlop={6}>
                      <Text style={styles.removeLink}>删</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View key={task.id} style={styles.taskRow}>
                    <Checkbox checked={task.done} accent={ac} onPress={() => app.toggleTaskDone(task.id)} />
                    <Text style={[styles.taskText, task.done && styles.taskTextDone]} numberOfLines={2}>
                      {task.text}
                    </Text>
                    {!task.done ? (
                      <Pressable onPress={() => app.planTaskToday(task.id)} hitSlop={6}>
                        <Text style={styles.todayLink}>今天</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => app.removeItem(task.id)} hitSlop={6}>
                      <Text style={styles.removeLink}>删</Text>
                    </Pressable>
                  </View>
                ),
              )}

              {/* 加任务 + 重复选择 */}
              <View style={styles.addRow}>
                <Input
                  value={taskInputs[goal.id] ?? ""}
                  onChangeText={(v) => setTaskInput(goal.id, v)}
                  placeholder="添加任务…"
                  onSubmitEditing={() => submitTask(goal.id)}
                  returnKeyType="done"
                  style={{ flex: 1 }}
                />
                <Pressable
                  onPress={() => submitTask(goal.id)}
                  style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.addBtnText}>＋</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => app.suggestTasksForGoal(goal.id)}
                disabled={app.suggestingTasksGoalId === goal.id}
                style={({ pressed }) => [
                  styles.suggestTasksBtn,
                  pressed && { opacity: 0.7 },
                  app.suggestingTasksGoalId === goal.id && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.suggestTasksBtnText}>
                  {app.suggestingTasksGoalId === goal.id ? "AI 建议中…" : "AI 建议任务"}
                </Text>
              </Pressable>
              <View style={styles.repRow}>
                <Text style={styles.repLabel}>重复</Text>
                {REPEATS.map((o) => {
                  const on = rep === o.k;
                  return (
                    <Pressable
                      key={o.k}
                      onPress={() => setRepeatFor(goal.id, o.k)}
                      style={({ pressed }) => [styles.repPill, on && styles.repPillOn, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={[styles.repPillText, on && { color: "#fff" }]}>{o.l}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 目标操作 */}
              <View style={styles.goalActions}>
                {goal.status === "active" ? (
                  <Pressable onPress={() => app.completeGoal(goal.id)} hitSlop={6}>
                    <Text style={[styles.goalAction, { color: colors.success }]}>标记完成</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.goalAction, { color: colors.fgMuted }]}>已完成</Text>
                )}
                <Pressable onPress={() => confirmRemoveGoal(goal)} hitSlop={6}>
                  <Text style={[styles.goalAction, { color: colors.danger }]}>删除目标</Text>
                </Pressable>
              </View>
            </Card>
          );
        })
      )}

      <Muted style={{ marginTop: 4, textAlign: "center" }}>
        临时、不属于目标的事，去「安排」直接加到时间轴。
      </Muted>

      {/* 到期日选择 */}
      {duePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={activeDue ? new Date(activeDue) : new Date()}
          mode="date"
          onChange={onPickDue}
        />
      ) : null}
      {duePicker && Platform.OS === "ios" ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setDuePicker(null)}>
          <View style={styles.pickerBg}>
            <Pressable style={{ flex: 1 }} onPress={() => setDuePicker(null)} />
            <View style={styles.pickerSheet}>
              <Text style={styles.pickerTitle}>选到期日</Text>
              <DateTimePicker
                value={activeDue ? new Date(activeDue) : new Date()}
                mode="date"
                display="spinner"
                onChange={onPickDue}
                style={{ alignSelf: "stretch" }}
              />
              <Button label="完成" onPress={() => setDuePicker(null)} />
            </View>
          </View>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space, paddingBottom: 48 },
  h1: { fontSize: 30, fontWeight: "700", color: colors.fg, marginBottom: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.fg },
  newDueRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  clearLink: { fontSize: 13, color: colors.fgMuted },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  suggestionText: { flex: 1, fontSize: 14, color: colors.fg },
  suggestionAdd: { fontSize: 13, fontWeight: "600", color: colors.accent },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.fg, marginBottom: 4 },
  goalHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  goalTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.fg },
  goalPct: { fontSize: 14, fontWeight: "600", color: colors.fgMuted },
  goalDueRow: { paddingVertical: 4, marginBottom: 4 },
  goalDueText: { fontSize: 13, fontWeight: "600", color: "#c77600" },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  taskText: { flex: 1, fontSize: 15, color: colors.fg },
  taskTextDone: { textDecorationLine: "line-through", color: colors.fgMuted },
  repDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 7, marginRight: 4 },
  repTag: { borderRadius: radii.pill, backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 2 },
  repTagText: { fontSize: 11, color: colors.fgMuted, fontWeight: "600" },
  todayLink: { fontSize: 13, fontWeight: "600", color: colors.accent },
  removeLink: { fontSize: 13, color: colors.danger },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { fontSize: 22, color: colors.accent, fontWeight: "600", lineHeight: 24 },
  suggestTasksBtn: { alignSelf: "flex-start", marginTop: 10 },
  suggestTasksBtnText: { fontSize: 13, fontWeight: "600", color: colors.accent },
  repRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  repLabel: { fontSize: 13, color: colors.fgMuted },
  repPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  repPillOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  repPillText: { fontSize: 13, fontWeight: "600", color: colors.fg },
  dueBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  dueBtnOn: { backgroundColor: "#c77600", borderColor: "#c77600" },
  dueBtnText: { fontSize: 13, fontWeight: "600", color: colors.fgMuted },
  pickerBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderCurve: "continuous",
    padding: 18,
    paddingBottom: 32,
    gap: 8,
  },
  pickerTitle: { fontSize: 16, fontWeight: "700", color: colors.fg, textAlign: "center" },
  goalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  goalAction: { fontSize: 14, fontWeight: "600" },
});
