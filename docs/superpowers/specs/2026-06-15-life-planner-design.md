# 人生规划 App — 设计规格（MVP）

> 状态：已通过头脑风暴定稿，进入实现。
> 日期：2026-06-15
> 一句话：一个把"如果我做了不同选择，人生会怎样"变成一棵**会生长的动画人生树**的网页应用。

## 1. 产品定位

**核心隐喻**：一条直线代表"维持现状"，几条曲线代表"做了不同人生选择后的道路"。每条曲线从"现在"出发，长向一个由 AI 推演的人生结局。

**气质**：好玩的探索壳 + 接入真实的你。灵感来自 2025 年游戏《多重人生》(The Alters)——在人生关键节点选择不同，分裂出不同的自己。

**关键定位红线**：这不是一个声称"准确预测你真实人生"的工具（那会沦为算命）。它是一个**情感上真实、好玩、可分享**的"人生可能性探索器"。所有 AI 产出在文案上都呈现为"一种可能的人生"，而非"预言"。

**目标**：认真做成可上线产品（账号、云端保存、未来可能收费），但**用能先跑起来的最小切片落地**。

## 2. MVP 范围（v1）

完整愿景是"双向树"（过去 + 未来）。**v1 只做"向前看"那半棵树**：

包含：
1. **新手引导（"真实的你"）**——采集姓名、年龄、几个人生领域的现状、当前面临的岔路。
2. **动画人生树**——从"现在"出发的直线（维持现状）+ 2~3 条曲线（不同选择），SVG 生长动画。
3. **添加岔路**——用户自定义一个选择，或从 AI 建议里挑。每条岔路被"推演"。
4. **点开一条路**——时间线关键节点 + 每节点一小段 AI 故事 + 几条指标曲线（事业/财富/幸福/健康）。
5. **本地保存**——刷新后还在；可重置。

明确**不在 v1**（写进"下一步"）：过去那半棵树、账号系统、云端同步、付费、社交分享、真实大模型在线生成。

## 3. 架构总览

单体 Next.js 应用（App Router + TypeScript + Tailwind CSS）。全部逻辑跑在前端 + 少量 Route Handler 占位，便于日后替换为真实后端。

```
┌─────────────────────────────────────────────┐
│                  UI 层 (React)                │
│  Onboarding · LifeTree · PathDetail · 通用组件 │
└───────────────┬─────────────────────────────┘
                │ 调用
┌───────────────▼─────────────────────────────┐
│               领域 / 服务层                    │
│  ┌──────────────┐  ┌────────────────────┐    │
│  │ Generator     │  │ Repository          │   │
│  │ (AI 生成接口)  │  │ (持久化接口)         │   │
│  │  ├ Local 实现 │  │  └ LocalStorage 实现 │   │
│  │  └ Claude 实现│  │     (未来: Supabase) │   │
│  │    (未来)     │  └────────────────────┘    │
│  └──────────────┘                             │
└───────────────┬─────────────────────────────┘
                │ 操作
┌───────────────▼─────────────────────────────┐
│              领域模型 (纯 TS 类型)              │
│   Profile · LifeTree · Branch · PathNode      │
└─────────────────────────────────────────────┘
```

**两个关键接口（隔离点）**，让"能先跑"和"日后认真"兼得：

- `PathGenerator`：输入用户画像 + 一个选择，输出一条完整人生路径（节点、故事、指标）。
  - `LocalPathGenerator`（v1 默认）：确定性 + 模板 + 规则的本地生成，无需任何密钥即可运行。
  - `ClaudePathGenerator`（占位，下一步）：调用 Claude API 的真实实现，接口完全一致，可无缝替换。
- `TreeRepository`：保存/读取用户的树。
  - `LocalStorageRepository`（v1 默认）。
  - 未来：`SupabaseRepository`，接口不变。

UI 永远只依赖接口，不依赖具体实现。

## 4. 领域模型

```ts
type LifeArea = 'career' | 'wealth' | 'relationships' | 'health' | 'growth';

interface Profile {
  name: string;
  age: number;            // 当前年龄
  snapshot: string;       // 现状自述（自由文本）
  areas: Record<LifeArea, number>; // 各领域当前状态 0-100（用户自评）
  crossroad: string;      // 当前面临的岔路/纠结（自由文本）
}

interface MetricPoint { age: number; value: number; } // 0-100

interface PathNode {
  age: number;            // 该事件发生的年龄
  title: string;          // 关键节点标题，如 "升任团队负责人"
  story: string;          // AI 生成的一小段叙事
  mood: 'high' | 'mid' | 'low';
}

interface LifePath {
  id: string;
  choiceLabel: string;    // 这条路代表的选择，如 "辞职创业"
  kind: 'status-quo' | 'choice';
  summary: string;        // 一句话结局，如 "自己当老板，高风险高回报"
  color: string;          // 曲线颜色
  curve: 'rise-steep' | 'rise-gentle' | 'dip-rise' | 'decline' | 'flat';
  endValue: number;       // 终点"人生指数" 0-100，决定曲线高度
  nodes: PathNode[];      // 3-5 个关键节点
  metrics: Record<LifeArea, MetricPoint[]>; // 各领域随年龄变化
}

interface LifeTree {
  id: string;
  profile: Profile;
  horizonYears: number;   // 推演跨度，默认 15 年
  paths: LifePath[];      // 含 1 条 status-quo + N 条 choice
  createdAt: string;
  updatedAt: string;
}
```

**"人生指数"与纵轴**：曲线高度 = 综合人生指数（各领域加权平均，0-100）。这是一个刻意模糊的"主观人生高度"，文案明确说明它代表"综合状态感受"而非任何客观真理——守住定位红线。

## 5. 生成逻辑（LocalPathGenerator）

目标：在没有大模型的情况下，也能产出**读起来有代入感、且与用户输入相关**的路径，不是纯随机噪声。

输入：`Profile` + `choiceLabel`（或 status-quo）。
步骤：
1. **归类选择**：用关键词把 `choiceLabel` 匹配到一个原型（创业/跳槽/深造/搬迁/恋爱成家/慢下来/维持现状……）。匹配不到则归为"通用大胆选择"。
2. **取曲线形状与权重**：每个原型预设一套领域影响权重（如"创业"：career+wealth 高方差、health 下降、growth 上升）和曲线形状。
3. **结合用户现状**：以 `profile.areas` 为起点，按权重 + 轻度确定性扰动（以 tree id + path 序号为种子，**不使用 Math.random**，保证刷新稳定）推演各领域指标随年龄的轨迹。
4. **生成节点**：在跨度内取 3-5 个年龄点，用模板库（按原型 + 心情 + 领域）填充标题与故事，插入用户的 name/snapshot 片段增强代入感。
5. **汇总**：算 endValue、summary、color。

模板要有足够变体，避免明显重复。生成是**确定性**的（同输入同输出），便于保存与复现，也便于日后 A/B 对比真实大模型版本。

> 接口签名与 `ClaudePathGenerator` 完全一致：`generate(profile, choice, seed): LifePath`（本地版用 seed，Claude 版忽略 seed 用真实采样）。

## 6. UI / 页面

单页应用式体验，三个主要视图（用客户端状态切换，非多路由也可）：

1. **Onboarding**：分 2-3 步的轻量表单，深色精致风格。结束 → 生成初始树（status-quo + 基于 crossroad 的 1 条路）。
2. **LifeTree（主屏）**：复用头脑风暴已验证的 SVG 生长动画。顶部标题，画布中央是树，右侧/底部是路径图例。操作：➕ 添加岔路（输入或选 AI 建议）、点击曲线进入详情、重置。
3. **PathDetail**：左/上为该路径的指标曲线 + 一句话结局；主体为竖向时间线（年龄节点 + 标题 + 故事 + 心情色）。返回按钮回到树。

**视觉基调**：深色径向渐变背景、发光曲线、克制的动效——延续头脑风暴里用户已点头的那版美学。响应式，桌面优先但手机可用。

## 7. 错误处理与边界

- 生成器对空/异常输入有兜底（缺领域值按 50 计；choiceLabel 空给默认）。
- 持久化读到损坏数据时回退到"重新引导"，不崩溃。
- 无密钥/无网络也能完整使用（本地生成）——这是 v1 的硬要求。
- localStorage 不可用时降级为内存态并提示。

## 8. 测试策略

- 领域核心是纯函数，**单元测试**覆盖：原型归类、确定性（同输入同输出）、指标在 0-100 范围内、节点数与年龄单调递增。
- Repository 的存取往返测试（用内存 mock）。
- 一个冒烟测试 / 手动 Playwright 截图验证三个视图能正常渲染与切换。

## 9. 技术选型

- **Next.js (App Router) + TypeScript**：主流、易维护、未来加 API/SSR 顺畅。
- **Tailwind CSS**：快速实现精致深色 UI。
- **状态**：轻量（React context + reducer 或 Zustand），v1 不引入重型状态库。
- **动画**：SVG + CSS（已验证）为主；如需可加 Framer Motion 做视图过渡。
- **测试**：Vitest（纯函数）+ 可选 Playwright（视图冒烟）。
- **持久化**：localStorage（接口隔离，未来换 Supabase）。
- **AI**：v1 本地确定性生成；接口预留 Claude API 实现。

## 10. 目录结构（预期）

```
src/
  app/                    # Next.js 路由与页面外壳
  components/             # UI 组件 (LifeTreeCanvas, PathDetail, Onboarding, ...)
  domain/
    types.ts              # 领域模型
    archetypes.ts         # 选择原型 + 权重 + 模板
    generator/
      types.ts            # PathGenerator 接口
      localGenerator.ts   # 本地确定性实现
    repository/
      types.ts            # TreeRepository 接口
      localStorageRepo.ts
    seed.ts               # 确定性伪随机（基于种子）
  state/                  # 应用状态
  styles/
docs/superpowers/
  specs/                  # 本规格
  plans/                  # 实现计划
```

## 11. 下一步（v1 之后，写给未来）

1. 接 Claude API 的 `ClaudePathGenerator`（含结果缓存、免费次数限制以控成本）。
2. 账号 + `SupabaseRepository` 云端保存。
3. "向后看"半棵树（过去的岔路）→ 完成双向树。
4. 社交分享（导出/分享自己的人生树图片或链接）。
5. 更多指标、更细的领域、可调推演跨度。
6. 打包成手机 App。

## 12. 成功标准（明早验收）

- `npm run dev` 能一键启动，浏览器打开看到精致的深色界面。
- 完成引导 → 看到会生长动画的人生树 → 能加一条岔路 → 点开看到时间线+故事+指标 → 刷新后还在。
- 全程**无需任何 API 密钥或外部账号**。
- 代码有清晰的接口隔离，AI 与持久化都可日后替换。
- 有 README / MORNING-REVIEW 说明现状、如何运行、已知缺口与下一步。
