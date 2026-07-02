# Task Plan — Life Planner (人生树 / decision + planning app)

## ▶ CURRENT — 2026-07-02 状态快照（过夜大改：任务统一 + 预测/AI 重做）
Branch `feat/goal-planning-mainline` @ `785c808`, master fast-forwarded + pushed. web 全绿（tsc 0 / 497 vitest / build ok）。mobile tsc 干净。full session log in `progress.md` (top entries), gotcha log in there too。**⚠️ 过夜改动只提交未部署——待用户晨间 TestFlight 验收后再 OTA/发 Vercel。**

**刚完成（过夜 2026-07-02，subagent-driven，13 任务 + 2 轮 code-review 全过）** —— spec/plan `docs/superpowers/*/2026-07-02-prediction-planning-overhaul*`
- **WS1 任务统一（两端 + 核心迁移，`13a5827`→`cbf1e34`）**：`Habit` 并入 `Task`（`repeat?`/`repeatWeekday?` 可选属性），删 `Habit` 类型 + `Goal.habits`/`LifeTree.habits`；`normalizeLoadedTree` 无损幂等迁移 legacy habits→重复 tasks；`daily.ts` 连续天数/热力图/今日项改读重复任务；两端所有消费点扫平；网页习惯页→「重复任务」视图。守住了 3 个不变量（迁移无损、重复任务按天完成走 activity、重复任务不计入 goalProgress——`ownUnits` 加 `t.repeat==null` 过滤）。code-review 通过。
- **WS3 可能性只在 AI 确认后显示（`5f4b4ff`）**：`LifePath.enriched` + core `isEnriched`（带 legacy 真 note 兜底）；两端仅在 enriched 时显示乐观/中性/保守占比；爬升数学不变。
- **WS4 情景原地切换（手机, `6578e69`）**：详情页乐观/中性/保守本地切换，去掉 `router.replace`，预取变体；odds/选路/计划/聊天绑基准路，曲线+时间线跟随所选情景。
- **WS2 去假兜底 + 重试（手机+规则, `3dd33cf`）**：`decomposePathIntoGoals` 不再塞 `localPathGoals`；加 `retryEnrich` + 「重试推演」按钮；`ai-and-secrets.md` 规则改为"内容类 AI 无假兜底、给重试态、已存预测离线可读、几何/数学本地"（注明 supersedes 旧规则）。
- **WS7 调度流（手机, `33e9b92`）**：月视图选未排任务→点某天派过去（`scheduleToDay`）；周视图点任务排时段；重复任务不进派天流。
- **WS6 AI 建议任务（手机, `5139f2e`）**：目标上「AI 建议任务」→ `/api/goal-actions` → 挂目标下任务；按目标级 in-flight；无假兜底。
- **WS5 推演动画（手机, `785c808`）**：全屏 `PredictingOverlay`（自绘分支曲线+呼吸原点，reduce-motion 静态兜底）替掉旧「AI 推演中…」占位。

**待用户/待确认（晨间）**
- **TestFlight 真机验过夜大改**（关开 App 两次拉 OTA，但 OTA 还没发！先看下方部署）：统一任务无每日/每周分栏 + 可设重复；目标建任务→月派天→周排时段；选路 enrich 有动画；乐观/中性/保守原地切换；完成任务乐观爬升；断网历史预测仍在、新预测给「重试推演」。
- **部署（用户确认后我来发）**：手机 `eas update --environment production`（`EXPO_PUBLIC_API_BASE_URL` 已注册进 EAS 环境，OTA 会带上后端 → 真 AI）；网页已随 master 推送、Vercel 自动构建。
- 前一轮预测闭环（`b43e8a60` 已 OTA）+ Supabase Auth URL 配置 + build 17 TestFlight，仍待验。

**刚完成（上一轮 2026-07-01 下午）**
- **信息架构去重（网页, `8f852d0`）**：老用户落地页 `dashboard`→**人生树**（AppContext hydrate）；日历屏瘦身（移除 TodayReminders + 内嵌未来预测小地图这两处重复，只留排期）。preview 实测落地/瘦身生效。
- **手机端合并双日历（`a927d97`）**：删掉「月历」Tab + MonthScreen，月网格折进「首页」日程（顶部周/月切换，都驱动 viewDate）；5 Tab→4（首页/目标/人生树/我）。
- **手机端「维持现状」末端可点（`cf21516`）**：status-quo 先渲染→末端命中区被后画的彩色路命中层盖住→点不动。把所有终点命中区（圆点+文字）统一提到最上层。
- **手机端预测闭环 = 选路→定路→拆计划→乐观爬升（spec/plan `docs/superpowers/*/2026-07-01-mobile-prediction-loop*`, subagent-driven）**：core 加 `chosenPathId` + `choosePath/clearChosenPath/chosenPath` + `localPathGoals` 兜底（TDD）；store 选路/清路 + `addLongGoal` 挂 `pathId` + `decomposePathIntoGoals`（复用 /api/goals，离线本地兜底，按标题去重）；详情页**驾驶舱**（选这条路 + 三情景爬升条 + 计划）；树加「✓ 正在走」。**修好的根因**：手机端目标从不填 pathId → pathProgress 恒 0 → 乐观占比冻死；现在完成挂路目标的任务 → 有效可行度涨 → 乐观爬升。**已 OTA 到 production（iOS, runtime 1.0.0, `b43e8a60`）**。

**待用户/待确认**
- **TestFlight 真机验预测闭环**（关开 App 两次拉 OTA）：选路→✓+AI 拆出目标→完成任务→乐观爬升条变高。
- Supabase 后台 Auth → URL Configuration 设 Site URL + Redirect URLs（GoTrue 配置,无 MCP/API,只能用户点）→ 然后首登实测云同步(未对过真 Supabase)。
- 确认 build 17 在 TestFlight 处理完(Apple 侧 ~5–15min)。

护栏：core 纯净(无 Date.now/Math.random)；web 全绿；中文串规范(无 ASCII 引号)；无 emoji；苹果白。

---

## Goal
A life-planning web app whose centerpiece is an animated branching prediction tree ("人生树") + talk-to-future-self, wrapped in a Griply-style planner (calendar, goals, habits, life areas, insights, inbox). Prediction is the motivation engine, not fortune-telling. Build to small-circle-validation quality.

## Current status (2026-06-21)
- Branch `feat/goal-planning-mainline` @ `807050f` — **NOT merged to main**. 342 tests green, tsc + next build clean.
- Phase 13 (nested goal architecture) DONE + reviewed (3 CRITICAL migration data-loss bugs fixed + invariant test). Inbox removed + AI-拆解目标 shipped earlier.
- Phase 14 (A/B/C) DONE + adversarially reviewed: (A) grouped sidebar + To-Do views + favorites + 其他 area; (B) multi-day horizontal Upcoming timeline (drag+tap); (C) Choice panel (compare→推演分支→decide→goal). Review found 1 HIGH (predict-commit clobbered concurrent edits) — fixed. Awaiting user morning verification.
- Dev server: run detached `Start-Process cmd /c "npm run dev"` (harness background tasks get reaped) or the user runs `npm run dev` in their own terminal. localhost:3000.

## Phases
| # | Phase | Status |
|---|-------|--------|
| 1 | MVP: tree + onboarding + path detail (forward half) | complete |
| 2 | Prediction PRD: grounded/dense/multi-dim, scenarios, future-self chat, recursive map | complete |
| 3 | Decision loop: 看见→追问→选定→落地→复盘 (decisions/plan/review) | complete |
| 4 | Goal mainline: goals = branches; single-line start; /api/goals + goal-actions | complete |
| 5 | v2 motivation loop: dashboard, today plan, recurring actions, streak/heatmap, marker | complete |
| 6 | Overnight hardening: content-safety guardrail, i18n audit, enrich prompt rigor, share-SVG, weekly review, convo tuning, assistant goals, Supabase skeleton | complete |
| 7 | Calendar home: month calendar (drag + tap), split view | complete |
| 8 | Griply IA: sidebar shell + Habits/Life-Areas/Insights sections + de-dup + visual polish | complete |
| 9 | Griply gap functions: Inbox, goal deadlines, tags | complete |
| 10 | First-run guide: 「上手 3 步」card (add goal → schedule → complete; auto-checks; dismissible) — for "简单好上手 + 用户引导" | complete |
| 11 | Calendar upgrade: year/month/day views + day-view time blocks (startTime+duration) + 「AI 帮我排今天」(AI + local fallback arranger) — fixes "事情堆一天太乱" | complete |
| 12 | Task bugs: delete-action affordance + fix accidental completion (only the checkbox toggles, not the whole row) | complete |
| 13 | Nested goal architecture (FROM-SCRATCH rewrite): Goal(time range) ⊃ Subgoal ⊃ {Metric/Task/Habit}; lossless id-preserving migration; nested PlanScreen CRUD; per-goal metrics drive progress. 6 sub-phases + review-fix pass. | complete |
| 14 | A/B/C: (A) grouped sidebar + To-Do views (今天/全部/已完成/标签) + favorites + 其他领域(neutral); (B) multi-day horizontal Upcoming timeline (drag+tap); (C) Choice panel (options compare → 推演分支 → decide→goal). Spec+plan 2026-06-21. 8 phases + review-fix. | complete |
| 15 | UI re-skin: Apple-white minimal theme + app-wide emoji→line icons + edit-button to goal top-left + 待安排 vertical + new-goal-not-instantly-due fix. | complete |
| 16 | Two-tier goals (long/short): Goal.kind+parentGoalId, drop Subgoal (→short goals), 3-state lossless migration; long-only branch; progress roll-up; habit bound to goal endDate. + loose goal-less tasks/habits + standalone shorts + create-in-calendar + unified 建立目标(long/short). | complete |
| 17 | Six core-gap overnight fixes: P1 quick-capture+NL parse (`70324b0`), P2 AI plan-short-in-window (`27b6242`), P3 reminders+notifications+SW/PWA (`8adfe9d`), P4 ICS calendar import read-only (`7e63ddd`), P5 Supabase sync+auth behind flag — off by default (`a7e6b81`). 447 tests green. See docs/MORNING-2026-06-23.md. | complete |
| 18 | Route A (方向/决策+预测): prediction believability v2 (nationality + field/country anchors, eval-verified `bf5783a`); feasibility % per choice path (`2070201`); dynamic feasibility = AI baseline + progress bump (`01d6ed0`); instant feedback toast (`c52ed63`); AI option analysis + side-by-side futures (`8cefbc0`). 464 tests green. | complete |
| 19 | Expo/RN migration (Next-as-API, mobile/ app, shared pure src/domain). Plan docs/superpowers/plans/2026-06-23-expo-migration.md. Phase 1 scaffold + domain pipeline done (`78d2a34`, .shared junction for Windows Metro). Phases 2+ (state→AsyncStorage, screen-by-screen RN rebuild, Supabase auth, deploy+EAS) pending — multi-week. | in_progress |
| 20 | Web optimization (3 rounds): mobile touch targets ≥40px (lp-tap util); error.tsx + global-error.tsx + next/dynamic code-split + loaders; prediction-prompt polish (summary-vs-nodes consistency + interiority). All /green. | complete |
| 21 | 职场版 MBTI「人生路径码」viral funnel P1: pure-domain lifePathCode (16 types + 28-statement slider + deterministic scoring) + /test + /t/[code] (OG) + share card + onboarding integration (answers → riskAppetite + enrich soft line). humanized copy. spec/plan 2026-06-29. | complete |
| 22 | Cloud sync turned ON (web): Supabase `trees` table + RLS (via MCP) on project ucwgdgiymxfvuryzgevi; NEXT_PUBLIC_SUPABASE_* on Vercel + redeploy. Only Auth URL-config (user, dashboard) + first real login test remain. | complete |
| 23 | Mobile build 17 → TestFlight: runtimeVersion fingerprint→appVersion fix (monorepo mismatch killed build 16); build 17 succeeded + auto-submit; first TestFlight build WITH OTA embedded. | complete |
| 24 | Web IA de-dup: returning users land on 人生树 (not the dashboard); calendar slimmed (drop TodayReminders + embedded prediction mini-map). `8f852d0`. | complete |
| 25 | Mobile parity + prediction loop (subagent-driven, OTA'd): merge 月历→首页 (week/month toggle, 5→4 tabs, `a927d97`); fix status-quo endpoint tap via top hit-layer (`cf21516`); prediction loop = choosePath(commit) + AI-decompose to path-linked goals + 3-scenario climb bars in a detail "cockpit" + ✓ marker. core TDD (`chosenPathId`, `localPathGoals`). spec/plan 2026-07-01. `af0b3cc`→`1ebb790`. | complete |
| 26 | Task unification (both platforms + core migration, subagent-driven): merge `Habit` into `Task` (`repeat?` attribute); remove `Habit` type + `Goal/LifeTree.habits`; idempotent lossless `normalizeLoadedTree` migration; `daily.ts` from repeating tasks; sweep core/web/mobile green; HabitsSection→重复任务. Invariants held (migration, per-day completion, goalProgress exclusion). code-reviewed. `13a5827`→`cbf1e34`. | complete (not deployed) |
| 27 | Prediction+planning overhaul (subagent-driven, WS2–WS7): AI-only possibility shown after `enriched` + progress climb kept (`5f4b4ff`); in-place scenario toggle no-nav (`6578e69`); drop fabricated fallbacks + `retryEnrich`/「重试推演」 + rule update (`3dd33cf`); month=day/week=time schedule flow (`33e9b92`); AI-suggested tasks per goal (`5139f2e`); predicting animation overlay (`785c808`). spec/plan 2026-07-02. code-reviewed. **Awaiting user TestFlight verify before OTA/deploy.** | complete (not deployed) |
| — | Supabase cloud sync (mobile): NOT built — AsyncStorage only (sync-ready jsonb shape). Needs Supabase client + auth screen (email OTP) + sync wiring in mobile/src/state/store.tsx. | pending |

## Needs the user (morning of 2026-06-23) — code ready, see docs/MORNING-2026-06-23.md
- **Enable Supabase cloud sync**: create project + run schema SQL (docs/supabase-setup.md) + add NEXT_PUBLIC_SUPABASE_URL/ANON_KEY to .env.local. Cloud path UNTESTED against real Supabase — verify login + cross-device. Flag off = unchanged local app.
- **True background Web Push** (notify when app closed): needs VAPID keys + backend push + SW push/notificationclick handler. Tonight's reminders only fire while app is open.
- **Google/Outlook 2-way calendar**: needs OAuth creds + backend token mgmt. Tonight shipped read-only ICS import as the no-OAuth substitute.
- **Route decision A (direction/decision tool) vs B (daily planner)** still open — tonight's geo-base serves both.

## Backlog (next steps — not blocking; user-driven or optional)
- **Career-MBTI P2** (spec §9): compare/CP mode ("你俩路径合不合"); pre-seed "最可能的路" branch after onboarding (§5.3); mobile `/test` screen; AI-personalized teaser; funnel analytics; optional richer share-card visual (user preferred the plain card for now).
- **Cloud sync finish**: user sets Supabase Auth Site URL + Redirect URLs → then verify first real magic-link login + cross-device pull (untested vs real Supabase). Then optionally build mobile cloud sync (email OTP).
- **Real custom domain** later → set `NEXT_PUBLIC_SHARE_DOMAIN` (card + OG currently show the Vercel domain).
- **Verify on real machine** (esp. calendar drag + mobile) then **merge `feat/goal-planning-mainline` → main** (big branch: all the above).
- Deferred refinements: Supabase async wiring (AppContext) + auth UI; fold AI "suggest today" into calendar home; per-habit on the calendar grid; `nationality` field + structured-anchor validation for prediction realism; richer local-archetype fallback text; PNG export (currently SVG only). (DashboardScreen.tsx deleted in Phase 13.)
- Phase 13 follow-ups (non-blocking): degenerate 作息 window (睡觉<起床) guard; per-occurrence habit times (habit startTime is a global daily time); a recurring habit re-timed by AI-arrange affects all days.
- Phase 14 follow-ups (LOW, non-blocking, from review): (1) openPlanFocused to a goal hidden by the active tag filter never clears focusGoalId / never scrolls — clear filter or timeout. (2) goalTree.addGoal id = hashSeed(title|now) could collide for two identical-label decides in the same ms — add an index salt like addOption/createChoice. (3) optional AI-analyze for ChoicePanel (/api/analyze-choice) was intentionally cut — easy add later.
- Honest open risks: prediction-quality gain needs a DeepSeek key to measure; crisis detector is conservative (verify hotline numbers before public launch); broad a11y/empty-state/perf sweep was scoped to touched areas only.

## Hard constraints (project rules)
- Domain layer (`src/domain/*`) pure: no Date.now/Math.random; time injected. Render: no `new Date()` (module boot + effect).
- Chinese strings: never ASCII double quotes inside Chinese text. New UI strings get EN in `src/i18n/messages.ts`.
- AI routes need `.env.local` DEEPSEEK_API_KEY (gitignored, server-only) + offline fallback + rate limit. Dark theme only.
- Do NOT pixel-clone Griply's proprietary UI (IP) — build equivalent functionality + IA in our own design.
- Commit only when asked (autonomous /goal runs commit per task). Co-Authored-By trailer.
