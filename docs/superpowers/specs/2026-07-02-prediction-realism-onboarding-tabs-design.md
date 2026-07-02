# 预测真实化 + 三走向全 AI + onboarding 对齐网页 + Tab 重排

- 日期：2026-07-02
- 状态：设计已确认（brainstorming），直接 subagent 执行
- 范围：主手机端（`mobile/`）+ 一处共享服务端提示词（`src/lib/enrich.ts`，网页手机同时生效）+ 少量网页标签。

## 动机（用户真机反馈）

1. **三走向命名**：乐观/中性/保守 → **高光/平稳/低谷**。
2. **三走向还在本地托底**：乐观/保守走向由本地生成，不是 AI。要求三种全部 AI 推演。
3. **Tab 顺序**：人生树(1，默认) · 日历(2) · 目标(3) · 我(4)。
4. **onboarding 收集太少**：加技能/存款/负债等，对齐网页字段，8 页更密。
5. **AI 预测过于乐观、不够真实**。

## 关键事实（已核实）

- `/api/enrich`（`src/lib/enrich.ts`）**已支持 `scenario` 参数**：`optimistic`=偏顺利、`conservative`=偏不顺（`enrich.ts:166-173`），且节点心情已用 high/mid/low=高光/平稳/低谷。数字曲线一律本地引擎（AI 只覆盖 story/nodes/feasibility）——这是既定架构，几何非"假内容"。
- **网页端 `addScenario`（`AppContext.tsx:728`）已经 AI 推演变体**（`addScenarioVariant` 本地建变体 → `predictAndCommit` AI 覆盖）。**只有手机端 `store.tsx` 的 `addScenario` 是纯 `addScenarioVariant`、没接 AI** —— 这就是"本地托底"的根因，手机端独有。
- 手机 `ProfileInputs = Omit<Profile,"areas"|"snapshot">` 已**包含**所有网页字段（`skills?`/`savings?`/`debt?`/`familyResponsibility?`/`riskAppetite?`/`nationality?`/`status?`/`hasSideHustle`/`sideHustle`）——只是 OnboardingScreen 没采集。类型无需改，补 UI 即可。
- 手机 tab 路由：`app/(tabs)/index.tsx`=ScheduleScreen、`tree.tsx`=TreeScreen、`goals.tsx`、`me.tsx`。无别处硬跳 `/` 或 `/tree`（grep 确认）→ 重排安全。

## 决策（brainstorming 敲定）

- 三走向 AI **按需触发**：切到某走向且未生成过时才调 AI（期间放推演动画，之后缓存）——和网页一致。**去掉现在那个提前生成本地变体的预取**。
- "和网页端同步" = **采集相同字段**，不做云端数据同步（另立）。

## 工作流

### WS-A 走向改名（高光/平稳/低谷）
- 手机详情页 `mobile/app/path/[pathId].tsx`：`SCENARIOS` 段标签 + 三情景爬升条标签，乐观→高光、中性→平稳、保守→低谷。**只改显示文案，`Scenario` 枚举值（optimistic/likely/conservative）不动。**
- 网页 `src/components/PathDetail.tsx` 同步同样的显示改名（保持两端一致）。i18n 走 `t(...)`（网页），手机用 RN 文案常量。

### WS-B 三走向全 AI（手机端，核心修复）
- `mobile/src/state/store.tsx` 的 `addScenario(basePathId, scenario)` 改为：先 `addScenarioVariant`（本地几何），拿到新变体 path，**再 `enrichPath(tree, variant)`（带该 scenario）→ `applyEnrichToPath` 覆盖 story/nodes/feasibility 并 `enriched:true`**，期间 `setEnriching(true)`、`finally` 复位——完全复刻 `addChoiceBranch`/网页 `predictAndCommit` 的模式。离线（`!hasBackend()`）仍只本地建变体（无 AI 兜底内容，UI 用「重试推演」——沿用 WS2 口径）。
- 详情页 `[pathId].tsx`：切走向 `pickScenario` 逻辑不变（`setScenario` + 无变体则 `addScenario`），但因为 `addScenario` 现在异步 enrich，需在详情页显示推演动画（复用 `PredictingOverlay`，`visible={enriching}`）。**删除 WS4 那个 `useEffect` 预取乐观/保守变体的块**（它建的是本地变体 = 托底根源）。
- 结果：点高光/平稳/低谷，第一次切各自 AI 推演一版（scenario-specific），之后缓存；曲线几何仍本地（和基准路一致）。

### WS-C Tab 重排（手机）
- 目标顺序：**人生树(默认) · 日历 · 目标 · 我**。
- `app/(tabs)/index.tsx` → 改为 `export { default } from "../../src/screens/TreeScreen";`（人生树成为默认落地 + 第一个 tab）。
- 新增 `app/(tabs)/calendar.tsx` → `export { default } from "../../src/screens/ScheduleScreen";`（日历）。
- 删除 `app/(tabs)/tree.tsx`（index 已是树）。
- `_layout.tsx` 顺序改为：`index`(人生树, 图标 `sitemap-outline`) · `calendar`(日历, `calendar-month-outline`) · `goals`(目标) · `me`(我)。
- 跑一遍 grep 确认没有 `router.*("/")` / `"/tree"` 依赖（已初查无）；ScheduleScreen 里 `fmtDate`/首页文案里若有"首页"字样按需改"日历"。

### WS-D onboarding 对齐网页 + 8 页更密（手机）
- `mobile/src/screens/OnboardingScreen.tsx`：在现有采集（name/age/education/major/occupation/salary/hobbies/relationship/location/crossroad/作息窗）基础上，**补齐**：`skills`(技能，自由文本)、`savings`(SavingsBand 选项)、`debt`(DebtBand 选项)、`familyResponsibility`、`riskAppetite`、`nationality`、`status`、`hasSideHustle`+`sideHustle`。band 选项复用核心导出的 `SAVINGS_OPTIONS`/`DEBT_OPTIONS`/风险偏好选项（和网页 `Onboarding.tsx` 同源）。
- 重排成 **8 个步骤**，单页信息密度更大（一页放 2–3 个相关字段），大致：①称呼+年龄 ②学历+专业+职业 ③收入+副业 ④存款+负债 ⑤技能+爱好 ⑥情感+家庭责任 ⑦所在地+国籍+身份 ⑧风险偏好+当前岔路+作息窗。（步数/分组可微调，保证 8 页且必填只有名字+年龄。）
- 采集值全部进 `ProfileInputs` → `onboard`，喂 `deriveAreas`/`buildSnapshot`（字段越全预测越准）。保持 2026-07-02 已做的「引导完成后先等现状 AI 推演再进首页」。

### WS-E 预测别太乐观（共享 `src/lib/enrich.ts`，服务端）
- **surgical 调提示词**，方向：可行度校准更保守/真实（别动辄 60%+）；整条弧线别一路顺；结局更贴现实（含停滞/回撤/代价）；保留既有 anti-prophecy / 禁词表 / 每条≥2 处真实摩擦 / 多维度 / 因果 等约束——**只收紧现实性，不删约束**。
- 可能顺带压一下 `optimistic` 走向的乐观度（"顺利不等于无摩擦"再加重）。
- **必须跑评估**：用 `/predict-eval` 技能 + `prediction-quality-reviewer` agent 对几条样本打分（真实锚点/密度/无矛盾/不套话/不过度乐观），迭代到达标。这条是软性、可能来回几轮，由主控（我）在环。

## 护栏
- 核心纯净（本 spec 基本不动核心逻辑）；i18n 追加式（网页新串）；无 emoji；苹果白/现有 RN theme。
- 每个 WS 收口：mobile `npx tsc --noEmit`；凡动到共享/网页（WS-A 网页标签、WS-E enrich、若动核心）→ 跑 `/green`。
- 部署：手机纯 JS → OTA（`eas update --environment production`，env 已注册）；网页/服务端随 master → Vercel（WS-A 网页标签、WS-E enrich 生效）。**每步提交；用户在环确认 WS-E eval。**

## 顺序（subagent 执行）
WS-A（改名，机械）→ WS-C（Tab 重排）→ WS-B（走向全 AI）→ WS-D（onboarding 8 页）→ WS-E（提示词 + eval，主控在环，最后且需人判）。

## 非目标（YAGNI）
- 不做手机云端数据同步（Supabase）——独立项目。
- 不改数字曲线来源（几何仍本地，符合既定架构）。
- 不重构核心 Scenario 模型（只改显示名 + 手机 enrich 接线）。

## 验证 / 交付（真机，用户）
- 三走向 tab 显示高光/平稳/低谷；切换各自有 AI 推演动画、内容各不相同（非本地模板）。
- Tab 顺序为 人生树/日历/目标/我，开 App 落在人生树。
- onboarding 8 页、能填技能/存款/负债等。
- 预测读起来更真实、不再一味乐观（WS-E eval 达标后）。
