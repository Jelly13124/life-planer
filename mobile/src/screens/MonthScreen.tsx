// 月历 Tab：整月日历。点某天 → 设为当前日并跳回首页。
import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApp } from "../state/store";
import { MonthView } from "../components/calendar";
import { colors, space } from "../theme";

export default function MonthScreen() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const vy = Number(app.viewDate.slice(0, 4));
  const vm = Number(app.viewDate.slice(5, 7));

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space }]}>
      <Text style={styles.h1}>月历</Text>
      <MonthView
        year={vy}
        month={vm}
        today={app.today}
        viewDate={app.viewDate}
        densityOf={(d) => app.actionsOn(d).length}
        onPickDay={(d) => {
          app.setViewDate(d);
          router.navigate("/");
        }}
        onShiftMonth={(d) => app.setViewDate(d)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space, paddingBottom: 48 },
  h1: { fontSize: 28, fontWeight: "700", color: colors.fg, marginBottom: 14 },
});
