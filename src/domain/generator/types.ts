import type { LifePath, PathKind, Profile, Scenario } from "../types";

export interface GenerateInput {
  profile: Profile;
  choiceLabel: string;
  kind: PathKind;
  horizonYears: number;
  index: number; // 该路径在树中的序号，用作种子的一部分
  // ---- 递归树 / 多走向（可选）----
  parentId?: string | null; // 父分支 id；不传 = 根（从现在分叉）
  forkAge?: number; // 从哪一年分叉；不传 = profile.age
  scenario?: Scenario; // 走向变体；不传 = likely
}

// 生成器接口 —— UI 只依赖它。
// v1: LocalPathGenerator（确定性、无密钥）。
// 未来: ClaudePathGenerator（真实大模型，签名一致）。见 ./claudeGenerator.ts.txt
export interface PathGenerator {
  generate(input: GenerateInput): LifePath;
}
