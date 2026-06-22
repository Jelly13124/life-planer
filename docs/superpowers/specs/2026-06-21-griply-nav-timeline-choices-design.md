# 导航重构 + 多日时间轴 + 选择面板 — 设计 (A/B/C)

日期：2026-06-21 · 分支：`feat/goal-planning-mainline` · 状态：方向已确认（用户 `/goal`：今晚 A/B/C 全做，先 spec → plan → 构建，明早验收）

## 背景
用户给了 Griply 侧边栏截图，要求“同样的信息架构、我们自己的暗色视觉（不抄它界面）”，外加一条多日横向时间轴、一个“其他”领域、一个独立但与人生树打通的“选择面板”。拆成三个内聚的包，A→B→C 顺序构建，各自验证 + 提交。

**全局约束（沿用项目铁律）：** 领域层纯函数（无 `Date.now`/`Math.random`，时间注入）；渲染层无模块级 `new Date()`（boot const + effect）；中文串不得用 ASCII 直引号，新串在 `src/i18n/messages.ts` 加 EN（中文标点 key 要引号、仅追加、不用智能引号当 JS 定界符）；AI 路由需离线本地兜底 + 每 IP 限流；暗色主题；不抄 Griply 视觉。localStorage key 不变（`lifeplanner.tree.v3`），所有新字段经 `normalizeLoadedTree` 无损补齐。

---

## 当前现状（已读代码确认）
- 侧边栏 `AppShell.tsx`：扁平 6 项（📅日历=dashboard / 🎯目标=plan / 🔁习惯=habits / 🧭人生面=areas / 📊洞察=insights / 🌳人生树=tree）。`NavKey` + `NavItem` + `NavList` 已有。
- 路由 `page.tsx`：`view` 决定 section；`View = onboarding|tree|detail|plan|dashboard|habits|areas|insights`（dashboard 落到 else=CalendarPlannerScreen）。
- 领域 `types.ts`：`LifeArea` 5 值 + `LIFE_AREAS` + `AREA_LABELS`；`Profile.areas: Record<LifeArea,number>`、`compositeIndex` 都按 5 个领域算。`Goal.area: LifeArea`、`Goal.tags?`。已有 `Decision`（绑定 pathId 的“已决策”日志）。`LifeTree` 有 paths/decisions/goals/activity/dayStart/dayEnd/guideDismissed。
- 区域色：career=sky, wealth=amber, relationships=rose, health=emerald, growth=accent；PlanScreen 有区域 emoji（career 💼 / relationships ❤️ / growth 🌱 …）。
- 任务已有 `scheduledDate`/`startTime`/`durationMin`；`calendar.ts` 有 `actionsOnDay`/`unscheduledActions`/`setActionScheduledDate`；`daily.ts` 有 `todayItems`。

---

## 📦 包 A — 导航与任务视图 + 「其他」领域

### A1. 侧边栏分组重构（AppShell，我们自己的暗色）
分组带小标题（uppercase tracking 标签，沿用现有 `--fg-faint` 风格），顺序：
```
🌳 我的人生树                       → view: tree（置顶，单列突出）
── 待办 ──
  ☀️ 今天        → view: today      [新]
  🗓️ 即将到来    → view: upcoming   [新，= 包 B 横向时间轴]
  📅 日历        → view: dashboard  [现有日历首页]
  ✅ 全部任务    → view: alltasks   [新]
  ☑️ 已完成      → view: completed  [新]
── 我的人生 ──
  🧭 人生面=areas / 🎯 目标=plan / 🔁 习惯=habits / 📊 洞察=insights
── 选择 ──
  ⚖️ 选择面板    → view: choices    [新，包 C]
── 收藏 ──
  ⭐ <每个被收藏的目标>  → openPlan(focusGoalId)（目标页展开并滚到该目标）
── 标签 ──
  🏷️ <每个标签>         → view: tag（selectedTag 过滤）
```
- 收藏/标签为动态列表：收藏来自 `goals.filter(favorite)`；标签来自 `allTags(tree)`。空分组整组隐藏。
- 收藏项右侧小字：有 `endDate` → “距截止 {n}天/已过期”；否则 “{n}天前建”。纯函数算（时间注入）。
- 手机抽屉同一份 `sidebarInner`，分组照搬。无障碍：分组用 `role`/`aria-label`，项仍是 `<button>`。

### A2. 新增 View 与路由
`View` 增加：`today | upcoming | alltasks | completed | choices | tag`。`page.tsx` 的 AppShell 分支按 view 渲染对应组件。新增 AppContext openers：`openToday/openUpcoming/openAllTasks/openCompleted/openChoices/openTag(tag)/openPlanFocused(goalId)`，以及状态 `selectedTag: string | null`、`focusGoalId: string | null`（进入即用、用后由目标页消费）。

### A3. To Do 三个清单视图（read-heavy，复用适配器）
- **今天 TodayView**：`daily.todayItems(tree, today)`（手动任务：今天排期∪今天计划；+ 今天到期习惯），勾选完成（`toggleTodayAction`）。空态友好提示。
- **全部任务 AllTasksView**：`goalTree.allTasks(tree)` 按 领域→目标 分组；筛选切换“进行中 / 全部”；每行可勾选完成 + 删除 + 跳到所属目标。
- **已完成 CompletedView**：所有 `task.done` 的任务（+ 可选已完成目标）按完成时间倒序；可取消完成。
- 三者皆纯读 + 现有方法，零新领域逻辑（必要时加 1~2 个 `goalTree` 纯查询，带测试）。

### A4. 收藏 ⭐
- `Goal.favorite?: boolean`（可选，normalize 不需迁移）。目标卡（PlanScreen）加 ⭐ 切换；AppContext `toggleGoalFavorite(goalId)`。侧边栏“收藏”组列出。

### A5. 标签导航
- 标签已存在于 `Goal.tags`。侧边栏“标签”组列出 `allTags(tree)`；点击 → `view: tag` + `selectedTag`。**TagView**：列出带该标签的目标 + 它们的任务（复用 AllTasks 的渲染）。

### A6. 「其他」领域（中性桶，不参与预测）
- **不动 `LifeArea`（5 个，继续驱动 Profile.areas / compositeIndex / 预测）。** 新增：
  ```ts
  export type GoalArea = LifeArea | "other";
  export const GOAL_AREAS: GoalArea[] = [...LIFE_AREAS, "other"];
  export const GOAL_AREA_LABELS: Record<GoalArea,string> = { ...AREA_LABELS, other: "其他" };
  ```
- `Goal.area: GoalArea`（放宽）。色：other = 中性灰（`var(--fg-faint)` 或新增 `--c-slate`）；emoji 📦。
- `goals.completeGoal`：仅当 `area` 属于 5 个 `LifeArea` 时给领域 +bump；`other` 不 bump（不影响预测）。
- 区域分组（PlanScreen / AllTasks / TagView）用 `GOAL_AREAS`（6 桶）；**人生面 AreasSection（领域分数页）仍只展示 5 个**（other 无分数）。
- 迁移：旧目标 area 都是合法 LifeArea，天然兼容；无需迁移。

---

## 📦 包 B — 多日横向时间轴（= 即将到来 / Upcoming）

### B1. 概念
横向铺开“从今天起 N 天”（默认 14，水平滚动可看更多），每天一列；该天排期的一次性任务渲染成**任务条**（按目标领域色）；到期习惯渲染成**浅色只读幽灵条**（不可拖）。左侧/顶部“未排期任务”托盘列出 `unscheduledActions`（`!done && !scheduledDate`）。

### B2. 交互（沿用“桌面拖拽 + 手机点选”）
- **桌面 HTML5 DnD**：托盘任务 → 拖到某天列 = `setActionScheduledDate(id, date)`；已排任务条 → 拖到另一天 = 改期；拖回托盘 = `scheduleAction(id, null)` 取消排期。
- **手机点选兜底**：点任务条（选中高亮）→ 点某天列 = 排到该天；点托盘里“取消选中”。复用月历当初的同款模式。
- 具体几点不在这里设（保持“多日=按天”），点任务条可“去日视图设时间”（跳 dashboard 日视图）。

### B3. 实现
- 新组件 `UpcomingTimeline.tsx`（view: upcoming）。日期列纯由注入的 today 推导（boot const + visibility effect，不在模块作用域 new Date）。
- 复用 `calendar.actionsOnDay`/`unscheduledActions` 与 AppContext `scheduleAction`。零新数据、零迁移。
- 任务条上：标题、所属目标小点、勾选完成。一行多任务自动堆叠。今天列高亮。
- 可访问性：拖拽元素有键盘兜底（选中 + 方向？v1 至少保证点选可达；列与条为语义化按钮）。空态提示。

---

## 📦 包 C — 选择面板（独立，与人生树打通）

### C1. 数据模型（新，独立于现有 path 绑定的 `Decision`）
```ts
export type Reversibility = "one-way" | "two-way"; // 复用现有
export interface ChoiceOption {
  id: string;
  label: string;          // 选项名，如“去大厂” / “创业”
  pros: string;           // 利（自由文本，按行）
  cons: string;           // 弊
  cost: string;           // 成本（时间/金钱/机会）
  reversibility: Reversibility; // 可逆性
  gut: number;            // 直觉分 1-5
  pathId?: string | null; // 该选项在树上的分支（“为这个选项推演”后回填）
}
export interface Choice {
  id: string;
  question: string;       // 我面临的选择
  createdAt: string;
  options: ChoiceOption[];
  chosenOptionId?: string | null; // 选定的选项
  decidedAt?: string;
}
// LifeTree.choices: Choice[]
```
`normalizeLoadedTree` 补 `choices: []`；`createTree` 加 `choices: []`。无迁移。

### C2. 领域 `choices.ts`（纯，TDD）
`createChoice(question, now)` · `addOption(tree, choiceId, label, now)` · `updateOption(tree, optionId, patch)` · `removeOption(tree, optionId)` · `decideChoice(tree, choiceId, optionId, now)`（置 chosenOptionId+decidedAt）· `removeChoice(tree, choiceId)` · `linkOptionPath(tree, optionId, pathId)`。可选纯启发式 `suggestOption(choice)`（综合 gut + 可逆性 + 利弊行数给一个“倾向”提示，非强制）。

### C3. 状态 + 树联动（AppContext）
方法：`createChoice / addChoiceOption / updateChoiceOption / removeChoiceOption / removeChoice`，以及联动：
- `predictOptionBranch(choiceId, optionId)`：为某选项 `addPath`（choiceLabel=option.label，从“现在”分叉）→ `predictAndCommit` 推演 → 回填 `option.pathId`。让用户**先看未来再决定**。
- `decideChoice(choiceId, optionId, { makeGoal?, area? })`：置选定；若 `makeGoal` → 用该选项 `addGoal`（若有 pathId 则 `addGoalWithBranch` 复用该分支思路 / 或直接 link）。一键把“拍板”变成可执行目标。
- 全部走 `treeRef` 读取-应用一快照，避免与 `predictAndCommit` 抢快照（沿用既有模式）。

### C4. 组件 `ChoicePanel.tsx`（view: choices）
- 选择列表（未决/已决分区）。新建选择（输入 question）。
- 每个选择 = 标题 + **选项对比卡/横向表**：每列一个选项，行有 利 / 弊 / 成本 / 可逆性(单行道·可回头) / 直觉(1-5 星)。增删选项、行内编辑。
- 每选项按钮：「🌳 推演这个选项」(`predictOptionBranch`，有 pathId 后显示「在树上看」) + 「✅ 就选它」(`decideChoice`，弹一个“是否同时建成目标”的轻确认)。
- 已决选择：高亮选定项，显示 decidedAt；可“重新打开”。
- 可选 AI：「✨ AI 帮我分析」→ 路由 `/api/analyze-choice`（DeepSeek + 离线兜底 + 限流），按 question+options 回填 利/弊/可逆性建议。**标记为可裁剪子任务**（构建紧张时先不做，按钮置灰/隐藏）。

---

## 跨包：迁移 / i18n / 测试
- **normalize**：补 `choices: []`；`Goal.favorite` 为可选无需补；`Goal.area` 放宽到 `GoalArea` 不破坏旧值。createTree 加 `choices: []`。
- **i18n**：A/B/C 所有新中文串加 EN（追加式）。
- **测试**：领域 `choices.ts` 全测；收藏时间标 / 收藏过滤 / 标签过滤 / today/alltasks/completed 选择器若新增纯函数则测；`completeGoal` 对 `other` 不 bump 加测；timeline 复用 calendar（已测）。状态/组件靠 tsc + build + 真机冒烟。
- **验收**：tsc 0 / vitest 全绿 / next build 通过；新侧边栏分组可用、人生树置顶；今天/全部/已完成/标签视图正确；收藏 ⭐ 进侧栏；“其他”领域可选且不污染预测；横向时间轴桌面拖拽 + 手机点选改期；选择面板能建选择/选项/对比/推演分支/选定→目标。

## 分阶段（writing-plans 细化；每阶段 tsc+test+build+提交）
1. **A-数据/状态**：GoalArea + GOAL_AREAS/LABELS、Goal.favorite、LifeTree.choices(占位)、normalize/createTree、completeGoal other-guard、新 View keys + openers + selectedTag/focusGoalId（含测试）。
2. **A-侧边栏**：AppShell 分组重构 + 人生树置顶 + 收藏/标签动态组 + 手机抽屉。
3. **A-视图**：TodayView / AllTasksView / CompletedView / TagView + 收藏 ⭐ 接入 PlanScreen + 其他领域接入区域选择/分组。i18n。验证 + 提交。
4. **B-时间轴**：UpcomingTimeline（横向 14 天 + 托盘 + 桌面拖拽 + 手机点选）+ 接 upcoming view。i18n。验证 + 提交。
5. **C-数据/领域**：Choice/ChoiceOption 类型 + choices.ts(纯, TDD) + normalize/createTree。提交。
6. **C-状态/联动**：AppContext choices 方法 + predictOptionBranch + decideChoice→goal。提交。
7. **C-UI**：ChoicePanel + 接 choices view + 侧栏“选择”组。（可选 /api/analyze-choice，可裁剪）。i18n。验证 + 提交。
8. **收尾**：i18n 审计 + 全量 tsc/test/build + 重启 dev + 更新 task_plan/progress/findings。

## 诚实风险
- 量大：8 阶段、~5 个新视图 + 1 个新数据模型 + 侧边栏重构。夜间分阶段做、每阶段绿、可回滚。
- 时间轴拖拽的无障碍/手机端是历史易错点 → 强制点选兜底。
- 「其他」桶可能被滥用、稀释平衡框架 → 已隔离出预测之外，降低危害。
- 选择面板与现有 `Decision`(path 日志) 概念并存，刻意不强行合并（v1）；若日后重复感强，再融合。
- AI 分析选择为可裁剪项，确保不接 key 也能完整使用面板。
