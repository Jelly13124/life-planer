// 分享卡通用流程：组 payload → 建分享行（写 shares 表）→ 弹系统分享面板。
// 未登录/未配置/写入失败时给出温和中文提示，不抛错、不阻塞。
import { Alert, Share } from "react-native";
import { createShare, shareUrl, type SharePayload } from "./supabase";

export async function shareCard(payload: SharePayload, message: string): Promise<void> {
  const id = await createShare(payload);
  if (!id) {
    Alert.alert("暂时无法分享", "请先在「我」页登录（云同步），或稍后再试。");
    return;
  }
  try {
    await Share.share({ message: `${message} ${shareUrl(id)}` });
  } catch {
    // 用户取消分享面板等：静默
  }
}
