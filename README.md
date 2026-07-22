# 人生树 · Life Planner

人生树是一款人生方向与决策产品：用户可以探索几种可信的未来、选择一条路、把它拆成目标和行动，并让真实进度反过来影响这条路的可行度。

预测只表达“可能的人生”，不承诺算命式准确性。产品同时包含职业决策人格测试、人生树、未来自己对话、目标/任务规划、分享卡片和云端同步。

## 仓库结构

```text
lifeplaner/
├─ src/                 Next.js 16 网页与 /api 后端
├─ mobile/              Expo SDK 56 / React Native App
├─ packages/core/src/   Web 与 App 共用的纯 TypeScript 领域层
├─ supabase/            已纳入版本控制的数据库迁移
├─ docs/                当前运维文档、PRD、历史设计与 handoff
└─ .agents/.codex/      项目技能与 Codex 配置
```

默认分支是 `master`。生产网站：<https://life-planer-opal.vercel.app>。

## 新电脑快速开始

先安装 Git、Node.js 和 npm，然后只在仓库根目录安装依赖：

```bash
git clone https://github.com/Jelly13124/life-planer.git
cd life-planer
npm ci
npm run dev
```

打开 <http://localhost:3000>。

手机端复用根 workspace，不要在 `mobile/` 单独维护 lockfile：

```bash
npm run start --workspace mobile
```

提交前运行完整检查：

```bash
npm run verify
npm run clean:next
```

`verify` 包含 Web TypeScript、全部 Vitest、ESLint、Next 生产构建和 Mobile TypeScript。原生依赖或 Expo 配置变化时再运行：

```bash
npx expo-doctor@latest mobile
```

## 环境变量

仓库不会保存任何 `.env*`。具体恢复步骤见最新 [handoff](docs/handoffs/2026-07-22-new-machine-handoff.md) 和 [Supabase 指南](docs/supabase-setup.md)。常用变量只有名称可以进入文档：

- 服务端 AI：`DEEPSEEK_API_KEY`，可选 `LIFEPLANNER_MODEL`
- Web Supabase：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Web 服务端 Supabase：`SUPABASE_SECRET_KEY`，旧环境可回退 `SUPABASE_SERVICE_ROLE_KEY`
- 分享：`DECISION_STYLE_SHARE_SECRET`、可选 `NEXT_PUBLIC_SHARE_DOMAIN`
- Mobile：`EXPO_PUBLIC_API_BASE_URL`、`EXPO_PUBLIC_SUPABASE_URL`、`EXPO_PUBLIC_SUPABASE_ANON_KEY`、可选 `EXPO_PUBLIC_SHARE_DOMAIN`
- 未启用的付费入口：`EXPO_PUBLIC_REVENUECAT_IOS_KEY`

DeepSeek 和 Supabase Secret 必须只存在于服务端环境。所有 `EXPO_PUBLIC_*` / `NEXT_PUBLIC_*` 都应视为公开值。

## 架构要点

- `packages/core/src/**` 是共享领域核心，保持纯函数和确定性；时间由调用方注入，随机使用 seeded helpers。
- Web 使用 `@/domain/*` 兼容别名指向共享核心。
- Next.js 同时承担网页和手机端需要的 AI、分享与账户删除 API。
- Web 以 localStorage 为离线底座；Supabase 登录后进行云端读取、防抖保存和首次本地迁移。
- Mobile 使用 AsyncStorage，并通过 Expo 环境变量连接同一 Vercel/Supabase 后端。
- 历史数据的 normalize/migration 代码是兼容层，不是待删除死代码。

## 当前文档

- [文档索引](docs/README.md)
- [新电脑接手 Handoff](docs/handoffs/2026-07-22-new-machine-handoff.md)
- [手机开发构建与 TestFlight](docs/dev-build.md)
- [手机端后端连接](docs/mobile-backend.md)
- [Supabase 云同步、RLS 与账户删除](docs/supabase-setup.md)
- [人生预测体验 PRD](docs/PRD-prediction-experience.md)

`docs/superpowers/`、`docs/MORNING*.md` 和 `docs/archive/` 是历史证据，不代表当前 backlog。
