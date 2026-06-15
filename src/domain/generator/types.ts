import type { LifePath, PathKind, Profile } from "../types";

export interface GenerateInput {
  profile: Profile;
  choiceLabel: string;
  kind: PathKind;
  horizonYears: number;
  index: number; // 该路径在树中的序号，用作种子的一部分
}

// 生成器接口 —— UI 只依赖它。
// v1: LocalPathGenerator（确定性、无密钥）。
// 未来: ClaudePathGenerator（真实大模型，签名一致）。见 ./claudeGenerator.ts.txt
export interface PathGenerator {
  generate(input: GenerateInput): LifePath;
}
