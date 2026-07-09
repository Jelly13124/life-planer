// iOS 主屏小组件的数据通道：把树的关键指标写进 App Group UserDefaults，
// Swift 侧（mobile/targets/widget/index.swift）读同一 key 渲染。
// ⚠️ @bacons/apple-targets 的原生模块只存在于重新 EAS 构建后的包里；
// Expo Go / 旧 TestFlight 包 / Android 里必须整体 no-op（模式同 notifications.ts：
// 惰性 import + try/catch，任何失败都静默，不影响应用主流程）。
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { LifeTree } from "@lifeplanner/core/types";
import { currentStreakWithFreeze } from "@lifeplanner/core/streak";
import { todayItems } from "@lifeplanner/core/daily";
import { effectiveFeasibility } from "@lifeplanner/core/feasibility";

// 与 app.json / targets/widget/expo-target.config.js 的 App Group 保持一致。
const APP_GROUP = "group.com.jelly13124.lifeplanner";
const SNAPSHOT_KEY = "widgetSnapshot";

// Expo Go 检测（同 notifications.ts）：storeClient / appOwnership==="expo" 即 Expo Go。
const IS_EXPO_GO =
  Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient";

// Swift 侧的 Decodable 结构与此一一对应（index.swift 的 WidgetSnapshot）。
interface WidgetSnapshot {
  streak: number;
  todayCount: number;
  chosenLabel: string | null;
  chosenFeasibility: number | null; // 0-100 整数；未选路线 / 路线无可行度 → null
  updatedAt: string;
}

type AppleTargetsModule = typeof import("@bacons/apple-targets");

let mod: AppleTargetsModule | null = null;
let storage: InstanceType<AppleTargetsModule["ExtensionStorage"]> | null = null;

// 惰性加载 ExtensionStorage：非 iOS / Expo Go / 模块加载失败 → null（绝不抛错）。
async function getStorage(): Promise<{
  storage: NonNullable<typeof storage>;
  mod: AppleTargetsModule;
} | null> {
  if (Platform.OS !== "ios" || IS_EXPO_GO) return null;
  if (mod && storage) return { storage, mod };
  try {
    const m = await import("@bacons/apple-targets");
    mod = m;
    storage = new m.ExtensionStorage(APP_GROUP);
    return { storage, mod: m };
  } catch {
    return null;
  }
}

// 写一份小组件快照并请求 WidgetKit 刷新。同步签名、内部 fire-and-forget；
// 老构建里原生模块是 no-op 桩（或加载失败被吞），对主流程零影响。
export function writeWidgetSnapshot(tree: LifeTree, today: string): void {
  void (async () => {
    const loaded = await getStorage();
    if (!loaded) return;
    try {
      const chosen = tree.paths.find((p) => p.id === tree.chosenPathId) ?? null;
      const snapshot: WidgetSnapshot = {
        streak: currentStreakWithFreeze(tree, today),
        todayCount: todayItems(tree, today).length,
        chosenLabel: chosen?.choiceLabel ?? null,
        chosenFeasibility: chosen
          ? Math.round(effectiveFeasibility(tree, chosen)?.value ?? chosen.feasibility ?? 0)
          : null,
        updatedAt: new Date().toISOString(),
      };
      loaded.storage.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
      loaded.mod.ExtensionStorage.reloadWidget();
    } catch {
      // 小组件刷新失败不影响应用主流程
    }
  })();
}
