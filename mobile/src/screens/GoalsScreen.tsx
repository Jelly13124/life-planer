// 目标屏：建立长期目标 → 加任务/习惯 → 勾选完成（喂今日/连续天数）→ 完成目标。
// 全部数据走共享领域核心；可选「AI 建议目标」走后端（离线则提示无后端）。
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  GOAL_AREAS,
  GOAL_AREA_LABELS,
  type GoalArea,
  type Goal,
} from "@lifeplanner/core/types";
import { useApp } from "../state/store";
import { hasBackend, type GoalSuggestion } from "../lib/api";
import { Button, Card, Checkbox, Dot, Input, Muted, Progress, SectionTitle } from "../ui";
import { colors, AREA_COLORS, space } from "../theme";

export default function GoalsScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState<GoalArea>("career");
  const [title, setTitle] = useState("");
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<GoalSuggestion[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const setTaskInput = (key: string, v: string) =>
    setTaskInputs((m) => ({ ...m, [key]: v }));

  const submitGoal = () => {
    if (!title.trim()) return;
    app.addLongGoal(area, title, undefined);
    setTitle("");
  };

  const submitTask = (goalId: string) => {
    const text = taskInputs[goalId] ?? "";
    if (!text.trim()) return;
    app.addTaskToGoal(goalId, text);
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
        <SectionTitle>建立长期目标</SectionTitle>
        <View style={styles.chipRow}>
          {GOAL_AREAS.map((a) => {
            const active = a === area;
            return (
              <Pressable
                key={a}
                onPress={() => setArea(a)}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: AREA_COLORS[a], borderColor: AREA_COLORS[a] }
                    : { borderColor: colors.line },
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
        <View style={{ height: 10 }} />
        <Button label="建立目标" onPress={submitGoal} disabled={!title.trim()} />
        <View style={{ height: 8 }} />
        <Button
          label={suggesting ? "AI 思考中…" : "AI 建议目标"}
          kind="ghost"
          onPress={runSuggest}
          loading={suggesting}
        />
        {suggestions && suggestions.length > 0 ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            {suggestions.map((s, i) => (
              <Pressable
                key={`${s.title}-${i}`}
                style={styles.suggestion}
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
          <Muted>建立第一个长期目标，开始把人生方向拆成可执行的任务。</Muted>
        </Card>
      ) : (
        app.longGoals.map((goal) => {
          const ac = AREA_COLORS[goal.area];
          const progress = app.progressOf(goal);
          const shorts = app.shortGoalsOf(goal.id);
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

              {/* 任务 */}
              {goal.tasks.map((task) => (
                <View key={task.id} style={styles.taskRow}>
                  <Checkbox
                    checked={task.done}
                    accent={ac}
                    onPress={() => app.toggleTaskDone(task.id)}
                  />
                  <Text style={[styles.taskText, task.done && styles.taskTextDone]}>
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
              ))}

              {/* 习惯（只读展示） */}
              {goal.habits.map((habit) => (
                <View key={habit.id} style={styles.taskRow}>
                  <View style={[styles.habitTick, { borderColor: ac }]} />
                  <Text style={styles.taskText}>
                    {habit.text}
                    <Text style={styles.habitTag}>
                      {"  "}
                      {habit.repeat === "daily" ? "每日" : "每周"}
                    </Text>
                  </Text>
                  <Pressable onPress={() => app.removeItem(habit.id)} hitSlop={6}>
                    <Text style={styles.removeLink}>删</Text>
                  </Pressable>
                </View>
              ))}

              {/* 短期目标（紧凑展示） */}
              {shorts.length > 0 ? (
                <View style={styles.shortsWrap}>
                  {shorts.map((s) => (
                    <Text key={s.id} style={styles.shortItem}>
                      · {s.title}
                    </Text>
                  ))}
                </View>
              ) : null}

              {/* 加任务 */}
              <View style={styles.addRow}>
                <Input
                  value={taskInputs[goal.id] ?? ""}
                  onChangeText={(v) => setTaskInput(goal.id, v)}
                  placeholder="添加任务…"
                  onSubmitEditing={() => submitTask(goal.id)}
                  returnKeyType="done"
                  style={{ flex: 1 }}
                />
                <Pressable onPress={() => submitTask(goal.id)} style={styles.addBtn}>
                  <Text style={styles.addBtnText}>＋</Text>
                </Pressable>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space, paddingBottom: 48 },
  h1: { fontSize: 30, fontWeight: "700", color: colors.fg, marginBottom: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.fg },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  suggestionText: { flex: 1, fontSize: 14, color: colors.fg },
  suggestionAdd: { fontSize: 13, fontWeight: "600", color: colors.accent },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.fg, marginBottom: 4 },
  goalHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  goalTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.fg },
  goalPct: { fontSize: 14, fontWeight: "600", color: colors.fgMuted },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
  },
  taskText: { flex: 1, fontSize: 15, color: colors.fg },
  taskTextDone: { textDecorationLine: "line-through", color: colors.fgMuted },
  habitTick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  habitTag: { fontSize: 12, color: colors.fgMuted },
  todayLink: { fontSize: 13, fontWeight: "600", color: colors.accent },
  removeLink: { fontSize: 13, color: colors.danger },
  shortsWrap: {
    marginTop: 6,
    marginLeft: 4,
    gap: 2,
    borderLeftWidth: 2,
    borderLeftColor: colors.line,
    paddingLeft: 10,
  },
  shortItem: { fontSize: 13, color: colors.fgMuted },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { fontSize: 22, color: colors.accent, fontWeight: "600", lineHeight: 24 },
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
