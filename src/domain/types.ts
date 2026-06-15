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

export type EducationLevel = "highschool" | "college" | "bachelor" | "master" | "phd";
export type SalaryBand = "none" | "lt5" | "5to10" | "10to20" | "20to50" | "gt50";
export type RelationshipStatus =
  | "single"
  | "dating"
  | "married"
  | "married_kids"
  | "divorced"
  | "na";

export interface Profile {
  name: string;
  age: number; // 当前年龄（预测从这里往后）
  education: EducationLevel;
  major: string; // 专业（可空）
  occupation: string; // 现在的职业（可空）
  salary: SalaryBand; // 月薪区间
  hasSideHustle: boolean; // 有没有副业
  sideHustle: string; // 副业是什么（可空）
  hobbies: string; // 爱好（可空）
  relationship: RelationshipStatus; // 情感/婚姻状态
  location: string; // 现在生活在哪（国家/城市），用于现实约束（可空）
  status: string; // 现在的身份/阶段，如 H1B工作签 / 在读 / 工作3年（可空）
  snapshot: string; // 由结构化信息自动汇总的现状描述
  areas: Record<LifeArea, number>; // 各领域起点 0-100，由上面信息推导
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
