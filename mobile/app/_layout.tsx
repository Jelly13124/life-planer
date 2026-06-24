// 根布局（expo-router）：装 SafeArea + 应用状态 Provider，并在树加载完成前显示加载态。
// 路由文件只在 app/ 下；真正的屏幕组件在 src/screens/（避免在 app/ 里堆组件）。
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AppProvider, useApp } from "../src/state/store";
import { Spinner } from "../src/ui";

function Gate() {
  const { ready } = useApp();
  if (!ready) return <Spinner />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Gate />
        <StatusBar style="dark" />
      </AppProvider>
    </SafeAreaProvider>
  );
}
