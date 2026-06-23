# 两级目标(长期/短期)+ 时间窗 AI 规划 — 设计

日期：2026-06-21 · 分支：`feat/goal-planning-mainline` · 状态：模型已与用户敲定(选 option 2:短期=独立目标挂长期;子目标并入短期),确认"就这样开建"。

## 背景 / 产品判断
不是所有目标都该上人生树。**长期目标 = 方向/身份级(获得健康的身体)→ 上树、改未来预测**;**短期目标 = 时间盒阶段(一个月减肥10斤)→ 挂在长期下、不上树**。几个短期目标拼成一个长期目标(一条路)。这是目标模型第三次调整(扁平→嵌套→两级挂靠);通过无损迁移(保 id)+ 可回退 + 迁移测试控制风险。

## 新模型(src/domain/types.ts)
给 `Goal` 增加：
```ts
export type GoalKind = "long" | "short";
// Goal 增加：
//   kind: GoalKind;                 // 必填
//   parentGoalId?: string | null;   // short → 其 long 父目标；long → null
// 删除 Subgoal 类型 + Goal.subgoals（并入短期目标）。
```
- **长期目标**：`kind:"long"`, `parentGoalId:null`，可有 `pathId`(分支)。通常无硬截止。进度 = 旗下短期目标 + 自身直挂指标/任务 的综合。
- **短期目标**：`kind:"short"`, `parentGoalId:<longId>`，**带 startDate/endDate**，**无 pathId**(不上树)。直接装 `metrics/tasks/habits`。
- `LifeTree.goals: Goal[]` 仍是扁平数组(长+短混在一起,靠 kind/parentGoalId 区分),便于 allTasks/日历/清单遍历。

## 迁移(无损,保 id)—— src/domain/migrateGoals.ts + repository/normalize.ts
数据可能是三种形态之一,统一迁到"两级":
1. **legacy 扁平**(goals 带 `horizon`/`parentGoalId`/`actions`)：legacy 本就是两级 → 直接转：long 目标→`kind:"long"`;short 目标→`kind:"short"`+保留 parentGoalId;`actions` 按 repeat 拆成 tasks/habits;`deadline`→`endDate`。无父的 short → 当 long(或挂到无?保守:当 long)。
2. **nested**(当前生产形态：goal 带 `subgoals[]`)：拍平 —— 每个顶层 Goal → long 目标(去掉 subgoals,保留自身 metrics/tasks/habits/pathId/dates/id);它的每个 Subgoal S → 一个 short 目标 `{ id:S.id, kind:"short", parentGoalId:G.id, area:G.area, title:S.title, why:"", status:"active", createdAt:G.createdAt, startDate:G.startDate, endDate:G.endDate, metrics:S.metrics, tasks:S.tasks, habits:S.habits }`。
3. **已是两级**(有 `kind`、无 `subgoals`)：原样通过(幂等)。
`normalizeLoadedTree` 探测:任一 goal 有 `actions`/`horizon` → 先 legacy→two-tier;有 `subgoals` → nested→two-tier;有 `kind` 且无 `subgoals` → 通过。保证每个 goal/subgoal/task/habit/metric 的 id 都在输出里(不变量测试)。activity 一律不动(按 id 对齐继续成立)。

## 适配器(src/domain/goalTree.ts,纯)
没有 subgoal 层后更简单——只遍历 goals:
- `allTasks(tree)` / `allHabits(tree)` / `allMetrics(tree)` → 遍历每个 goal 的数组(返回 `{ goal, task }` 等;不再有 subgoal 字段)。
- `findItem(tree,id)` / `findTask` / `findHabit` → 跨所有 goal 找。
- `longGoals(tree)` / `shortGoalsOf(tree, longId)` / `goalById`。
- 写：`addLongGoal(tree, input, now)` · `addShortGoal(tree, parentLongId, input, now)` · `updateGoalById(tree,id,patch)` · `removeGoalById(tree,id)`(**long → 级联删它的 short 子目标 + 各自 tasks/habits + 清 activity + 删分支;short → 删自身 tasks/habits + 清 activity**) · `addTask(tree, goalId, text, now)` / `addHabit(...)`(直接挂在某 goal 上,不再有 subgoalId 参数) · `setMetric(tree, goalId, metric)` / `removeMetric` / `bumpMetric`。
- 习惯结束日:`addHabit`/`updateHabit` 时,若所属 goal 有 endDate,则该习惯在 endDate 后不再"到期"(见 calendar/daily 的 due 判断,而非删数据)。

## 进度 / 完成 / 复盘(src/domain/goals.ts)
- `goalProgress(tree, goal)`：
  - **short**：(已完成 tasks + 已达成 metrics)/总数;空则 0。
  - **long**：综合 = (自身直挂 tasks/metrics 的完成数 + 各 short 子目标的"完成度")/(自身单元数 + short 子目标数);short 子目标"完成"= 其 progress≥1 或 status==="done"。habits 不计入。
- `completeGoal`：**仅 long 目标完成时给领域 +bump**(它才是改未来的;short 完成只推动 long 进度)。`other` 领域仍不 bump。
- `dueGoalReviews`：沿用 createdAt 基线;主要面向 long 目标(short 可不催;实现时 long-only 以免噪音)。

## 习惯绑定目标结束日
`Habit` 不必加字段——它的"窗口"由所属 goal 的 `endDate` 决定。`calendar.actionsOnDay` / `daily.recurringDueToday` 判断习惯到期时,若 `date > 所属 goal.endDate` 则不再出现。需要 allHabits 返回所属 goal(已有)。

## AI(接上轮"好")
- **`/api/decompose-goal`(已存在,改造)**：输入一个 **long 目标**(title/why/area/时间范围)→ 产出 **3-4 个 short 目标**,每个含 建议的 metrics/tasks/habits。预览面板勾选 → 一次快照建成 short 目标(parentGoalId=long.id)。
- **`/api/plan-short-goal`(新)**：输入一个 **short 目标 + 其 tasks/habits + 起止时间 + 作息窗**→ 在窗口内按**合理频率**(如每周 3 次、共 N 周)排期(给 scheduledDate / 习惯 repeatWeekday),**不填满每一天**;离线本地兜底(均匀铺到窗口内的若干天)。预览 → 确认排。
- 两个 AI 都:DeepSeek + 离线兜底 + 每 IP 限流;预览后才落地。

## 受影响清单(重写消费方,语义不变)
- domain：goalTree(重) / goals(进度+完成) / daily(habit 窗口) / calendar(habit 窗口) / habits / areas(按 area 列 long+其 short) / insights / weekly / guide / inbox? / tree。
- state：AppContext 全部目标方法(addLongGoal/addShortGoal/updateGoal/removeGoalById/addTask/addHabit/setMetric/bumpMetric/decompose/planShortGoal)。
- UI：PlanScreen(领域→长期→短期→{指标/任务/习惯};只有长期"成长为分支";AI 拆/规划);CalendarPlannerScreen(目标列=long,进度为综合;短期挂其下);AreasSection(long 按 area,short 归在其 long 下);Today/AllTasks/Completed/Tag/Upcoming/DayView/Month/Year 复用 allTasks(基本不动);ChoicePanel decideChoice→建 long 目标。

## 验收
旧数据(扁平/嵌套)升级无损(历史/连续/排期不乱,id 对齐);新建分长期/短期;短期挂长期、带时间、不上树;长期上树、进度=旗下综合;习惯到期不超过所属目标结束日;AI 拆长期→短期、AI 规划短期在窗口内不填满;tsc/test/build 全绿。

## 分阶段(writing-plans 细化,每阶段 tsc+test+build+评审+提交)
1. 类型(kind/parentGoalId,删 Subgoal)+ 迁移(legacy/nested/two-tier 三态→两级,保 id,不变量测试)+ goalTree 适配器重写 + 测试。
2. domain 消费方(goals 进度/完成、daily/calendar 习惯窗口、habits/areas/insights/weekly/guide/tree)+ 测试。
3. AppContext 目标方法重写(含 habit 绑定 endDate)。
4. PlanScreen 两级 UI(长期卡含短期卡;每级 CRUD;只有长期上树)。
5. 其余组件适配(calendar 首页/areas/choices 等)。
6. AI:decompose-goal 改造(long→short 预览)+ plan-short-goal(窗口内排,预览)+ 习惯窗口生效。
7. i18n + 全量验证 + 对抗评审 + 真机冒烟。

## 诚实风险
第三次动目标模型;迁移叠加(legacy→nested→two-tier 三态)。靠 id 保留 + 三态幂等 + "每个输入 id 可达"不变量测试 + 分阶段可回退控制。增量风险仍在,故每阶段必过迁移测试 + 评审。
