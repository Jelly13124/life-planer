# P4 Monetization + P5 iOS Widget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. SEQUENTIAL tasks (shared files). Tasks 0/6 are CONTROLLER-run. **OTA FREEZE: from Task 4 onward (react-native-purchases lands), NO `eas update` to production (runtime 1.0.0). Everything ships via the 1.1.0 EAS build.**

**Goal:** Freemium subscription (AI-op quota 20/月 free, Pro unlimited via RevenueCat ¥68/yr 7-day-trial + ¥12/mo) + Apple-required web /privacy /terms + iOS home-screen widget (streak + today + chosen-path feasibility).

**Architecture:** Quota = pure core (`aiOps` on LifeTree, syncs via P1). Entitlement = RevenueCat SDK (native). Paywall/Pro UI mobile-only. Widget = @bacons/apple-targets SwiftUI target reading an App-Group JSON snapshot written from the store.

**Spec:** `docs/superpowers/specs/2026-07-03-p45-monetization-widget-design.md`

**Gates:** core/web tasks → `/green`; mobile tasks → `cd mobile && npx tsc --noEmit`. Commit per task.

---

### Task 0 (CONTROLLER): handoff + env
- [ ] Give the user the prerequisite checklist (ASC paid agreement/banking, RevenueCat account + iOS app `com.jelly13124.lifeplanner` → send back `appl_…` public key, ASC subscriptions `lp_pro_annual` ¥68/yr + 7-day trial & `lp_pro_monthly` ¥12/mo, RC entitlement `pro` offering `default`).
- [ ] When the key arrives: `eas env:create --environment production --environment preview --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value <key> --visibility plaintext`.

### Task 1: core AI quota (TDD)
**Files:** `packages/core/src/types.ts` (+`aiOps?: { month: string; used: number }` on LifeTree), `packages/core/src/aiQuota.ts` (new), `packages/core/src/__tests__/aiQuota.test.ts` (new).
- [ ] Tests first (fixture style from `chosenPath.test.ts`): used=0 when no aiOps / month mismatch; `consumeAiOp` increments same-month, resets+1 on rollover; `aiOpsLeft` floors at 0; `canUseAi` true when isPro regardless, true when left>0, false when exhausted && !isPro. Run red.
- [ ] Implement:
```ts
import type { LifeTree } from "./types";
export const FREE_AI_OPS_PER_MONTH = 20;
const monthOf = (today: string): string => today.slice(0, 7);
export function aiOpsUsed(tree: LifeTree, today: string): number {
  const a = tree.aiOps;
  return a && a.month === monthOf(today) ? a.used : 0;
}
export function aiOpsLeft(tree: LifeTree, today: string): number {
  return Math.max(0, FREE_AI_OPS_PER_MONTH - aiOpsUsed(tree, today));
}
export function canUseAi(tree: LifeTree, today: string, isPro: boolean): boolean {
  return isPro || aiOpsLeft(tree, today) > 0;
}
export function consumeAiOp(tree: LifeTree, today: string): LifeTree {
  const month = monthOf(today);
  return { ...tree, aiOps: { month, used: aiOpsUsed(tree, today) + 1 } };
}
```
- [ ] Green + `/green` full gate. Commit `feat(P4/core): AI op quota — aiOps month bucket, consume/left/canUse (TDD)`.

### Task 2: web /privacy + /terms
**Files:** `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` (new, server components, static text zh-first + short EN section, Apple-white styling like other static pages; contact email ruizheyuan3487@gmail.com; terms: auto-renew subscription language, refunds via Apple, AI 内容为可能性非预测 disclaimer; privacy: local + Supabase sync storage, AI calls via our backend, no data sale).
- [ ] `/green`. Commit `feat(P4/web): /privacy + /terms static pages (App Store requirement)`.

### Task 3: store quota wiring (pure JS — still OTA-safe, but hold OTAs anyway)
**Files:** `mobile/src/state/store.tsx`, `mobile/app/chat/[pathId].tsx` (message send site if it calls API directly).
- [ ] Store: `isPro` state (default false; setter exposed for Task 4), `paywallOpen` state + `openPaywall()/closePaywall()`. Helper inside store:
```ts
// 计数一个 AI 点；额度不足且非 Pro → 打开 Paywall 并返回 false（调用方直接 return）。
const spendAiOp = (): boolean => {
  const cur = treeRef.current; if (!cur) return false;
  const t = todayStr();
  if (!canUseAi(cur, t, isProRef.current)) { setPaywallOpen(true); return false; }
  if (!isProRef.current) commit(consumeAiOp(cur, t));
  return true;
};
```
(`isProRef` mirrors `isPro`.) Free/not-counted per spec: status-quo enrich (onboard + retryEnrich on status-quo), first likely enrich (`addChoiceBranch`/`addChoiceBranchAt` auto-enrich, retryEnrich when `!isEnriched(path)` && `path.scenario==="likely"`). Counted call sites — guard each with `if (!spendAiOp()) return;`: `addScenario`'s enrich branch (non-likely variant), `retryEnrich` when path already enriched OR non-likely scenario, `decomposePathIntoGoals`, `suggestGoals`, `suggestTasksForGoal`, and the chat send path (find where chat messages POST — `mobile/app/chat/[pathId].tsx` uses an api fn; gate per user message; chat screen needs `openPaywall` access via useApp). Expose `aiOpsLeftToday: aiOpsLeft(tree, today)` (name it `aiQuotaLeft`), `isPro`, `paywallOpen`, `openPaywall`, `closePaywall` on AppValue + deps.
- [ ] Gate mobile tsc. Commit `feat(P4/mobile): AI quota enforcement — free ops preserved, counted ops gated, paywall trigger`.

### Task 4: RevenueCat lib + Paywall + Me Pro card (**NATIVE — OTA freeze from here**)
**Files:** `mobile/package.json` (`npx expo install react-native-purchases`), `mobile/src/lib/purchases.ts` (new), `mobile/src/components/PaywallSheet.tsx` (new), `mobile/src/state/store.tsx` (init + listener → setIsPro), `mobile/src/screens/MeScreen.tsx` (Pro card).
- [ ] `purchases.ts`: guard-everything wrapper —
```ts
import { Platform } from "react-native";
const KEY = (process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "").trim();
export function purchasesAvailable(): boolean { return Platform.OS === "ios" && KEY.length > 0; }
```
`initPurchases(onProChange: (isPro: boolean) => void)`: dynamic `import("react-native-purchases")`, `Purchases.configure({ apiKey: KEY })`, read initial `customerInfo.entitlements.active["pro"]`, `addCustomerInfoUpdateListener` → onProChange. `getPackages()` (offering `default` → packages), `purchase(pkg)` / `restore()` returning `{ isPro, error?: string }` with user-cancel detected (not an error). All functions no-op/false when `!purchasesAvailable()`.
- [ ] Store: call `initPurchases(setIsPro)` in the boot effect (fire-and-forget, guarded).
- [ ] `PaywallSheet.tsx` (Modal, gets `visible/onClose` props, uses useApp for quota display): benefits list (无限 AI 推演·三种走向·AI 拆解与建议任务·未来自我畅聊), package rows from `getPackages()` (annual highlighted, 「7 天免费试用」 badge, localized priceString from RC), buy button per row, 恢复购买 link, footer links 服务条款/隐私政策 → `Linking.openURL("https://life-planer-opal.vercel.app/terms" | "/privacy")`, honest footnote 「免费额度每月自动重置，不订阅也能一直用」. When `!purchasesAvailable()`: show 「购买暂未开放，敬请期待」+ close. Render `<PaywallSheet visible={paywallOpen} onClose={closePaywall} />` once at root (`mobile/app/_layout.tsx` inside providers) so any screen can trigger it.
- [ ] MeScreen Pro card: 免费 → 「本月 AI 额度剩 {aiQuotaLeft}/20」+ 「升级 Pro」(openPaywall); Pro → 「Pro 会员」+ 管理订阅 (`Linking.openURL("https://apps.apple.com/account/subscriptions")`) + 恢复购买.
- [ ] Gate mobile tsc. Commit `feat(P4/mobile): RevenueCat purchases lib + paywall sheet + Me Pro card (native — requires 1.1.0 build)`.

### Task 5: iOS widget (@bacons/apple-targets)
**Files:** `mobile/package.json` (`npx expo install @bacons/apple-targets`), `mobile/app.json` (plugin + `ios.entitlements` App Group `group.com.jelly13124.lifeplanner` + appleTeamId if required by plugin config), `mobile/targets/widget/*` (new: `expo-target.config.js`, `Widget.swift`, `Info.plist` per plugin docs — READ `node_modules/@bacons/apple-targets/README.md` first and follow its current API exactly), `mobile/src/lib/widgetSnapshot.ts` (new), `mobile/src/state/store.tsx` (write snapshot in the commit debounce).
- [ ] `widgetSnapshot.ts`: `ExtensionStorage` from the plugin — `new ExtensionStorage("group.com.jelly13124.lifeplanner")`, `writeWidgetSnapshot(tree, today)` → `storage.set("widgetSnapshot", JSON.stringify({ streak, todayCount, chosenLabel, chosenFeasibility, updatedAt }))` + `ExtensionStorage.reloadWidget()`. Derive: `streak = currentStreakWithFreeze`, `todayCount = todayItems(tree, today).length`, chosen = tree.chosenPathId path (`choiceLabel`, `effectiveFeasibility(...)?.value`). Wrap in try/catch (module absent in Expo Go → silent no-op via lazy require, mirror `notifications.ts` pattern).
- [ ] Store: call `writeWidgetSnapshot(next, todayStr())` inside the existing commit debounce callback (after digest sync).
- [ ] `Widget.swift`: TimelineProvider reading `UserDefaults(suiteName: "group.com.jelly13124.lifeplanner")?.string(forKey: "widgetSnapshot")`, JSON-decode, small view (flame SF Symbol + 「连续 N 天」 + 「今日 N 个任务」), medium adds chosenLabel + a feasibility ProgressView. Placeholder/snapshot entries for gallery. Apple-white bg, black text, violet accent (#6D28D9-ish). `.widgetURL(URL(string: "lifeplanner://"))`.
- [ ] Gate mobile tsc (Swift compiles only at EAS build — acknowledge; keep Swift minimal/std-lib only). Commit `feat(P5/mobile): iOS home widget — streak/today/chosen-path via App Group snapshot`.
- [ ] CONTINGENCY: if plugin config fights EAS at Task 6, revert ONLY this task's commits and ship the build without the widget.

### Task 6 (CONTROLLER): version bump + build + submit
- [ ] `npx expo install --check` (fix any mismatches). Bump `mobile/app.json` version → `1.1.0`. Commit.
- [ ] BLOCKED-ON-USER check: RC key in EAS env; ASC agreement + products created.
- [ ] `eas build --platform ios --profile production --auto-submit` (env inlined like OTAs). Monitor; on widget-related failure → execute Task 5 contingency and rebuild.
- [ ] Post-build: TestFlight sandbox purchase test instructions to user; resume OTAs targeting runtime 1.1.0 only. Update task_plan/progress; push master.

## Self-Review
- Spec coverage: quota rules/field → T1+T3 (free sites enumerated = spec's not-counted list); RC products/entitlement/paywall compliance (restore + terms/privacy links) → T4+T2; widget snapshot contract key `widgetSnapshot` + App Group id consistent T5 JS/Swift; OTA freeze + 1.1.0 + install --check → header + T6; contingency → T5/T6. ✓
- Placeholders: linchpin code (quota, spendAiOp, purchases API surface, snapshot fields) concrete; UI structural per established pattern; Swift described to field level. plugin API deliberately deferred to its README (it changes — reading current docs IS the instruction). ✓
- Types: `aiOps` shape/`aiQuotaLeft`/`isPro`/`paywallOpen` names consistent across T1/T3/T4; snapshot fields identical in T5 JS+Swift. ✓
