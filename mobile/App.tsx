// Life Planner — 移动端入口（Expo / React Native）。
// Phase 2：状态层（AsyncStorage + 共享领域核心）+ 头两个真实屏（今日 / 目标）。
// 导航暂用底部双 Tab；expo-router + 人生树/选择面板等屏在 Phase 3 接。
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { AppProvider, useApp } from "./src/state/store";
import TodayScreen from "./src/screens/TodayScreen";
import GoalsScreen from "./src/screens/GoalsScreen";
import { Spinner } from "./src/ui";
import { colors } from "./src/theme";

type Tab = "today" | "goals";

const TOP_PAD = Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 24) : 56;

function Shell() {
  const { ready } = useApp();
  const [tab, setTab] = useState<Tab>("today");

  return (
    <View style={styles.root}>
      <View style={[styles.body, { paddingTop: TOP_PAD }]}>
        {!ready ? <Spinner /> : tab === "today" ? <TodayScreen /> : <GoalsScreen />}
      </View>
      <View style={styles.tabBar}>
        <TabButton label="今日" active={tab === "today"} onPress={() => setTab("today")} />
        <TabButton label="目标" active={tab === "goals"} onPress={() => setTab("goals")} />
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tab} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <Text style={[styles.tabText, active && { color: colors.accent, fontWeight: "700" }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  tabText: { fontSize: 14, color: colors.fgMuted },
});
