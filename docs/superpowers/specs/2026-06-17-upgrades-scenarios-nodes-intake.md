# 升级：走向一致+缓存 · 节点线上标注 · 更丰富的初始信息 — 设计文档

日期：2026-06-17
状态：方向已确认（用户已拍板三项选择），待 /goal 过夜执行
执行方式：subagent-driven（同 decision-loop），全程 TDD + 两段评审 + 最后真机冒烟

## 范围（4 块）

### A. 走向一致 + 缓存（修 bug）
**问题（同一根因）：** 当前 `canRetime` 只看 `kind === "choice" && parentId == null`，没排除走向，于是 乐观/保守 变体各自被 AI 重定分叉年龄 → (1) 保守 24 岁、最可能 23 岁，不一致；(2) PathDetail 切换时按 `forkAge` 匹配缓存变体，年龄漂移 → 匹配失败 → 每次切换都重新推演。

**改法：**
1. `src/lib/enrichClient.ts` `canRetime`：加 `&& path.scenario === "likely"`。
2. `src/lib/enrich.ts` `applyEnrichment` 的 `retime` 判定：加 `&& path.scenario === "likely"`（只有 最可能 能重定时机；乐观/保守继承）。
3. `src/domain/tree.ts` `addScenarioVariant` 已经用 `base.forkAge` 建变体 → 配合上面两条，变体会**继承最可能的分叉年龄**，不再漂移。
4. `src/components/PathDetail.tsx` 走向切换的变体查找：**去掉 `p.forkAge === path.forkAge` 这个匹配条件**，改为按 `choiceLabel + parentId + scenario` 匹配。这样缓存稳定命中 → 切换不再重新推演（懒生成：某走向第一次查看才生成，之后秒切）。
5. 近期时间线一致：`src/lib/enrich.ts` 对非 likely 变体（canRetime=false，已传 fixedStart=base.forkAge）在 prompt 里追加一句：前 1-2 个关键时刻的年龄尽量与"最可能"对齐，分歧体现在后段与结局。

**验收：** 同一选择的 乐观/最可能/保守 三条 forkAge 完全相同；切换走向不触发"正在推演"动画第二次（首次生成后缓存命中）。
**测试：** 领域层加测试——给定一个已 enrich 的 likely 路径，生成的 optimistic/conservative 变体 forkAge === likely.forkAge（用本地 generator + 模拟 applyEnrichment 的 retime=false 分支）。

### B. 关键节点标注在选中的那条路上
**行为：** 当一条路被选中/聚焦（`focusId === p.id`）时，沿它的曲线在每个关键节点旁显示小标签（`{age} 岁 · {title 截断}`），并把"＋ 在这里加岔路"做成显眼可点的标记（不再只靠 hover）。其它未聚焦的路保持当前的小圆点，避免多条路时标签糊成一团。
**文件：** 主要 `src/components/LifeMap.tsx`（节点渲染：聚焦路显示标签 + 明显的加岔路按钮；非聚焦路维持圆点）；如需，`src/components/mapLayout.ts` 仅提供已有的 node x/y/age/title（无需改布局）。
**注意：** 标签小字号、交替上/下偏移防重叠；点节点仍走现有 `onForkAtNode`。可用 ui-pro-max 做视觉打磨，但交互契约不变。
**验收：** 点开一条路，曲线上能看到每个节点的年龄+标题，并能一眼看出"在这里加岔路"。
**i18n：** 复用现有 `{age} 岁`、`＋ 在这里加岔路（{age} 岁 · {title}）`、`＋ 在这里加岔路`，无需新词。

### C. 更丰富的初始信息（财务/技能/家庭/风险）
**新增 Profile 字段（全部可选，旧树不破）：**
- `skills?: string` — 技能/专长（自由文本）
- `savings?: SavingsBand` — 存款区间（select）
- `debt?: DebtBand` — 负债区间（select）
- `assets?: string` — 资产（自由文本，如"房1套/车/股票"）
- `family?: FamilyResponsibility` — 家庭责任（select）
- `riskAppetite?: RiskAppetite` — 风险偏好（select）

枚举（带中文标签，english 进 messages.ts）：
- SavingsBand: `none(无积蓄) | lt1w(1万以下) | 1to10w(1-10万) | 10to50w(10-50万) | 50to100w(50-100万) | gt100w(100万以上)`
- DebtBand: `none(无负债) | lt10w(10万以下) | 10to50w(10-50万) | 50to100w(50-100万) | gt100w(100万以上)`
- FamilyResponsibility: `none(暂无) | kids(要养孩子) | parents(要养父母) | both(上有老下有小)`
- RiskAppetite: `conservative(保守求稳) | balanced(稳健) | aggressive(进取敢冲)`

**Onboarding：** 现为 3 步；插入新的一步（放在"现在的工作/收入"之后、"情感/岔路"那步之前），TOTAL_STEPS 3→4。新步标题如「再真实一点（可选，但越填越准）」，含：技能、存款、负债、资产、家庭责任、风险偏好。全部可选，可直接下一步。
**文件：** `src/domain/types.ts`（Profile + 新枚举）、`src/domain/profile.ts`（OPTIONS/LABELS + buildSnapshot 追加这些字段；deriveAreas 可轻量纳入：存款/负债微调 wealth，技能/风险微调 career/growth——可选，先最小改动）、`src/components/Onboarding.tsx`（新步 + 字段）、`src/i18n/messages.ts`（全部新标签英文）。
**喂给 AI：** `buildSnapshot` 追加这些字段后，`profileSummary` 自动带到 assistant/suggest-paths；`src/lib/enrich.ts` 的 facts 列表与 `src/app/api/chat/route.ts` 的 facts 列表各追加：技能、存款、负债、资产、家庭责任、风险偏好（有才写，空则跳过）。
**向后兼容：** 新字段可选；旧 localStorage 树缺这些字段照常加载（不清库）。无需 bump storage key。
**验收：** 新用户引导能填这些；填了之后 enrich/chat 的提示词里出现这些事实；旧树仍能打开。
**测试：** `buildSnapshot` 在带/不带新字段时都生成合理文本（领域单测）。

### D. （贯穿）提示词用上新信息
A/C 落实后，确认 enrich、chat、assistant、suggest-paths 四处提示词都能（在有值时）引用新字段，让"贴近真实的你"更强。无单独文件，附在 C 内。

## 非目标（本轮不做）
- 账号/云同步、上线相关（BYOK/限流/法务）——另议。
- 让"加岔路"支持用户手写节点标注（自定义注释）——本轮只做"显示已有关键节点 + 在其处加岔路"。
- deriveAreas 的复杂财务建模——只做轻量加权或先不动。

## 风险/注意
- 不在中文双引号串里夹 ASCII 引号（构建杀手）。
- 领域层不得用 Date.now/Math.random。
- 渲染期不得调用 new Date()（purity lint）——节点标注不涉及时间，安全。
- 走向缓存改动要确保：切换走向时若变体已存在则 `openPath` 而非重新生成。

## 验收总览
50+ 既有测试保持通过 + 新增测试；typecheck/build 干净；真机冒烟：①三走向 forkAge 一致且切换不再二次推演；②选中路曲线上有节点标签且能加岔路；③新引导步可填、提示词带上新信息、旧树不丢。
