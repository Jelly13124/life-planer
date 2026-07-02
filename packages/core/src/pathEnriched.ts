import type { LifePath } from "./types";

// 本地生成器写的占位 note（见 generator/localGenerator.ts）；带这个 note = 尚未经 AI 确认。
export const COARSE_FEASIBILITY_NOTE = "粗估，接入 AI 后更准";

// 是否已由 AI 确认基线可能性：显式 enriched，或有真实（非占位）可行度依据。
export function isEnriched(path: LifePath): boolean {
  if (path.enriched === true) return true;
  return path.feasibility != null && !!path.feasibilityNote && path.feasibilityNote !== COARSE_FEASIBILITY_NOTE;
}
