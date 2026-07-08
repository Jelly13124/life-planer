// 领域模型 —— 见 docs/superpowers/specs/2026-06-15-life-planner-design.md 第 4 节

import type { IcsEvent } from "./ics";
export type { IcsEvent };

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

// 目标领域 = 5 个人生面 + 「其他」（中性桶，不参与 Profile.areas / 预测）。
export type GoalArea = LifeArea | "other";
export const GOAL_AREAS: GoalArea[] = [...LIFE_AREAS, "other"];
export const GOAL_AREA_LABELS: Record<GoalArea, string> = { ...AREA_LABELS, other: "其他" };

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
  nationality?: string; // 国籍/出生国（可选，如 中国大陆 / 印度 / 美国），用于签证排期等现实校准
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
  // 职场人格测试结果（可选；旧数据无此字段，optional 即 backfill，无需迁移）
  lifePathCode?: string;         // 4 字母码，如 "FDBV"
  lifePathAnswers?: { statementId: string; value: number }[]; // 原始答案（便于复算/回显）
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
  // ---- 现实可行度（仅 choice 路有；衡量从主角真实起点到这条路要求的差距，不是"预测会成真"）----
  feasibility?: number; // 0-100 整数：对他多够得着（status-quo 不设）
  feasibilityNote?: string; // ≤20 字依据（如「有设计功底+已起号，但变现门槛高」）
  enriched?: boolean; // AI 已确认基线可能性（否则只有本地占位，不展示可能性）
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

// ───────── 规划主线：两级目标 —— 长期目标 ⊃ 短期目标（均直挂 { Metric, Task }，重复任务走 Task.repeat） ─────────
export type GoalStatus = "active" | "done";

// 目标层级：long = 长期/身份级（上树、改预测）；short = 时间盒阶段（挂长期下、不上树）。
export type GoalKind = "long" | "short";

// 成功指标：数字/百分比/单位（如 存款 0→100000 元、体脂 25→18 %）
export interface Metric {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: string;
}

// 一次性任务（里程碑，计入进度）
export interface Task {
  id: string;
  text: string;
  done: boolean;
  scheduledDate?: string; // 排到的本地日 YYYY-MM-DD（未排期则无）
  startTime?: string;     // 本地时刻 HH:MM 24h（仅在 scheduledDate 已排期时有意义）
  durationMin?: number;   // 时长（分钟），未设时默认 60
  repeat?: "daily" | "weekly"; // 有值 = 重复任务（按天完成，走 activity）；无值 = 一次性
  repeatWeekday?: number;      // 仅 weekly：0=周日…6=周六
}

// 目标 Plan：扁平两级 —— 靠 kind/parentGoalId 区分长期/短期，直挂指标/任务/习惯。
//   long：kind:"long"，parentGoalId:null，可有 pathId（分支），通常无硬截止。
//   short：kind:"short"，parentGoalId:<longId>，带 startDate/endDate，无 pathId（不上树）。
export interface Goal {
  id: string;
  kind: GoalKind; // long = 长期（上树）；short = 短期（挂长期下、不上树）
  parentGoalId?: string | null; // short → 其 long 父目标；long → null
  area: GoalArea; // 事业/财富/关系/健康/成长/其他（other 不参与预测）
  title: string;
  why: string;
  status: GoalStatus;
  createdAt: string;
  startDate?: string; // 起（本地日 YYYY-MM-DD）
  endDate?: string;   // 止（本地日 YYYY-MM-DD，替代旧 deadline）
  pathId?: string | null; // 目标 → 人生树分支 id（仅 long 使用）
  tags?: string[];    // 用户自定义标签（过滤/归组用，可选）
  favorite?: boolean; // 收藏（进侧边栏「收藏」组，可选，无需迁移）
  metrics: Metric[];  // 目标级指标
  tasks: Task[];      // 目标级一次性任务
  completedAt?: string;
  lastReviewedAt?: string;
}

// ───────── 选择面板：独立的决策对比模型（与绑定 pathId 的 Decision 并存） ─────────
// 复用现有 Reversibility（"one-way" | "two-way"）。
export interface ChoiceOption {
  id: string;
  label: string;          // 选项名，如「去大厂」/「创业」
  pros: string;           // 利（自由文本，按行）
  cons: string;           // 弊
  cost: string;           // 成本（时间/金钱/机会）
  reversibility: Reversibility; // 可逆性（单行道/可回头）
  gut: number;            // 直觉分 1-5
  pathId?: string | null; // 该选项在树上的分支（推演后回填）
}

export interface Choice {
  id: string;
  question: string;       // 我面临的选择
  createdAt: string;
  options: ChoiceOption[];
  chosenOptionId?: string | null; // 选定的选项
  decidedAt?: string;
}

// ───────── 迁移用旧类型（仅供 normalize → migrateGoals 读取，不在新代码中使用） ─────────

// 旧嵌套形态的习惯（habits[] 里的一项，Habit 类型已并入 Task.repeat，仅供迁移读取旧数据）。
export interface LegacyHabit {
  id: string;
  text: string;
  repeat: "daily" | "weekly";
  repeatWeekday?: number;
  startTime?: string;
  durationMin?: number;
}

// 旧嵌套形态的子目标（goal.subgoals[] 里的一项）。两级化后并入 short Goal。
export interface NestedSubgoal {
  id: string;
  title: string;
  metrics?: Metric[];
  tasks?: Task[];
  habits?: LegacyHabit[];
}

// 旧嵌套形态的目标（带 subgoals[]，无 kind）。两级化后 → 一个 long Goal + N 个 short Goal。
export interface NestedGoal {
  id: string;
  area: GoalArea;
  title: string;
  why: string;
  status: GoalStatus;
  createdAt: string;
  startDate?: string;
  endDate?: string;
  pathId?: string | null;
  tags?: string[];
  favorite?: boolean;
  completedAt?: string;
  lastReviewedAt?: string;
  metrics?: Metric[];
  tasks?: Task[];
  habits?: LegacyHabit[];
  subgoals: NestedSubgoal[];
}

export interface LegacyGoalAction {
  id: string;
  text: string;
  done: boolean;
  repeat?: "daily" | "weekly";
  repeatWeekday?: number;
  scheduledDate?: string;
  startTime?: string;
  durationMin?: number;
}

export interface LegacyGoal {
  id: string;
  area: LifeArea;
  horizon: "long" | "short";
  title: string;
  why: string;
  status: "active" | "done";
  createdAt: string;
  parentGoalId: string | null;
  pathId: string | null;
  actions: LegacyGoalAction[];
  deadline?: string;
  tags?: string[];
  completedAt?: string;
  lastReviewedAt?: string;
}

// ───────── 每日激励闭环：今日计划 / 连续天数 / 完成热力图 ─────────
// 一天的活动：当天挑进"今天"的行动 id + 当天勾掉完成的行动 id。date 用本地日 YYYY-MM-DD。
export interface ActivityDay {
  date: string; // 本地日期 YYYY-MM-DD（由 state 层注入，不在领域层取 new Date）
  plannedActionIds: string[];
  completedActionIds: string[];
}

export interface LifeTree {
  id: string;
  profile: Profile;
  horizonYears: number; // 推演跨度
  paths: LifePath[]; // 含 1 条 status-quo + N 条 choice
  decisions: Decision[]; // 决策日志（看见→追问→选定→落地→复盘）
  goals: Goal[]; // 规划主线：长期/短期目标
  tasks: Task[]; // 无目标的散任务（goal-less，如「临时买菜」）—— 与 goal.tasks 区分，挂树根
  choices: Choice[]; // 选择面板：决策对比（与人生树打通）
  activity: ActivityDay[]; // 每日激励闭环：今日计划/完成记录
  calendarFeeds: CalendarFeed[]; // 只读外部日历（ICS 订阅源 / 上传文件），叠加在月/日视图
  dayStart?: string; // 清醒时段起点 HH:MM（未设默认 07:00）
  dayEnd?: string;   // 清醒时段终点 HH:MM（未设默认 23:00）
  guideDismissed?: boolean; // 首次上手引导是否已关闭（undefined=未关→仍显示，无需迁移）
  chosenPathId?: string | null; // 用户「正在走」的那条路（选定）；未选 = undefined/null
  freezeDays?: string[]; // 被补签卡保护的日期 YYYY-MM-DD（每月免费 2 张，自动使用）
  createdAt: string;
  updatedAt: string;
}

// ───────── 只读日历导入（P4 ICS）：外部订阅源 / 上传文件 → 月/日视图只读叠加 ─────────
// url：订阅地址（https .ics），每次进应用按它重新代取最新事件（不持久化事件本身）。
// events：上传 .ics 文件时把客户端解析出的事件内联存下（无 url，离线也在）。
// 二者互斥使用：链接订阅用 url；文件上传用 events。
export interface CalendarFeed {
  id: string;
  name: string;
  url?: string;
  events?: IcsEvent[];
}

// 综合人生指数：各领域加权平均（v1 等权）。刻意是"主观状态感受"，非客观真理。
export function compositeIndex(areas: Record<LifeArea, number>): number {
  const sum = LIFE_AREAS.reduce((acc, a) => acc + (areas[a] ?? 50), 0);
  return Math.round(sum / LIFE_AREAS.length);
}
