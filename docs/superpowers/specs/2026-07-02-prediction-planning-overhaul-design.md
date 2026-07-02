# 预测 + 计划大改（两端 + 共享核心）

- 日期：2026-07-02
- 状态：设计已确认（brainstorming），过夜自主执行
- 范围：共享核心 `packages/core` + 网页（root）+ 手机（`mobile/`）。用户实测后的一批修复。

## 动机

用户真机体验后提的一批问题，归为两条线：预测/AI 的真实性与手感，计划/任务的模型与调度流。四个已确认决策：

1. **任务统一**：保留"重复"作为任务的**可选属性**，不再分「每日/每周任务」两栏 —— `Habit` 合并进 `Task`。**两端一起迁移**。
2. **去本地假兜底**：AI 不可达时显示"推演中/重试"，不塞本地假故事/假目标/假可能性（AI-vs-本地不再打架）。**保留**：树的曲线几何（数学坐标，非假内容）+ **已推演过并持久化的人生离线仍可见**（只有"生成新预测"需要联网）。
3. **AI 算可能性 + 行动仍爬升**：乐观/中性/保守的基线可能性由 AI 给，用户完成挂路任务时乐观占比仍往上推（保留"越努力越乐观"闭环）。
4. **乐观/中性/保守原地实时切换**，不跳新界面、不按需重新生成。

## 数据模型变更（共享核心，linchpin，最先做，必须两端保持绿）

### Task 吸收 Habit
- `Task` 增加可选：`repeat?: "daily" | "weekly"`；`repeatWeekday?: number`（仅 weekly）。（`startTime?`/`durationMin?`/`scheduledDate?` 已有。）
- **移除 `Habit` 接口**、`Goal.habits`、`LifeTree.habits`。习惯改为"带 `repeat` 的 Task"，并入 `Goal.tasks` / `LifeTree.tasks`。
- **完成语义**（关键，迁移必须守住）：
  - `repeat` 未设的一次性任务 → 完成 = `Task.done`（排期后当天完成也走 activity 记录，与现状一致）。
  - `repeat` 已设的重复任务 → **按天完成**，走现有 `activity`/`ActivityDay` + `toggleActionOn`/`applyComplete` 路径（与旧 Habit 完全相同的按天记录），`done` 布尔对重复任务无意义（不参与）。
- **迁移** `normalizeLoadedTree`（幂等、无损、纯）：把任意历史树里的 `goal.habits[]` / `tree.habits[]` 逐条转成 `{...habit, done:false}` 形态的 Task 追加进对应 `tasks[]`（保 id，保 `repeat/repeatWeekday/startTime/durationMin`）；删除 `habits` 字段。已是新形态（无 habits 字段）→ 原样透传。带**幂等 + 无损**测试（对齐既有 `migrateGoals` 风格）。
- `daily.ts`：`todayItems` / `currentStreak` / `heatmap` 改为从"重复任务"派生（原先读 habits 的逻辑改读 `tasks.filter(t => t.repeat)`）。完成记录仍走 activity，连续天数/热力图口径不变。

### 消费面清单（迁移 sweep，tsc 兜底查漏）
- 核心：`types.ts`（模型）、`tree.ts`、`goals.ts`、`goalTree.ts`、`schedule.ts`、`calendar.ts`、`daily.ts`、`habits.ts`（并入 tasks 或删）、`planShort.ts`、`quickParse.ts`、`areas.ts`、`repository/normalize.ts`、`migrateGoals.ts` + 所有相关 `__tests__`。
- 网页：`state/AppContext.tsx`、`components/{TodayView,DayView,AppShell,PlanScreen,UpcomingTimeline,HabitsSection,AreasSection}.tsx`、`app/page.tsx`、`app/api/{decompose-goal,plan-short-goal}/route.ts`、`lib/{planShortClient,goalClient,decompose}.ts`、`i18n/messages.ts`（新串仅追加）。`HabitsSection` → 变成"重复任务"视图（保留入口，改数据源）。
- 手机：`state/store.tsx`（`addHabitToGoal` → `addTaskToGoal(..., {repeat})`；派生）、`screens/{ScheduleScreen,GoalsScreen}.tsx`（不再分每日/每周栏，统一"任务"，重复作为标记）。

## 七条工作流（过夜执行顺序）

### WS1 — 任务统一（核心迁移 + 两端适配）
上面的模型变更全部落地。**门槛：`/green` 全绿（网页）+ `mobile tsc` 干净 + 迁移幂等/无损测试通过**。这是地基，必须先完成再进后续。

### WS3 — AI 给基线可能性 + 行动爬升（核心 + 两端）
- `enrich` 路由返回**基线可行度/可能性**（已返回 `feasibility`）——这就是 AI 给的基线，作为唯一真值来源。
- 可能性 = `scenarioOdds(effectiveFeasibility)`，其中 `effectiveFeasibility = AI基线 + 进度bump`。**保留** bump（越努力乐观越高）。odds 映射函数不变，输入改为 AI 基线。
- **与 WS2 一致**：本地生成器创建路时仍会写一个占位 `feasibility`（供内部计算不崩），但**只要该路尚未经 AI enrich 确认**，UI 就不展示可能性数字——显示推演中（WS5 动画）/ 失败给重试（WS2），绝不把本地粗估当可能性呈现给用户。路径对象加一个"已 AI 确认"标记（如 `enriched: true` 或复用 `feasibilityNote` 非空判断），UI 据此决定显示 odds 还是重试态。
- 两端详情页显示同一套。

### WS4 — 乐观/中性/保守原地切换（手机）
- 推演一条路时**一次性备好 3 个走向的数据**（曲线 + 故事 + 节点），存在同一路对象上（或作为该路的 `scenarios` 子结构），不再靠 `addScenarioVariant` 按需生成兄弟路。
- 详情页 `pickScenario` 改为**只切本地渲染状态**，不再 `router.replace(/path/${variant.id})`、不再触发生成。切换即时、无导航。

### WS2 — 去本地假兜底（手机为主，核心少量）
- `decomposePathIntoGoals`、路径 enrich、建议任务：AI 不可达（`!hasBackend()` 或调用失败）→ 显示**"AI 暂时不可用，重试"** 态 + 重试按钮，**不**创建本地假目标/假故事。移除 `localPathGoals` 作为"静默替身"的用法（函数可留作显式占位，但不自动塞）。
- **保留**：`layoutMap` 曲线几何（本地数学）；已持久化的树/路（离线可看，历史预测不丢）。
- 更新规则文档 `.claude/rules/ai-and-secrets.md`：把"每个 AI 路由必须有离线兜底"改为反映新架构（内容类 AI 无假兜底、给重试态；已存数据离线可读；纯几何/确定性数学保留）。这是用户明确的架构决策，覆盖原铁律。

### WS7 — 调度流：目标页建任务 → 月视图派到某天 → 周视图分配时段（手机）
- 目标页（GoalsScreen）建任务 = 未排期 Task（挂目标下）。
- 首页**月视图**：点未排任务 → 点某天 = 设 `scheduledDate`（派到那天）。
- 首页**周视图**：点当天任务 → 选时段 = 设 `startTime`/`durationMin`（现有 `TimePickSheet`）。
- 顺 2026-07-01 合并后的首页（周/月切换）做清楚：月=派天，周=派时段。

### WS6 — AI 建议任务（手机）
- 目标详情：「AI 建议任务」→ `fetchGoalActions`（`/api/goal-actions`）→ 生成挂该目标的任务，用户可留/删/改。无兜底（WS2 口径）：不可达给重试。

### WS5 — AI 推演动画（手机）
- 手机推演（enrich / 拆解）时全屏过场动画，观感对齐网页 `PredictionOverlay`（曲线/进度感），替掉现在的"AI 推演中…"文字 + `SkeletonCard`。

## 优先级（若过夜跑不完）
WS1 必须完成（地基）。体验最痛的 WS4（原地切换）+ WS5（动画）排前。WS2（去兜底）风险孤立，可最后。顺序：WS1 → WS3 → WS4 → WS2 → WS7 → WS6 → WS5。

## 护栏
- 核心纯净：迁移/odds 等纯函数无 `Date.now`/`Math.random`/argless `new Date`；TDD。
- i18n：新用户串走 `t(...)`，仅在 `messages.ts` 追加英文条目，中文标点键加引号，无 ASCII 引号夹中文。
- 主题：苹果白 + 线性图标，无 emoji。手机沿用现有 theme token。
- 每个 WS 收口：`/green`（tsc+vitest+build，清 `.next`）+ `cd mobile && npx tsc --noEmit`。
- 部署：手机纯 JS → OTA（`eas update --environment production`，现已注册 `EXPO_PUBLIC_API_BASE_URL`，见 memory `mobile-ota-first`）；网页推 master → Vercel。**过夜只提交、不自动 OTA/部署**——早上用户确认后再统一发（除非明确要边跑边发）。

## 非目标（YAGNI）
- 不做手机端 Supabase 同步（另立）。
- 不新增习惯以外的重复类型（只 daily/weekly）。
- 不重做网页整体 IA；`HabitsSection` 只换数据源为"重复任务"，不重构布局。

## 验证 / 交付
- 核心：新/改纯函数 TDD；`vitest` 全绿；迁移幂等+无损测试。
- 网页：`/green`。手机：`mobile tsc` + `eas update` 前 Metro 打包过。
- 真机（用户晨间）：无每日/每周分栏、统一任务 + 可设重复；目标建任务→月派天→周派时段；选路 enrich 有动画；乐观/中性/保守原地切换；完成任务乐观爬升；断网时历史预测仍在、生成新预测给重试态。
