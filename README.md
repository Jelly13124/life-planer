# 人生规划 · Life Planner (MVP)

把"如果我做了不同选择，人生会怎样"变成一棵**会生长的动画人生树**。
一条灰色虚线代表"维持现状"，每条彩色曲线代表一个不同选择推演出的人生，点开能看到那段人生的时间线、AI 生成的故事和各方面指标变化。

灵感来自 2025 年的游戏《多重人生》(The Alters)。定位是"好玩的人生探索"，**不是**一个声称能准确预测真实人生的工具——所有产出都呈现为"一种可能的人生"。

## 快速开始

```bash
npm install      # 首次
npm run dev      # 启动开发服务器 → http://localhost:3000
npm test         # 运行单元测试（35 个）
npm run build    # 生产构建（含类型检查 + lint）
```

**无需任何 API 密钥或账号即可完整体验**——v1 的"AI 生成"用的是本地确定性引擎，数据存在浏览器 localStorage。

## 用户流程

1. **引导**：填昵称、年龄、几个人生领域的现状、当前面临的一个岔路。
2. **人生树**：看到从"现在"长出的多条曲线；点「＋ 添加岔路」加新选择（可选 AI 建议）。
3. **点开一条路**：看时间线关键节点 + 每节点的故事 + 五个领域的指标曲线。
4. 数据自动保存，刷新仍在；「↺ 重置」清空重来。

## 架构

UI 只依赖两个接口，使"现在能跑"和"日后认真上线"解耦：

| 接口 | v1 实现 | 未来实现 |
|---|---|---|
| `PathGenerator`（生成一条人生路径） | `LocalPathGenerator`（确定性、模板+规则、无密钥） | `ClaudePathGenerator`（真实大模型，草稿见 `src/domain/generator/claudeGenerator.ts.txt`） |
| `TreeRepository`（持久化） | `LocalStorageRepository` | `SupabaseRepository`（账号+云端） |

```
src/
  domain/            # 纯 TS 领域核心（有单测）
    types.ts         # 领域模型
    seed.ts          # 确定性伪随机（无 Math.random/Date.now）
    archetypes.ts    # 选择原型：关键词、曲线、领域影响、节点模板
    suggestions.ts   # "AI 建议"岔路（静态规则）
    tree.ts          # 建树/加路/删路（纯函数）
    generator/       # PathGenerator 接口 + 本地实现
    repository/      # TreeRepository 接口 + localStorage 实现
  components/        # React 组件
    LifeTreeCanvas / treePath  # 招牌动画 SVG + 曲线几何（有单测）
    Onboarding / AddBranchSheet / PathDetail / MetricChart
  state/AppContext   # 应用状态 + 副作用（时间/持久化）
  app/               # Next.js 外壳与主题
docs/superpowers/    # 设计规格 (specs) 与实现计划 (plans)
```

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Vitest。

## 设计与计划文档

- 规格：[docs/superpowers/specs/2026-06-15-life-planner-design.md](docs/superpowers/specs/2026-06-15-life-planner-design.md)
- 计划：[docs/superpowers/plans/2026-06-15-life-planner-mvp.md](docs/superpowers/plans/2026-06-15-life-planner-mvp.md)
- 现状与下一步：[MORNING-REVIEW.md](MORNING-REVIEW.md)
