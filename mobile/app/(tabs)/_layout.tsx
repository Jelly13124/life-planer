// 底部 4 Tab：人生树 / 日历 / 目标 / 我（人生树默认落地）。
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { colors } from "../../src/theme";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
const icon =
  (name: IconName) => {
    function TabBarIcon({ color, size }: { color: ColorValue; size: number }) {
      return <MaterialCommunityIcons name={name} size={size ?? 24} color={color as string} />;
    }
    return TabBarIcon;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.fgMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          height: 60,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "人生树", tabBarIcon: icon("sitemap-outline") }} />
      <Tabs.Screen name="calendar" options={{ title: "日历", tabBarIcon: icon("calendar-month-outline") }} />
      <Tabs.Screen name="goals" options={{ title: "目标", tabBarIcon: icon("target") }} />
      <Tabs.Screen name="me" options={{ title: "我", tabBarIcon: icon("account-circle-outline") }} />
    </Tabs>
  );
}
