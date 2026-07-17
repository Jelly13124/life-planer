import { Share } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { DecisionStyleSummary } from "@lifeplanner/core/decisionStyle";
import {
  resolveSignedStyleShareResponse,
  type SignedStyleShare,
} from "./decisionStyleShareResponse";
import { SHARE_BASE_URL } from "./supabase";

async function requestSignedShare(summary: DecisionStyleSummary): Promise<SignedStyleShare> {
  const response = await fetch(`${SHARE_BASE_URL}/api/style-share-token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ version: 2, source: summary.source, code: summary.code, scores: summary.scores }),
  });
  if (!response.ok) throw new Error("share-token-failed");
  const signed = resolveSignedStyleShareResponse(await response.json(), SHARE_BASE_URL, summary.code);
  if (!signed) throw new Error("share-token-failed");
  return signed;
}

export async function shareDecisionStyle(summary: DecisionStyleSummary): Promise<"image" | "link"> {
  const signed = await requestSignedShare(summary);
  const file = new File(Paths.cache, `decision-style-${Date.now()}.png`);
  try {
    try {
      const image = await File.downloadFileAsync(signed.pngUrl, file, { idempotent: true });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(image.uri, { mimeType: "image/png", dialogTitle: "分享我的决策人格" });
        return "image";
      }
    } catch {
      // 图片下载/系统图片分享失败时回退到文字链接。
    }
    await Share.share({ message: `我是 ${summary.code}。你是什么？${signed.url}` });
    return "link";
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      // cache 文件由系统回收；清理失败不阻塞分享结果。
    }
  }
}
