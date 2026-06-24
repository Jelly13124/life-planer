// 我 Tab：个人资料 + 账号/同步（占位）+ 数据（重置）。
import React from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state/store";
import { hasBackend } from "../lib/api";
import { Button, Card, Muted, SectionTitle } from "../ui";
import { colors, space } from "../theme";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function MeScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const p = app.tree?.profile;

  const confirmReset = () =>
    Alert.alert("重置全部数据", "会清空人生树、目标和任务，重新填写资料。此操作不可撤销。", [
      { text: "取消", style: "cancel" },
      { text: "重置", style: "destructive", onPress: () => app.reset() },
    ]);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space }]}>
      <Text style={styles.h1}>我</Text>

      <Card>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(p?.name || "你").slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{p?.name || "你"}</Text>
            <Muted>{p?.snapshot || "还没填写资料"}</Muted>
          </View>
        </View>
      </Card>

      <SectionTitle>账号与同步</SectionTitle>
      <Card>
        <Row label="云同步" value={hasBackend() ? "后端已配置" : "未连接 · 本地存储"} />
        <View style={styles.divider} />
        <Muted>登录与多设备同步即将到来（Supabase）。</Muted>
      </Card>

      <SectionTitle>数据</SectionTitle>
      <Card>
        <Button label="重置全部数据（重新填写资料）" kind="danger" onPress={confirmReset} />
      </Card>

      <Muted style={{ textAlign: "center", marginTop: 20 }}>Life Planner · 人生树</Muted>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space, paddingBottom: 48 },
  h1: { fontSize: 28, fontWeight: "700", color: colors.fg, marginBottom: 14 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: colors.accent },
  name: { fontSize: 18, fontWeight: "700", color: colors.fg, marginBottom: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontSize: 15, color: colors.fg },
  rowValue: { fontSize: 14, color: colors.fgMuted },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginVertical: 10,
  },
});
