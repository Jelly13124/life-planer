# 人生决策闭环 — 设计文档（Life Decision Loop）

日期：2026-06-16
状态：已确认方向，待评审

## 一句话

把现有的「可视化预测 + 与未来自己对话」从一个**好玩的探索壳**，升级成一个**真正帮你做人生决定的闭环**：看见 → 追问 → 选定 → 落地 → 复盘 →（回到看见）。预测当情绪钩子，规划当内实，复盘闭环让预测从「算命」变成「校准」。

## 背景与定位

调研了一批**不带预测**的规划/决策工具（Designing Your Life / Odyssey、Farnam Street 决策日志、Decision Journal、Mindsera 的心智模型、TickTick/Sunsama 的计划-复盘）。结论：

- 这些工具帮人"真的规划"靠的是四个机制：**决策日志闭环**、**心智模型框架**、**Odyssey 原型试错**、**目标→近期计划→定期复盘**。
- 但它们几乎都是"日记优先、文字为主"，没有人有我们这种**情绪化、可视化的"看见多重人生"体验**。
- 我们的护城河 = 那套可视化预测 + 与未来自己对话。错误做法是 (1) 保留它却继续当"预测器"卖（滑向算命陷阱），或 (2) 为了显得"正经"把它扔掉。
- 正确做法：**保留护城河，给它接上真正的规划内核**，并用**复盘闭环**让预测对照现实、自我校准——这既诚实、又安全、又独一无二。

红线（沿用最初的产品决策）：**不做"预测器"，不算命。** 预测是"想象一种可能"，复盘是"对照真实"，决策框架是"帮你想清楚"，永远把选择权和不确定性还给用户。

## 目标 / 非目标

目标（本期第一刀）
- 让用户能把任意一条已展开的路，变成一个**可执行的人生计划**并在未来**复盘**。
- 引入**决策框架**（后悔最小化 / 预演失败 / 可逆性）到"与未来自己对话"里，帮用户想清楚。
- 复盘时把**真实结果 vs 当时的预期/信心**对照出来，沉淀一句"教训/校准"。
- 全程中英双语（复用现有 i18n）。

非目标（本期不做，列为后续）
- 账号 / 云同步 / 跨设备（仍是 localStorage 单机）。
- 系统通知 / 邮件提醒（只做应用内"该复盘了"提示）。
- 与某条路无关的"独立决定"（本期决定必须挂在一条 path 上）。
- 数据分析、付费层。

## 闭环的五步（与现状对照）

| 步骤 | 含义 | 现状 |
| --- | --- | --- |
| 看见 | 可视化预测：你的多重人生树 | ✅ 已有（LifeMap） |
| 追问 | 与未来自己对话 + 决策框架 | 🟡 对话已有；**本期加 3 个框架预设** |
| 选定 | 记下：赌哪条、为什么、信心几成、何时回看 | 🆕 本期新建（决策日志） |
| 落地 | AI 把它拆成 30/90 天计划 + 几个低成本试错 | 🆕 本期新建（/api/plan） |
| 复盘 | 到期回看：真实 vs 当时预测，校准自己 | 🆕 本期新建（/api/review） |

复盘后可选「用真实情况再推演一条」→ 复用现有 `addBranch`，回到"看见"，形成闭环。

## 数据模型（src/domain/types.ts 新增）

决定挂在树上（`LifeTree.decisions`），用 `pathId` 关联到某条 `LifePath`。纯数据，不含时间/随机副作用。

```ts
type Reversibility = "one-way" | "two-way"; // 单行道 / 可回头
type PlanHorizon = "30d" | "90d";

interface PlanStep { id: string; text: string; done: boolean }
interface Experiment { id: string; text: string; done: boolean } // 低成本试错

interface Plan {
  horizon: PlanHorizon;
  steps: PlanStep[];        // 3-6 条近期行动
  experiments: Experiment[]; // 2-3 个可证伪的小试验
  generatedByAI: boolean;    // 区分 AI / 本地模板
}

interface Review {
  reviewedAt: string;            // ISO
  whatHappened: string;          // 用户写：实际发生了什么
  outcome: 1 | 2 | 3 | 4 | 5;    // 1 远差于预期 … 5 远好于预期
  lesson: string;                // AI + 用户：一句教训/校准
}

interface Decision {
  id: string;
  pathId: string;                // 关联的 LifePath
  choiceLabel: string;           // 这次"赌"的选择（默认取 path.choiceLabel）
  createdAt: string;             // ISO（状态层注入）
  rationale: string;             // 为什么选它
  expectation: string;           // 我预期/希望发生什么
  confidence: number;            // 0-100，step 10（信心几成）
  reversibility: Reversibility;
  reviewDate: string;            // ISO = createdAt + horizon（状态层算）
  plan: Plan;
  review: Review | null;         // 未复盘为 null
}
```

`LifeTree` 增加 `decisions: Decision[]`。**约束：每条 path 至多一个"未复盘"的活跃决定**（再次选定则覆盖未复盘的那条）。

确定性：`Decision.id = "dec-" + hashSeed(pid|createdAt)`；step/experiment id 同理用序号 hash。所有时间（createdAt / reviewDate / reviewedAt）由状态层用注入的 `now` 计算，domain 不碰 `Date.now`。

## 领域纯函数（src/domain/decisions.ts 新增）

- `createDecision(input, now): Decision` — 组装一条决定（含 reviewDate = now + horizon 天，由状态层把算好的 ISO 传入或在此用注入的 now 计算天数）。
- `upsertDecision(tree, decision): LifeTree` — 覆盖同 path 的活跃决定，返回新树。
- `attachPlan(decision, plan): Decision`、`togglePlanItem(decision, id): Decision`。
- `recordReview(decision, review): Decision`。
- `dueDecisions(tree, today): Decision[]` — 返回 `reviewDate <= today 且 review === null` 的决定（today 注入，便于测试）。
- `calibrationNote(confidence, outcome): string` — 本地兜底的一句校准（例如"你当时信心 80%，结果比预期差——也许高估了顺利程度"）。AI 版在 /api/review 生成更好的。

全部纯函数、注入 now/today，配套单测（node 环境）。

## AI 路由（服务端，沿用 DeepSeek + 优雅降级 + lang）

### POST /api/plan —— 落地
入参：`{ profileSummary, path:{choiceLabel,summary,nodesBrief}, rationale, expectation, horizon, lang }`
出参：`{ steps: string[], experiments: string[] }`（zod 校验、json 模式、extractJson）。
提示词要点：把选择拆成**未来 30/90 天的具体、可执行**行动（动词开头、可勾选），外加 2-3 个**低成本、可证伪**的小试验来验证这条路是否真适合（呼应 DYL 原型试错）；现实、克制、不画饼；语言跟随 `lang`。
无 key / 失败 → 返回空 → 前端用**本地模板**兜底（基于选择关键词给通用步骤）。

### POST /api/review —— 复盘校准
入参：`{ choiceLabel, rationale, expectation, confidence, whatHappened, outcome, lang }`
出参：`{ lesson: string }`（≤2 句）。
提示词要点：对照"当时的预期/信心"与"真实发生"，给一句**温暖、诚实、可迁移**的教训/校准；不说教、不算命。失败 → 用 `calibrationNote` 本地兜底。

### 追问框架（不新增路由）
复用现有 `/api/chat`（与未来自己对话）。在 `chatClient` 增加 3 个框架预设提示，用户点一下即把对应问题发给"未来的自己/助手"：
- 后悔最小化："如果我 80 岁回头看，哪个选择更不会让我后悔？"
- 预演失败（pre-mortem）："假设这条路三年后失败了，最可能是因为什么？"
- 可逆性："这个决定是单行道还是可回头？最坏情况我能承受、能撤回吗？"

## 组件与交互（前端）

1. **PathDetail 增加「把这条路变成计划」区块**（仅 choice 路径）：
   - 入口按钮 → 打开 `DecisionSheet`（底部抽屉，复用 AddBranchSheet 的视觉语言）。
   - 选定表单：为什么选它（rationale）、预期（expectation）、信心滑条（0-100，step10）、可逆性（单行道/可回头）、何时回看（30 天 / 90 天）。
   - 提交 → 调 /api/plan 生成计划（期间用现有「正在推演」过场的轻量版/局部 loading）→ 展示可编辑、可勾选的 steps + experiments → 保存进 `tree.decisions`。
   - 已有决定时，PathDetail 顶部显示"你的决定 + 计划进度（x/total）+ 距复盘还有 N 天"。
2. **追问**：在 `FutureSelfChat` 的快捷追问里加上面 3 个框架预设。
3. **复盘提示**：`TreeScreen` 顶部，当 `dueDecisions(tree, today).length>0` 时显示一条"有 N 个决定该复盘了"，点开进 `ReviewSheet`：写"实际发生了什么" + 选 outcome（1-5）→ 调 /api/review 出 lesson → 存入 `decision.review`。复盘完给一个可选按钮"用真实情况再推演一条"（调 `addBranch`，回到看见）。
4. **新视图（可选，第一刀可不做）**："我的决定"列表页；本期先靠 PathDetail + TreeScreen 提示承载。

## 持久化与迁移

- 仍用 localStorage，**STORAGE_KEY 保持 `lifeplanner.tree.v3`，不再清库**（用户已多次被重置，避免再丢数据）。
- `LocalStorageRepository.load()` 对旧树做**向后兼容回填**：`tree.decisions ??= []`，并为缺字段的决定补默认值。新增 decisions 不破坏旧结构。

## i18n

所有新文案走现有 `t("中文")` 方案，并在 `src/i18n/messages.ts` 补英文；/api/plan、/api/review 带 `lang`，输出语言跟随界面。

## 确定性 / 约束（沿用项目规则）

- domain（types/decisions）**不使用 `Date.now` / `Math.random`**；时间与今天由状态层注入，ID 用 `hashSeed`。
- 组件文案不在中文串里混 ASCII 引号（用中文引号）。
- 新增纯函数全部带单测；AI 路由全部有无 key 的本地兜底。

## 测试

- `decisions.test.ts`：createDecision/upsert（同 path 覆盖）/toggle/recordReview/dueDecisions（注入 today 的边界）/calibrationNote。
- `enrichClient` 风格的客户端清洗测试（plan/review 解析与兜底）。
- 现有 64 个测试保持通过；typecheck + build 干净。

## 范围切分

第一刀（本 spec）：数据模型 + 领域纯函数 + DecisionSheet（选定→落地）+ 复盘提示与 ReviewSheet + 3 个框架预设 + 两个 AI 路由 + 迁移 + i18n + 测试。

后续（另开 spec）：独立决定（不挂 path）、"我的决定"看板、复盘→自动再推演的更顺滑闭环、账号/云同步与提醒、把"计划"接入日历/待办。

## 待确认的开放问题

1. 信心用 0-100% 滑条，还是 1-5 星？（默认 0-100%）
2. 复盘到期只在应用内提示，对吗？（默认是）
3. 计划默认 30 天还是 90 天？（默认让用户选，预选 90 天）
