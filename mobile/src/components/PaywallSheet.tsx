// 付费墙弹层："人生树 Pro" —— 无限 AI 额度 + 年度/月度会员方案。
// 原生 IAP 模块/key 缺失时优雅降级：显示「购买暂未开放」而不是报错或崩溃（见 ../lib/purchases）。
import React from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FREE_AI_OPS_PER_MONTH } from "@lifeplanner/core/aiQuota";
import { Button, Card, Muted } from "../ui";
import { colors, radii, space } from "../theme";
import { useApp } from "../state/store";
import { Icon } from "./icons";
import {
  getProPackages,
  purchasePro,
  purchasesAvailable,
  restorePro,
  type ProPackage,
} from "../lib/purchases";

const TERMS_URL = "https://life-planer-opal.vercel.app/terms";
const PRIVACY_URL = "https://life-planer-opal.vercel.app/privacy";

const BENEFITS = [
  "无限 AI 推演与重推",
  "高光/平稳/低谷三种走向",
  "AI 拆解目标与建议任务",
  "未来自我畅聊",
];

export function PaywallSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const app = useApp();
  const [packages, setPackages] = React.useState<ProPackage[]>([]);
  const [loadingPkgs, setLoadingPkgs] = React.useState(false);
  const [buyingId, setBuyingId] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    // 重置态放进 .then 回调（而非 effect 顶层直接调用），避免触发
    // react-hooks/set-state-in-effect（effect 内同步 setState 会连锁重渲染）。
    void Promise.resolve()
      .then(() => {
        setError(null);
        setLoadingPkgs(true);
        return getProPackages();
      })
      .then((list) => {
        if (!cancelled) setPackages(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingPkgs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleBuy = React.useCallback(
    async (pkg: ProPackage) => {
      setError(null);
      setBuyingId(pkg.id);
      const { isPro, error: err } = await purchasePro(pkg);
      setBuyingId(null);
      if (err) {
        setError(err);
        return;
      }
      if (isPro) {
        app.setIsPro(true);
        onClose();
        Alert.alert("欢迎加入 Pro", "无限 AI 推演已解锁");
      }
      // isPro=false 且 err=null：用户取消购买，静默不提示。
    },
    [app, onClose],
  );

  const handleRestore = React.useCallback(async () => {
    setError(null);
    setRestoring(true);
    const { isPro, error: err } = await restorePro();
    setRestoring(false);
    if (err) {
      setError(err);
      return;
    }
    if (isPro) {
      app.setIsPro(true);
      onClose();
      Alert.alert("欢迎回来", "已恢复 Pro 会员");
    } else {
      setError("未找到可恢复的购买记录");
    }
  }, [app, onClose]);

  const used = Math.max(0, FREE_AI_OPS_PER_MONTH - app.aiQuotaLeft);
  const available = purchasesAvailable();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>人生树 Pro</Text>
                <Muted>解锁无限 AI</Muted>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="关闭"
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
              >
                <Icon name="close" size={20} color={colors.fg} />
              </Pressable>
            </View>

            <Card style={{ marginTop: 4 }}>
              {BENEFITS.map((b) => (
                <View key={b} style={styles.benefitRow}>
                  <Icon name="check" size={18} color={colors.accent} />
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </Card>

            <Muted style={styles.quotaLine}>
              免费版每月 {FREE_AI_OPS_PER_MONTH} 点 AI 额度，已用 {used} 点
            </Muted>

            {!available ? (
              <Card style={{ marginTop: 4 }}>
                <Muted style={styles.centerText}>购买暂未开放，敬请期待</Muted>
              </Card>
            ) : loadingPkgs ? (
              <Card style={{ marginTop: 4 }}>
                <Muted style={styles.centerText}>加载方案中…</Muted>
              </Card>
            ) : packages.length === 0 ? (
              <Card style={{ marginTop: 4 }}>
                <Muted style={styles.centerText}>暂时无法获取方案，请稍后再试</Muted>
              </Card>
            ) : (
              <View style={{ marginTop: 4 }}>
                {packages.map((pkg) => (
                  <Card key={pkg.id} style={pkg.isAnnual ? styles.pkgCardHighlight : undefined}>
                    {pkg.trialLabel ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{pkg.trialLabel}</Text>
                      </View>
                    ) : null}
                    <View style={styles.pkgRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pkgTitle}>{pkg.title}</Text>
                        <Text style={styles.pkgPrice}>{pkg.priceString}</Text>
                      </View>
                      <Button
                        label={
                          buyingId === pkg.id
                            ? "处理中…"
                            : pkg.trialLabel
                              ? "开始免费试用"
                              : "立即订阅"
                        }
                        onPress={() => void handleBuy(pkg)}
                        loading={buyingId === pkg.id}
                        disabled={buyingId !== null}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            )}

            {error ? <Muted style={styles.errorText}>{error}</Muted> : null}

            <Pressable
              hitSlop={8}
              onPress={() => void handleRestore()}
              disabled={restoring}
              style={styles.restoreRow}
            >
              <Text style={styles.link}>{restoring ? "恢复中…" : "恢复购买"}</Text>
            </Pressable>

            <View style={styles.linkRow}>
              <Pressable hitSlop={8} onPress={() => void Linking.openURL(TERMS_URL)}>
                <Text style={styles.linkMuted}>服务条款</Text>
              </Pressable>
              <Pressable hitSlop={8} onPress={() => void Linking.openURL(PRIVACY_URL)}>
                <Text style={styles.linkMuted}>隐私政策</Text>
              </Pressable>
            </View>

            <Muted style={styles.footnote}>免费额度每月自动重置，不订阅也能一直用</Muted>
            <Muted style={styles.finePrint}>订阅将通过 Apple 账户自动续订，可随时在系统设置取消</Muted>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderCurve: "continuous",
    maxHeight: "88%",
  },
  content: { padding: space, paddingBottom: 36 },
  head: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.fg, marginBottom: 2 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  benefitText: { fontSize: 14, color: colors.fg, flex: 1 },
  quotaLine: { marginVertical: 12, textAlign: "center" },
  centerText: { textAlign: "center" },
  pkgCardHighlight: { borderWidth: 1.5, borderColor: colors.accent },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: colors.accent },
  pkgRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pkgTitle: { fontSize: 16, fontWeight: "700", color: colors.fg },
  pkgPrice: { fontSize: 14, color: colors.fgMuted, marginTop: 2 },
  errorText: { color: colors.danger, textAlign: "center", marginTop: 10 },
  restoreRow: { marginTop: 16, alignItems: "center" },
  link: { fontSize: 14, fontWeight: "600", color: colors.accent },
  linkRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 14 },
  linkMuted: { fontSize: 13, color: colors.fgMuted, textDecorationLine: "underline" },
  footnote: { textAlign: "center", marginTop: 16, fontSize: 12 },
  finePrint: { textAlign: "center", marginTop: 4, fontSize: 11 },
});
