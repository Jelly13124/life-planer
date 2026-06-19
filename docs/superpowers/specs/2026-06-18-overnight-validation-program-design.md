# 过夜验证程序（12h）— 上线就绪硬化 + 预测质量 + 新功能 + Supabase 骨架

日期：2026-06-18
状态：方向与优先级已确认（brainstorming），/goal 过夜自动执行（writing-plans → subagent-driven，逐阶段 just-in-time 出计划）
分支：`feat/goal-planning-mainline`（在 goal + v2 之上继续；硬化顺便坐实 v2）

## 一句话

把这一夜做成一个**按优先级排序、严格顺序、每阶段独立验证+提交**的过夜 backlog：最有价值、最安全（不依赖密钥/账号、能自验证）的先做，做完一个提交一个，12h 耗尽即停在最近的绿色提交。诚实预期：大概率完成 Phase 0–1 + Phase 2 的一两个功能 + Phase 3 骨架，未必四个新功能都满深度。

## 执行纪律（所有阶段通用）

- 每个阶段（及阶段内每个子功能）= 独立的 spec 片段 → writing-plans 细化 → subagent-driven（implementer + 两段评审：spec 合规 → 代码质量）→ 每任务一次提交。
- 全程铁律：领域层不用 `Date.now`/`Math.random`（时间注入）；渲染期不调用 `new Date()`（模块级 boot 值 + effect 刷新）；中文串里绝不出现 ASCII 直引号；新中文文案必须在 `src/i18n/messages.ts` 补英文；AI 路由必须有无-key 本地兜底 + 限流。
- 每阶段收尾必须 `npx tsc --noEmit` + `npx vitest run` + `npx next build` 全绿才算完成。
- 优先级保证：阶段严格按 0→1→2→3；Phase 2 内按 2a→2b→2c→2d。时间不够就停，绝不半成品跨阶段。
- 不合并到 main（等用户真机验收）。不碰 `.env*`。

## Phase 0 · 硬化地基（最高优先）

目标：把现有 goal + v2 坐实到"可给小圈子用"的健壮度。

- **v2 评审快随项**：①「你在这里」标记只随里程碑移动——加一句图例/说明，避免被误读为坏了；②`breakIntoActions` 重拆行动是整段覆盖（会丢已设 🔁/勾选）——加二次确认或合并而非覆盖。
- **内容安全护栏（上线阻断项 / 脆弱用户红线）**：对带自伤/危机信号的用户输入（昵称/现状/岔路/补充/对话），用保守的本地关键词判定，温和、非临床地给出关怀语 + 可配置的求助资源（默认中国大陆/通用），并**暂缓"预测/推演"**，引导寻求帮助。纯本地、确定性、可单测；绝不做诊断或治疗建议。放在 enrich/chat/assistant/regenerate 入口处统一拦截（领域纯函数 `safety.ts` 判定 + UI 关怀面 + 路由侧二次保险）。
- **错误/空/加载态全覆盖**：所有屏（onboarding/dashboard/tree/detail/plan）+ 六条 AI 路由失败/429 的双语降级提示；空态引导文案统一。
- **无障碍**：焦点可见、aria 标签、键盘可达、`prefers-reduced-motion`（已部分有）补齐。
- **i18n 完整性审计**：扫出所有 `t("中文")` 未在 EN 字典命中的串并补齐；建一个小测试/脚本防回归。
- **测试扩展**：domain 纯函数与各 client sanitizer 的边界用例补齐。
- **性能体检**：明显的重渲染/动画卡顿排查（map/dashboard）。
- 验收：tsc/lint/vitest/next build 全绿；新增安全/ i18n/ sanitizer 测试；`docs/QA-checklist.md` 落一份人工冒烟清单。

## Phase 1 · 预测质量大改（核心钩子）

目标：让 AI 人生推演更扎实、更少套话，并能自评。

- 改 `src/lib/enrich.ts` 提示词：强化现实锚点、去除爽文/套话、强制多维度与财务/身份出现（在已有约束上加严与给更多反例）。
- 扩充本地生成器的原型/指标真实度（`src/domain/generator/*`），让无-key 兜底也不假。
- **评审闭环**：用现有 `prediction-quality-reviewer` 子代理，建一个**离线评测 harness**（对一组样本 Profile 跑生成→按 PRD rubric 打分→标记不合格点），跑在本地兜底文本上即可验证，不烧 key。
- 验收：评测 harness + 样本过 rubric（真实锚点/密度/多维/不矛盾/不套话）；既有测试无回归；所有本地兜底路径完好。

## Phase 2 · 新功能（子优先级：传播 > 闭环 > 深度 > 便捷）

每个子功能独立 spec→plan→执行→提交；做完一个再下一个。

- **2a 可分享只读人生树**：把当前树渲染成可导出的快照（PNG/分享图，客户端 canvas/SVG 导出，无后端），含克制的水印与"可能的人生，非预测命运"的红线声明。验收：能从 dashboard/tree 一键导出图片；双语；不泄露隐私字段。
- **2b 每周复盘仪式**：聚合 决策复盘 + 目标复盘(`dueGoalReviews`) + 本周完成(heatmap/streak) 成一个"本周回顾"页；到点轻提醒。复用既有 review/goals/daily。验收：回顾页正确聚合本周数据；双语；纯函数带测试。
- **2c 对话式调路**：在某条路的 FutureSelfChat / 规划助手里，支持多轮对话后"据此重推这条路"（复用 `regeneratePath` + chat 上下文）。验收：多轮对话能把累积的补充喂给重推；停在该路详情；不破坏现有一次性"补充重推"。
- **2d 规划助手全能化**：助手能在对话里识别意图并触发 建目标/拆行动/挑今日（复用 AppContext 既有方法 + 确认优先）。验收：对话里能确认后建一个长期目标/拆行动/把行动挑进今天；不误触。

## Phase 3 · Supabase 骨架（账号阻断、最后、可选）

目标：把云端存档做到"只差填密钥"。

- 在现有 `TreeRepository` 接缝后实现 `SupabaseRepository`（CRUD 映射 LifeTree）+ 登录/注册 UI 脚手架 + 本地→云一次性迁移路径，**全部藏在 feature flag 后**（默认关，走 localStorage）。
- 用 mock supabase client 做单测；类型/构建验证。**绝不连真库**（需用户密钥）。
- 验收：flag 关时行为与现在完全一致；flag 开 + mock 下 CRUD/迁移单测通过；`docs/supabase-setup.md` 写清"填哪些密钥、开哪个 flag"。

## 优雅降级 / 收尾

- 每阶段（及子功能）独立提交，可单独回滚。
- 12h 预算耗尽：停在最近一个绿色提交，写一份 `docs/MORNING-REVIEW-2026-06-18.md`：完成了哪些阶段、每阶段验收结果、未做的、已知问题/快随项、给用户的真机冒烟清单与合并建议。
