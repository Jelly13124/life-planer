# 人生规划 App MVP — 实现计划

> **For agentic workers:** 用 superpowers:executing-plans 逐任务实现。步骤用 `- [ ]` 跟踪。

**Goal:** 做出一个能本地运行的"会生长的动画人生树"网页 MVP：引导 → 看树 → 加岔路 → 点开看一条人生（时间线+故事+指标），刷新保留，全程无需密钥。

**Architecture:** 单体 Next.js (App Router) + TypeScript + Tailwind。UI 只依赖两个接口——`PathGenerator`（默认本地确定性生成）与 `TreeRepository`（默认 localStorage）——使日后可无缝替换为 Claude API 与 Supabase。领域逻辑是纯函数，单测覆盖。

**Tech Stack:** Next.js 15 / React 19 / TypeScript / Tailwind CSS v4 / Vitest / (可选) Playwright。

---

## 文件结构

```
src/
  app/
    layout.tsx              # 根布局，深色主题，字体
    page.tsx                # 应用外壳：按状态切换 Onboarding/Tree/Detail
    globals.css             # Tailwind + 主题变量 + 动画 keyframes
  domain/
    types.ts                # 领域模型（第4节）
    seed.ts                 # 确定性伪随机
    archetypes.ts           # 选择原型：权重、曲线、模板
    generator/
      types.ts              # PathGenerator 接口
      localGenerator.ts     # 本地确定性实现
    repository/
      types.ts              # TreeRepository 接口
      localStorageRepo.ts   # localStorage 实现
    tree.ts                 # 建树/加路/删路的纯函数
  state/
    AppContext.tsx          # React context + reducer，调用 repo/generator
  components/
    Onboarding.tsx          # 引导表单
    LifeTreeCanvas.tsx      # SVG 动画人生树（招牌）
    AddBranchSheet.tsx      # 添加岔路（输入或选 AI 建议）
    PathDetail.tsx          # 单条路径详情：指标+时间线
    MetricChart.tsx         # 小型指标折线
    ui/                     # Button, Field, Modal 等通用件
  domain/__tests__/         # Vitest 单测
```

---

## Task 1: 项目脚手架

**Files:** 整个项目（create-next-app 生成），随后改 `package.json`、`globals.css`、`app/page.tsx`。

- [ ] **Step 1:** 在工作目录用非交互参数脚手架：
  `npx --yes create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm`
  （目录非空仅含 docs/.superpowers，create-next-app 允许）
- [ ] **Step 2:** 装测试依赖：`npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`
- [ ] **Step 3:** 加 `vitest.config.ts`（jsdom 环境，alias `@`），在 `package.json` 加 `"test": "vitest run"`。
- [ ] **Step 4:** 验证启动：`npm run dev` 起得来（后台），访问 `/` 返回 200；`npm run build` 通过。
- [ ] **Step 5:** `git init` + `.gitignore`（含 `.superpowers/`、`node_modules`、`.next`），首次提交。

---

## Task 2: 领域类型与确定性随机

**Files:** Create `src/domain/types.ts`, `src/domain/seed.ts`, `src/domain/__tests__/seed.test.ts`

- [ ] **Step 1:** 写 `types.ts`——按规格第4节定义 `LifeArea, Profile, MetricPoint, PathNode, LifePath, LifeTree`。常量 `LIFE_AREAS: LifeArea[]`。

- [ ] **Step 2:** 写 `seed.test.ts`（失败测试）:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng, hashSeed } from '@/domain/seed';
describe('seed', () => {
  it('same seed -> same sequence', () => {
    const a = makeRng('x'); const b = makeRng('x');
    expect([a(),a(),a()]).toEqual([b(),b(),b()]);
  });
  it('values in [0,1)', () => {
    const r = makeRng('y');
    for (let i=0;i<100;i++){ const v=r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('different seeds differ', () => {
    expect(makeRng('a')()).not.toEqual(makeRng('b')());
  });
});
```
- [ ] **Step 3:** 跑 `npm test` 确认失败。
- [ ] **Step 4:** 实现 `seed.ts`：`hashSeed(str)` (xfnv1a) + `makeRng(seed)` (mulberry32)，纯函数，**不使用 Math.random / Date.now**。
- [ ] **Step 5:** 跑 `npm test` 确认通过。提交。

---

## Task 3: 选择原型库 (archetypes)

**Files:** Create `src/domain/archetypes.ts`, `src/domain/__tests__/archetypes.test.ts`

定义若干原型，每个含：`keywords:string[]`、`curve`、`areaBias: Record<LifeArea, number>`（-1..1，对各领域长期影响）、`volatility:number`、`nodeTemplates`（按 mood 分组的标题/故事模板，模板含 `{name}`、`{age}` 占位）、`summaryTemplates:string[]`。

原型清单（至少）：`startup`（创业）、`jobhop`（跳槽）、`study`（深造/读研）、`relocate`（搬迁/出国）、`family`（恋爱/成家）、`slowdown`（慢生活/gap）、`statusQuo`（维持现状）、`bold`（兜底·大胆选择）。

`classifyChoice(label: string): Archetype` —— 关键词命中返回对应原型，未命中返回 `bold`；空串返回 `bold`。

- [ ] **Step 1:** 写失败测试：
```ts
import { describe,it,expect } from 'vitest';
import { classifyChoice } from '@/domain/archetypes';
it('classifies by keyword', () => {
  expect(classifyChoice('我想辞职创业').key).toBe('startup');
  expect(classifyChoice('换个公司跳槽').key).toBe('jobhop');
  expect(classifyChoice('去读研深造').key).toBe('study');
});
it('falls back to bold', () => {
  expect(classifyChoice('asdfqwer').key).toBe('bold');
  expect(classifyChoice('').key).toBe('bold');
});
```
- [ ] **Step 2:** 跑测试确认失败。
- [ ] **Step 3:** 实现 `archetypes.ts`（每原型 ≥3 套节点模板、≥3 条 summary，避免重复感）。
- [ ] **Step 4:** 跑测试通过。提交。

---

## Task 4: 生成器接口 + 本地实现

**Files:** Create `src/domain/generator/types.ts`, `src/domain/generator/localGenerator.ts`, `src/domain/__tests__/localGenerator.test.ts`

`PathGenerator` 接口：
```ts
export interface GenerateInput { profile: Profile; choiceLabel: string; kind: 'status-quo'|'choice'; horizonYears: number; index: number; }
export interface PathGenerator { generate(input: GenerateInput): LifePath; }
```

`LocalPathGenerator implements PathGenerator`：
1. `classifyChoice` 得原型（status-quo 强制用 statusQuo 原型）。
2. `seed = hashSeed(profile.name + choiceLabel + index)`，`rng = makeRng(seed)`。
3. 各领域：起点 `profile.areas[area]`，按 `areaBias*强度 + volatility*rng 扰动`，在 `[age, age+horizon]` 上取年度点，clamp 0-100。
4. 取 3-5 个节点年龄，按该年综合指数定 mood，从模板填充（注入 name）。
5. endValue = 终点综合指数；summary 选模板；color 按原型。

- [ ] **Step 1:** 写失败测试（确定性 + 边界 + 结构）：
```ts
import { describe,it,expect } from 'vitest';
import { LocalPathGenerator } from '@/domain/generator/localGenerator';
import { LIFE_AREAS } from '@/domain/types';
const profile = { name:'阿明', age:28, snapshot:'普通程序员', crossroad:'要不要创业',
  areas:{career:55,wealth:40,relationships:60,health:65,growth:50} };
const gen = new LocalPathGenerator();
const inp = { profile, choiceLabel:'辞职创业', kind:'choice', horizonYears:15, index:1 } as const;
it('deterministic', () => {
  expect(JSON.stringify(gen.generate(inp))).toEqual(JSON.stringify(gen.generate(inp)));
});
it('metrics within 0-100 and nodes ordered', () => {
  const p = gen.generate(inp);
  for (const a of LIFE_AREAS) for (const pt of p.metrics[a]) { expect(pt.value).toBeGreaterThanOrEqual(0); expect(pt.value).toBeLessThanOrEqual(100); }
  const ages = p.nodes.map(n=>n.age);
  expect(ages).toEqual([...ages].sort((x,y)=>x-y));
  expect(p.nodes.length).toBeGreaterThanOrEqual(3);
});
it('injects user name into stories', () => {
  const p = gen.generate(inp);
  expect(p.nodes.some(n=>n.story.includes('阿明'))).toBe(true);
});
```
- [ ] **Step 2:** 跑确认失败。
- [ ] **Step 3:** 实现 `localGenerator.ts`。
- [ ] **Step 4:** 跑通过。提交。

> 占位说明（不实现）：在 `generator/` 留 `claudeGenerator.ts.txt` 注释草稿，写明日后真实实现的 prompt 结构与同接口签名。

---

## Task 5: 树操作纯函数 + Repository

**Files:** Create `src/domain/tree.ts`, `src/domain/repository/types.ts`, `src/domain/repository/localStorageRepo.ts`, `src/domain/__tests__/tree.test.ts`

`tree.ts`：
- `createTree(profile, gen, horizon=15): LifeTree` —— 含 1 条 status-quo + 1 条由 `profile.crossroad` 生成的 choice。
- `addPath(tree, choiceLabel, gen): LifeTree` —— append 一条 choice（index 递增），更新 updatedAt（updatedAt 由调用方传入或用占位常量，**不在纯函数内用 Date.now**；改为 `tree.ts` 接收 `now:string` 参数）。
- `removePath(tree, pathId): LifeTree`（不可删 status-quo）。

`TreeRepository` 接口：`load(): LifeTree|null`、`save(t): void`、`clear(): void`。
`LocalStorageRepository`：键 `lifeplanner.tree.v1`，JSON 序列化，解析失败返回 null。

- [ ] **Step 1:** 写失败测试：createTree 含 status-quo+1；addPath 增加一条且不动原有；removePath 删对的且拒删 status-quo；repo 往返（用注入的内存 Storage mock）。
- [ ] **Step 2:** 跑确认失败。
- [ ] **Step 3:** 实现三文件。
- [ ] **Step 4:** 跑通过。提交。

---

## Task 6: 应用状态 (AppContext)

**Files:** Create `src/state/AppContext.tsx`

- reducer 状态：`{ view:'onboarding'|'tree'|'detail', tree:LifeTree|null, activePathId:string|null }`。
- actions：`completeOnboarding(profile)`、`addBranch(label)`、`openPath(id)`、`backToTree()`、`reset()`。
- 挂载时从 repo `load()`：有树 → view='tree'，无 → 'onboarding'。
- 每次变更后 `repo.save()`。`now` 用 `new Date().toISOString()`**在此层**取（副作用层，非纯函数）。
- 通过 props 注入 `generator` 与 `repository`，默认 `LocalPathGenerator` / `LocalStorageRepository`，便于测试与替换。

- [ ] **Step 1:** 实现 context + provider + `useApp()` hook。
- [ ] **Step 2:** 冒烟测试：用内存 repo + 假 profile，`completeOnboarding` 后 view='tree' 且 tree 有 2 条路；`addBranch` 后 3 条。
- [ ] **Step 3:** 跑通过。提交。

---

## Task 7: 全局样式与主题

**Files:** Modify `src/app/globals.css`, `src/app/layout.tsx`

- [ ] **Step 1:** globals.css：Tailwind 引入 + CSS 变量（深色径向渐变背景、强调色、路径色板 rose/violet/sky/emerald/slate）+ keyframes（`lpDraw` 画线、`lpFade`、`lpPop`、`lpPulse`），复用头脑风暴原型里的动画。
- [ ] **Step 2:** layout.tsx：中文友好字体栈、`lang="zh"`、body 深色背景、`metadata` 标题"人生规划 · Life Planner"。
- [ ] **Step 3:** 手动核验：dev 下背景与字体生效。提交。

---

## Task 8: Onboarding 组件

**Files:** Create `src/components/Onboarding.tsx`, `src/components/ui/*`

- 2 步：①姓名/年龄/现状自述 ②五个领域滑块(0-100)+当前岔路文本。
- "生成我的人生树"按钮 → `completeOnboarding(profile)`。
- 校验：姓名非空、年龄 10-100、岔路非空（空给占位提示）。

- [ ] **Step 1:** 实现通用件 `ui/Button.tsx`、`ui/Field.tsx`、`ui/Slider.tsx`。
- [ ] **Step 2:** 实现 Onboarding，深色精致风格，分步。
- [ ] **Step 3:** 手动核验：填写 → 进入 tree 视图。提交。

---

## Task 9: LifeTreeCanvas（招牌动画）

**Files:** Create `src/components/LifeTreeCanvas.tsx`

- 输入 `paths: LifePath[]`，输出 SVG：共享主干 + 每条 path 一条贝塞尔曲线，终点发光圆点 + 标签（choiceLabel + summary）。
- 曲线 y 由 `endValue` 映射；形状由 `curve` 决定控制点。status-quo 用灰色虚线。
- 入场用 `lpDraw`（stroke-dashoffset）逐条 stagger；起点 `现在·{name}` 脉冲。
- 点击曲线/终点 → `openPath(id)`；右上"➕ 添加岔路"按钮触发 AddBranchSheet；底部"重置"。
- 复用规格已验证的 SVG 写法（见头脑风暴 `life-paths-hero.html`）。

- [ ] **Step 1:** 实现曲线路径生成 helper（endValue+curve → SVG path d），放 `src/components/treePath.ts`，并写单测（给定输入产出含 `M`/`C` 的字符串、y 落在画布内）。
- [ ] **Step 2:** 实现 LifeTreeCanvas。
- [ ] **Step 3:** 手动核验：树渲染、动画、点击进详情。提交。

---

## Task 10: AddBranchSheet（加岔路）

**Files:** Create `src/components/AddBranchSheet.tsx`

- 弹层：文本框输入一个选择 + 3-4 个 AI 建议 chip（来自一个静态建议表，按 profile.crossroad 关键词挑；点 chip 填入文本）。
- 确认 → `addBranch(label)` → 关闭，新曲线动画长出。

- [ ] **Step 1:** 实现建议表 `src/domain/suggestions.ts`（纯数据 + `suggestFor(profile):string[]`）+ 单测。
- [ ] **Step 2:** 实现 Sheet。
- [ ] **Step 3:** 手动核验：加一条 → 树多一条曲线。提交。

---

## Task 11: PathDetail + MetricChart

**Files:** Create `src/components/PathDetail.tsx`, `src/components/MetricChart.tsx`

- 顶部：choiceLabel + summary + endValue 徽章；五条/可切换的指标 mini 折线（MetricChart：输入 MetricPoint[]，画 SVG polyline + 渐变填充）。
- 主体：竖向时间线，每节点：年龄、标题、mood 色点、story 段落，入场 `lpPop` stagger。
- 顶部"← 返回"→ `backToTree()`。

- [ ] **Step 1:** 实现 MetricChart + 单测（points → polyline points 字符串，归一化到视图框）。
- [ ] **Step 2:** 实现 PathDetail。
- [ ] **Step 3:** 手动核验：点曲线 → 看到时间线+故事+指标 → 返回。提交。

---

## Task 12: 组装外壳 page.tsx

**Files:** Modify `src/app/page.tsx`

- [ ] **Step 1:** `'use client'`，包 `<AppProvider>`，按 `view` 渲染 Onboarding/Tree+Canvas/PathDetail。
- [ ] **Step 2:** 手动核验全链路：引导→树→加岔路→详情→返回→刷新仍在→重置回引导。
- [ ] **Step 3:** 提交。

---

## Task 13: 验收、截图、文档

**Files:** Create `README.md`, `MORNING-REVIEW.md`

- [ ] **Step 1:** `npm test` 全绿；`npm run build` 通过。
- [ ] **Step 2:** dev 起服务，用 Playwright 截四张图：引导、树、加岔路、详情；逐张检查并修问题。
- [ ] **Step 3:** 写 README（如何运行/测试/架构/接口替换点）与 MORNING-REVIEW（完成项、已知缺口、下一步：Claude API + Supabase + 过去半棵树）。
- [ ] **Step 4:** 最终提交。

---

## Self-Review

**Spec 覆盖：** 引导(T8)、动画树(T9)、加岔路 hybrid(T10)、点开路径=时间线+故事+指标(T11)、本地保存(T5/T6)、生成接口隔离(T4)、持久化接口隔离(T5)、确定性无密钥(T2/T4)、测试(T2-6,9,11)、文档与验收(T13)——均有对应任务。✓

**占位扫描：** 计划内 `claudeGenerator.ts.txt` 是**有意的未来占位草稿**，非交付物；其余无 TBD。✓

**类型一致：** `PathGenerator.generate(GenerateInput)`、`TreeRepository.load/save/clear`、`createTree/addPath/removePath` 在 T4/T5/T6/T9/T11 间签名一致；`tree.ts` 纯函数接收 `now:string`，副作用层(T6)注入时间——确定性约束一致。✓
