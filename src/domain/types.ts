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
export type SavingsBand = "none" | "lt1w" | "1to10w" | "10to50w" | "50to100w" | "gt100w";
export type DebtBand = "none" | "lt10w" | "10to50w" | "50to100w" | "gt100w";
export type FamilyResponsibility = "none" | "kids" | "parents" | "both";
export type RiskAppetite = "conservative" | "balanced" | "aggressive";

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
  skills?: string;        // 技能/专长（自由文本）
  savings?: SavingsBand;  // 存款区间
  debt?: DebtBand;        // 负债区间
  assets?: string;        // 资产（自由文本，如 房/车/股票）
  family?: FamilyResponsibility; // 家庭责任
  riskAppetite?: RiskAppetite;   // 风险偏好
}

export interface MetricPoint {
  age: number;
  value: number; // 0-100
}

export type Mood = "high" | "mid" | "low";

// 人生维度（用于给节点打标签，比 LifeArea 更全：含居住、身份/签证）
export type Dimension =
  | "career"
  | "finance"
  | "relationships"
  | "health"
  | "housing"
  | "identity"
  | "growth";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  career: "事业",
  finance: "财务",
  relationships: "感情/家庭",
  health: "健康",
  housing: "居住",
  identity: "身份/签证",
  growth: "成长",
};

export const DIMENSIONS: Dimension[] = [
  "career",
  "finance",
  "relationships",
  "health",
  "housing",
  "identity",
  "growth",
];

export interface PathNode {
  age: number;
  title: string;
  story: string;
  mood: Mood;
  dimensions: Dimension[]; // 该关键时刻主要触及的维度
}

export type CurveShape =
  | "rise-steep"
  | "rise-gentle"
  | "dip-rise"
  | "decline"
  | "flat";

export type PathKind = "status-quo" | "choice";

// 走向变体（同一选择的三种可能）
export type Scenario = "optimistic" | "likely" | "conservative";

export interface LifePath {
  id: string;
  choiceLabel: string; // 这条路代表的选择
  kind: PathKind;
  summary: string; // 一句话结局
  color: string; // 曲线颜色（hex）
  curve: CurveShape;
  endValue: number; // 终点综合人生指数 0-100
  nodes: PathNode[]; // 关键节点（6-10）
  metrics: Record<LifeArea, MetricPoint[]>; // 各领域随年龄变化
  // ---- 递归树 / 多走向（R6 / P2）----
  parentId: string | null; // 父分支 id；null = 从"现在"分叉
  forkAge: number; // 从哪一年分叉出来（根分支 = profile.age）
  scenario: Scenario; // 该分支属于哪种走向
  note?: string; // 用户对这条路的补充/更正（喂回 AI 重新推演用）
}

export type Reversibility = "one-way" | "two-way"; // 单行道 / 可回头
export type PlanHorizon = "30d" | "90d";

export interface PlanStep {
  id: string;
  text: string;
  done: boolean;
}
export interface Experiment {
  id: string;
  text: string;
  done: boolean;
}
export interface Plan {
  horizon: PlanHorizon;
  steps: PlanStep[];
  experiments: Experiment[];
  generatedByAI: boolean;
}

export type ReviewOutcome = 1 | 2 | 3 | 4 | 5; // 1 远差于预期 … 5 远好于预期
export interface Review {
  reviewedAt: string;
  whatHappened: string;
  outcome: ReviewOutcome;
  lesson: string;
}

export interface Decision {
  id: string;
  pathId: string;
  choiceLabel: string;
  createdAt: string;
  rationale: string;
  expectation: string;
  confidence: number; // 0-100
  reversibility: Reversibility;
  reviewDate: string; // ISO = createdAt + horizon
  plan: Plan;
  review: Review | null;
}

// ───────── 规划主线：目标（一个长期目标 = 树上一条分支） ─────────
export type GoalHorizon = "short" | "long";
export type GoalStatus = "active" | "done";

export interface GoalAction {
  id: string;
  text: string;
  done: boolean;
  repeat?: "daily" | "weekly"; // 缺省=一次性（里程碑，计入进度）；重复行动=日常纪律，不计入进度
  scheduledDate?: string;   // 一次性行动排到的本地日 YYYY-MM-DD（未排期则无）
  repeatWeekday?: number;   // 仅 weekly：锚定星期几 0=周日…6=周六（用于在月历上落位）
}

export interface Goal {
  id: string;
  area: LifeArea; // 事业/财富/关系/健康/成长
  horizon: GoalHorizon;
  title: string;
  why: string;
  status: GoalStatus;
  createdAt: string;
  parentGoalId: string | null; // 短期目标挂到某个长期目标；长期目标为 null
  pathId: string | null; // 仅长期目标：它在树上长出的那条分支 id
  actions: GoalAction[];
  completedAt?: string;
  lastReviewedAt?: string;
  deadline?: string; // 本地日 YYYY-MM-DD（截止日，可选）
  tags?: string[];   // 用户自定义标签（过滤/归组用，可选）
}

// 新建目标的入参（id/status/createdAt/actions 由 createGoal 补全）
export interface GoalInput {
  area: LifeArea;
  horizon: GoalHorizon;
  title: string;
  why: string;
  parentGoalId?: string | null;
  pathId?: string | null;
}

// ───────── 每日激励闭环：今日计划 / 连续天数 / 完成热力图 ─────────
// 一天的活动：当天挑进"今天"的行动 id + 当天勾掉完成的行动 id。date 用本地日 YYYY-MM-DD。
export interface ActivityDay {
  date: string; // 本地日期 YYYY-MM-DD（由 state 层注入，不在领域层取 new Date）
  plannedActionIds: string[];
  completedActionIds: string[];
}

export interface InboxItem {
  id: string;
  text: string;
  createdAt: string;
}

export interface LifeTree {
  id: string;
  profile: Profile;
  horizonYears: number; // 推演跨度
  paths: LifePath[]; // 含 1 条 status-quo + N 条 choice
  decisions: Decision[]; // 决策日志（看见→追问→选定→落地→复盘）
  goals: Goal[]; // 规划主线：长期/短期目标
  activity: ActivityDay[]; // 每日激励闭环：今日计划/完成记录
  inbox: InboxItem[]; // 快捷收件箱：随手捕获，回头再归类
  createdAt: string;
  updatedAt: string;
}

// 综合人生指数：各领域加权平均（v1 等权）。刻意是"主观状态感受"，非客观真理。
export function compositeIndex(areas: Record<LifeArea, number>): number {
  const sum = LIFE_AREAS.reduce((acc, a) => acc + (areas[a] ?? 50), 0);
  return Math.round(sum / LIFE_AREAS.length);
}
