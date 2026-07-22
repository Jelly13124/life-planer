<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Life Planner project rules

## Product

- Life Planner is a life-direction and decision product, not a generic to-do app.
- The core loop is: explore believable futures → choose a path → act → update feasibility → reflect.
- Predictions are possibilities, never fortune-telling. Keep uncertainty visible and retain crisis-safety handling.

## Architecture

- Root: Next.js 16 web app and `/api/*` backend.
- `mobile/`: Expo SDK 56 / React Native app.
- `packages/core/src/`: shared pure domain layer consumed by both clients. The web `@/domain/*` alias points here.
- `src/state/`: web state and persistence orchestration.
- `src/lib/`: server AI, API clients, Supabase, feature flags, and infrastructure.
- Tests are colocated under `**/__tests__/` and `*.test.*`; there is intentionally no root `tests/` directory.

## Invariants

- Keep `packages/core/src/**` deterministic: no `Date.now()`, `Math.random()`, or argument-free `new Date()`. Inject time and use the seeded helpers.
- AI and Supabase privileged keys are server-only. Never expose them through `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.
- Content-generating AI has no fabricated fallback. Preserve saved content and show a retry state; deterministic geometry/math can remain local.
- New web user-facing strings go through `t(...)`; add English entries to `src/i18n/messages.ts`. Avoid ASCII double quotes inside Chinese text.
- Preserve backward-compatible normalization and legacy data migrations unless a verified migration strategy replaces them.

## Visual direction

- Current identity is Apple-style white minimal UI with violet accent.
- The life tree/prediction canvas may use a dark media panel; do not turn the whole product into a dark theme.
- Reuse existing primitives and line icons. Respect keyboard access, contrast, and reduced motion.

## Development and verification

- Install once from the repository root with `npm ci`; do not maintain a second lockfile under `mobile/`.
- Before committing, run `npm run verify`. Run `npm run clean:next` afterward if returning to development mode.
- For Expo-specific work, also run `npx expo-doctor@latest mobile` when dependency or native configuration changed.
- Use `.agents/skills/green` for the standard verification gate and `.agents/skills/restart-dev` for a clean local web restart.
- Do not read, print, or commit `.env*`. Environment names and recovery steps belong in documentation; values stay in Vercel, EAS, Supabase, or a password manager.

## Git and handoff

- Default branch is `master`.
- Keep current operational truth in `README.md`, `docs/README.md`, and the latest file under `docs/handoffs/`.
- Dated plans, specs, morning reviews, and `docs/archive/` are historical evidence, not current backlog.
