# Workspaces 迁移计划 (2026-06-23)

把"一个仓两个 app + 共享 domain"从 `.shared` 软链改成 npm 原生 workspaces。**前置:`master` 已跟上(f5935a8)、用户已建远端备份。** 全程保 web 460 测试绿、可回退。

## 策略:轻量版优先(W1),完整版可选(W2)
- **W1(做这个)**:抽出 `packages/core`(= 纯 domain)为 workspace 包;**Next app 留在根目录**;靠 `@/domain/*` 别名重指到包源码,使 **web 端零 import 改动**;mobile 改成依赖 `@lifeplanner/core`,**删掉 `.shared` 软链 + link-shared + 三处 @core 别名**。churn 最小、根除软链债。
- **W2(以后可选)**:把 Next app 整体搬进 `apps/web` 求结构对称。churn 大(路径/配置/部署根),非必要不做。

## W1 阶段步骤(每步 web 绿)

### W1.1 建 workspaces 骨架
- 根 `package.json` 加 `"workspaces": ["packages/*", "mobile"]`。
- 建 `packages/core/package.json`:`{ "name": "@lifeplanner/core", "private": true, "type": "module", "exports": { ".": "./src/index.ts", "./*": "./src/*.ts" } }`(直接吐 TS 源,由各 app 的打包器编译)。
- 建 `packages/core/tsconfig.json`(strict;不依赖 app 的 `@/` 别名)。
- `npm install`(让 workspace 把 `@lifeplanner/core` 软链进根 node_modules——这是 Metro/Next 都能原生认的标准机制,取代手工 junction)。

### W1.2 搬 domain → packages/core
- `git mv src/domain/* packages/core/src/`(整体搬,domain 内部相对 import `./x` 不受影响)。
- domain 源码若有 `@/` 引用→改相对(已知:源码全相对,只有 `__tests__` 用 `@/`)。
- 测试随包搬:`packages/core/src/__tests__/`;其 `@/domain/x` → 相对 `../x` 或包内别名。
- 加 `packages/core/src/index.ts` 汇出常用模块(可选,按需)。

### W1.3 web 端零改动接住
- 根 `tsconfig.json` 把 `"@/domain/*": ["./src/domain/*"]` 改为 `["../packages/core/src/*"]`(或 `./packages/core/src/*`)——**所有 `@/domain/...` import 原样可用**。
- `next.config.ts` 若按包名 import 才需 `transpilePackages: ["@lifeplanner/core"]`;走 `@/domain` 别名指源码则 Next 当 app 源码编译,通常不需要。两种择一,验证为准。
- `vitest.config.ts`:把 domain 测试纳入(include `packages/core/**`)或在 core 包内单独跑;保证 `npx vitest run` 仍跑全 460。

### W1.4 mobile 改用 workspace 包,删软链
- `mobile/package.json` 加 `"@lifeplanner/core": "*"`。
- 代码 `@core/...` → `@lifeplanner/core`(或保留 `@core` 别名指 `@lifeplanner/core`,改一处 babel/metro/tsconfig 别名即可)。
- **删** `mobile/.shared`、`mobile/scripts/link-shared.js`、postinstall、metro/babel/tsconfig 里的 `../src` 跨目录 hack;Metro 配 workspaces(`watchFolders=[根]` + 默认 node_modules 解析就能认软链进来的包)。
- `mobile` tsc + headless bundle 验证。

### W1.5 全量验证 + 提交
- web:`npx tsc --noEmit`(根)+ `npx vitest run`(460)+ `npx next build` 全绿;`rm -rf .next`。
- mobile:`cd mobile && npx tsc --noEmit` + `npx expo export -p ios` 能 bundle。
- 确认 `.shared` 已无、仓库无残留软链。分阶段提交(W1.1–W1.5 各 commit,或一个连贯 commit)。

## 护栏 / 风险
- 每步保 web 绿;搬 domain 用 `git mv`(留历史)。
- 最大风险:别名/解析在 Next 16 Turbopack + Metro + Windows 三处的细节;逐个 verify,不行就回退该步(已有远端备份)。
- domain 源码相对 import → 整体搬安全;只需处理测试的 `@/`。
- 不动 domain 逻辑、不动 web UI、不动 API 路由——纯结构搬迁。

## 验收
`.shared` 软链彻底移除;web/mobile 都靠 `@lifeplanner/core` workspace 包共享同一份 domain;web 460 绿 + build 绿;mobile bundle 绿。
