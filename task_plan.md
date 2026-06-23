# Task Plan — Life Planner (人生树 / decision + planning app)

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
| — | BLOCKED ON USER: Supabase cloud sync — user reconnecting Supabase MCP to a NEW account (current MCP is global/shared, authed to a different account). Then I create 「life-planner」(Tokyo) + schema + give env lines. Code ready behind flag. | pending |

## Needs the user (morning of 2026-06-23) — code ready, see docs/MORNING-2026-06-23.md
- **Enable Supabase cloud sync**: create project + run schema SQL (docs/supabase-setup.md) + add NEXT_PUBLIC_SUPABASE_URL/ANON_KEY to .env.local. Cloud path UNTESTED against real Supabase — verify login + cross-device. Flag off = unchanged local app.
- **True background Web Push** (notify when app closed): needs VAPID keys + backend push + SW push/notificationclick handler. Tonight's reminders only fire while app is open.
- **Google/Outlook 2-way calendar**: needs OAuth creds + backend token mgmt. Tonight shipped read-only ICS import as the no-OAuth substitute.
- **Route decision A (direction/decision tool) vs B (daily planner)** still open — tonight's geo-base serves both.

## Backlog (next steps — not blocking; user-driven or optional)
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
