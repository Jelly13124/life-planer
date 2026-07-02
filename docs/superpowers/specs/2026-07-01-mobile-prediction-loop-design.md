# 手机端预测闭环：选路 → 定路 → 拆计划 → 看乐观爬升

- 日期：2026-07-01
- 状态：设计已确认（brainstorming），待写实现计划
- 范围：**仅手机端（Expo/RN）**。共享核心加一个无害可选字段；网页本轮不动。

## 问题 / 动机

手机端「预测未来」现在是一张**静止的画**，不是会因用户努力而变化的活东西。三个真实缺口：

1. **人生树只画一条线**：树上每条路只渲染「中性 likely」曲线 + 一个「约 X%」。三种走向（乐观/中性/低谷）只藏在详情页一个按需生成的切换按钮后面。
2. **手机端不能「选定一条路」**：核心有决策模型（`Decision`），手机端一处没用。没有「这是我要走的路」这个概念/入口。
3. **最要命——乐观概率永远不涨**：算法是有的（`乐观占比 = 40×可行度`，`可行度 = 起步分 + 行动加成`），但「行动加成」来自挂在该路上的目标进度；而手机端建目标时**从不填 `pathId`**（`addLongGoal` 无此参数），导致 `pathProgress` 恒为 0、加成恒为 0、乐观占比冻死在 AI 起步分。**做再多任务，预测纹丝不动。**

## 目标闭环

> ① 树上很多岔路 → ② **选定一条**当作「我要走的路」→ ③ AI 把这条路拆成 2-3 个目标（挂在本路名下），你可改；给目标排任务、天天完成 → ④ 该路**有效可行度上涨 → 乐观占比肉眼可见地往上爬**，低谷/中性让位给乐观。

算法内核（`effectiveFeasibility` / `scenarioOdds` / `pathProgress` / `linkedGoals`）在 `packages/core` **已现成**；本轮主要是手机端接线 + 补呈现 + 建目标时能挂路。

## 关键设计决策（brainstorming 结论）

- **主阵地 = 路线详情页做成「驾驶舱」**（不在树上展开三股）。理由：N 个选择 × 3 情景 = 组合爆炸，树会乱；树的职责是「纵览 + 选路」，详情页才是「定路 + 拆计划 + 看爬升」。
- **同一时间只选定一条路**（可切换），不做多路并行。
- **拆计划 = AI 先拆 2-3 个目标，用户再改**；离线用本地兜底。

## 数据模型（共享核心，改动很小）

- `LifeTree.chosenPathId?: string | null`——用户正在走的那条路。**可选字段**，`normalizeLoadedTree` 无需迁移（老数据读出即 `undefined`）。
- 纯函数（`packages/core`，TDD）：
  - `choosePath(tree, pathId, now): LifeTree`——设 `chosenPathId`（校验该 path 存在且 `kind==="choice"`）。
  - `clearChosenPath(tree, now): LifeTree`。
  - `chosenPath(tree): LifePath | null`——访问器。
- 目标挂路：`Goal.pathId` **已存在**；确保建目标的领域入口能接受 `pathId`（若缺，补一个可选参数，不破坏现有调用）。

## 组件

### 1. 共享核心 `packages/core`
- 上面的 `choosePath` / `clearChosenPath` / `chosenPath`（新纯模块或并入 `tree.ts`，带 `__tests__`）。
- 复用 `effectiveFeasibility` / `scenarioOdds` / `pathProgress`（不改）。

### 2. 手机 store `mobile/src/state/store.tsx`
- 派生：`chosenPathId`、`chosenPathObj`。
- 写入：`choosePath(pathId)` / `clearChosenPath()`。
- `addLongGoal` 增加可选 `pathId`（挂路）。
- `decomposePathIntoGoals(pathId): Promise<void>`——调 AI（复用 `fetchGoalSuggestions`，把该路 `choiceLabel` 作为 choice 上下文）拿 2-3 个目标，逐个 `addLongGoal(area, title, why, undefined, pathId)` 挂到本路；**离线兜底**：从该路 `nodes` 的维度/标题确定性派生 2-3 个目标（纯、无随机）。
- 派生：`effectiveOf(path)`（= 核心 `effectiveFeasibility`）、`oddsOf(path)`（= `scenarioOdds`），供详情页。

### 3. 路线详情页 `mobile/app/path/[pathId].tsx`（驾驶舱，主要工作）
- **选路条**：未选 → 主按钮「选这条路」；已选 → 「正在走这条路 ✓」+ 次级「换一条 / 取消」。
- **三情景爬升条**：常驻横向三条（乐观/中性/低谷 占比，来自 `oddsOf(有效可行度)`），乐观重点标色 + 数字。下方一行「起步 X% · 你的行动 +Y%」。完成任务回来即上涨。（保留原「换走向看曲线」切换——它看曲线；爬升条看概率，二者并存不冲突。）
- **拆成计划**：选路后出现。首次自动（或一键）触发 `decomposePathIntoGoals`；列出挂在本路的目标 + 各自进度条；可删/改/加。空态引导「让 AI 拆一版」。

### 4. 人生树 `mobile/src/screens/TreeScreen.tsx`
- 仅在 `chosenPathId` 对应的路的终点标签旁加「✓ 正在走」标记。不展开三股。

### 5. 完成反馈
- 已有 `nudge` toast 复用/微调：当挂在**已选定路**上的目标进度把乐观占比推高时，提示「你的乐观未来 +Y%」。

## 数据流

树点某路 → 详情（驾驶舱）→「选这条路」→ `choosePath` 置 `chosenPathId` →（首次）`decomposePathIntoGoals` 建 2-3 个挂路目标 → 用户排任务/勾完成（走现有日程流）→ `goalProgress↑ → pathProgress↑ → effectiveFeasibility↑ → scenarioOdds` 乐观↑ → 爬升条动 + nudge。

## 非目标（YAGNI）

- 不搬网页的完整 `Decision`/复盘模型到手机。
- 树不做三股展开。
- 不做多条路同时选定。
- 网页不改（`chosenPathId` 是无害可选字段，网页是否采用以后再定）。

## 验证

- 核心新纯函数：TDD（`packages/core/**/__tests__`），`vitest` 全绿。
- 手机端：`cd mobile && npx tsc --noEmit` 通过；`eas update` 前 Metro 打包通过。
- 真机（用户）：选路 → ✓ 标记出现 → AI 拆出目标 → 勾任务 → 乐观条上涨 + nudge。

## 部署

- 手机纯 JS 改动 → **OTA（`eas update` production 频道）**，不重新 build（见 memory `mobile-ota-first`）。
- 核心若改动波及网页构建，`/green` 必须通过后再合并（网页行为不变，仅新增可选字段）。
