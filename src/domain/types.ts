// 领域模型 —— 见 docs/superpowers/specs/2026-06-15-life-planner-design.md 第 4 节

export type LifeArea =
  | "career" // 事业
  | "wealth" // 财富
  | "relationships" // 关系
  | "health" // 健康
  | "growth"; // 成长

export const LIFE_AREAS: LifeArea[] = [
  "career",
  "wealth",
  "relationships",
  "health",
  "growth",
];

export const AREA_LABELS: Record<LifeArea, string> = {
  career: "事业",
  wealth: "财富",
  relationships: "关系",
  health: "健康",
  growth: "成长",
};

export interface Profile {
  name: string;
  age: number; // 当前年龄
  snapshot: string; // 现状自述（自由文本）
  areas: Record<LifeArea, number>; // 各领域当前状态 0-100
  crossroad: string; // 当前面临的岔路/纠结
}

export interface MetricPoint {
  age: number;
  value: number; // 0-100
}

export type Mood = "high" | "mid" | "low";

export interface PathNode {
  age: number;
  title: string;
  story: string;
  mood: Mood;
}

export type CurveShape =
  | "rise-steep"
  | "rise-gentle"
  | "dip-rise"
  | "decline"
  | "flat";

export type PathKind = "status-quo" | "choice";

export interface LifePath {
  id: string;
  choiceLabel: string; // 这条路代表的选择
  kind: PathKind;
  summary: string; // 一句话结局
  color: string; // 曲线颜色（hex）
  curve: CurveShape;
  endValue: number; // 终点综合人生指数 0-100
  nodes: PathNode[]; // 3-5 个关键节点
  metrics: Record<LifeArea, MetricPoint[]>; // 各领域随年龄变化
}

export interface LifeTree {
  id: string;
  profile: Profile;
  horizonYears: number; // 推演跨度
  paths: LifePath[]; // 含 1 条 status-quo + N 条 choice
  createdAt: string;
  updatedAt: string;
}

// 综合人生指数：各领域加权平均（v1 等权）。刻意是"主观状态感受"，非客观真理。
export function compositeIndex(areas: Record<LifeArea, number>): number {
  const sum = LIFE_AREAS.reduce((acc, a) => acc + (areas[a] ?? 50), 0);
  return Math.round(sum / LIFE_AREAS.length);
}
