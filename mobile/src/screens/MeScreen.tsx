// 我 Tab：个人资料 + 账号/同步（邮箱验证码登录）+ 数据（重置）。
import React from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FREE_AI_OPS_PER_MONTH } from "@lifeplanner/core/aiQuota";
import { AXES } from "@lifeplanner/core/decisionStyle";
import { useApp } from "../state/store";
import { Button, Card, Input, Muted, SectionTitle } from "../ui";
import { colors, space } from "../theme";
import { ensureNotifPermission } from "../lib/notifications";
import { restorePro, MONETIZATION_ENABLED } from "../lib/purchases";
import DecisionStyleQuickTest from "../components/DecisionStyleQuickTest";
import { shareDecisionStyle } from "../lib/decisionStyleShare";
import { trackAppDecisionStyleEvent } from "../lib/decisionStyleAnalytics";
import { DecisionPersonalityCard } from "../components/DecisionPersonalityCard";

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
  const [digestHint, setDigestHint] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState(false);
  const [styleRetake, setStyleRetake] = React.useState(false);
  const [sharingStyle, setSharingStyle] = React.useState(false);
  const [styleDetailsOpen, setStyleDetailsOpen] = React.useState(false);

  const handleStyleShare = React.useCallback(async () => {
    if (!p?.decisionStyle || sharingStyle) return;
    setSharingStyle(true);
    try {
      void trackAppDecisionStyleEvent("style_share");
      await shareDecisionStyle(p.decisionStyle);
    } catch {
      Alert.alert("暂时无法分享", "请联网后再试。");
    } finally {
      setSharingStyle(false);
    }
  }, [p, sharingStyle]);

  const handleRestore = React.useCallback(async () => {
    if (restoring) return;
    setRestoring(true);
    const { isPro, error: err } = await restorePro();
    setRestoring(false);
    if (err) {
      Alert.alert("恢复失败", err);
      return;
    }
    if (isPro) {
      app.setIsPro(true);
      Alert.alert("已恢复", "Pro 会员已恢复");
    } else {
      Alert.alert("未找到购买记录", "该账户没有可恢复的 Pro 购买");
    }
  }, [app, restoring]);

  const digestOn = app.tree?.dailyDigest !== false;
  const handleToggleDigest = React.useCallback(
    async (on: boolean) => {
      app.setDailyDigest(on);
      setDigestHint(null);
      if (on) {
        const granted = await ensureNotifPermission();
        if (!granted) setDigestHint("需要在系统设置里允许通知");
      }
    },
    [app],
  );

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
      {
        text: "退出",
        style: "destructive",
        onPress: () => {
          void app.logout();
          // 登出后卡片会重新出现登录表单：重置到初始态，避免残留旧的验证码步骤/报错。
          // 保留 email 作为下次登录的预填，体验更好。
          setPhase("email");
          setCode("");
          setError(null);
        },
      },
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

      <SectionTitle>职业决策风格</SectionTitle>
      {styleRetake ? (
        <DecisionStyleQuickTest
          embedded
          onComplete={(summary) => {
            app.setDecisionStyleSummary(summary);
            setStyleRetake(false);
            setStyleDetailsOpen(false);
          }}
          onSkip={() => setStyleRetake(false)}
        />
      ) : (
        <Card>
          {p?.decisionStyle ? (
            <>
              <DecisionPersonalityCard summary={p.decisionStyle} compact />
              <View style={styles.styleActions}>
                <Button
                  label={sharingStyle ? "准备分享中…" : "分享我的人格"}
                  loading={sharingStyle}
                  onPress={() => void handleStyleShare()}
                />
                <Button
                  label={styleDetailsOpen ? "收起人格详情" : "查看人格详情"}
                  kind="ghost"
                  onPress={() => setStyleDetailsOpen((open) => !open)}
                />
              </View>
              {styleDetailsOpen ? (
                <View style={styles.styleScoreRow}>
                  {AXES.map((axis) => (
                    <Text key={axis.key} style={styles.styleScore}>
                      {axis.a.label} / {axis.b.label} · {p.decisionStyle!.scores[axis.key]}
                    </Text>
                  ))}
                </View>
              ) : null}
              <Button
                label="重新测试"
                kind="ghost"
                onPress={() => {
                  setStyleDetailsOpen(false);
                  setStyleRetake(true);
                }}
              />
            </>
          ) : (
            <>
              <Muted>还没有测试结果，可以稍后补测。</Muted>
              <Button
                label="开始快测"
                kind="ghost"
                onPress={() => setStyleRetake(true)}
              />
            </>
          )}
        </Card>
      )}

      {/* 商品化暂缓（MONETIZATION_ENABLED=false）：整卡隐藏，开启后原样恢复 */}
      {MONETIZATION_ENABLED ? (
        <>
      <SectionTitle>会员</SectionTitle>
      <Card>
        {app.isPro ? (
          <View>
            <Text style={styles.cardTitle}>Pro 会员 · 无限 AI</Text>
            <View style={styles.linkRow}>
              <Pressable
                hitSlop={8}
                onPress={() => void Linking.openURL("https://apps.apple.com/account/subscriptions")}
              >
                <Text style={styles.link}>管理订阅</Text>
              </Pressable>
              <Pressable hitSlop={8} onPress={() => void handleRestore()}>
                <Text style={styles.link}>{restoring ? "恢复中…" : "恢复购买"}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.cardTitle}>
              免费版 · 本月 AI 额度剩 {app.aiQuotaLeft}/{FREE_AI_OPS_PER_MONTH}
            </Text>
            <Muted style={{ marginTop: 4, marginBottom: 12 }}>
              升级 Pro 解锁无限 AI 推演、拆解目标与畅聊
            </Muted>
            <Button label="升级 Pro" onPress={app.openPaywall} />
          </View>
        )}
      </Card>
        </>
      ) : null}

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

      <SectionTitle>通知</SectionTitle>
      <Card>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>每日提醒</Text>
          <Switch value={digestOn} onValueChange={(v) => void handleToggleDigest(v)} />
        </View>
        <Muted style={{ marginTop: 6 }}>每天固定时段提醒今日任务和连击天数</Muted>
        {digestHint ? <Muted style={{ marginTop: 6 }}>{digestHint}</Muted> : null}
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
  styleActions: { gap: 2, marginTop: 12 },
  styleScoreRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 },
  styleScore: { color: colors.fgMuted, fontSize: 13 },
  linkRow: { flexDirection: "row", gap: 20, marginTop: 12 },
  link: { fontSize: 14, fontWeight: "600", color: colors.accent },
});
