# 规划主线 — 目标驱动的人生规划闭环（目标即分支）

日期：2026-06-18
状态：方向与设计已确认（多轮拍板），待写实现计划 / 过夜执行
执行方式：subagent-driven，TDD + 两段评审 + 真机冒烟

## 一句话

在现有"看见多重人生 + 决策闭环"之上，加一条持续的、目标驱动的**规划主线**，并和人生树**接成一体**：
人生树**一开始只有一条线**（维持现状/当前轨迹）→ AI 从你的资料建议目标，你挑（或手动加）→ **一个长期目标就在树上长出一条分支**，短期目标是这条分支沿途的踏脚石 → 把行动一项项勾掉，**进度条沿分支逼近"达成后的未来"** → **达成长期目标 → 相关人生面加分 + 这条分支标为已达成（里程碑）** → **和"达成了目标的未来的你"对话**（直接复用这条真实分支）被激励 → 回去继续追。
预测不再是算命，而是你努力的镜子与胡萝卜。分叉只从**长期目标**或**手动加的选择**长出来，不再一上来就分叉。

## 背景 / 定位

对标 Griply（愿景→目标→习惯→任务）、Lifebook（人生面）、Designing Your Life（原型未来）。已有：人生树（预测）、决策闭环（针对单条路的 30/90 天计划+复盘）。本主线是**更上层、跨人生面、长期持续**的规划层，并把"目标"和"树的分支"统一起来，形成激励循环。
红线沿用：不算命；预测=可能性+激励，不是命令。

## 关键改动：人生树的起手式（先说，因为它牵动全局）

现状：`createTree` 画 status-quo + 若 onboarding 填了 `crossroad` 就自动再画一条分支（`src/domain/tree.ts:36-47`）——一上来就分叉。

改为：
- **`createTree` 只生成 status-quo 一条线**，删掉自动分叉的 crossroad 分支。
- onboarding 的 `crossroad` 保留在 profile，但**不再自动分叉**；进树后若有 crossroad 且尚无目标，给一个一键 chip：「把「{crossroad}」设成你的第一个长期目标」。
- 分叉来源只有两个：**① 添加长期目标（自动长出分支）② 手动加一个选择**（现有 addPath，不变）。
- 兼容：已存在的旧树不动（仍带历史分支）；只有新建树是单线起手。

## 目标 / 非目标

v1 目标：
- AI 建议目标（确认优先，挑卡片加入）；也能手动加。
- 目标两级：**长期目标 ⊃ 短期目标（parentGoalId）⊃ 可勾选行动**。
- **长期目标 = 树上一条真实分支**（`Goal.pathId` 关联）；添加长期目标走现有"加分支 + 推演"管线（含「正在推演」动画 + enrich）。
- 「达成后的未来」= 这条分支的未来（summary/nodes），**不单独做 future-vision 路由**。
- **和"达成目标的未来的你"对话** = 直接打开这条分支的现有 future-self 对话（不造合成 path、不加新路由）。
- 进度：沿长期目标推导（短期子目标 done + 自身 actions done）/ 总数。
- **达成长期目标 → 相关 LifeArea 分数上调 + 分支标为已达成（里程碑）**（轻量"影响人生"）。
- 每周复盘提醒：逐目标记一句，到期提醒。
- 全程中英双语；旧 localStorage 树兼容（不清库）。

非目标（v1 不做）：习惯打卡/连续天数、日历、推送通知、对话式调目标、以及"用真实进展重跑整条人生预测"（先用上面的轻量版）。

## 数据模型（src/domain/types.ts + LifeTree.goals）

```ts
export type GoalHorizon = "short" | "long";
export type GoalStatus = "active" | "done" | "dropped";
export interface GoalAction { id: string; text: string; done: boolean }

export interface Goal {
  id: string;
  area: LifeArea;            // 事业/财富/关系/健康/成长
  horizon: GoalHorizon;
  title: string;
  why: string;
  status: GoalStatus;        // active | done | dropped
  createdAt: string;
  parentGoalId?: string | null; // 短期目标挂到某个长期目标
  pathId?: string | null;       // 仅长期目标：它在树上长出的那条分支
  actions: GoalAction[];
  completedAt?: string;
  lastReviewedAt?: string;
}
```
`LifeTree` 增加 `goals: Goal[]`（旧树 load 回填 `[]`，不 bump storage key；createTree 初始化 `goals: []`）。
不再有 `futureVision` 字段——长期目标的"未来"就是 `pathId` 对应分支的 summary/nodes。

进度为**推导值**（不存）：长期目标 = (短期子目标 done 数 + 自身 actions done 数) / 总数；短期目标 = actions done 比例。纯函数 `goalProgress`。
"已达成"也为推导：某条 path 被某个 `status==="done"` 的长期目标 `pathId` 指向，即视为已达成里程碑（不改 `LifePath` 结构）。

## 领域纯函数（src/domain/goals.ts，注入 now/today，不用 Date.now/random）

- `createGoal(input, now): Goal`（id = `goal-${hashSeed(title|now)}`；长期目标的 pathId 由 state 层创建分支后回填）
- `upsertGoal(tree, goal)` / `updateGoalById(tree, goal)` / `linkGoalPath(tree, goalId, pathId)`
- `setGoalActions(goal, texts: string[]): Goal`（生成 `${goal.id}-a{i}`）
- `toggleGoalAction(goal, actionId): Goal`
- `childGoals(tree, longGoalId): Goal[]`（短期子目标，按 createdAt）
- `goalProgress(tree, goal): number`（0–1）
- `completeGoal(tree, goalId, now): LifeTree`（goal status=done、completedAt=now；若长期目标，`profile.areas[area]` += AREA_BUMP(=8) clamp 0–100；其分支因 done 自动算"已达成"）
- `dropGoal(tree, goalId, now): LifeTree`（goal status=dropped；若长期目标，连带 `removePath` 删掉它那条分支及后代）
- `achievedPathIds(tree): Set<string>`（done 长期目标的 pathId 集合，供树渲染高亮里程碑）
- `dueGoalReviews(tree, today): Goal[]`（active 且 lastReviewedAt 为空或距 today>7天）
- `recordGoalReview(goal, now): Goal`

配套 `goals.test.ts`：createGoal / progress（长短两级）/ completeGoal 的 area 加分与 clamp / dropGoal 连带删分支 / dueGoalReviews 的 today 边界 / toggle / achievedPathIds。

## AI 路由（服务端，均带无-key 本地兜底 + 限流 allowRequest）

- `POST /api/goals` — 入参 `{ profileSummary, choices, lang }`。出参 `{ goals: [{ area, horizon, title, why }] }`，3–5 个、含至少 1 个长期 + 几个短期、方向各异。本地兜底：按 area 给通用目标。
- `POST /api/goal-actions` — 入参 `{ goalTitle, why, area, horizon, profileSummary, lang }`。出参 `{ actions: string[] }`，3–5 条动词开头、近期可动手。本地兜底模板。
- **长期目标的分支** —— 不新增路由：复用现有"加分支"管线（generator 生成 + `/api/enrich` 推演 + 「正在推演」动画）。
- **未来自我对话** —— 不新增路由：直接用该分支的现有 `FutureSelfChat` + `/api/chat`。

客户端封装放 `src/lib/goalClient.ts`：`fetchGoalSuggestions`、`fetchGoalActions`（各自 sanitize + 本地兜底）。**不再有** fetchFutureVision / goalToPathForChat。

## 状态层（src/state/AppContext.tsx）

- `View` 增加 `"plan"`。
- `addLongTermGoal(input)`：① `createGoal`（horizon=long）② 走现有加分支流程在树上生成分支（forkAge 用 `inferForkAge`，含 enrich + 推演动画）③ `linkGoalPath` 回填 pathId ④ patchTree。
- `addShortTermGoal(input, parentGoalId?)`：仅建目标，不建分支。
- `toggleAction(goalId, actionId)`、`setActions(goalId, texts)`、`completeGoalById(id)`、`dropGoalById(id)`、`reviewGoal(id)`——均走 `patchTree`（停在规划页）。
- crossroad chip：`addLongTermGoal({ title: profile.crossroad, ... })` 的快捷入口。

## UI / 交互

- **入口**：TreeScreen 头部加按钮「🎯 我的规划」→ `openPlan()`；单线起手时树上给明确引导："设一个长期目标，或加一个选择，让路开始分叉。"
- **PlanScreen（新组件）**：
  - 顶部「✨ 帮我想几个目标」→ `/api/goals` → 确认优先卡片（标 长期/短期 + area + why）→「加入」才进；长期目标加入即在树上长分支（推演动画）；任一目标可「拆成行动」→ `/api/goal-actions`。
  - **长期目标卡**：标题/why、进度条（goalProgress）、「📈 在树上看这条路」（跳到该分支）、「✨ 和达成目标的未来的你聊聊」（开该分支 future-self 对话）、短期子目标列表、自身行动勾选、「✅ 已达成」（→ completeGoalById：加分+里程碑+🎉）、「移除」（→ dropGoalById：连带删分支，需确认）。
  - **短期目标卡**：可挂到某长期目标（下拉选 parent）、行动勾选、完成。
  - **已达成里程碑**区：列出 done 的长期目标 + 其分支。
  - **每周复盘**：`dueGoalReviews` 非空 → 顶部提醒「该回看目标了」；逐目标记一句 → 置 lastReviewedAt。
  - 手动加目标（小入口，可选长期/短期）。
  - 若 `profile.crossroad` 存在且无目标 → 顶部 chip「把「{crossroad}」设成第一个长期目标」。
- **树上里程碑**：`achievedPathIds` 命中的分支用实线/微光区分（轻量样式）；未达成目标分支保持现有虚线/曲线观感。

## 持久化 / 迁移

- `localStorageRepo.load()` 回填 `parsed.goals ??= []`（同 decisions 做法，不清库、不 bump key）。
- 旧树保留历史分支；新树单线起手（createTree 改动只影响新建）。

## i18n / 确定性 / 测试

- 所有新 UI 文案走 `t()` + `messages.ts` 补英文。
- domain（types/goals/tree）不用 Date.now/Math.random；时间/today 注入。
- 渲染期不调用 new Date()（purity lint）：进度/到期判断用注入或模块级 boot 值 + effect 刷新（沿用 PathDetail/TreeScreen 做法）。
- goals.ts 纯函数全测；createTree 单线起手补/改测（tree.test.ts）；AI 路由全有本地兜底；client sanitize 有测。

## 范围切分（实现顺序）

1. types：Goal/GoalAction/枚举 + `LifeTree.goals`；迁移回填；createTree 改单线起手（+改 tree.test.ts）。
2. `src/domain/goals.ts`(+tests)：上述纯函数。
3. `/api/goals` + `/api/goal-actions`（+ `goalClient.ts` + 本地兜底 + 限流）。
4. AppContext：`View "plan"` + 目标方法（长期目标自动长分支、complete 加分、drop 删分支、review）。
5. `PlanScreen` + 入口按钮 + crossroad chip + 引导文案；复用 FutureSelfChat / 跳转分支。
6. 树上已达成里程碑样式（轻量）。
7. i18n + 全套验证（tsc/test/build）+ 真机冒烟（单线起手 → 建长期目标看到长出分支 → 拆行动勾选看进度 → 达成看到加分/里程碑 → 和未来自我对话）。

## 验收

既有测试通过 + 新增 goals/client/单线起手测试；tsc/build 干净；真机：新树单线起手；AI 建议目标可挑；加长期目标在树上长出一条分支并能进它的未来自我对话；勾行动进度推进；达成后相关人生面加分、分支标为里程碑；手动加选择仍能分叉。
