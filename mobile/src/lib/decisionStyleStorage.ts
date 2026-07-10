import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DecisionStyleLocalDetail } from "@lifeplanner/core/decisionStyle";

export const DECISION_STYLE_DETAIL_KEY = "lifeplanner.decision-style.v2.detail";

export async function loadDecisionStyleDetail(): Promise<DecisionStyleLocalDetail | null> {
  try {
    const raw = await AsyncStorage.getItem(DECISION_STYLE_DETAIL_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as DecisionStyleLocalDetail;
    return value?.version === 2 && Array.isArray(value.answers) && value.tieBreaks ? value : null;
  } catch {
    return null;
  }
}

export async function saveDecisionStyleDetail(detail: DecisionStyleLocalDetail): Promise<void> {
  try {
    await AsyncStorage.setItem(DECISION_STYLE_DETAIL_KEY, JSON.stringify(detail));
  } catch {
    // 本地存储失败不阻塞 onboarding。
  }
}

export async function clearDecisionStyleDetail(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DECISION_STYLE_DETAIL_KEY);
  } catch {
    // ignore
  }
}
