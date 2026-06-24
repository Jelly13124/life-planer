// 底部 5 Tab：首页(周+当天时间轴) / 月历 / 目标 / 人生树 / 我。极简线条风（小圆点图标，无 emoji）。
import { Tabs } from "expo-router";
import { View, type ColorValue } from "react-native";
import { colors } from "../../src/theme";

function TabDot({ color }: { color: ColorValue }) {
  return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.fgMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "首页", tabBarIcon: ({ color }) => <TabDot color={color} /> }}
      />
      <Tabs.Screen
        name="month"
        options={{ title: "月历", tabBarIcon: ({ color }) => <TabDot color={color} /> }}
      />
      <Tabs.Screen
        name="goals"
        options={{ title: "目标", tabBarIcon: ({ color }) => <TabDot color={color} /> }}
      />
      <Tabs.Screen
        name="tree"
        options={{ title: "人生树", tabBarIcon: ({ color }) => <TabDot color={color} /> }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: "我", tabBarIcon: ({ color }) => <TabDot color={color} /> }}
      />
    </Tabs>
  );
}
