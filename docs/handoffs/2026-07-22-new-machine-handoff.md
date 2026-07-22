# New-machine handoff — 2026-07-22

## Objective

Leave Life Planner in a GitHub-cloneable, documented, verifiable state so the current Windows computer can be retired without losing source, architecture decisions, deployment identifiers, or the next operational action.

## Latest User Request

Audit outdated documentation and code, write a handoff document, and push the complete project state to GitHub so a new computer can clone and continue the project.

## Current State

- Old computer repository path: `C:\Users\Jerry\Desktop\lifeplaner`.
- GitHub: <https://github.com/Jelly13124/life-planer>; public repository; default branch `master`.
- Working branch during handoff: `feat/goal-planning-mainline`. Before this handoff commit, remote `master` and the working branch both pointed to `f86dbff`.
- Production web/API: <https://life-planer-opal.vercel.app>.
- Stack: Next.js `16.2.11`, React `19.2.3`, Expo `56.0.16`, React Native `0.85.3`, TypeScript `5.9.3` for root and `6.0.3` for Mobile.
- Repository shape: root Next.js web/API, `mobile/` Expo app, `packages/core/src/` shared deterministic domain core.
- Supabase project: `ucwgdgiymxfvuryzgevi`. Vercel Production has the public URL/key and `SUPABASE_SECRET_KEY`; EAS Production has the public Mobile URL/key.
- Vercel project name: `life-planer`; project ID `prj_0ZS7XF92TJQjNDPCpjiaI6X3xX8i`; team ID `team_Cyx44vsEDGkfAjOJZcgjvmqb`. `.vercel/` is intentionally ignored and must be re-linked.
- Expo owner/project: `jelly2474` / `bbb6f73c-30ed-4eb9-b2c6-97289c3bcac9`.
- iOS: app version `1.1.0`, latest known build `24`, bundle `com.jelly13124.lifeplanner`, App Store Connect app ID `6784142722`.
- Latest known iOS build ID: `8eb73767-1831-46de-9357-9f33d59af6be`; submission ID: `a51edf81-7a6f-4e88-bce6-66620616609d`; TestFlight: <https://appstoreconnect.apple.com/apps/6784142722/testflight/ios>.
- EAS Production variables found by name: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `EXPO_PUBLIC_REVENUECAT_IOS_KEY` was not present, so paid subscription behavior remains unconfigured/gracefully unavailable.
- No OTA is part of this handoff. The only Mobile source cleanup is removal of unused React imports; native/runtime configuration is unchanged.

## Decisions and Constraints

- Install only from the repository root with `npm ci`. The root `package-lock.json` is authoritative; do not recreate `mobile/package-lock.json`.
- The default/trunk branch is `master`. The handoff commit must be pushed to both the working branch and `master` so a normal clone receives it.
- `packages/core/src/**` must remain deterministic. Historical normalize/migration code is required for existing local and cloud data.
- AI content failures preserve saved content and expose retry; do not fabricate a new local narrative.
- Current visual identity is Apple-style white minimal with violet accent; dark styling is reserved for life-tree/prediction media panels.
- Never commit or print `.env*`, Apple credentials, DeepSeek keys, Supabase Secret Keys, or RevenueCat keys.
- `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` values are public by design; security still depends on RLS and server-side authorization.
- Native dependency/plugin/entitlement changes require a new EAS build. OTA is only for compatible JavaScript/assets on the same runtime.
- `docs/superpowers/`, `docs/MORNING*.md`, and `docs/archive/` are historical. The current truth is root `README.md`, root `AGENTS.md`, `docs/README.md`, and this handoff.

## Files and Changes

- Rewrote `C:\Users\Jerry\Desktop\lifeplaner\README.md` and `AGENTS.md` as current setup/architecture sources.
- Added `C:\Users\Jerry\Desktop\lifeplaner\docs\README.md` and this handoff.
- Rewrote `docs/dev-build.md`, `docs/mobile-backend.md`, and `docs/supabase-setup.md` to match the deployed Vercel/Supabase/EAS state.
- Archived former root session memory under `docs/archive/session-notes/` and legacy Claude configuration under `docs/archive/legacy-claude/`.
- Archived tracked `.superpowers/sdd` reports under `docs/archive/sdd/`.
- Made `.codex/hooks.json` portable by removing the old computer's absolute path.
- Updated active Codex review agents and `.agents/skills/green` to match the current architecture, theme, and verification gate.
- Removed the stale nested `mobile/package-lock.json`; added root/mobile verification scripts.
- Upgraded `next` and `eslint-config-next` from `16.2.9` to the official July 2026 security patch `16.2.11`.
- Updated `POST /api/style-events` to prefer `SUPABASE_SECRET_KEY` while retaining the legacy service-role fallback, with test coverage.
- Removed eight unused Mobile React default imports and corrected stale AI fallback comments.

## Verification

- Fresh-install simulation: root `npm ci` succeeded and installed 1054 packages using only the root lockfile.
- `npm run verify` passed after the handoff changes: Web TypeScript, 68 Vitest files / 635 tests, ESLint, Next `16.2.11` production build, and Mobile TypeScript.
- `npx expo-doctor@latest mobile` passed all 21/21 checks.
- Focused `POST /api/style-events` coverage passed 7/7 tests, including new Secret Key and legacy-key fallback cases.
- `git diff --check` passed. `.next` was removed afterward with `npm run clean:next`.
- The architecture helper found all required surfaces except a literal root `tests/` directory. This repository intentionally uses 68 colocated `__tests__`/`*.test.*` suites as the documented conventional equivalent. It also reports the root `CLAUDE.md`; that file is an intentional one-line compatibility bridge to `AGENTS.md`, not a parallel rule set.
- Production smoke evidence before handoff: `https://life-planer-opal.vercel.app` returned `200`; invalid bearer token on `DELETE /api/account` returned `401`, proving the production route and server secret path were active.

## Open Issues and Risks

- Run one real-user end-to-end Supabase test: sign in, create/sync data, pull it on another device, then delete the test account and confirm Auth/`trees`/`shares` cleanup.
- `trees` and `shares` SQL are documented in `docs/supabase-setup.md` but are not yet represented as checked-in migrations; only `style_events` currently has a migration file.
- RevenueCat is intentionally not configured in EAS Production. Decide whether to remove/hide monetization entirely or configure and sandbox-test it before advertising paid access.
- Build 24 is uploaded to TestFlight, but final App Review still requires the normal human checks: fresh-install flow, test completion/share, login/sync, account deletion, privacy/terms links, screenshots, metadata, and Apple questionnaire answers.
- `npm audit` still reports 21 transitive dependency findings (14 moderate, 7 high), mainly inside Expo tooling plus Next-bundled PostCSS/Sharp. Next was upgraded to the official `16.2.11` security release, but npm's suggested automatic fixes are invalid breaking downgrades (for example Next 9 / datetimepicker 8). Do not run `npm audit fix --force`; reassess after Expo/Next publish compatible upstream fixes.
- A new computer needs fresh authentication for GitHub, Vercel, Expo/EAS, Supabase, and possibly Apple. These sessions are not transferable through Git.
- The GitHub repository is public. Re-run a secret scan before introducing any future configuration files.

## Next Action

On the new computer, run exactly:

```bash
git clone https://github.com/Jelly13124/life-planer.git
cd life-planer
git switch master
npm ci
npm run verify
```

Then authenticate and reconnect external services without creating new projects:

```bash
gh auth login
npx vercel login
npx vercel link
npx eas-cli login
cd mobile
npx eas-cli project:info
```

Choose the existing Vercel project `life-planer`, verify EAS project ID `bbb6f73c-30ed-4eb9-b2c6-97289c3bcac9`, open the existing Supabase project `ucwgdgiymxfvuryzgevi`, and perform the real-user Supabase/TestFlight smoke test listed above before submitting Build 24 for App Review.
