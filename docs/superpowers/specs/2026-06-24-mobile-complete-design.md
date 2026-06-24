# 手机端完整功能设计 (2026-06-24)

把 Expo 手机端从"骨架三屏"做成**完整可用的 app**。所有逻辑复用共享纯领域核心 `@lifeplanner/core`，本设计只新增 RN UI + 少量 mobile 状态/副作用层。**不动 web / core**（除非给 core 加纯函数且 web 全绿）。

## 导航（已与用户敲定）
底部 3 Tab：**安排 / 目标 / 人生树**。「安排」= 首页。

## 屏 1 · 安排（首页 = 当日安排）
- 顶部：`‹ 日期 ›` + 「今天」按钮；下面 `日 | 月 | 年` 分段切换（视图状态在屏内，非路由）。
- **日视图**（默认 = 今天）：竖向时间轴，左侧小时刻度（作息窗 `dayStart`/`dayEnd`，默认 07:00–23:00），`PX_PER_MIN` 比例定位时间块。
  - 已排任务 = 实心块，按领域上色；当天到期习惯 = 虚线"幽灵"块。
  - **未排托盘**：底部，列出没排时间的任务（散任务 + 目标里未排期任务，来自 `calendar.unscheduledActions`）。
  - **轻点排期（地基，必稳）**：点托盘任务 → 选时间 → 排到当天；点已排块 → 改时间/完成/移回未排；点空白 → 快速加任务。
  - **拖拽排期（增强，最后做）**：长按托盘任务拖到时间轴某时段，落点 Y → 时间；拖已排块改时间。拖拽用 `react-native-gesture-handler` + `react-native-reanimated`。**拖拽是唯一高风险点，最后叠加；轻点始终兜底。**
  - `+ 添加任务`：建散任务（`addLooseTask`），可选直接给时间或丢进未排托盘。
  - `✨ AI 排今天`：`schedule.arrangeDay` 把今天未排任务塞进作息窗空档（离线可用）。
  - **目标进度小条**：日期下方一条紧凑横条 —— 在进行的长期目标 + 迷你进度条 + %（`goals.goalProgress`）。点进去看可行度。
  - **完成动力提示**：完成属于某目标的任务时，弹小提示"你的努力让『X』+Y%"（复刻 web 动力闭环）。
- **月视图**：`calendar.monthGrid` 月历格；每天密度点（已排 + 完成数）；点某天 → 跳日视图到那天。
- **年视图**：12 个迷你月；点某月 → 月视图。

## 屏 2 · 目标
- **移除「无目标·散任务」整块**（散任务现在活在时间轴上）。
- 保留：建长期目标、领域 chip、AI 建议目标、目标下任务/习惯（加/完成/删）、短期目标列表。
- 给目标加的任务，未排期时出现在「安排」的未排托盘。

## 屏 3 · 人生树
- 保留：维持现状 + 选择分支曲线、加/删分支。
- **AI 增强分支**：加分支时若后端可达（`EXPO_PUBLIC_API_BASE_URL` 已设）→ 调 `/api/enrich` 拿贴合档案的 AI 预测（故事 + 节点 + 可行度），写回该 path；离线/失败 → 退回本地生成器（现状）。加分支时显示"AI 推演中…"。
- **和未来的自己对话**：点某条分支 → "和这条路的未来自己聊聊" → 对话屏（expo-router 路由 `chat/[pathId]`），复用 `/api/chat`。**v1 一问一答（非流式）**，需要后端；无后端 → 提示"需要连接后端"。

## 通知系统（本地定时；Expo Go 可用，已查 SDK 56 文档确认）
- `expo-notifications`：本地 `scheduleNotificationAsync`（按 Date/日历触发），app 关着也会响。**远程推送从 SDK 53 起 Expo Go 不支持 → 需 dev build，归后续（与 TestFlight 一起）。**
- 首次请求权限 + Android 通知渠道。
- 排了时间的任务 → 在该时刻安排一条本地通知"该做：<任务>"；每日/每周习惯按时刻定时（重复）。
- 树变更 → 校准（取消全部已排 → 重排未来 N 天的）；完成/取消排期 → 撤通知。
- 放 `mobile/src/lib/notifications.ts`（副作用层；"排哪些/几点"用 core 的 `actionsOnDay`/`todayItems`/`schedule` 算）。

## 数据 / 复用（不复制逻辑）
- `schedule.ts`：`toMinutes/toHHMM`、`arrangeDay`、`setActionTime`、`dayWindow`、`setDayWindow`、`DEFAULT_DAY_START/END`、`DEFAULT_DURATION_MIN`。
- `calendar.ts`：`monthGrid`、`actionsOnDay`、`unscheduledActions`、`setActionScheduledDate`、`weekdayOf`。
- `daily.ts`：`todayItems`、`completeAction`/`uncompleteAction`、`planToday`、`localDay`、`currentStreak`、`isActionDoneToday`。
- `goals.ts` / `goalTree.ts`：`goalProgress`、`longGoals`、`addLooseTask`、`updateTask`、`removeItem`、`completeAction` 等（已接）。
- `feasibility.ts`：`effectiveFeasibility`、`linkedGoals`、`pathProgress`（目标进度→可行度）。
- 新增 mobile 状态动作：`scheduleAtTime(taskId,date,time,dur)`、`unschedule(taskId)`、`setDayWindowValues`、`arrangeToday`、`addTimelineTask`、`viewDate` 状态。

## 不动 / 护栏
- web + core 全程绿（`tsc` 0 / `vitest` / `next build`）。新代码尽量只在 `mobile/`；若给 core 加纯函数，补测试并保持全绿。
- core 纯净铁律不破（无 `Date.now`/`Math.random`/无参 `new Date`；时间由 mobile 注入）。
- 中文串规范；无 emoji（线条图标）；苹果白主题。

## 今晚不做（后续）
选择面板手机版；远程推送（dev build）；Supabase 登录/同步；聊天流式逐字；EAS→TestFlight。

## 构建顺序（风险递增，每段验证 + 提交）
1. 装依赖 + 日视图时间轴渲染（块 + 习惯幽灵 + 刻度 + 作息窗）。
2. 未排托盘 + 轻点排期 + `+任务` + AI 排今天（**到此排期已完全可用**）。
3. 月 + 年日历 + 日/月/年 切换。
4. 目标进度小条 + 完成动力提示；目标屏移除散任务。
5. 人生树 AI 增强分支 + 和未来的自己对话屏。
6. 本地定时通知（树变更校准）。
7. **拖拽排期**（最后叠加；轻点兜底已在）。

## 诚实风险
- 拖拽（RN gesture/reanimated 落点算时间）、聊天（RN 读 SSE，故先非流式）、通知权限（模拟器可测本地通知）是三个摩擦点 —— 都排在后面、各有兜底，前面的稳功能先成型。
- AI 增强分支 + 对话需要用户那边后端可达（dev server + `EXPO_PUBLIC_API_BASE_URL`）；没设就离线降级，不报错。
