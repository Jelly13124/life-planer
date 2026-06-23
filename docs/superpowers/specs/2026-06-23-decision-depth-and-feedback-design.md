# 决策体验深化 + 即时反馈 (Route A ③ + 动机闭环加档, 2026-06-23)

分支 `feat/goal-planning-mainline`。两块,各自独立提交。

## Part 1 — 即时反馈 toast(动机闭环加一档)
完成一个推动"挂在某条路上的目标"的行动时,弹一个短暂反馈:**「『去大厂』这条路更近了:40% → 45%」**,而不只是静态数字。
- 触发:AppContext 里完成行动的方法(toggleTodayAction / toggleActionOn → completeAction;仅"由未完成→完成"时)。该行动属于某 goal,且该 goal 有 pathId。
- 计算:用 `effectiveFeasibility(path)` 在完成前(treeRef.current)与完成后(新树)各算一次,取**取整到 5 后的 value**;仅当 after > before 才弹(小任务没把整 5 推动 → 不弹,诚实)。
- 机制:AppContext 暴露 `feasibilityToast: { pathLabel, before, after } | null` + `dismissFeasibilityToast()`;一个全局 `<FeasibilityToast/>`(挂在 page.tsx)消费,~4s 自动消失,数字 before→after 有个轻动效(count-up / 颜色)。尊重 reduce-motion。
- 诚实:只在真涨时弹,显示真实 before→after,封顶 95。

## Part 2 — 选择面板:AI 分析选项 + 两个未来并排(③)
让"做决定"更深。
### 2a. AI 帮我分析各选项利弊 —— `/api/analyze-choice`
- 路由(DeepSeek + 离线兜底 + allowRequest 限流):POST { question, options:[{label}], profile, lang } → 每个选项返回建议 `{ pros, cons, cost, reversibility:"one-way"|"two-way", note≤20字 }`,**结合用户 profile**(起点/约束)给,克制不浮夸、可逆性按现实判。离线兜底=基于关键词/通用模板的保守填充(始终返回有效结构)。
- client `src/lib/choiceClient.ts`(若无则建)`fetchChoiceAnalysis(payload)`,网络失败本地兜底。
- ChoicePanel:每个未决 choice 一个「✨ AI 帮我分析」按钮 → 拉取 → **预览**每个选项的建议(利/弊/成本/可逆性/点评)→ 用户可「采纳」写回该选项的字段(updateChoiceOption),或忽略。不直接覆盖用户已填内容(空字段填入 / 或并列展示让用户挑)。
- 复用既有 i18n/限流/兜底范式(参照 arrange-day / plan-short-goal 路由)。

### 2b. 两个未来并排对比
- 当某 choice 有 ≥2 个选项已"推演分支"(option.pathId 已回填、树上有对应 LifePath)时,提供「并排对比」:选 2 个选项 → 一张对比卡,每列显示:选项名、该路 summary、**现实可行度(effectiveFeasibility)**、最终走向(endValue/曲线一句话)、前 3-4 个关键里程碑 node(title + 年龄 + mood)。
- 纯展示,数据来自 `tree.paths`(按 pathId)+ feasibility 域函数。不新做双树渲染——结构化对比卡更清楚。
- 入口在 ChoicePanel 的该 choice 上;移动端纵向堆叠。

## 不动
- 不改 enrich/prediction prompt、feasibility 估法、目标模型。
- predictOptionBranch / decideChoice 已存在,复用。

## 验收
- 完成挂在某路上的目标的任务 → 若可行度整 5 上涨,弹 before→after toast,自动消失,reduce-motion 下不抖。
- 选择面板:点「AI 帮我分析」→ 每选项给出结合 profile 的利弊/可逆性建议,可采纳;离线也有兜底。≥2 个选项推演过 → 能并排看两个未来(可行度/结局/里程碑)。
- tsc/test/build 全绿。

## 诚实风险
AI 分析同样有"看似客观其实是模型判断"的问题 → 建议都标为"AI 建议,你来定",采纳是用户主动动作,不自动改写。并排对比只呈现已生成的预测,不新增预言。
