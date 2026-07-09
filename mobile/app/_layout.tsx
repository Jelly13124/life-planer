// 根布局（expo-router）：装 SafeArea + 应用状态 Provider，并在树加载完成前显示加载态。
// 路由文件只在 app/ 下；真正的屏幕组件在 src/screens/（避免在 app/ 里堆组件）。
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AppProvider, useApp } from "../src/state/store";
import { Spinner } from "../src/ui";
import OnboardingScreen from "../src/screens/OnboardingScreen";
import { PaywallSheet } from "../src/components/PaywallSheet";

function Gate() {
  const { ready, tree } = useApp();
  if (!ready) return <Spinner />;
  if (!tree) return <OnboardingScreen />; // 未引导：直接渲染引导屏（非路由），完成后进入主界面
  return <Stack screenOptions={{ headerShown: false }} />;
}

// Paywall 挂载点：需在 AppProvider 内部才能读到 useApp()，故独立成一个子组件
// （而非直接写进 RootLayout，RootLayout 本身在 Provider 外层）。全局仅挂一次。
function PaywallHost() {
  const { paywallOpen, closePaywall } = useApp();
  return <PaywallSheet visible={paywallOpen} onClose={closePaywall} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <Gate />
          <PaywallHost />
          <StatusBar style="dark" />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
