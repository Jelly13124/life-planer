# 嵌套目标架构（从零重写类型）— 设计

日期：2026-06-19
状态：方向 + "从零重写"已确认（用户拍板，明知风险）；待用户复核 spec → writing-plans → 分阶段 subagent 构建
分支：`feat/goal-planning-mainline`

## 目标层级（用户画的）
Vision（愿景＝人生树/预测，保留）→ Life Area（5 个固定领域，容器）→ Goal Plan（目标，带起止时间）→ Subgoal（子目标）→ { Success Metric（数字/百分比/单位）, Task（一次性）, Habit（重复） }

## 这是高风险大改 —— 安全策略
- **保留 id**：迁移时旧 action 的 id 原样变成 task/habit 的 id，所以 `activity`（按 id 记完成/计划）与排期、连续天数、热力图全部继续对得上，无需重算历史。
- **适配器优先**：提供扁平访问器（`allTasks(tree)`/`allHabits(tree)` → `{goal, subgoal?, item}`），让"读"型领域函数（today/calendar/streak/insights）改动最小；"写"型按 id 在 goal→subgoal 嵌套里定位。
- **迁移无损**：`normalizeLoadedTree` 检测旧结构（goals 带 `actions`/`horizon`/`parentGoalId`）→ 转成新嵌套；旧 localStorage 一条不丢。新建 = 直接新结构。
- **分阶段、每步验证 + 评审、可回滚**。

## 新类型（src/domain/types.ts）
```ts
export type LifeArea = "career" | "wealth" | "relationships" | "health" | "growth"; // 不变（容器）

export interface Metric { id: string; label: string; current: number; target: number; unit: string }
export interface Task { id: string; text: string; done: boolean; scheduledDate?: string; startTime?: string; durationMin?: number }
export interface Habit { id: string; text: string; repeat: "daily" | "weekly"; repeatWeekday?: number; startTime?: string; durationMin?: number }
export interface Subgoal { id: string; title: string; metrics: Metric[]; tasks: Task[]; habits: Habit[] }
export interface Goal {            // = Goal Plan
  id: string;
  area: LifeArea;
  title: string;
  why: string;
  status: "active" | "done";
  createdAt: string;
  startDate?: string;              // 起（YYYY-MM-DD）
  endDate?: string;               // 止（替代旧 deadline）
  pathId?: string | null;         // 仍：目标 → 人生树分支
  tags?: string[];
  metrics: Metric[];              // 目标级指标
  subgoals: Subgoal[];
  tasks: Task[];                  // 目标级一次性任务（不在子目标下）
  habits: Habit[];               // 目标级习惯
  completedAt?: string;
  lastReviewedAt?: string;
}
// LifeTree.goals: Goal[] （嵌套）；activity / inbox / paths / decisions / dayStart/dayEnd 不变。
```
（删除旧 `GoalAction`/`GoalHorizon`/`GoalInput`，或保留为"迁移用旧类型" `LegacyGoal` 仅供 normalize 读。）

## 迁移（旧 → 新，无损，保留 id）
`src/domain/migrateGoals.ts`（纯）：输入旧 goals[]（flat，带 horizon/parentGoalId/actions），输出新 Goal[]：
- 旧"长期"目标（或 parentGoalId==null）→ 新顶层 Goal。其 `actions` 按 `repeat` 拆成 `tasks`(无 repeat) / `habits`(有 repeat)，挂在 Goal 级。`deadline`→`endDate`，`tags`/`pathId` 保留，`metrics`/`subgoals` 初始 []。
- 旧"短期"目标（parentGoalId 指向某长期）→ 该长期目标下的一个 `Subgoal`（title 保留，actions 同样拆 tasks/habits，metrics []）。
- 无父的短期目标 → 顶层 Goal（同长期处理）。
- task/habit 的 id = 旧 action 的 id（关键，保历史对齐）。
`normalizeLoadedTree` 里探测：若任一 goal 含 `actions` 字段或缺 `subgoals` 字段 → 跑迁移。

## 适配器 + 受影响清单
新增 `src/domain/goalTree.ts`（纯访问器/写入）：
- `allTasks(tree): { goal: Goal; subgoal: Subgoal | null; task: Task }[]`
- `allHabits(tree): { goal: Goal; subgoal: Subgoal | null; habit: Habit }[]`
- `findTask(tree,id)` / `findHabit(tree,id)` / `findItem(tree,id)`（→ 含归属链）
- 写：`updateTask(tree,id,patch)` / `updateHabit` / `removeItem(tree,id)` / `addTask(tree, goalId, subgoalId|null, text)` / `addSubgoal(tree, goalId, title)` / `addGoal` / `setMetric(tree, ownerId, metric)` / `bumpMetric(...)` 等——按 id 在嵌套里定位修改。
重写以下消费方改用访问器（语义不变）：
- domain：`daily.ts`（complete/uncomplete/isDone/recurringDue/todayItems/streak/heatmap/removeEverywhere）、`calendar.ts`（actionsOnDay/unscheduled/setScheduledDate）、`schedule.ts`（setActionTime/arrange items）、`goals.ts`（progress 改为 指标+任务+子目标 综合；completeGoal area bump 保留）、`habits.ts`、`areas.ts`、`insights.ts`、`weekly.ts`、`guide.ts`、`tree.ts`(createTree)、`inbox.ts`(promote)。
- state：`AppContext.tsx` 全部目标/任务/习惯/排期/指标方法。
- UI：`PlanScreen`（改成 领域→目标(时间+指标)→子目标→任务/习惯 的嵌套增删）、`CalendarPlannerScreen`、`DayView`、`MonthCalendar`、`HabitsSection`、`AreasSection`、`InsightsSection`、`WeeklyReviewSheet`、`InboxSection`、`GettingStarted`、`LifeMap` markers。

## 进度/指标语义
- `goalProgress`：综合 = (已完成 tasks + 已达成 metrics(current≥target 记 1，或按比例) + 子目标完成度) / 总数；具体权重在实现时定，纯函数 + 测试。
- 习惯仍不计入"里程碑进度"（连续/热力图单独）。

## 分阶段（writing-plans 细化；每步 tsc+test+build+评审）
1. **新类型 + 迁移 + 适配器（含测试）** —— 不接 UI；旧测试可能大面积改，先让 domain 编译 + 迁移测试过。
2. **重写 domain 消费方**（daily/calendar/schedule/goals/habits/areas/insights/weekly/guide/inbox/tree）走访问器；改它们的测试。
3. **AppContext** 方法重写（建目标/子目标/任务/习惯、设指标、排期、删除）。
4. **PlanScreen** 嵌套层级 UI（增删每层 + 指标编辑 + 目标时间范围）。
5. **其余组件适配**（calendar/day/habits/areas/insights/weekly/inbox/guide/lifemap）。
6. **i18n + 全量验证 + 真机冒烟**。

## 验收
旧 localStorage 升级无损（历史完成/连续/排期不乱）；新建走嵌套；PlanScreen 能在 领域→目标→子目标→{指标/任务/习惯} 各层增删改；指标可设/更新且驱动进度；日历/今日/习惯/洞察/本周回顾照常；tsc/test/build 全绿。

## 诚实风险（再次声明）
即便保 id + 适配器，这仍是动整层数据模型 + 全部消费方 + 大量测试的重写；阶段 1-2 期间测试会红一阵；务必逐阶段提交、可回滚。增量"加字段法"能得到同样的用户界面且风险低得多——已被用户否决，按"从零重写"执行。
