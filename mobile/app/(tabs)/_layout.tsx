// 底部 4 Tab：首页 / 目标 / 人生树 / 我。真线性图标（MaterialCommunityIcons）。
// 「月历」已并入首页（周/月切换）——不再是独立 Tab。
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { colors } from "../../src/theme";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) =>
    <MaterialCommunityIcons name={name} size={size ?? 24} color={color as string} />;

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
      <Tabs.Screen name="index" options={{ title: "首页", tabBarIcon: icon("calendar-today") }} />
      <Tabs.Screen name="goals" options={{ title: "目标", tabBarIcon: icon("target") }} />
      <Tabs.Screen name="tree" options={{ title: "人生树", tabBarIcon: icon("sitemap-outline") }} />
      <Tabs.Screen name="me" options={{ title: "我", tabBarIcon: icon("account-circle-outline") }} />
    </Tabs>
  );
}
