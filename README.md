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

不需要 API 密钥也能打开应用、查看已保存内容和运行本地几何/数学逻辑；新的 AI 人生叙事和规划内容需要配置 DeepSeek key，失败时保留重试入口，已保存的内容仍可离线读取。

### 接入真实 AI（可选，让故事"活"起来）

把你的 DeepSeek API Key 放进 `.env.local`，每段人生的故事就会由真实大模型按你的真实背景生成：

```bash
cp .env.example .env.local   # 然后编辑 .env.local，填入 DEEPSEEK_API_KEY
npm run dev                  # 重启即可生效
```

- 密钥只在**服务端**使用（`src/app/api/enrich/route.ts` → `src/lib/enrich.ts`），永远不会进到浏览器，也不会被提交（`.env*` 已 gitignore）。
- 默认模型 `deepseek-chat`（DeepSeek-V3）；可用 `LIFEPLANNER_MODEL` 覆盖。
- 机制是**分层**的：本地逻辑负责树的几何、数字和进度；真实 AI 负责新的路径叙事、规划内容和对话。AI 内容生成失败时不伪造一份新文案，界面提供重试，已保存的预测仍然可读。
- 每"加一条岔路"会产生一次 AI 调用（按量计费），结果存进本地不会重复生成。
- 想换成别的服务商（如 Claude）只需改 `src/lib/enrich.ts` 里的请求——接口与回退逻辑都不用动。

## 用户流程

1. **引导**：填真实的你——昵称/年龄、学历专业、职业/薪资/副业、爱好、所在地、身份（如 H1B）、情感状态、当前纠结的岔路。
2. **人生地图**：从"现在"长出的多条曲线（Odyssey 三路：维持现状 / 替代路 / 疯狂路）。可平移缩放；**点曲线上的节点能在那里再长一条岔路**（递归决策树）。
3. **点开一条路**：时间线关键节点（每个带维度标签）+ 故事 + 指标曲线；顶部切**乐观/最可能/保守**三种走向。
4. **和未来的你对话**：点「✨ 和 X 岁的你聊聊」，跟走了这条路的未来自己第一人称聊天；聊出新选择可一键加进树。
5. **规划助手**：右下角常驻浮窗，帮你理清纠结、提出没想到的路，也能一键加进树。
6. 数据自动保存，刷新仍在；「↺ 重置」清空重来。没有密钥时仍可访问本地数据和确定性功能，但新的 AI 内容需要重试或配置服务端 key。

## 架构

UI 只依赖两个接口，使"现在能跑"和"日后认真上线"解耦：

| 接口 | v1 实现 | 未来实现 |
|---|---|---|
| `PathGenerator`（生成一条人生路径） | `LocalPathGenerator`（确定性几何/结构） | DeepSeek enrichment（真实大模型，入口在 `src/lib/enrich.ts`） |
| `TreeRepository`（持久化） | `LocalStorageRepository` | `SupabaseRepository`（账号+云端） |

```
src/
  domain/            # Web 兼容别名，实际指向 packages/core/src
    types.ts         # 领域模型
    seed.ts          # 确定性伪随机（无 Math.random/Date.now）
    archetypes.ts    # 选择原型：关键词、曲线、领域影响、节点模板
    suggestions.ts   # "AI 建议"岔路（静态规则）
    tree.ts          # 建树/加路/删路（纯函数）
    generator/       # Web 侧通过 @/domain 兼容引用 core
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
