# Task Plan — Life Planner (人生树 / decision + planning app)

## ▶ CURRENT — 2026-07-01 状态快照（承接一路优化 + 上云 + 上 TestFlight）
Branch `feat/goal-planning-mainline`, master fast-forwarded each commit. web 全绿（tsc 0 / 482 vitest / build ok）。full session log in `progress.md` (top entries), gotcha log in there too.

**刚完成（本轮）**
- **职场版 MBTI「人生路径码」病毒漏斗 P1**（网页端，已上线 Vercel）：纯域模块 `packages/core/src/lifePathCode/`（4轴8字母·16型·28题滑块·确定性算分）+ `/test` 测试页 + `/t/[code]` 公开结果页(OG) + 可晒卡 SVG + onboarding 一体化(测试答案喂进预测:riskAppetite + enrich 软性倾向行)。spec/plan: `docs/superpowers/*/2026-06-29-life-path-code-viral-test*`. 型文案已过 humanizer-zh。
- **网页优化 3 轮**：①手机触控目标 ≥40px(lp-tap)②error/global-error 边界 + 代码分割(next/dynamic)+ 加载态 ③预测提示词打磨(summary 不再和 nodes 矛盾 + 故事有内心戏)。
- **Web 云同步已接通**（memory `cloud-sync-status`）：Supabase 项目 `ucwgdgiymxfvuryzgevi` 建了 `trees` 表+RLS(via MCP)；Vercel 设了 `NEXT_PUBLIC_SUPABASE_*`(Prod+Preview)+ 重新部署 → 线上云同步开。
- **手机 build 17 → TestFlight**：修了 `runtimeVersion` fingerprint→appVersion(monorepo 指纹不一致导致 build 16 挂在 Configure expo-updates)。build 17 成功、auto-submit 已排，**首个带 OTA 的包** → 以后 JS 改动 `eas update` 秒推。

**待用户/待确认**
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
