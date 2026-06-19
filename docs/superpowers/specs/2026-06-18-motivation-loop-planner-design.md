# 激励闭环 Planner（v2）— 规划当主角，预测当胡萝卜

日期：2026-06-18
状态：方向与重心已确认（多轮拍板），待写实现计划 / 过夜执行
执行方式：subagent-driven，TDD + 两段评审 + 真机冒烟
依赖：建立在已合并的「规划主线（目标即分支）」之上（Goal / GoalAction / LifeTree.goals 已存在）

## 一句话

把重心从"看见多重人生"挪到"每天真的去走"：首页改成**合并仪表盘**——上半「今日计划 + 连续天数 + 完成热力图」，下半「缩略人生树 + 你在这里」标记。
你从目标里挑几件事进"今天"（AI 也会建议今天做哪几件），勾掉的当场看见标记**沿你选的分支往"未来的你"前进一格**；做完整条长期目标才**真实加该领域分**（影响之后新生成的预测）。
预测系统 + 和未来的自己对话，从"主菜"降为**激励你完成目标的胡萝卜**。差异点：**唯一一个把今天的事做完、会肉眼改写你未来的 planner。**

## 为什么这么改（与红线）

- 预测/树是一次性惊艳，没有每天回来的理由；日计划 + 追踪给"每日打开"的理由（toy → habit）。
- 诚实红线（守住"不算命"）：**完成不会凭空把预测变好**。预测的"未来的你"是**固定终点**；完成步骤 = 沿曲线**走向**它（你真走了 N/总 步）；只有完成整条长期目标，才按既有逻辑给该领域 +8 分、影响**之后**的新预测。未来的自己只引用你**真做过**的事来鼓励。
- 不做红海：不与 Griply/Todoist 拼日历功能。做最薄规划闭环让激励引擎唱起来。

## 非目标（v2 明确不做）

外部日历同步（Google Calendar）、推送通知、时间块/排程、任务带到期日、Griply 那套习惯统计（完成率/完美周/12 周趋势）与每习惯提醒、对话式调目标。"日历"只做**完成热力图**（GitHub 贡献图式），不可排程。
（注：**最小"重复行动"是做的**——见下节；它只负责"自动回到今日"，不带统计/提醒/排程。）

## 最小重复行动（让今日不断粮）

研究 Griply 后确认：一次性行动做完即空，今日会断粮，"每日打开"落空。Griply 靠**习惯（recurring）**让 Today 天天有内容。我们取其最小内核：
- `GoalAction` 加可选 `repeat?: "daily" | "weekly"`（缺省=一次性，行为不变）。
- **重复行动不写永久 `done`**，"完成"只记进当天 `ActivityDay.completedActionIds`（次日/下周自动重新可做）；一次性行动仍用 `done` 且计入目标进度。
- **进度只数一次性行动（里程碑）**：`goalProgress` 排除 `repeat` 行动——重复=日常纪律，不推进"未来的你"那条进度，守住诚实红线（marker 不会因每日习惯来回跳）。
- **自动回今日**：daily 每天都在今日清单（勾了显示已完成）；weekly 在"本周内未完成"时出现，完成后本周隐藏。
- **连续天数/热力图**：任何完成（一次性或重复）都计入当天——重复行动正是让 streak 每天活着的引擎。
- 创建：在「我的规划」每条行动加一个 🔁 小开关循环 关→每天→每周。

## 数据模型（src/domain/types.ts + LifeTree）

在已有 Goal/GoalAction 基础上，新增"每日活动"记录：

```ts
// 一天的活动：当天挑进"今天"的行动 + 当天完成的行动（用于今日清单/连续天数/热力图）
export interface ActivityDay {
  date: string;               // 本地日期 YYYY-MM-DD（注入，不在领域层取 new Date）
  plannedActionIds: string[]; // 当天挑进"今天"的 GoalAction.id
  completedActionIds: string[]; // 当天勾掉完成的 GoalAction.id
}
```
`LifeTree` 增加 `activity: ActivityDay[]`（旧树 load 回填 `[]`，不 bump storage key；createTree 初始化 `activity: []`）。

说明：
- GoalAction 仍是一次性任务（done 一次）。"今天完成" = 把它的 id 记进当天 ActivityDay.completedActionIds，同时 action.done=true。
- 行动全做完会自然"没今日任务"——属预期：提示去加目标/让 AI 拆更多行动。
- 位置标记、连续天数、热力图都是**推导值**，不另存。

## 领域纯函数（src/domain/daily.ts，注入 today: "YYYY-MM-DD"，不用 Date.now/random）

- `localDay(iso: string): string` —— 把 ISO 时间戳取本地日期 YYYY-MM-DD（state 层算好 today 传入；此函数仅做切片，便于测试）。
- `dayEntry(tree, today): ActivityDay` —— 取当天记录，没有则返回空壳（不写树）。
- `planToday(tree, actionId, today): LifeTree` —— 把行动加入当天 plannedActionIds（去重；必要时创建当天条目）。
- `unplanToday(tree, actionId, today): LifeTree` —— 从当天 plannedActionIds 移除。
- `completeAction(tree, actionId, today): LifeTree` —— 找到该行动所属 goal，置 action.done=true；当天 completedActionIds 去重加入；若不在 plannedActionIds 也补进（勾了就算今天计划过）。
- `uncompleteAction(tree, actionId, today): LifeTree` —— 反向：action.done=false；从当天 completedActionIds 移除。
- `todayItems(tree, today): { goal: Goal; action: GoalAction }[]` —— 解析当天 planned ∪ completed 的行动，连同所属目标。
- `currentStreak(tree, today): number` —— 从 today 往前数连续"当天完成≥1"的天数；**宽限**：若 today 还没完成但 today-1 有，则按截止 today-1 的连续段计（让"今天还没做"不立刻清零）。
- `heatmap(tree, sinceDays, today): { date: string; count: number }[]` —— 最近 N 天每天的完成数（含 0），供贡献图。
- `branchPositionAge(tree, goal): number | null` —— 长期目标分支上"你在这里"的年龄：`forkAge + goalProgress(tree, goal) * (endAge - forkAge)`，endAge 取该 path 最后一个 node 的 age（无 path 返回 null）。复用已有 `goalProgress`。

配套 `daily.test.ts`：planToday/unplan 去重、completeAction 写当天且补 planned、currentStreak（含宽限与断裂）、heatmap 计数、branchPositionAge 的 0%/50%/100%、localDay 切片。

## AI 路由（带无-key 本地兜底 + 限流 allowRequest）

- `POST /api/today-plan` —— 入参 `{ profileSummary, pending: {id,text,goalTitle}[], lang }`（pending=各活跃目标里 done=false 的行动）。出参 `{ pick: {id, why}[] }`：从 pending 里挑**最多 3 条**今天最该做的，每条一句话理由（≤20字）。本地兜底：跨活跃目标各取第一条未完成、最多 3 条，why 给通用句。
- 复用：**今日任务不新增生成路由**——任务来自已有目标的 actions（`/api/goal-actions` 已建）。
- **未来自我"报喜"**：不新增路由。完成里程碑（整条长期目标做完）时，仪表盘弹一条庆祝条 + 「和未来的你说一声」按钮 → 打开该分支现有 `FutureSelfChat`（复用）。v1 报喜文案先本地一句，聊天里才走真 AI。

客户端封装 `src/lib/dailyClient.ts`：`fetchTodayPlan(tree)`（sanitize + 本地兜底）。

## 状态层（src/state/AppContext.tsx）

- `View` 增加 `"dashboard"`；hydrate 后有树则默认 `"dashboard"`（替代现在的 `"tree"` 默认）。
- 新方法（均走 `patchTree`，注入 `new Date().toISOString()` → state 层转 today）：`planActionToday(id)`、`unplanActionToday(id)`、`toggleTodayAction(id)`（done 互斥调用 complete/uncomplete）。
- 导航：`openDashboard()`、`openTree()`（看完整树）、`openPlan()`（管理目标，已有）。

## UI / 交互

- **DashboardScreen（新，默认首页）**：
  - **上半 · 今日计划**：今日行动清单（来自 todayItems，可勾选）；「✨ 建议今天做什么」→ `/api/today-plan` → 候选行动逐条「加入今天」；空态引导去「我的规划」加目标。顶部一行：🔥 连续 N 天 + 最近 30 天完成热力图（小色块）。
  - **下半 · 缩略人生树**：复用 `LifeMap`（紧凑模式），每条活跃长期目标分支上画「你在这里」标记（branchPositionAge）；「看完整人生树 →」进 tree 视图。
  - 勾掉任务时：标记沿分支前移一点（带过渡动画）；连续天数/热力图即时更新。
- **里程碑报喜**：长期目标 100% → 庆祝条（🏆 + 该领域 +分提示）+「和未来的你说一声」。
- **PlanScreen（我的规划）**：保留为目标管理二级页（建/拆/达成/移除，已有）；每条行动加「＋今天」快捷加入今日。
- **TreeScreen**：保留为"完整人生树"页，从仪表盘进入；头部入口互通（仪表盘 / 我的规划 / 完整树）。
- 规划助手浮窗：保留。

## 位置标记的画法（LifeMap）

- 入参加可选 `markers: { pathId: string; age: number }[]`；在对应 path 的曲线上按 age 求点（复用既有 `cubicYAtX`/采样）画一个发光圆点 + "你在这里"微标签。
- 紧凑模式 `compact?: boolean`：缩小留白与字号，供仪表盘下半使用；完整 TreeScreen 不传即原样。

## 持久化 / 迁移

- `localStorageRepo.load()` 回填 `parsed.activity ??= []`（同 decisions/goals 做法，不清库、不 bump key）。
- 默认视图改 dashboard 只影响有树用户的落点，不动数据。

## i18n / 确定性 / 测试

- 新 UI 文案走 `t()` + `messages.ts` 补英文。
- domain（types/daily）不用 Date.now/Math.random；today 注入。渲染期不调用 new Date()：沿用模块级 boot 值 + effect/visibilitychange 刷新（TreeScreen 已有范式）。
- daily.ts 全测；today-plan client sanitize 有测；AI 路由本地兜底。

## 范围切分（实现顺序）

1. types：`ActivityDay` + `LifeTree.activity`；createTree 初始化；localStorage 回填。
2. `src/domain/daily.ts`(+tests)：上述纯函数（含 currentStreak/heatmap/branchPositionAge）。
3. `/api/today-plan` + `src/lib/dailyClient.ts`（+本地兜底+限流）。
4. AppContext：`View "dashboard"` + 默认落点 + 今日方法 + 导航。
5. `LifeMap`：markers + compact 模式。
6. `DashboardScreen`：今日清单 + 连续/热力图 + 缩略树 + 标记 + 里程碑报喜；接成默认首页。
7. PlanScreen 行动加「＋今天」；TreeScreen/入口互通。
8. i18n + 全套验证（tsc/test/build）+ 真机冒烟。

## 真机冒烟（验收）

- 打开默认落"仪表盘"；空态能引导去加目标。
- 「建议今天做什么」给出≤3 条；逐条加入今天。
- 勾掉一条 → 下半缩略树上该分支「你在这里」标记**当场前移**；🔥连续天数 +1、热力图当天点亮。
- 做完整条长期目标 → 报喜条 + 该领域加分 + 分支标 🏆；可一键和未来的你报喜（开 FutureSelfChat）。
- 既有测试全过；tsc/build 干净；旧树升级不丢数据。
