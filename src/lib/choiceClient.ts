// 客户端安全：AI 分析选项利弊这一段的网络封装。失败/离线一律回退到本地 localChoiceAnalysis，
// 永远 resolve 出一份每个选项 id 都有效的 ChoiceAnalysis。镜像 planShortClient.ts。
import {
  localChoiceAnalysis,
  type AnalyzeOption,
  type ChoiceAnalysis,
} from "@/lib/choiceAnalysis";
import type { Profile } from "@/domain/types";
import { currentLocale } from "@/i18n/locale";

export interface ChoiceAnalysisPayload {
  question: string;
  options: AnalyzeOption[];
  profile: Profile;
}

export async function fetchChoiceAnalysis(
  payload: ChoiceAnalysisPayload,
): Promise<ChoiceAnalysis> {
  const local = (): ChoiceAnalysis => localChoiceAnalysis(payload.options);
  try {
    const res = await fetch("/api/analyze-choice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: payload.question,
        options: payload.options,
        profile: payload.profile,
        lang: currentLocale(),
      }),
    });
    if (!res.ok) return local();
    const data = (await res.json()) as { analysis?: ChoiceAnalysis };
    const analysis = data.analysis && typeof data.analysis === "object" ? data.analysis : {};
    // 兜底补齐：确保每个传入的选项 id 都有有效结构（AI/网络可能漏给）。
    const fallback = local();
    const out: ChoiceAnalysis = {};
    for (const o of payload.options) {
      out[o.id] = analysis[o.id] ?? fallback[o.id];
    }
    return out;
  } catch {
    return local();
  }
}
