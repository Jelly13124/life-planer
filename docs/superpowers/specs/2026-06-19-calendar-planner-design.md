# 日历规划首页 — 月历排程（左）+ 目标与预测（右）

日期：2026-06-19
状态：设计已确认（brainstorming：完整月历 + 桌面拖拽 + 手机点选兜底），待用户复核 spec → writing-plans
分支：`feat/goal-planning-mainline`（接在 goal + v2 + 过夜硬化之上）

## 一句话

把首页换成左右分屏：**左边一个当月月历**，可把行动排到具体某天（桌面拖拽 / 手机"点行动→点某天"）；**右边目标进度 + 缩略人生树「你在这里」+ 🔥连续天数**。解决当前"一堆行动没有时间、管理太混乱"的问题——给每件事一个"什么时候做"。

## 为什么 / 红线

之前 v2 刻意只做完成热力图、不做可排程日历（怕掉进 Todoist/TickTick 红海）。真机用下来"没有时间维度、管理混乱"是真痛点，所以现在补一个**有边界的**月历：能排程、能看整月铺排，但**不**碰外部同步/推送/时间块/复杂重复/时区这些无底洞。

## 范围 / 非目标

做：当月月历网格（可翻月、今天高亮）、把一次性行动排到某天、每日/每周重复在格子上显示、点某天看当天清单并勾完成、未排期托盘、桌面拖拽 + 手机点选兜底、右栏复用目标/预测/连续。
**不做**（守住不掉无底洞）：Google 日历同步、推送通知、小时级时间块、复杂重复规则（每月第N个周二之类）、时区处理、月视图之外的周/日时间轴。

## 数据模型（src/domain/types.ts，全部可选——旧树无需迁移）

`GoalAction` 增加两个可选字段：
```ts
export interface GoalAction {
  id: string;
  text: string;
  done: boolean;
  repeat?: "daily" | "weekly";
  scheduledDate?: string;   // 一次性行动排到的本地日 YYYY-MM-DD（未排期则无）
  repeatWeekday?: number;   // 仅 weekly：锚定星期几 0=周日…6=周六（用于在月历上落位）
}
```
说明：完成状态/连续天数/热力图仍走现有 `activity`（`ActivityDay`）与 `daily.ts`，不变。`scheduledDate`/`repeatWeekday` 只影响"在月历上显示在哪天"，不改完成口径。

## 领域纯函数（src/domain/calendar.ts，注入年月/日期，不用 Date.now/random）+ 测试

- `weekdayOf(date: string): number` —— YYYY-MM-DD → 0–6（用 UTC 解析，避免时区漂移，与 daily.addDays 口径一致）。
- `monthGrid(year: number, month: number): { date: string; inMonth: boolean }[]` —— 返回覆盖整月的网格（前后补齐到整周，周一起始），每格带是否属于本月。纯函数，按年月计算。
- `actionsOnDay(tree, date): { goal: Goal; action: GoalAction; kind: "scheduled" | "daily" | "weekly"; done: boolean }[]` —— 当天要显示的行动：① 一次性且 `scheduledDate === date`（kind=scheduled）；② `repeat==="daily"`（kind=daily，每天都在）；③ `repeat==="weekly"` 且 `repeatWeekday === weekdayOf(date)`（kind=weekly）。`done` 用现有 `isActionDoneToday(tree, action, date)` 求。仅取 active 目标。
- `unscheduledActions(tree): { goal: Goal; action: GoalAction }[]` —— active 目标里 `!repeat && !done && !scheduledDate` 的一次性行动（未排期托盘用）。
- 复用 daily.ts 的 `isActionDoneToday` / `addDays` / `localDay`。
- 测试 `calendar.test.ts`：monthGrid 的边界（月初补齐、跨月、整周数）、weekdayOf、actionsOnDay 三种 kind（含 weekly 锚定日命中/不命中、daily 每天都在、scheduled 仅当天）、unscheduledActions 过滤。

## 状态层（src/state/AppContext.tsx）

- `scheduleAction(actionId: string, date: string | null)` —— 设/清 `scheduledDate`（patchTree；纯函数放 calendar.ts 或 goals.ts：`setActionScheduledDate(tree, actionId, date)`）。
- `toggleActionOn(actionId: string, date: string)` —— 在指定日期勾/取消完成（包一层 daily 的 `completeAction`/`uncompleteAction`，传入该日期，而非只用 today）。判断当前是否已完成用 `isActionDoneToday(tree, action, date)`。
- 扩 `setActionRepeatById` —— 设为 weekly 时同时设 `repeatWeekday`（默认取"今天"的 weekday；用 `localDay(new Date())` 在 state 边界算）。设回 daily/undefined 时清掉 repeatWeekday。
- 视图：沿用 `"dashboard"` 作为首页 view，但渲染新的 `CalendarPlannerScreen`（取代 `DashboardScreen` 作为家）。`DashboardScreen` 可保留文件但不再是首页（或其右栏内容被复用/抽出）。

## UI / 交互

- **CalendarPlannerScreen（新首页，左右分屏，响应式：窄屏上下堆叠）**
  - **左 · MonthCalendar**：当月网格（周一起始）、◀▶ 翻月、回到本月按钮、今天高亮；每格显示当天 `actionsOnDay` 的 chip（一次性=实色、daily/weekly=带 🔁 的弱色；done=划掉/勾）。格子是拖拽落点。
  - **点某天 → 当天面板**（格子下方或侧栏 sheet）：列出当天行动，可勾完成（`toggleActionOn(id, date)`）、把未排期行动加到当天、从当天移除（`scheduleAction(id, null)`）。
  - **未排期托盘**：`unscheduledActions` 的 chip，桌面可拖到某天；手机"点中某 chip→点某天"落位。
  - **拖拽**：桌面 HTML5 draggable chip + 格子 onDrop → `scheduleAction(id, cellDate)`；跨天拖拽=改期。**手机兜底**：点 chip 进入"待放置"高亮态 → 点某天格子落位（不依赖原生拖拽）。
  - **右 · 目标 + 预测 + 连续**：复用现有 `DashboardScreen` 右侧内容——活跃目标进度、缩略人生树 + 「你在这里」标记（compact LifeMap + markers）、🔥连续天数 + 完成热力图。里程碑报喜也保留。
- 入口互通：TreeScreen/PlanScreen 的"← 今日"改指向这个新首页（语义不变）。

## 持久化 / 迁移

新字段全部可选 → 旧 localStorage 树直接可用，无需迁移、不 bump key。`activity` 不变。

## i18n / 确定性 / 测试

- 新文案走 `t()` + `messages.ts` 补英文（周一…周日、本月、回到今天、未排期、移到某天、点选日期 等）。
- calendar.ts 纯函数不用 Date.now/Math.random；月历的"今天/当前月"在 state/组件边界用 `new Date()`（模块级 boot + effect 刷新，沿用现有范式），不在领域层。
- calendar.ts 全测；AppContext 新方法的纯函数部分（setActionScheduledDate）可测。

## 范围切分（实现顺序，供 writing-plans）

1. types：`GoalAction.scheduledDate?` + `repeatWeekday?`（可选，无迁移）。
2. `src/domain/calendar.ts`(+tests)：weekdayOf / monthGrid / actionsOnDay / unscheduledActions / setActionScheduledDate。
3. AppContext：`scheduleAction` / `toggleActionOn` / 扩 `setActionRepeatById` 设 weekday。
4. `MonthCalendar` 组件：网格 + 翻月 + 今天高亮 + 当天 chip + 桌面拖拽落点 + 手机点选落位。
5. 当天面板 + 未排期托盘。
6. `CalendarPlannerScreen`：左右分屏，右栏复用目标/缩略树/连续；接成首页（dashboard view 渲染它）；入口互通。
7. i18n + 全套验证（tsc/test/build）+ 真机冒烟（桌面拖拽排期、手机点选排期、点天勾完成、未排期托盘、翻月、右栏照常、旧数据不丢）。

## 验收

既有测试通过 + calendar.ts 新测试；tsc/build 干净；真机：打开落新日历首页；能把未排期行动拖到/点到某天；每日/每周重复在对的格子显示；点某天能勾完成并联动连续天数/热力图/标记；翻月正常；右栏目标与预测照常；旧 localStorage 数据无损。诚实预期：拖拽与手机端是最需要真机调的部分。
