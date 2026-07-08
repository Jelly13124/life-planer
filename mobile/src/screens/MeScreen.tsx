// 我 Tab：个人资料 + 账号/同步（邮箱验证码登录）+ 数据（重置）。
import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state/store";
import { Button, Card, Input, Muted, SectionTitle } from "../ui";
import { colors, space } from "../theme";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function MeScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const p = app.tree?.profile;

  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [phase, setPhase] = React.useState<"email" | "code">("email");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSendCode = React.useCallback(async () => {
    const target = email.trim();
    if (!target || pending) return;
    setError(null);
    setPending(true);
    const err = await app.sendLoginCode(target);
    setPending(false);
    if (err) {
      setError(err);
    } else {
      setPhase("code");
    }
  }, [app, email, pending]);

  const handleLogin = React.useCallback(async () => {
    const target = code.trim();
    if (!target || pending) return;
    setError(null);
    setPending(true);
    const err = await app.loginWithOtp(email.trim(), target);
    setPending(false);
    if (err) {
      setError(err);
    } else {
      setCode("");
    }
  }, [app, email, code, pending]);

  const handleSwitchEmail = () => {
    setPhase("email");
    setCode("");
    setError(null);
  };

  const confirmReset = () =>
    Alert.alert("重置全部数据", "会清空人生树、目标和任务，重新填写资料。此操作不可撤销。", [
      { text: "取消", style: "cancel" },
      { text: "重置", style: "destructive", onPress: () => app.reset() },
    ]);

  const confirmLogout = () =>
    Alert.alert("退出登录", "本地数据保留，仅停止云同步", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => void app.logout() },
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
        {!app.cloudEnabled ? (
          <Muted>云同步未配置</Muted>
        ) : !app.cloudUserId ? (
          <View>
            <Text style={styles.cardTitle}>云同步</Text>
            <Muted style={{ marginBottom: 12 }}>
              登录后你的人生树会在设备间自动同步（不登录也能正常使用）
            </Muted>
            {phase === "email" ? (
              <>
                <Input
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setError(null);
                  }}
                  placeholder="邮箱"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{ marginBottom: 10 }}
                />
                {error ? <Muted style={styles.errorText}>{error}</Muted> : null}
                <Button
                  label={pending ? "发送中…" : "发送验证码"}
                  onPress={() => void handleSendCode()}
                  loading={pending}
                  disabled={pending || !email.trim()}
                />
              </>
            ) : (
              <>
                <Muted style={{ marginBottom: 10 }}>验证码已发到 {email}</Muted>
                <Input
                  value={code}
                  onChangeText={(v) => {
                    setCode(v);
                    setError(null);
                  }}
                  placeholder="6 位验证码"
                  keyboardType="number-pad"
                  maxLength={6}
                  style={{ marginBottom: 10 }}
                />
                {error ? <Muted style={styles.errorText}>{error}</Muted> : null}
                <Button
                  label={pending ? "登录中…" : "登录"}
                  onPress={() => void handleLogin()}
                  loading={pending}
                  disabled={pending || code.trim().length !== 6}
                />
                <View style={styles.linkRow}>
                  <Pressable hitSlop={8} onPress={() => void handleSendCode()}>
                    <Text style={styles.link}>重新发送</Text>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={handleSwitchEmail}>
                    <Text style={styles.link}>换个邮箱</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ) : (
          <View>
            <Row label="账号" value="已登录" />
            <View style={styles.divider} />
            {app.syncState === "synced" ? (
              <Row label="同步状态" value={`已同步 · ${formatTime(app.lastSyncAt)}`} />
            ) : app.syncState === "error" ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>同步状态</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={[styles.rowValue, { color: colors.danger }]}>同步失败</Text>
                  <Pressable hitSlop={8} onPress={() => app.retrySync()}>
                    <Text style={styles.link}>重试</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Row label="同步状态" value="同步待启动" />
            )}
            <View style={{ height: 12 }} />
            <Button label="退出登录" kind="ghost" onPress={confirmLogout} />
          </View>
        )}
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
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.fg, marginBottom: 6 },
  errorText: { color: colors.danger, marginBottom: 10 },
  linkRow: { flexDirection: "row", gap: 20, marginTop: 12 },
  link: { fontSize: 14, fontWeight: "600", color: colors.accent },
});
