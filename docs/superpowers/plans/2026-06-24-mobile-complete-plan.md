# 手机端完整功能 — 实现计划 (2026-06-24)

Spec: `docs/superpowers/specs/2026-06-24-mobile-complete-design.md`. 自主 /goal 过夜执行：每阶段 实现 → 验证（mobile `tsc` + 模拟器截图 + web 全绿）→ 提交。风险递增，轻点/离线兜底先行，拖拽/流式/通知靠后。

## 依赖
`npx expo install expo-notifications react-native-gesture-handler react-native-reanimated @react-native-community/datetimepicker`。reanimated 需 babel plugin（`react-native-reanimated/plugin` 加到 `babel.config.js`，必须最后一项）。gesture-handler 需根布局包 `GestureHandlerRootView`。

## 阶段（每个 = 一次提交）

### P1 — 日视图时间轴渲染
- `mobile/src/lib/timeline.ts`（mobile 端小工具：PX_PER_MIN、把 task/habit 映射成 {topPx,heightPx,colorByArea}；复用 schedule.toMinutes）。
- `mobile/src/screens/ScheduleScreen.tsx`（新主屏）：顶部日期 + 今天 + 日/月/年 切换（先只渲染"日"）；竖向时间轴：小时刻度（dayWindow）、已排任务块（actionsOnDay 的 scheduled）、习惯幽灵块（daily/weekly due）。先只读渲染。
- store：加 `viewDate` 状态（默认 today）+ `setViewDate`；派生 `actionsOn(date)`。
- 路由：`app/(tabs)/index.tsx` 改为 ScheduleScreen；今日 TodayScreen 退役（或并入）。
- 验证：模拟器看到今天的时间轴（即使空）+ 刻度。

### P2 — 未排托盘 + 轻点排期 + +任务 + AI 排今天（排期可用闭环）
- 未排托盘组件（unscheduledActions）；轻点任务 → DateTimePicker 选时间 → `scheduleAtTime`（setActionScheduledDate(viewDate)+setActionTime）。
- 点已排块 → 弹操作：改时间 / 完成（completeAction）/ 移回未排（setActionScheduledDate null）。
- `+ 添加任务` → addLooseTask（可选时间）。
- `✨AI 排今天` → arrangeDay(viewDate) 写回时间。
- store 动作：scheduleAtTime / unschedule / arrangeToday / addTimelineTask / setActionTimeById。
- 验证：模拟器加任务→排时间→出现在轴上→完成；AI 排今天。

### P3 — 月 / 年日历 + 切换
- MonthGrid 组件（monthGrid + 每天密度点 actionsOnDay/completed）；点某天 → setViewDate + 切回日。
- YearView（12 迷你月）；点月 → 月视图。
- 日/月/年 toggle 接上。
- 验证：三视图切换、点月某天跳日。

### P4 — 目标进度小条 + 完成动力提示；目标屏去散任务
- ScheduleScreen 顶部「目标进度」横条（longGoals + goalProgress 迷你条）。
- 完成目标任务 → 计算 goalProgress 增量 → 小 toast/inline "你的努力让『X』+Y%"。
- GoalsScreen：删除「无目标·散任务」整块（store 仍保留 addLooseTask 供时间轴用）。
- 验证：完成任务看到进度条动 + 提示；目标屏无散任务区。

### P5 — 人生树 AI 增强分支 + 和未来的自己对话
- api.ts：`enrichPath(profile, choiceLabel)` → POST /api/enrich（带 backgroundFacts），失败 null。`chatReply(messages, path, profile)` → POST /api/chat 取完整回复（非流式：await 后解析）。
- 加分支：先本地 addPath 即时出线 → 若 hasBackend 异步 enrich → 用 AI 结果覆盖该 path（updatePath）。显示"AI 推演中"。
- 对话屏 `app/chat/[pathId].tsx`：消息列表 + 输入；调 chatReply；无后端提示。人生树分支卡加"和未来自己聊"入口。
- store：updatePathEnrichment(pathId, enriched)。
- 验证：离线加分支仍即时；（若后端可达）AI 故事 + 对话往返。

### P6 — 本地定时通知
- `mobile/src/lib/notifications.ts`：requestPermission、Android channel、`syncNotifications(tree, today)`（cancelAll + 排未来 N 天已排任务/习惯时刻）。
- store：commit 后 debounce 调 syncNotifications；首次进 app 请求权限。
- 验证：排一个近未来任务 → 等通知弹出（模拟器）；改时间→重排。

### P7 — 拖拽排期（最后）
- GestureHandlerRootView 包根；reanimated 拖拽：托盘任务长按拖到时间轴，落点 Y→时间 onDrop scheduleAtTime；已排块拖动改时间。
- 轻点路径保留为兜底。
- 验证：模拟器拖拽落点排期。若打磨不完 → 保留轻点，记 backlog。

## 验证 gate（每阶段）
- `cd mobile && npx tsc --noEmit` 干净。
- 模拟器（AVD trippin，Metro :8081）截图确认渲染/交互。
- 只改 mobile/ → web 不受影响；阶段末或涉及 core 改动时跑 web `/green`。
- 每阶段提交（Co-Authored-By 尾注），master 跟进 + 推备份。

## 护栏
core 纯净；中文串规范；无 emoji；苹果白。拖拽/流式/通知三摩擦点靠后 + 兜底。
