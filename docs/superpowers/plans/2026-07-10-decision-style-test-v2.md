# 职业决策风格测试 v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用可信的连续四轴模型替换旧职场人格测试，在 Web 提供 28 题完整版，在 App 提供可跳过的 12 题快测，并完成最小化签名分享、朋友对比和匿名聚合漏斗。

**Architecture:** 共享、无副作用的 `packages/core/src/decisionStyle/` 负责题库、计分、标签、结果合并和公开载荷校验；Web 负责完整测试、服务端 HMAC、公开卡片/OG/PNG、对比和统计入口；App 复用同一核心，原始答案仅存设备本地，Profile 只保存可同步摘要。旧 `lifePathCode` 数据模型、路由和风险映射直接删除，不做迁移或兼容。

**Tech Stack:** TypeScript 5/6、React 19、Next.js 16.2 App Router、Vitest 4 + Testing Library、Expo SDK 56 / React Native 0.85、AsyncStorage、Supabase Postgres、Web Crypto/Node `crypto`、Playwright。

## Global Constraints

- 开始实现前重新阅读已批准规格：`docs/superpowers/specs/2026-07-10-decision-style-test-v2-design.md`。
- 严格 TDD：每个行为先写失败测试、运行并确认失败原因正确，再写最小实现，再运行通过；不要先批量写实现。
- 项目工作树已有用户改动。每次编辑前运行 `git status --short`，只修改本计划列出的文件；提交时逐个路径暂存，不使用 `git add .`，不覆盖或回退无关改动。
- Next.js 16 的 `params` 是 Promise。修改路由、Route Handler、metadata 或 OG 前，先阅读：
  - `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`
- 涉及 Supabase 的任务开始前必须读取并使用 `supabase:supabase` skill；涉及 App 结构与真机检查时使用合适的 `build-ios-apps` skills。所有功能/修复实现遵循 `superpowers:test-driven-development`。
- 不得出现 `feasibility`、固定百分比、`AI 粗估`、默认 `SDLG`、`TIE_DEFAULT`、人格概率、匹配分、优劣判断或从风格映射 `riskAppetite` 的代码和文案。
- 原始答案、平分选择和本地结果依据只能进入 Web 本地存储或 App AsyncStorage；不得进入 `LifeTree`、Supabase 云同步、AI 请求、公开 token、OG/PNG URL、统计事件。
- 公开 token 只能包含 `version/source/code/scores`；`completedAt`、姓名、资料和任何稳定标识都不能进入 token。
- 测试可完全离线；公开分享才需要网络。签名密钥缺失或网络失败时必须明确降级，绝不生成未签名公开 URL。
- 可访问性不是收尾项：每个交互任务同时覆盖键盘/VoiceOver、可访问名称与状态、动态字体、减少动态效果、44pt 触控区域，并确保颜色不是唯一信息通道。

---

## File Map

**Delete after replacements are green:**

- `packages/core/src/lifePathCode/axes.ts`
- `packages/core/src/lifePathCode/statements.ts`
- `packages/core/src/lifePathCode/score.ts`
- `packages/core/src/lifePathCode/types.ts`
- `packages/core/src/lifePathCode/index.ts`
- `packages/core/src/__tests__/lifePathCode.test.ts`
- `src/app/t/[code]/page.tsx`
- `src/app/t/[code]/ResultActions.tsx`
- `src/components/LifePathTest.tsx`
- `src/components/LifePathCard.tsx`
- `src/lib/lifePathCardImage.ts`
- `src/lib/__tests__/lifePathCardImage.test.ts`

**Create:**

- `packages/core/src/decisionStyle/{axes,questions,scoring,types,shareToken,index}.ts`
- `packages/core/src/__tests__/{decisionStyle,decisionStyleShareToken}.test.ts`
- `src/lib/{decisionStyleStorage,decisionStyleToken.server,decisionStyleShareClient,decisionStyleAnalytics}.ts`
- `src/lib/__tests__/{decisionStyleStorage,decisionStyleToken.server,decisionStyleShareClient,decisionStyleAnalytics}.test.ts`
- `src/components/decision-style/{DecisionStyleTest,DecisionStyleResult,DecisionStyleAxisBars,DecisionStyleShareCard}.tsx`
- `src/components/decision-style/__tests__/{DecisionStyleTest,DecisionStyleResult}.test.tsx`
- `src/app/api/style-share-token/route.ts`
- `src/app/api/style-share-token/__tests__/route.test.ts`
- `src/app/api/style-events/route.ts`
- `src/app/api/style-events/__tests__/route.test.ts`
- `src/app/style/[code]/[token]/{page,opengraph-image}.tsx`
- `src/app/style/[code]/[token]/card.png/route.ts`
- `src/app/compare/[left]/[right]/page.tsx`
- `mobile/src/components/decision-style/{DecisionStyleQuiz,DecisionStyleResultCard}.tsx`
- `mobile/src/lib/{decisionStyleStorage,decisionStyleShare}.ts`
- `supabase/migrations/20260710000000_style_events.sql`

**Modify:**

- `packages/core/src/types.ts`, `packages/core/src/index.ts`
- `src/app/test/page.tsx`, `src/components/Onboarding.tsx`, `src/lib/enrich.ts`, `src/state/useAppApi.ts`, `src/state/AppContext.tsx`, relevant AI client/API tests
- `mobile/src/screens/OnboardingScreen.tsx`, `mobile/src/screens/MeScreen.tsx`, `mobile/src/state/store.tsx`, `mobile/src/lib/storage.ts`, `mobile/package.json`
- `src/app/privacy/page.tsx`, `.env.example` or the repository’s checked-in environment template, `docs/supabase-setup.md`

---

## Task 1: Build the shared four-axis domain with tests

**Files:**

- Create: `packages/core/src/decisionStyle/axes.ts`
- Create: `packages/core/src/decisionStyle/questions.ts`
- Create: `packages/core/src/decisionStyle/scoring.ts`
- Create: `packages/core/src/decisionStyle/types.ts`
- Create: `packages/core/src/decisionStyle/index.ts`
- Create: `packages/core/src/__tests__/decisionStyle.test.ts`

- [ ] **Step 1: Add failing contracts for axes, question inventory and labels**

Write tests asserting:

```ts
expect(FULL_QUESTIONS).toHaveLength(28);
expect(QUICK_QUESTIONS).toHaveLength(12);
expect(TIE_BREAKERS).toHaveLength(4);
for (const axis of AXIS_KEYS) {
  expect(FULL_QUESTIONS.filter((q) => q.axis === axis)).toHaveLength(7);
  expect(QUICK_QUESTIONS.filter((q) => q.axis === axis)).toHaveLength(3);
}
expect(allDecisionStyleTypes()).toHaveLength(16);
expect(allDecisionStyleTypes().every((type) => !("feasibility" in type))).toBe(true);
```

Also assert unique IDs, values limited to `-2|-1|0|1|2`, same-axis opposite poles, all 16 codes matching `/^[FS][DW][BL][GV]$/`, and exact approved code→label mapping.

- [ ] **Step 2: Run the focused test and confirm it fails because the new module is absent**

Run: `npm test -- packages/core/src/__tests__/decisionStyle.test.ts`

Expected: FAIL with unresolved `../decisionStyle` imports; no unrelated test failure.

- [ ] **Step 3: Implement exact shared types and the complete question bank**

Use these public contracts:

```ts
export type DecisionStyleAxis = "tempo" | "focus" | "engine" | "drive";
export type DecisionStyleAnswerValue = -2 | -1 | 0 | 1 | 2;
export type DecisionStyleSource = "quick" | "full";
export type DecisionStylePole = "a" | "b";

export interface DecisionStyleAxisScores {
  tempo: number;
  focus: number;
  engine: number;
  drive: number;
}

export interface DecisionStyleSummary {
  version: 2;
  source: DecisionStyleSource;
  code: DecisionStyleCode;
  scores: DecisionStyleAxisScores;
  completedAt: string;
}

export interface DecisionStyleLocalDetail {
  version: 2;
  answers: { questionId: string; value: DecisionStyleAnswerValue }[];
  tieBreaks: Partial<Record<DecisionStyleAxis, DecisionStylePole>>;
}

export interface DecisionStyleQuestion {
  id: string;
  axis: DecisionStyleAxis;
  prompt: string;
  left: { pole: DecisionStylePole; label: string };
  right: { pole: DecisionStylePole; label: string };
  quick: boolean;
}
```

Author all 28 concrete behavioral scenarios now—no placeholder copy. Each endpoint must be independently reasonable, refer to observable recent behavior, avoid identity absolutes, and balance social desirability. Add one concrete binary tie-breaker per axis.

Each of the 16 type objects must contain only `code`, `label`, `strength`, `cost`, `advice`, and `tension`; use the 16 approved labels exactly and do not infer industry, employer, income, city or future outcome.

- [ ] **Step 4: Add failing scoring tests**

Cover all-neutral answers, only tied axes, all-A/all-B extremes, reversed visual poles, score clamping, 45/55 boundaries, evidence selection and summary precedence. Required signatures:

```ts
export function scoreDecisionStyle(
  source: DecisionStyleSource,
  answers: DecisionStyleLocalDetail["answers"],
  tieBreaks?: DecisionStyleLocalDetail["tieBreaks"],
): DecisionStyleScoringResult;

export function mergeDecisionStyleSummary(
  current: DecisionStyleSummary | undefined,
  incoming: DecisionStyleSummary,
): DecisionStyleSummary;
```

Assert that neutral answers return `pendingTieBreaks: AXIS_KEYS` and no `code`; after four explicit tie-breaks a complete code exists while scores remain 50. Assert `full` overrides `quick`, quick never downgrades full, and same-source latest `completedAt` wins.

- [ ] **Step 5: Run tests, implement minimal deterministic scoring, rerun**

Normalize each axis with `50 + (signedSum / maximumAbsoluteSum) * 50`, round once at the public score boundary, and clamp to `0..100`. Select up to three strongest non-neutral evidence answers, preferring axis diversity; evidence must reference question IDs/choice labels, not invent prose.

Run: `npm test -- packages/core/src/__tests__/decisionStyle.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the shared domain**

```powershell
git add packages/core/src/decisionStyle packages/core/src/__tests__/decisionStyle.test.ts
git commit -m "feat: add decision style domain model"
```

---

## Task 2: Add minimal public payload serialization and server HMAC

**Files:**

- Create: `packages/core/src/decisionStyle/shareToken.ts`
- Modify: `packages/core/src/decisionStyle/index.ts`
- Create: `packages/core/src/__tests__/decisionStyleShareToken.test.ts`
- Create: `src/lib/decisionStyleToken.server.ts`
- Create: `src/lib/__tests__/decisionStyleToken.server.test.ts`
- Create: `src/app/api/style-share-token/route.ts`
- Create: `src/app/api/style-share-token/__tests__/route.test.ts`

- [ ] **Step 1: Write failing pure payload tests**

Use this only public payload:

```ts
export interface DecisionStylePublicPayload {
  version: 2;
  source: "quick" | "full";
  code: DecisionStyleCode;
  scores: DecisionStyleAxisScores;
}
```

Test canonical key order, integer score enforcement, `0..100`, code recomputation from scores, exact payload round-trip, unknown version rejection and rejection of extra keys such as `completedAt`, `answers`, `name`, `token` and `id`.

- [ ] **Step 2: Run and observe the expected missing-module failure**

Run: `npm test -- packages/core/src/__tests__/decisionStyleShareToken.test.ts`

Expected: FAIL because serializers do not exist.

- [ ] **Step 3: Implement portable encode/decode/validate functions**

Keep this file browser/React Native safe: no `node:crypto`, `Buffer` or environment access. Export canonical UTF-8 JSON helpers and strict shape validation. For every non-50 score, recompute and verify its code letter; at exactly 50, accept only the explicit tie-resolved letter already carried by `code` and never synthesize a default.

- [ ] **Step 4: Write failing HMAC and route tests**

Required server-only API:

```ts
export function signDecisionStylePayload(
  payload: DecisionStylePublicPayload,
  secret: string,
): string;

export function verifyDecisionStyleToken(
  token: string,
  secret: string,
): DecisionStylePublicPayload | null;
```

Test valid round-trip, one-byte payload/signature tampering, wrong secret, malformed base64url, invalid path code, missing secret, body over 1 KiB, non-JSON and extra fields. Route success returns `{ token, path }`; missing configuration returns 503; invalid input 400; method is POST only.

- [ ] **Step 5: Implement HMAC-SHA-256 and the Route Handler**

Use `node:crypto` with timing-safe signature comparison. Read `DECISION_STYLE_SHARE_SECRET` only inside `.server.ts`/Route Handler. The route must parse a capped body, validate/recompute, and never log payloads.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- packages/core/src/__tests__/decisionStyleShareToken.test.ts src/lib/__tests__/decisionStyleToken.server.test.ts src/app/api/style-share-token/__tests__/route.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit signing boundary**

```powershell
git add packages/core/src/decisionStyle/shareToken.ts packages/core/src/decisionStyle/index.ts packages/core/src/__tests__/decisionStyleShareToken.test.ts src/lib/decisionStyleToken.server.ts src/lib/__tests__/decisionStyleToken.server.test.ts src/app/api/style-share-token
git commit -m "feat: sign minimal decision style shares"
```

---

## Task 3: Replace Profile fields and make AI context low-weight

**Files:**

- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `src/lib/enrich.ts`
- Modify: `src/lib/enrichClient.ts` and/or the actual client serializer discovered by call-site tracing
- Modify: `src/components/Onboarding.tsx`
- Modify: affected tests under `packages/core/src/__tests__/`, `src/lib/__tests__/`, and `src/app/api/__tests__/`

- [ ] **Step 1: Trace every Profile serializer before editing**

Run:

```powershell
rg -n "lifePathCode|lifePathAnswers|riskAppetiteFromAxes|styleHintForCode|JSON.stringify\(.*profile|profile:" packages/core/src src mobile/src
```

Record all hits in the task notes; do not assume `enrich.ts` is the only AI path.

- [ ] **Step 2: Add failing Profile and AI boundary tests**

Tests must prove:

- `Profile` accepts `decisionStyle?: DecisionStyleSummary` and no production code reads old fields.
- a quick/full summary does not alter independently selected `riskAppetite`.
- AI context contains four numeric tendencies and the “self-reported, not fact” boundary.
- AI context excludes all 16 labels, answers, tie-breaks, evidence and local storage detail.
- client request construction whitelists the summary and cannot serialize an accidentally attached local-detail property.

- [ ] **Step 3: Run focused tests and confirm old behavior fails the new assertions**

Run the exact affected test files found in Step 1 plus: `npm test -- src/lib/__tests__/enrichClient.test.ts`

Expected: FAIL on old risk mapping/label prompt or missing summary.

- [ ] **Step 4: Replace the Profile model and prompt builder**

Delete `lifePathCode` and `lifePathAnswers`; add `decisionStyle?: DecisionStyleSummary`. Add a pure prompt helper that returns an empty string unless `version === 2`, and otherwise reports four score-derived tendencies without the Chinese nickname. Explicitly tell the model not to infer location, occupation, identity, finances, relationships, illness or future events.

On Web onboarding, consume only the completed `DecisionStyleSummary`; leave risk appetite as the user’s independent form answer. Do not put `DecisionStyleLocalDetail` into the profile object.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```powershell
npm test -- src/lib/__tests__/enrichClient.test.ts packages/core/src/__tests__/profile.test.ts
npm run typecheck
npx tsc -p mobile/tsconfig.json --noEmit
```

Expected: all commands PASS; no old fields remain in non-document production code.

- [ ] **Step 6: Commit the data-flow replacement**

Stage only files actually changed for this task, then:

```powershell
git commit -m "refactor: decouple decision style from risk and AI facts"
```

---

## Task 4: Build the Web 28-question flow with local-only persistence

**Files:**

- Create: `src/lib/decisionStyleStorage.ts`
- Create: `src/lib/__tests__/decisionStyleStorage.test.ts`
- Create: `src/components/decision-style/DecisionStyleTest.tsx`
- Create: `src/components/decision-style/DecisionStyleAxisBars.tsx`
- Create: `src/components/decision-style/DecisionStyleResult.tsx`
- Create: `src/components/decision-style/__tests__/DecisionStyleTest.test.tsx`
- Create: `src/components/decision-style/__tests__/DecisionStyleResult.test.tsx`
- Modify: `src/app/test/page.tsx`
- Modify: `src/state/useAppApi.ts`
- Modify: `src/state/AppContext.tsx`

- [ ] **Step 1: Write storage tests before implementation**

Use separate keys:

```ts
export const STYLE_DRAFT_KEY = "lifeplanner.decision-style.v2.draft"; // sessionStorage
export const STYLE_DETAIL_KEY = "lifeplanner.decision-style.v2.detail"; // localStorage
export const STYLE_SUMMARY_KEY = "lifeplanner.decision-style.v2.summary"; // sessionStorage handoff
```

Test corrupted JSON, wrong version, draft restore, completion clearing draft, local-detail persistence, summary handoff and a single `clearDecisionStyleLocalData()` used by reset flows. Add a Web state action that applies a completed summary to an existing tree profile through `mergeDecisionStyleSummary`, so retaking outside onboarding persists and cloud sync sees only the summary.

- [ ] **Step 2: Run storage tests, implement the smallest safe adapter, rerun**

Run: `npm test -- src/lib/__tests__/decisionStyleStorage.test.ts`

Expected after implementation: PASS in jsdom, with storage exceptions returning safe defaults.

- [ ] **Step 3: Write the failing user-flow component tests**

Cover intro → start → 28 answered questions → only required tie-breakers → result; refresh restore; progress text; back navigation; completion cleanup; restart confirmation; result evidence; continue-to-tree handoff. Assert buttons/radios expose accessible names and state, keyboard operation works, score bars include text values, and no feasibility/probability wording renders.

- [ ] **Step 4: Run the component tests and confirm failure on the old test UI**

Run: `npm test -- src/components/decision-style/__tests__`

Expected: FAIL because the v2 components are absent.

- [ ] **Step 5: Implement the full flow and result UI**

`src/app/test/page.tsx` remains a small page shell. `DecisionStyleTest` owns the finite states `intro | questions | tieBreakers | result`; every answer persists immediately to the draft. On completion, store local detail, clear only the draft, and render result actions in the approved order. If a tree already exists, apply the merged summary directly to `tree.profile` through the state API; otherwise save the summary handoff for onboarding. Web reset clears both tree data and local decision-style data.

Use native inputs/buttons where possible. Honor `prefers-reduced-motion`, never rely on color alone, and keep mobile targets at least 44px.

- [ ] **Step 6: Run focused tests, lint and Web typecheck**

```powershell
npm test -- src/lib/__tests__/decisionStyleStorage.test.ts src/components/decision-style/__tests__
npm run lint -- src/app/test src/components/decision-style src/lib/decisionStyleStorage.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Web test flow**

```powershell
git add src/app/test src/components/decision-style src/lib/decisionStyleStorage.ts src/lib/__tests__/decisionStyleStorage.test.ts src/state/useAppApi.ts src/state/AppContext.tsx
git commit -m "feat: rebuild web decision style test"
```

---

## Task 5: Add public result, shared OG/PNG renderer and share actions

**Files:**

- Create: `src/lib/decisionStyleShareClient.ts`
- Create: `src/lib/__tests__/decisionStyleShareClient.test.ts`
- Create: `src/components/decision-style/DecisionStyleShareCard.tsx`
- Create: `src/app/style/[code]/[token]/page.tsx`
- Create: `src/app/style/[code]/[token]/opengraph-image.tsx`
- Create: `src/app/style/[code]/[token]/card.png/route.ts`
- Modify: `src/components/decision-style/DecisionStyleResult.tsx`

- [ ] **Step 1: Write failing client and public-token tests**

Test successful signing request, 503/missing secret, offline/network error, copy fallback, `navigator.share` availability, PNG download URL generation and invalid token/path mismatch. Ensure request body contains exactly the public payload.

- [ ] **Step 2: Implement share client and verify focused tests**

Run: `npm test -- src/lib/__tests__/decisionStyleShareClient.test.ts`

Expected: PASS after implementation.

- [ ] **Step 3: Write failing route/render tests**

Factor token resolution into a testable server helper. Test that page metadata, page, OG and PNG all reject invalid signatures and all resolve the same validated payload. Assert OG/PNG omit answers, evidence, name, timestamp, feasibility and “AI 粗估”.

- [ ] **Step 4: Implement one Satori-compatible card renderer**

`DecisionStyleShareCard` must be a pure JSX renderer accepted by `ImageResponse`. Both `opengraph-image.tsx` and `card.png/route.ts` call it with the verified payload. Export `size = { width: 1200, height: 630 }` and `contentType = "image/png"`; await Promise params per Next 16 docs.

The public page displays code, label, axis scores, current-tendency disclaimer and CTA “测完和 TA 比”; it never displays local evidence. Invalid tokens call `notFound()` or render a safe retest entry without exposing validation details.

- [ ] **Step 5: Connect result actions with explicit degradation**

Action behavior:

1. First request a signed token.
2. Use system share if available; otherwise copy the verified public URL.
3. “复制链接” copies only the verified URL.
4. “保存 PNG” downloads `.../card.png` and reports failure without blocking link sharing.
5. Missing secret/offline shows “分享暂不可用，请联网后重试”; it must not construct an unsigned URL.

- [ ] **Step 6: Run tests and production build for route contracts**

```powershell
npm test -- packages/core/src/__tests__/decisionStyleShareToken.test.ts src/lib/__tests__/decisionStyleToken.server.test.ts src/lib/__tests__/decisionStyleShareClient.test.ts src/app/api/style-share-token/__tests__/route.test.ts
npm run typecheck
npm run build
```

Expected: PASS; build lists `/style/[code]/[token]` and its image route without Promise-param errors.

- [ ] **Step 7: Commit public sharing**

Stage this task’s paths and commit: `git commit -m "feat: add signed decision style sharing"`.

---

## Task 6: Complete the friend comparison loop

**Files:**

- Modify: `src/app/style/[code]/[token]/page.tsx`
- Modify: `src/components/decision-style/DecisionStyleTest.tsx`
- Create: `src/app/compare/[left]/[right]/page.tsx`
- Modify/Create: related component tests under `src/components/decision-style/__tests__/`

- [ ] **Step 1: Add failing invite and compare tests**

Test that the public CTA passes only the inviter’s signed token through this one test flow; completion signs the friend result and navigates to `/compare/{left}/{right}`. Directly opening compare verifies both tokens. Invalid token returns the safe retest entry.

Assertions must cover:

- closest axis and largest-difference axis are deterministic;
- each axis shows both scores and plain-language tendencies;
- no “匹配度”, percentage compatibility, “适合/不适合”, winner or ranking copy exists;
- invite state is cleared after completion/restart.

- [ ] **Step 2: Run tests and confirm they fail before compare exists**

Run: `npm test -- src/components/decision-style/__tests__`

Expected: FAIL on invite/compare expectations.

- [ ] **Step 3: Implement server-verified comparison and one-flow invite state**

Do comparison calculations only after verifying both HMAC tokens. A 50 score’s displayed pole comes from its verified code letter. For equal differences, use `AXIS_KEYS` order for stable results. Never persist the inviter token to Profile/local detail/analytics.

- [ ] **Step 4: Rerun tests and Web typecheck**

```powershell
npm test -- src/components/decision-style/__tests__ packages/core/src/__tests__/decisionStyleShareToken.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit comparison loop**

Stage compare/test/share page changes and commit: `git commit -m "feat: add friend decision style comparison"`.

---

## Task 7: Embed the 12-question quick test in App onboarding

**Files:**

- Create: `mobile/src/lib/decisionStyleStorage.ts`
- Create: `mobile/src/components/decision-style/DecisionStyleQuiz.tsx`
- Create: `mobile/src/components/decision-style/DecisionStyleResultCard.tsx`
- Modify: `mobile/src/screens/OnboardingScreen.tsx`
- Modify: `mobile/src/state/store.tsx`
- Modify: `mobile/src/lib/storage.ts`

- [ ] **Step 1: Read the iOS/SwiftUI plugin boundaries and inspect current Expo config**

Use `build-ios-apps:swiftui-ui-patterns` only for interaction/accessibility principles—the app is React Native, so do not introduce SwiftUI. Inspect `app.json/app.config.*`, `mobile/src/ui.tsx`, theme tokens and onboarding state before editing.

- [ ] **Step 2: Add pure tests for App-facing state transitions in shared core**

Where RN component testing infrastructure is absent, keep state reducers/view-model helpers pure and test them with Vitest in `packages/core/src/__tests__/decisionStyle.test.ts`. Cover start, 12 answers, tied-axis follow-up, complete, skip, restart and `full`-over-`quick` merge.

- [ ] **Step 3: Run the focused tests and confirm new transition assertions fail**

Run: `npm test -- packages/core/src/__tests__/decisionStyle.test.ts`

Expected: FAIL only for newly introduced helper/state assertions.

- [ ] **Step 4: Implement AsyncStorage detail persistence**

Use key `lifeplanner.decision-style.v2.detail`; expose `loadDecisionStyleDetail`, `saveDecisionStyleDetail`, `clearDecisionStyleDetail`. Update the existing reset path in `mobile/src/lib/storage.ts`/store so reset clears both tree and local detail. Never add detail to `saveTree`.

- [ ] **Step 5: Implement the skippable onboarding stage**

Before the current profile steps, show “开始 12 题快测” and “先跳过”. The quick quiz uses `QUICK_QUESTIONS`, persists after each answer, shows only necessary tie-breakers, then a concise result card. “继续填写资料” passes only `DecisionStyleSummary` into `ProfileInputs`. Skip leaves it undefined and does not block onboarding.

Use `accessibilityRole`, `accessibilityLabel`, `accessibilityState`, Dynamic Type-compatible text, reduced motion, and minimum 44pt controls.

- [ ] **Step 6: Verify core, Web and mobile types**

```powershell
npm test -- packages/core/src/__tests__/decisionStyle.test.ts
npm run typecheck
npx tsc -p mobile/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit App onboarding quick test**

Stage only the listed mobile/core files and commit: `git commit -m "feat: add app onboarding style quick test"`.

---

## Task 8: Add App “Me” result management and native image sharing

**Files:**

- Modify: `mobile/src/screens/MeScreen.tsx`
- Modify: `mobile/src/state/store.tsx`
- Create: `mobile/src/lib/decisionStyleShare.ts`
- Modify: `mobile/src/components/decision-style/DecisionStyleQuiz.tsx`
- Modify: `mobile/src/components/decision-style/DecisionStyleResultCard.tsx`
- Modify: `mobile/package.json`, lockfile, and Expo config only if official modules require it

- [ ] **Step 1: Verify Expo SDK 56-compatible modules before installation**

Run:

```powershell
npx expo install expo-file-system expo-sharing --check
```

If missing, install with `npx expo install expo-file-system expo-sharing`; do not hand-pick versions. Review the installed SDK 56 package docs/type declarations before calling APIs.

- [ ] **Step 2: Add failing pure share-orchestration tests**

Extract dependency-injected orchestration so Vitest can cover:

```ts
export async function shareDecisionStyle(
  summary: DecisionStyleSummary,
  deps: DecisionStyleShareDependencies,
): Promise<"image" | "link" | "cancelled">;
```

Test token request → PNG download to cache → native share → cleanup; image download/share failure → link fallback; offline/missing secret → user-facing retry error; cleanup runs in `finally`; no permanent media-library write.

- [ ] **Step 3: Run tests and confirm missing implementation failure**

Run the exact new test file with `npm test -- <path>`.

- [ ] **Step 4: Implement “Me” card, retake and share**

With no result, show a quick-test entry. With a result, show label/code, source (`快测`/`完整`), four scores, retake and share. Retake replaces same-source results; quick retake cannot overwrite an existing full result. Do not retain history.

Download the server PNG into Expo cache, invoke native sharing, remove the file afterward, and fall back to text/link share. Keep existing generic tree-share behavior separate.

- [ ] **Step 5: Run mobile verification**

```powershell
npx tsc -p mobile/tsconfig.json --noEmit
npx expo config --type public
npx expo-doctor@latest mobile
```

Expected: TypeScript and config PASS; Expo Doctor reports no dependency mismatch attributable to this change.

- [ ] **Step 6: Commit App result/share experience**

Stage exact mobile files and lockfile, then commit: `git commit -m "feat: add app decision style results and sharing"`.

---

## Task 9: Add privacy-minimal first-party analytics and 30-day retention

**Files:**

- Create: `supabase/migrations/20260710000000_style_events.sql`
- Create: `src/app/api/style-events/route.ts`
- Create: `src/app/api/style-events/__tests__/route.test.ts`
- Create: `src/lib/decisionStyleAnalytics.ts`
- Create: `src/lib/__tests__/decisionStyleAnalytics.test.ts`
- Modify: Web/App flow call sites
- Modify: `src/app/privacy/page.tsx`
- Modify: `docs/supabase-setup.md`

- [ ] **Step 1: Invoke and follow `supabase:supabase` before any database edit**

Confirm the project’s migration/CLI conventions and whether `pg_cron` is available. Keep the schema below unless the connected project requires the documented Supabase-equivalent scheduler.

- [ ] **Step 2: Write failing API schema and privacy tests**

Allowed request:

```ts
interface StyleEventRequest {
  event: "style_view" | "style_start" | "style_skip" | "style_complete" |
    "style_share" | "style_share_open" | "style_compare_start" |
    "style_compare_complete" | "style_continue_tree";
  surface: "web" | "app";
  source: "direct" | "shared" | "compare";
  test_version: 2;
}
```

Test exact-key validation, 512-byte body cap, invalid enum/version, per-IP transient rate limiting, server timestamp ownership, configured insert, unconfigured no-op, DB failure success-type no-op, and a serialized body scan proving it cannot contain answers, scores, code, token, name, user/device/flow IDs or free text.

- [ ] **Step 3: Run route/client tests and confirm failure**

Run: `npm test -- src/app/api/style-events/__tests__/route.test.ts src/lib/__tests__/decisionStyleAnalytics.test.ts`

Expected: FAIL because endpoint/client do not exist.

- [ ] **Step 4: Implement locked-down database and retention migration**

Create `style_events` with only:

```sql
id bigint generated always as identity primary key,
event text not null check (...),
surface text not null check (surface in ('web','app')),
source text not null check (source in ('direct','shared','compare')),
test_version smallint not null check (test_version = 2),
created_at timestamptz not null default now()
```

Enable RLS and grant no direct anonymous select/insert policy; the server route inserts with `SUPABASE_SERVICE_ROLE_KEY`. Add a daily scheduled deletion for `created_at < now() - interval '30 days'`. Do not persist request IP; in-memory rate-limit keys expire with the window.

- [ ] **Step 5: Implement best-effort endpoint/client and wire exact events**

The endpoint returns 202 for accepted inserts and for intentional no-op when configuration/database is unavailable; validation/rate-limit failures remain 400/413/429. Client calls use `keepalive` where supported and never block navigation.

Wire each approved event at its semantic point exactly once. Do not add session IDs or deduplication identifiers. Update privacy copy with the exact five stored fields and 30-day retention.

- [ ] **Step 6: Run tests and inspect migration**

```powershell
npm test -- src/app/api/style-events/__tests__/route.test.ts src/lib/__tests__/decisionStyleAnalytics.test.ts
npm run typecheck
rg -n "answers|scores|code|token|user_id|device|flow|name" supabase/migrations/20260710000000_style_events.sql src/app/api/style-events src/lib/decisionStyleAnalytics.ts
```

Expected: tests/typecheck PASS; final search has no persisted/request fields beyond test descriptions that explicitly reject them.

- [ ] **Step 7: Commit analytics/privacy**

Stage the migration, endpoint, client, call sites, privacy page and docs; commit: `git commit -m "feat: add anonymous style funnel analytics"`.

---

## Task 10: Remove old implementation and stale semantics

**Files:**

- Delete all files listed under “Delete after replacements are green”
- Modify: imports/copy in `packages/core/src`, `src`, `mobile`, tests, README/docs where the old product is described

- [ ] **Step 1: Prove all live call sites use the replacement**

Run:

```powershell
rg -n "lifePathCode|lifePathAnswers|riskAppetiteFromAxes|styleHintForCode|TIE_DEFAULT|职场人格测试|现实可行度|AI 粗估" packages/core/src src mobile/src mobile/app --glob "*.ts" --glob "*.tsx"
```

Expected before deletion: only old modules/routes/tests or deliberate negative-test strings remain. If a live call site appears, migrate and test it before continuing.

- [ ] **Step 2: Delete old files and exports**

Remove `lifePathCode/`, old route `/t/[code]`, old components/image generator and obsolete tests. Do not add redirects or migration code because the approved design explicitly has no users/compatibility requirement.

- [ ] **Step 3: Update terminology and environment documentation**

Use “职业决策风格测试” and “当前倾向” consistently. Document `DECISION_STYLE_SHARE_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` as server-only and the style-events migration/retention. Never expose either as `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.

- [ ] **Step 4: Run stale-semantics gates**

```powershell
rg -n "lifePathCode|lifePathAnswers|riskAppetiteFromAxes|styleHintForCode|TIE_DEFAULT" packages/core/src src mobile/src mobile/app
rg -n "职场人格测试|现实可行度|AI 粗估|匹配度" packages/core/src src mobile/src mobile/app
```

Expected: no production hits. Negative tests may be rewritten to read rendered output and assert absence without embedding obsolete identifiers in production.

- [ ] **Step 5: Run all tests and typechecks before committing deletion**

```powershell
npm test
npm run typecheck
npx tsc -p mobile/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit deletion cleanup**

Stage exact removed/updated paths and commit: `git commit -m "refactor: remove legacy personality test semantics"`.

---

## Task 11: Full verification, browser QA and beta handoff

**Files:**

- Modify only if verification exposes a defect; each defect gets a failing regression test first
- Update: this plan’s checkbox progress and a concise verification record if the repository convention requires it

- [ ] **Step 1: Invoke `superpowers:verification-before-completion` and project `green` skill**

Run the project’s complete gate exactly as directed by `green`, covering ESLint, Vitest, TypeScript and Next production build. Also run:

```powershell
npx tsc -p mobile/tsconfig.json --noEmit
npx expo config --type public
npx expo-doctor@latest mobile
```

Expected: all blocking checks PASS. Record exact command output/counts; do not claim success from prior runs.

- [ ] **Step 2: Run real browser critical flows using the Playwright skill**

Start a clean dev server using the project `restart-dev` skill. Verify desktop and mobile viewport:

1. Direct `/test`: intro, answer, refresh restore, finish, tie-break if triggered, result.
2. Result: share/copy/PNG/continue/retest, including offline/missing-secret degradation.
3. Public signed result: metadata/OG image, “测完和 TA 比”.
4. Friend flow: complete and land on compare; no match score or winner wording.
5. Keyboard-only navigation and visible focus; reduced-motion mode.
6. Privacy page disclosure.

Capture screenshots for intro, question, local result, public result and compare. Check console/network for leaked answer/score/code/token event payloads.

- [ ] **Step 3: Audit accessibility and performance baselines**

Run Lighthouse for `/test` intro and a public result route. Fix only regressions introduced by this feature. Verify semantic controls, contrast, text zoom and that score meaning survives grayscale.

- [ ] **Step 4: Prepare real-iPhone/TestFlight checklist—do not falsely mark it complete on Windows**

The release owner must verify on a real iPhone/TestFlight:

- first-run quick test and skip;
- VoiceOver reading order/state;
- largest Dynamic Type and reduced motion;
- app termination/relaunch and offline draft recovery;
- offline completion then later share;
- PNG temp download, system share, cancellation, fallback and cleanup;
- “Me” retake/source behavior;
- analytics failure does not block UX.

Mark beta release blocked until these physical-device checks are signed off. Windows static checks cannot substitute for Xcode Simulator, ETTrace, memgraph or TestFlight.

- [ ] **Step 5: Final privacy and scope searches**

```powershell
rg -n "lifePathCode|lifePathAnswers|riskAppetiteFromAxes|TIE_DEFAULT|AI 粗估|现实可行度" packages/core/src src mobile/src mobile/app
rg -n "DECISION_STYLE_SHARE_SECRET|SUPABASE_SERVICE_ROLE_KEY" src mobile packages --glob "*.ts" --glob "*.tsx"
git status --short
git diff --check
```

Expected: no obsolete semantics; secrets appear only in server-only files/docs and never in client bundles; no whitespace errors; unrelated pre-existing user changes remain untouched.

- [ ] **Step 6: Request code review before integration**

Invoke `superpowers:requesting-code-review`, resolve only evidence-backed findings with regression tests, rerun the full gate, and then use `superpowers:finishing-a-development-branch` to choose merge/PR handling.

---

## Plan Self-Review Checklist

- [ ] Every requirement in spec sections 3–16 maps to at least one task and verification step.
- [ ] No task contains TODOs, placeholder copy, unspecified “handle errors”, or an unbounded refactor.
- [ ] Shared interfaces use one naming scheme across core/Web/App (`DecisionStyle*`, version 2).
- [ ] No raw-answer path crosses into Profile/cloud/AI/share/analytics.
- [ ] Every mutation task begins with a failing test and ends with an exact verification command.
- [ ] Next 16 Promise params, Expo 56 dependency resolution, Supabase RLS/retention and Windows iOS limitations are explicit.
- [ ] Old behavior is deleted only after replacement tests pass; no migration or compatibility layer is introduced.
- [ ] Commits stage scoped paths and preserve the existing dirty worktree.
