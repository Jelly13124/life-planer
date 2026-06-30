# 职场版 MBTI · 人生路径码 — Design Spec (v2)

**Date:** 2026-06-29
**Status:** Draft for user review (v2 — supersedes the v1 "life-path-code" draft below the line of decisions)
**One-liner:** A 28-question, MBTI-style (16personalities-flavored) **职场人格测试** that gives you a 4-letter 人生路径码 + 中文昵称 on a shareable card — and the *same answers* feed your real AI life-tree prediction.

---

## 1. Why

Our prediction is real and detailed (retention/credibility moat), but realism doesn't spread. MBTI/16personalities prove the viral format: a quiz → a claimable 4-letter type → a card you wear and compare. We bolt that viral *front* onto our honest *depth*, **职场-flavored** because career anxiety is the strongest share trigger for our 20–35 audience.

**The unlock (decision C — unified):** the test is **part of onboarding**. The same answers (a) produce a shareable 职场型 (the viral artifact) AND (b) feed the prediction as legitimate inputs. This makes the type *honest and load-bearing* (not a horoscope toy): your work-personality genuinely shapes your predicted path — the causal story 算命 cannot tell.

**Non-negotiable (`.claude/rules/product-route-a.md`):** not fortune-telling. Every type has 光 **and** 影. The type is a **soft** prediction input, never "因为你是 X 型所以必然 Y". Any % carries "约 X% · AI 粗估 · 随你努力上升". Crisis-safety (`safety.ts`) applies to any free-text.

---

## 2. The 人生路径码 (职场版, MBTI-style)

**4 binary axes → 4 letters → 16 types.** Axes are **career/work decision dimensions**:

| 轴 | 字母 A | 字母 B | 含义（职场） |
|---|---|---|---|
| 节奏 tempo | **F** 闯 | **S** 稳 | 职业行动的快/险 vs 稳/慎 |
| 专注 focus | **D** 深 | **W** 广 | 专才(深耕一域) vs 通才(多线开花) |
| 引擎 engine | **B** 自立 | **L** 借势 | 自己造盘子 vs 借平台/组织的势往上爬 |
| 底色 drive | **G** 求稳 | **V** 求自我 | 求回报/安全 vs 求意义/自我实现 |

Code reads `[F|S][D|W][B|L][G|V]`, e.g. `FDBV`. "我是 FDBV" mirrors "我是 INTJ".

### The 16 types (each: code · 昵称 · 光 · 影 · 职场打法 · feasibility · color · teaser)

Content draft — to be polished, but **光+影 are mandatory** (honesty). `职场打法` = one line on how this type plays the career game / fitting roles. `feasibility` = coarse 0-100 (非精确). `color` = card/branch hex.

| 码 | 昵称 | 光 | 影 | 职场打法 | feas | color |
|---|---|---|---|---|---|---|
| FDBG | 孤勇淘金者 | 敢 all-in 赚钱方向、执行猛 | 孤注一掷、赌错沉没成本大 | 押一个能变现的硬方向，自己干、快进快出 | 38 | #D85A30 |
| FDBV | 孤勇拓荒者 | 敢为天下先、死磕到底 | 孤立无援、烧钱、易熬干 | 认准一域自立门户，为信念长期投入 | 40 | #D85A30 |
| FDLG | 快车道攀登者 | 在好平台冲得快、回报高 | 被体系绑架、卷到透支 | 进大厂/头部，深耕一条线快速升级 | 60 | #2f6fe0 |
| FDLV | 体制内破局者 | 在框架里推动真实改变 | 理想撞现实、易心累出局 | 借组织的势，深耕一域做有意义的改变 | 50 | #7F77DD |
| FWBG | 多线套利者 | 嗅觉灵、机会捕手 | 样样不精、易翻车 | 自己开多个口子，哪个赚钱押哪个 | 42 | #BA7517 |
| FWBV | 多线冒险家 | 好奇心强、敢试 | 精力分散、难沉淀 | 自立 + 多元探索，追新追热爱 | 45 | #BA7517 |
| FWLG | 机会冲浪者 | 踩风口、换赛道快 | 随波逐流、根基浅 | 借平台、追风口，灵活换赛道求回报 | 55 | #378ADD |
| FWLV | 斜杠理想家 | 身份多元、活得精彩 | 样样松、身份焦虑 | 多平台斜杠，为自我表达活成多面 | 48 | #D4537E |
| SDBG | 闷声匠人 | 手艺做到顶、吃复利 | 慢热、错过窗口、闷亏 | 自己的小盘子，稳稳把一门手艺做精 | 58 | #1D9E75 |
| SDBV | 长期主义者 | 耐寂寞、做难而正确的事 | 回报太慢、易被磨平 | 自立深耕，押长期价值、慢慢复利 | 52 | #1D9E75 |
| SDLG | 深耕守成派 | 稳扎稳打、时间站你这边 | 天花板早、温水煮青蛙 | 在稳定平台深耕一线，求稳求保障 | 70 | #2f6fe0 |
| SDLV | 体制内手艺人 | 安静精进、有意义感 | 被结构限制、理想缩水 | 借体系的稳，专注精进、求内在意义 | 62 | #7F77DD |
| SWBG | 稳健多面手 | 东方不亮西方亮、抗风险 | 不够聚焦、难做大 | 自己经营多条稳当的小线、分散风险 | 60 | #5b6478 |
| SWBV | 自在生活家 | 生活丰富、自洽 | 难积累、世俗成就有限 | 自立 + 多元，把生活过舒服优先 | 55 | #D4537E |
| SWLG | 稳进多栖者 | 多份保障、稳 | 平庸感、缺少高光 | 借平台 + 多栖，稳稳攒保障 | 65 | #5b6478 |
| SWLV | 随遇而安者 | 松弛、随缘、知足 | 目标感弱、易随波逐流 | 借势、不强求，顺势而活求自洽 | 58 | #5b6478 |

`teaser` (一句未来走向，不含具体年龄) lives with each type in code — e.g. FDBV → "你会先摔两跤，然后才看到光——那束光是你自己点的。"

---

## 3. The test (28 statements, 5-point slider, deterministic)

**Format:** 28 first-person statements (7 per axis), each answered on a **5-point 符合度滑块**: 非常符合(+2) / 比较符合(+1) / 中立(0) / 不太符合(−1) / 完全不符合(−2). Modeled on 16personalities (agree↔disagree). ~2–3 min.

**Keying:** each statement leans toward one pole (`pole`) of one `axis`. Within each axis, statements are mixed-keyed (some lean A, some lean B) to reduce acquiescence bias.

**Scoring (pure, deterministic, TDD):** per axis, `score = Σ over its statements ( pole === axis.a ? +value : −value )`. Then letter = `score > 0 ? axis.a : score < 0 ? axis.b : TIE_DEFAULT[axis]`. With 7 statements/axis a full answer set rarely ties; partial/all-neutral falls to `TIE_DEFAULT = { tempo:S, focus:D, engine:L, drive:G }` (lean 稳健/求实). No AI, no network → instant, free, scales.

### The 28 statements

**节奏 tempo（F 闯 / S 稳）**
1. (F) 看到一个不稳但可能爆发的机会，我会忍不住想冲进去。
2. (S) 重大职业决定前，我一定要把风险想清楚才敢动。
3. (F) 与其稳稳当当，我更怕错过一个大机会。
4. (S) 稳定、可预期的工作让我更安心。
5. (F) 我做事常常先干起来，边做边调整。
6. (S) 没准备好之前，我不会轻易出手。
7. (F) 为了更大的回报，我愿意承担别人觉得太冒险的选择。

**专注 focus（D 深 / W 广）**
8. (D) 我愿意十年磨一剑，把一件事做到顶尖。
9. (W) 我喜欢同时涉猎很多领域，什么都想试试。
10. (D) 成为某个领域的专家，比"什么都会一点"更吸引我。
11. (W) 只押一个方向会让我不安，我更想多线下注。
12. (D) 我做事喜欢往深里钻，而不是浅尝辄止。
13. (W) 跨界、什么都拿得起的人最让我欣赏。
14. (D) 把一项技能练到极致，是我的成就感来源。

**引擎 engine（B 自立 / L 借势）**
15. (B) 理想状态是自己从零搭一个东西。
16. (L) 进一个好平台、借它的势往上走，更聪明。
17. (B) 我更愿意靠自己定义规则，而不是适应别人的规则。
18. (L) 背后有靠谱的组织/平台，我才更踏实。
19. (B) 手里有自己的盘子，比拿高薪更让我安心。
20. (L) 站在巨人肩上，比单打独斗走得更快。
21. (B) 哪怕更难，我也想做自己说了算的事。

**底色 drive（G 求稳 / V 求自我）**
22. (G) 选工作我首先看回报和保障。
23. (V) 一份工作有没有意义，比赚多少更重要。
24. (G) 我最怕的是晚景不安稳、没有保障。
25. (V) 我最怕的是一辈子没做成一件有意义的事。
26. (G) 钱和安全感是我职业的底线。
27. (V) 能不能实现自我，是我职业的底线。
28. (G) 只要够稳够安全，平淡一点我也能接受。

---

## 4. Unified flow (decision C)

Onboarding is redesigned **test-first**:

```
进来 → 28 题滑块（职场人格测试）
     → 立刻揭晓：你的 4 字母码 + 职场型 + 光/影 + 可晒卡   ← 病毒产出（陌生人到此即可晒、可传）
     → "想看你真正的未来？" → 补几个事实题（年龄/城市/职业/收入/感情/身份签证）
     → 同一份答案 + 事实 → AI 人生树预测                   ← 深度产出（护城河）
```

- The 28 answers + derived code **persist into `Profile`** (new optional fields, see §6) so nothing is wasted.
- Public shareable result lives at `/t/[code]` (anonymous, no tree needed).
- The factual second half = today's onboarding fields (reused), minus what the test already implies.

---

## 5. How the test feeds the prediction (decision C — the core)

Three concrete, **soft** mechanisms (none make the prediction deterministic):

1. **tempo → `riskAppetite`.** The 闯/稳 axis maps to `Profile.riskAppetite` (闯→`high`, 稳→`low`, tie→`medium`), which **already** flows into the enrich prompt via `financialFacts()` (`packages/core/src/profile.ts:101` → "风险偏好：X"). Verified.
2. **type/axes → soft prompt context.** `enrich.ts` `buildUserPrompt` gains an optional line built from the code: e.g. *"主角的职场决策风格：闯·深·自立·求自我（孤勇拓荒者）——倾向冒险、死磕一域、自己干、追求意义。把这种倾向作为软性背景，影响他更可能做的选择与走向；但绝不可凌驾于真实事实（年龄/收入/签证/所在地）之上，也不可写成'因为他是X型所以必然Y'。"* This is additive to the existing tuned prompt; all current hard constraints stay.
3. **type → pre-seeded "你最可能走的路" branch.** The type maps to one of the existing `archetypes.ts` archetypes (by tempo×engine, etc.); after onboarding we auto-grow ONE choice branch for that archetype labeled "你最可能走的路 · {昵称}". So the type tangibly shapes the first tree the user sees. (Reuses existing `addPath`/local generator + async enrich.)

---

## 6. Data model additions (optional, backfilled — no migration)

`Profile` gains optional fields (per the additions-only persistence rule; `normalizeLoadedTree` backfills):
- `lifePathCode?: string` — the 4-letter code.
- `lifePathAnswers?: { statementId: string; value: number }[]` — raw answers (so we can re-derive / re-show).

`riskAppetite` is set from the test (existing field). Storage key unchanged (`lifeplanner.tree.v3`).

---

## 7. Honesty guardrails

- Every type shows 光 AND 影.
- The type is a **soft** prediction input (guardrail text baked into the enrich line, see §5.2).
- Any % → "约 X% · AI 粗估，非精确概率 · 随你的真实努力上升".
- Teaser/走向 uses "可能/大概率", never 预言/保证.
- Card frames it as based on your real answers, 不是生辰八字.

---

## 8. Architecture (reuse-first; pure determinism + i18n rules)

**New pure-domain module `packages/core/src/lifePathCode/`** (deterministic, TDD; no `Date.now`/`Math.random`/argless `new Date`):
- `axes.ts` — 4 axes, 8 letters, `Axes`/`LifePathCode`, `codeOf()`.
- `types.ts` — 16 `LifePathType` records + `typeByCode()`/`allTypes()`.
- `statements.ts` — the 28 statements (`{ id, axis, text, pole }`).
- `score.ts` — `scoreQuiz(answers: {statementId,value}[]) → { code, axes }` weighted-sum + tie defaults; plus `riskAppetiteFromAxes(axes)` and `archetypeKeyFromCode(code)` helpers for §5.
- `index.ts` — barrel.
- Tests: `packages/core/src/__tests__/lifePathCode.test.ts`.

**Web (`src/`):**
- `src/lib/shareConfig.ts` — `SHARE_DOMAIN` (env-overridable) + `resultUrl()`.
- `src/lib/lifePathCardImage.ts` — pure SVG card builder (mirrors `treeShareImage.ts`) + reuse `downloadShareSvg`.
- `src/components/LifePathCard.tsx` — on-screen card + save-image.
- `src/components/LifePathTest.tsx` — the 28-statement slider quiz (client).
- `src/app/test/page.tsx` — standalone quiz entry → on finish, route to `/t/[code]` (anonymous) OR continue into onboarding if launched from it.
- `src/app/t/[code]/page.tsx` (+ `ResultActions.tsx`) — public result page + `generateMetadata` OG.
- `src/components/Onboarding.tsx` — test-first restructure: quiz section → reveal → factual fields; sets `riskAppetite` + `lifePathCode`/`lifePathAnswers` on submit.
- `src/lib/enrich.ts` — add the optional soft-context line (§5.2) when `input.lifePathCode` is present (new optional `EnrichInput` field).
- `src/state/AppContext.tsx` — after onboarding, pre-seed the "你最可能走的路" branch (§5.3).
- `src/i18n/messages.ts` — additive EN entries for new chrome.

**Reuse:** `archetypes.ts` palette + archetype mapping; existing image export; existing onboarding factual fields + `/api/enrich`. **No new AI route** (teaser templated; prediction = existing enrich with one extra soft line).

**Mobile:** out of scope for P1 (domain module is shared → mobile can add later).

---

## 9. Scope / phasing

**P1 (this build):**
- `lifePathCode` domain (16 types + 28 statements + weighted scoring + helpers + tests).
- `/test` + `/t/[code]` (OG) + `LifePathCard` + image export.
- Test-first onboarding restructure; persist code/answers/riskAppetite.
- §5.1 + §5.2 integration (riskAppetite already wired; add the soft enrich line).
- zh-only; EN strings additive.

**P2 (later):** §5.3 pre-seeded "最可能的路" branch (if §5.1/5.2 not enough); compare/CP mode; mobile `/test`; AI-personalized teaser; funnel analytics.

**NOT doing:** 玄学/紫微/星盘; precise probabilities; all-flattering types; Likert→% nuance scoring (binary pole is enough).

---

## 10. Testing

- **Domain (vitest, TDD):** `scoreQuiz` determinism (same answers → same code); all-neutral → `TIE_DEFAULT` code (`SDLG`); a clearly-F/D/B/V answer set → `FDBV`; every code in the 16-set has 光+影+teaser+color+feas-in-band; 28 statements = 7/axis with valid poles; `riskAppetiteFromAxes`/`archetypeKeyFromCode` total.
- **Web:** tsc + `next build`; manual: `/test` 28-slider flow → `/t/[code]` renders + card image exports + OG tags; onboarding test-first flow sets code + riskAppetite and produces a tree; `/t/zzzz` → 404.
- `/green` before commit.

---

## 11. Decisions (resolved 2026-06-29)

1. **16 types**, full 4-letter code. ✓
2. **Integration = C (unified)**: test is part of onboarding; same answers feed prediction. ✓
3. **Test length/format = 28 statements, 7/axis, 5-point 符合度滑块** (16personalities-style). ✓
4. **职场-flavored** framing (career test as the viral front; whole-life prediction as the product). ✓
5. **Share domain** = `SHARE_DOMAIN` config const, default current Vercel domain. ✓
6. **zh-only P1**; EN additive later. ✓
7. **Compare/CP mode + §5.3 pre-seeded branch = P2.** ✓

---

## Open question for the user

- The 28 statements (§3) — review wording: keep / tweak which / add or cut any? (They go verbatim into `statements.ts`.)
