# P1 Cloud Sync + P2 Retention + P3 Share Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execute tasks SEQUENTIALLY (they share `mobile/src/state/store.tsx` and `MeScreen`). Task 0 and deploy steps are CONTROLLER-run (need EAS creds / user coordination). Steps use checkbox (`- [ ]`).

**Goal:** Mobile Supabase login (skippable, email OTP) + cross-device tree sync (updatedAt-newest-wins), streak freezes + streak UI + daily push, and shareable link-cards that funnel viewers back to the web app.

**Architecture:** Mobile mirrors the web's proven Supabase wiring (`CloudStore` adapter → core `SupabaseRepository`; debounced cloud save; cloud-vs-local resolution at login). Streak freeze is a pure-core extension (`freezeDays` + `currentStreakWithFreeze`). Share = insert sanitized payload into a public-readable `shares` table → share a URL to a new web card page `/s/[id]` with OG meta.

**Tech Stack:** `@supabase/supabase-js` (pure JS — OTA-safe), AsyncStorage, expo-notifications (existing lib), Next 16 (`/s/[id]` + `next/og`), vitest TDD for core.

**Spec:** `docs/superpowers/specs/2026-07-03-p123-sync-retention-share-design.md`

**Gates:** mobile = `cd mobile && npx tsc --noEmit`. Core/web touched (Tasks 4, 6) = `/green`. Commit per task. Deploys at phase ends (controller).

---

### Task 0 (CONTROLLER): env plumbing + user actions
- [ ] Extract the Supabase anon key from the deployed web bundle (`https://life-planer-opal.vercel.app` — NEXT_PUBLIC vars are inlined; grep the JS chunks for `eyJ` JWT near `ucwgdgiymxfvuryzgevi.supabase.co`). It's the public RLS-protected key.
- [ ] `eas env:create` `EXPO_PUBLIC_SUPABASE_URL=https://ucwgdgiymxfvuryzgevi.supabase.co` + `EXPO_PUBLIC_SUPABASE_ANON_KEY=<key>` on production+preview.
- [ ] Tell the user: Supabase Dashboard → Auth → Email Templates → Magic Link → ensure body contains `{{ .Token }}` (6-digit OTP). P3 later: run the `shares` SQL (Task 6 below).

### Task 1 (P1): mobile supabase client lib
**Files:** Create `mobile/src/lib/supabase.ts`; modify `mobile/package.json` (deps).
- [ ] In `mobile/`: `npm install @supabase/supabase-js react-native-url-polyfill` (both pure JS).
- [ ] Create `mobile/src/lib/supabase.ts` mirroring web `src/lib/supabaseClient.ts`:
```ts
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LifeTree } from "@lifeplanner/core/types";
import type { CloudStore } from "@lifeplanner/core/repository/supabaseRepo";

const URL_ = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const ANON = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export function isCloudEnabled(): boolean { return URL_.length > 0 && ANON.length > 0; }

let cached: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  if (!isCloudEnabled()) return null;
  cached = createClient(URL_, ANON, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return cached;
}
export async function getCurrentUserId(): Promise<string | null> {
  const sb = getSupabase(); if (!sb) return null;
  try { const { data, error } = await sb.auth.getUser(); if (error) return null; return data.user?.id ?? null; } catch { return null; }
}
export function getCloudStore(): CloudStore | null {
  const sb = getSupabase(); if (!sb) return null;
  return {
    async getTree(userId) {
      const { data, error } = await sb.from("trees").select("data").eq("user_id", userId).maybeSingle();
      if (error) throw error; return data?.data ?? null;
    },
    async putTree(userId, tree: LifeTree) {
      const { error } = await sb.from("trees").upsert({ user_id: userId, data: tree, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
    async deleteTree(userId) {
      const { error } = await sb.from("trees").delete().eq("user_id", userId); if (error) throw error;
    },
  };
}
// OTP 登录流：发码 → 验码。均返回 error message 或 null。
export async function sendOtp(email: string): Promise<string | null> {
  const sb = getSupabase(); if (!sb) return "云同步未配置";
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return error ? error.message : null;
}
export async function verifyOtp(email: string, token: string): Promise<string | null> {
  const sb = getSupabase(); if (!sb) return "云同步未配置";
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  return error ? error.message : null;
}
export async function signOut(): Promise<void> { const sb = getSupabase(); if (sb) await sb.auth.signOut(); }
```
- [ ] Gate `cd mobile && npx tsc --noEmit`; commit `feat(P1/mobile): supabase client lib (OTP auth + CloudStore adapter)`.

### Task 2 (P1): store sync wiring
**Files:** Modify `mobile/src/state/store.tsx`, `mobile/src/lib/storage.ts` (backup key helper).
- [ ] `storage.ts`: add `backupTree(tree)` writing JSON to key `lifeplanner.tree.backup` (fire-and-forget) — used before a cloud tree overwrites local.
- [ ] `store.tsx`: add state `cloudUserId: string | null` + `syncState: "off"|"synced"|"error"` + `lastSyncAt: string | null`. On mount (after local load): `getCurrentUserId()` → if logged in run `resolveCloud()`.
- [ ] `resolveCloud()` (in store): build `new SupabaseRepository(getCloudStore()!, uid)`; `const cloudTree = await repo.load()`; compare with `treeRef.current`:
  - both exist → `Date.parse(updatedAt)` newer wins; if cloud wins: `backupTree(local)` then `setTree(cloud)+saveTree(cloud)`; if local wins (or tie): `repo.save(local)`.
  - only cloud → adopt cloud; only local → `repo.save(local)`; neither → nothing.
  - set `syncState/lastSyncAt`; all errors → `syncState:"error"`, keep local.
- [ ] `commit()`: after local save, if `cloudUserId` — debounce 800ms `repo.save(next)` (mirror web; reuse one timer ref; swallow errors → `syncState:"error"`, success → `"synced"`+timestamp).
- [ ] Actions: `loginWithOtp(email, token)` (verify → set `cloudUserId` → `resolveCloud()`), `sendLoginCode(email)`, `logout()` (signOut → `cloudUserId=null`, `syncState:"off"`, local untouched), extend `reset()` to also `repo.clear()` when logged in. Expose all + `syncState/lastSyncAt/cloudUserId` on `AppValue` (+ memo deps).
- [ ] Gate mobile tsc; commit `feat(P1/mobile): cloud sync wiring — updatedAt-newest-wins, debounced save, backup before overwrite`.

### Task 3 (P1): MeScreen login UI
**Files:** Modify `mobile/src/screens/MeScreen.tsx`.
- [ ] Read the screen; add a 云同步 card: logged-out → email `Input` + 「发送验证码」→ 6-digit `Input` + 「登录」(errors inline; disabled while pending); logged-in → email + 「已同步 <time>」/「同步失败·重试」(retry = `resolveCloud`) + 「退出登录」. If `!isCloudEnabled()` show muted 「云同步未配置」. Follow existing card/Input/Button patterns; no emoji.
- [ ] Gate mobile tsc; commit `feat(P1/mobile): MeScreen 云同步 login card (email OTP)`. **[Phase P1 end — controller OTAs with the two new env vars inlined + registered]**

### Task 4 (P2): core streak freeze (TDD)
**Files:** Create `packages/core/src/streak.ts` + `packages/core/src/__tests__/streak.test.ts`; modify `packages/core/src/types.ts` (`freezeDays?: string[]` on LifeTree), `repository/normalize.ts` (backfill `[]`).
- [ ] Types + normalize backfill (optional field, no migration).
- [ ] TDD `streak.ts`: `FREE_FREEZES_PER_MONTH = 2`; `freezesUsedInMonth(tree, month /*YYYY-MM*/)`; `freezesLeft(tree, today)`; `currentStreakWithFreeze(tree, today)` — same walk as `daily.currentStreak` but a day counts if `completedOn>0` OR in `freezeDays`; `applyAutoFreeze(tree, today)` → `{ tree, frozen: string[] }` — walk back from yesterday, for up to 2 consecutive zero-completion days that would break an otherwise-alive streak (i.e. a completed or frozen day lies beyond the gap), consume available freezes for the gap days (skip days already frozen; stop when freezes run out or gap exceeds 2). Pure, deterministic, no Date.now. Tests: freeze preserves streak across a 1-day gap; monthly cap of 2; no-op when gap > freezes left; idempotent re-run; month rollover resets allowance.
- [ ] Gate `/green` (core touched); commit `feat(P2/core): streak freezes — freezeDays, currentStreakWithFreeze, applyAutoFreeze (TDD)`.

### Task 5 (P2): mobile streak UI + auto-freeze + daily push
**Files:** Modify `mobile/src/state/store.tsx`, `mobile/src/screens/TreeScreen.tsx`, `mobile/src/lib/notifications.ts`, `mobile/src/screens/MeScreen.tsx`.
- [ ] store: on mount + foreground (`AppState` active), run `applyAutoFreeze(tree, today)`; if `frozen.length` commit + nudge 「补签卡帮你保住了连击」. Expose `streak` via `currentStreakWithFreeze` (replace the `currentStreak` read) + `freezesLeft`.
- [ ] TreeScreen: streak bar under the h1 — flame line-icon (`fire` MaterialCommunityIcons) + 「连续 N 天」+ freeze chips (剩 X 张补签); first completion of the day already triggers nudges elsewhere — add a lightweight scale-pulse on the streak number when it increments (Animated; respect `useReduceMotion`).
- [ ] notifications.ts: add `scheduleDailyDigest(tree, enabled)` — cancel-tagged daily repeating local notification at 09:00 (or `dayWindow.start`+2h) with body 「今天 N 个任务在等你 · 连击 M 天」 (N=0 → 「给未来的自己留 10 分钟」). Wire into `syncNotifications` or call alongside it from store. MeScreen: 「每日提醒」 toggle (persist in tree as optional `dailyDigest?: boolean`, default on; normalize backfill).
- [ ] Gate mobile tsc (+ `/green` if types.ts touched for `dailyDigest`); commit `feat(P2/mobile): streak bar + auto-freeze + daily digest push`. **[Phase P2 end — controller OTAs]**

### Task 6 (P3): web share page `/s/[id]` + OG
**Files:** Create `src/app/s/[id]/page.tsx` + `src/app/s/[id]/opengraph-image.tsx`; modify `src/lib/supabaseClient.ts` (add `getShare(id)` fetch via anon).
- [ ] **USER ACTION (controller relays):** run in Supabase SQL Editor:
```sql
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.shares enable row level security;
create policy "shares_public_read" on public.shares for select using (true);
create policy "shares_owner_insert" on public.shares for insert with check (auth.uid() = user_id);
```
- [ ] Payload contract (sanitized, both platforms): `{ kind: "tree"|"future-self"|"path", title: string, subtitle?: string, name?: string, items?: { label: string; feasibility?: number }[], quote?: string }`.
- [ ] `/s/[id]/page.tsx`: server component; fetch via supabase anon (`createClient` with NEXT_PUBLIC envs, `.from("shares").select("payload").eq("id", id).maybeSingle()`); 404 if missing; render an Apple-white card (tree-silhouette accent, reuse the visual language of `treeShareImage`) + CTA buttons 「测测你的人生树」→ `/` and 「测职场人格」→ `/test`. Bilingual via `t(...)` additions-only.
- [ ] `opengraph-image.tsx`: `next/og` `ImageResponse` — dark media-panel styled card (title, name, up to 3 items with 约X%, brand mark). Keep fonts system.
- [ ] Gate `/green`; commit `feat(P3/web): public share card page /s/[id] + OG image`. 

### Task 7 (P3): mobile share entries
**Files:** Modify `mobile/src/lib/supabase.ts` (add `createShare(payload): Promise<string | null>` — insert with `user_id: uid`, return id), `mobile/app/path/[pathId].tsx`, `mobile/app/chat/[pathId].tsx`, `mobile/src/screens/MeScreen.tsx` (or TreeScreen) for 「晒我的人生树」.
- [ ] `createShare`: requires login (`getCurrentUserId()`; null → return null so UI prompts 「登录后可分享」).
- [ ] Path detail: 「分享这条路」 link → payload `{kind:"path", title: choiceLabel, items:[{label, feasibility}], name}` → `Share.share({ message: \`我的人生路线 · ${choiceLabel}\`, url: \`https://life-planer-opal.vercel.app/s/${id}\` })` (RN core `Share`). Chat screen: small 「分享」 affordance per assistant bubble → `{kind:"future-self", quote, name, title:"来自未来的我"}`. TreeScreen/MeScreen: 「晒我的人生树」 → top-3 paths payload. Loading/disabled states; offline/not-logged-in → inline hint.
- [ ] Gate mobile tsc; commit `feat(P3/mobile): share links — path / future-self / tree cards`. **[Phase P3 end — controller OTAs + master push (web page live)]**

### Final (controller)
- [ ] Full `/green` + mobile tsc. Update `task_plan.md`/`progress.md`. Push master. OTA (env-inlined). Walk user through: email-template check, shares SQL, then on-device verification of all three phases.

## Self-Review
- Spec coverage: P1 决策(可跳过/新的赢/备份)→Tasks 1-3;P2(2张/月自动/连击UI/推送)→Tasks 4-5;P3(三种卡/链接分享/OG/CTA/脱敏 payload/登录门槛)→Tasks 6-7;env 教训→Task 0. ✓
- Placeholders: linchpin code (supabase lib, streak semantics, SQL, payload contract) fully specified; UI tasks structural w/ exact files+patterns (consistent with prior plans). ✓
- Type consistency: `CloudStore`/`SupabaseRepository` core imports; `freezeDays`/`dailyDigest` optional fields + normalize; `createShare` payload matches web page contract. ✓
