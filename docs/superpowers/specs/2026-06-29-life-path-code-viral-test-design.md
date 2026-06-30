# 人生路径码 · 病毒测试漏斗 — Design Spec

**Date:** 2026-06-29
**Status:** Draft for user review
**One-liner:** An MBTI-style scenario quiz that gives you a 4-letter **人生路径码** + a catchy 中文昵称 on a shareable card, then funnels you into the real (honest) life-tree prediction.

---

## 1. Why (the problem this solves)

Our prediction is **real and detailed** — that's our retention/credibility moat. But realism is **not a spread mechanism**. Things go viral because they serve *identity + emotion + social play*, not because they're true (Barnum effect, identity signaling, low cognitive cost, comparison/tribe). MBTI/16personalities prove the format: a quiz → a claimable 4-letter type → a card you wear and compare. Zero 玄学, maximally viral.

**Goal:** add a viral *front layer* that obeys those rules — a claimable code + a shareable card + a 30-second quiz — and funnels strangers into our honest depth. **Acquisition-first** (public, no-signup, shareable → convert to users). Steal 算命/MBTI's *packaging* (ritual, label, reveal, card); keep our *substance* (honest, grounded, names tradeoffs).

**The honest differentiator (vs 算命):** the result comes from your **real decision-style answers**, and decision style genuinely shapes life outcomes — so "test → 未来走向" is a defensible causal claim. Birth charts are not. We can say on the card: *"基于你的真实选择,不是生辰八字。"*

**Non-negotiable (per `.claude/rules/product-route-a.md`):** not fortune-telling. Every type has 光 **and** 影. Any % carries "AI 粗估·非精确·随你努力上升". Crisis-safety (`safety.ts`) still applies on any free-text input.

---

## 2. The 人生路径码 system (MBTI-style, but for life paths)

**4 binary axes → 4 letters → 16 types.** Each type = `CODE`(4 letters) + 中文昵称 + 光 + 影 + 现实可行度 + signature color.

| 轴 | 字母 A | 字母 B | 来源(测试如何测) |
|---|---|---|---|
| 节奏 (tempo) | **F** 闯 (Fast) | **S** 稳 (Steady) | 风险承受、行动急缓 |
| 路宽 (focus) | **D** 深 (Deep) | **W** 广 (Wide) | 死磕一域 vs 多线下注 |
| 引擎 (engine) | **B** 自创 (Build) | **L** 借势 (Lever) | 自己造 vs 借平台/体制/学历的势 |
| 底色 (drive) | **G** 务实 (Gold) | **V** 理想 (Vision) | 求稳/求钱/安全 vs 求意义/身份 |

A code always reads `[F|S][D|W][B|L][G|V]` — e.g. `FDBV`. "我是 FDBV" mirrors "我是 INTJ".

### The 16 types (draft — copy to be polished, but each MUST keep 光+影)

| 码 | 昵称 | 光 | 影 |
|---|---|---|---|
| FDBG | 孤勇淘金者 | All-in 一个赚钱方向,执行力猛 | 孤注一掷,赌错沉没成本大 |
| FDBV | 孤勇拓荒者 | 敢为天下先,有信念 | 孤立无援、烧钱、易把自己熬干 |
| FDLG | 快车道攀登者 | 在体系里冲得快、回报高 | 被体系绑架、卷到透支 |
| FDLV | 体制内破局者 | 在框架里推动改变 | 理想撞现实,易心累出局 |
| FWBG | 多线套利者 | 嗅觉灵、机会捕手 | 样样做=样样不精,易翻车 |
| FWBV | 多线冒险家 | 好奇心强、敢试 | 精力分散、难沉淀 |
| FWLG | 机会冲浪者 | 踩风口、换赛道快 | 随波逐流、根基浅 |
| FWLV | 斜杠理想家 | 身份多元、活得精彩 | 样样松、身份焦虑 |
| SDBG | 闷声匠人 | 把一门手艺做到顶、吃复利 | 慢热、错过窗口、闷亏 |
| SDBV | 长期主义者 | 耐得住寂寞,做难而正确的事 | 回报来得太慢、易被现实磨平 |
| SDLG | 深耕守成派 | 稳扎稳打,时间站你这边 | 天花板早、温水煮青蛙 |
| SDLV | 体制内手艺人 | 安静精进、有意义感 | 被结构限制、理想缩水 |
| SWBG | 稳健多面手 | 东方不亮西方亮、抗风险 | 不够聚焦、做不大 |
| SWBV | 自在生活家 | 生活丰富、自洽 | 难积累、世俗成就有限 |
| SWLG | 稳进多栖者 | 多份保障、稳 | 平庸感、缺少高光 |
| SWLV | 随遇而安者 | 松弛、随缘、知足 | 目标感弱、易随波逐流 |

**Signature color:** map each code to one of the existing path-color tokens (reuse `archetypes.ts` palette: coral/violet/sky/emerald/amber/…) so the card + (later) the tree branch share a color. Mapping rule: by `引擎×底色` quadrant (Build/Vision = coral 拓荒感, Lever/Gold = blue 稳健感, etc.). Exact map decided in the plan.

**现实可行度 on the card:** a coarse, deterministic estimate from the code itself (e.g. high-leap codes like `F_B_` → lower; 顺势 codes like `S_L G` → higher), reusing the spirit of `localGenerator.coarseFeasibility`. Always shown as "约 X%" + disclaimer. NOT a precise probability.

---

## 3. The quiz (the viral entry — pure, deterministic, no AI)

- **~10 scenario questions**, each a real life-choice dilemma (not 星座/birthdate). Each option carries weights toward one pole of one (sometimes two) axes.
- Examples (illustrative — full bank polished in the plan):
  - *"一份稳定 offer vs 一个没谱但你心动的机会,你选?"* → F/S
  - *"做事你更像:死磕一件事到底,还是多线一起押?"* → D/W
  - *"你更想:自己从零搭一个东西,还是进一个好平台往上爬?"* → B/L
  - *"你更怕哪种结局:碌碌无为没意义,还是不安稳没保障?"* → V/G
  - 每轴至少 2 题(交叉验证,降低单题噪声)。
- **Scoring (pure function, TDD):** tally each axis; majority pole → letter. Ties → a designated tiebreaker question per axis (so output is always deterministic, never random). Input = answer array; output = `{ code, axes:{tempo,focus,engine,drive} }`.
- **No AI, no network, no tree needed** → instant, free, offline-capable, scales to unlimited anonymous visitors. (This is what protects cost + speed on the viral path.)

---

## 4. The result + shareable card

- **Result page content:** code + 昵称 + 光 + 影 + 现实可行度(约X%+免责) + **一句"未来走向"预览**(templated per code — deterministic, instant, free — NOT the full AI prediction) + the two CTAs.
- **Shareable card (the artifact):** the mockup shown to the user — code chips, 昵称, 光/影, 约X%, "10 秒测你的 →", brand/url. **Image export** reuses the existing share/PNG infra (Phase 2a). Card must read well as a screenshot on 小红书/微信 (portrait-ish, high contrast, brand mark).
- **Future-teaser copy** lives with the type content (per-code template), e.g. FDBV → *"你大概率先摔两跤,5 年后才看到光——但那束光是你自己点的。"* Honest, no specific ages.

---

## 5. The funnel (acquisition core)

1. **Public, no-signup result URL:** `/t/[code]` (e.g. `/t/FDBV`). A stranger who opens a shared link sees the type + card immediately, with **"10 秒测你的 →"** (to `/test`). This is the chain-reaction loop.
2. **Quiz page:** `/test` — the 10 questions → compute code → redirect to `/t/[code]` with the user's result.
3. **Upsell into the moat:** on the result page, **"填完整资料 → 生成你真正的人生树"** → routes into the existing onboarding (`Onboarding` → real AI prediction). The code/axes can pre-seed onboarding (e.g. risk appetite) so it feels continuous.
4. **Compare (Phase 2):** "@朋友 看看你俩的路径合不合" — `/t/[code]` vs friend's code → a compatibility/contrast blurb. Comparison is MBTI's strongest viral driver; deferred to keep P1 small.

---

## 6. Honesty guardrails (the line we don't cross)

- Every type shows **光 AND 影** — no all-flattering types.
- Any percentage → **"AI 粗估,非精确概率 · 随你的真实努力上升"**.
- 未来走向 uses **"可能 / 大概率"**, never 预言/保证.
- Card explicitly frames it as **based on your real choices, not 玄学**.
- Free-text inputs (if any in onboarding upsell) still pass through `safety.ts` crisis detection.

---

## 7. Architecture (reuse-first, respects determinism + i18n rules)

**New pure-domain module — `packages/core/src/lifePathCode/`** (deterministic, TDD; no `Date.now`/`Math.random`/argless `new Date`):
- `axes.ts` — the 4 axes + 8 letters as typed constants.
- `questions.ts` — the question bank: each question = `{ id, prompt, options:[{ label, weights:{axis,pole}[] }] }`.
- `score.ts` — `scoreQuiz(answers): { code, axes }` pure function + tiebreakers.
- `types.ts` — the 16 type table: `{ code, nickname, light, shadow, feasibility, color, teaser }`. (Content lives here, one source of truth.)
- `index.ts` — exports + `typeByCode(code)`, `allTypes()`.
- All copy goes through nothing special server-side, but **user-facing strings still route through `t(...)`** in the React layer (additions-only in `src/i18n/messages.ts`).

**Web (Next, `src/`):**
- `src/app/test/page.tsx` — the quiz UI (client; uses the domain question bank + score).
- `src/app/t/[code]/page.tsx` — public result page (server-renderable for share/OG; reads `typeByCode`). Add OpenGraph/`generateMetadata` so a shared link unfurls with the type name + card image (important for 微信/小红书 link previews).
- Result card component `src/components/LifePathCard.tsx` — reuses tokens + the existing image-export util.
- Entry points to `/test`: a button on the landing/onboarding ("先 10 秒测你的人生路径码") and on the tree screen ("看看你是哪型").
- Upsell: result page "生成你真正的人生树" → existing onboarding, pre-seeding what the quiz already revealed.

**Reuse:** `archetypes.ts` palette + curve mapping; existing PNG/share export; existing onboarding + `/api/enrich` (unchanged — the deep path). **No new AI route for P1** (teaser is templated; real prediction is the existing enrich after upsell).

**Mobile:** out of scope for P1 (web is the shareable/acquisition surface). The domain module is shared, so mobile can add a `/test` screen later for free.

---

## 8. Data flow

```
stranger opens /t/FDBV (shared)  ──►  sees type + card  ──►  "测你的" ──► /test
/test: answer 10 Qs ──► scoreQuiz() [pure] ──► code ──► /t/[code]
/t/[code]: type content [pure] + templated teaser ──► card (image export, share)
            └─► "填完整 → 真树" ──► existing Onboarding ──► /api/enrich ──► life tree (moat)
```

No persistence needed for the viral path (code is in the URL). The real tree persists via the existing `lifeplanner.tree.v3` flow after upsell.

---

## 9. Scope / phasing

**P1 (this build — the funnel):**
- `lifePathCode` domain module (16 types content + question bank + scoring + tests).
- `/test` quiz + `/t/[code]` public result page + OG metadata.
- `LifePathCard` + image export.
- Entry buttons + upsell into onboarding (pre-seed risk appetite from axes).
- i18n: zh first; EN strings additive (can ship zh-only, gate EN).

**P2 (later):**
- Compare / couple mode.
- Mobile `/test` screen.
- Optional AI-personalized teaser (only if the templated one underperforms).
- Analytics on the funnel (test starts → completions → upsell clicks → onboards).

**Explicitly NOT doing:** 玄学/紫微/星盘; precise probabilities; all-flattering types.

---

## 10. Testing

- **Domain (vitest, TDD):** `scoreQuiz` determinism (same answers → same code; ties resolved, never random); every code in the 16-set has non-empty 光+影+teaser+color; `typeByCode` total coverage (all 16 reachable); feasibility within a sane band.
- **Web:** tsc + `next build`; manual: `/test` flow → `/t/[code]` renders + card image exports + OG tags present; upsell routes into onboarding.
- `/green` gate before commit.

---

## 11. Decisions (resolved 2026-06-29)

1. **16 types** — ship all 16 (full 4-letter code, true MBTI feel). Confirmed by user.
2. **Share domain** — use a single config constant `SHARE_DOMAIN` (in a small `src/lib/shareConfig.ts` or env `NEXT_PUBLIC_SHARE_DOMAIN`), defaulting to the current Vercel domain (`life-planer-opal.vercel.app`); swap to the real domain later with one change. Card + OG read from this constant.
3. **Language** — P1 zh-only; EN strings additive later.
4. **Compare / CP mode** — deferred to P2.
