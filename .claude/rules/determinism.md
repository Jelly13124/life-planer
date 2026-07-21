# Determinism (domain purity)

`packages/core/src/**` (also consumed through `@/domain/*` and `@lifeplanner/core/*`) MUST be pure & deterministic:

- **No `Date.now()`, no `Math.random()`, no argless `new Date()`** in domain. Time is **injected** from the state layer (pass `now`/`today` as ISO/`YYYY-MM-DD` strings). `new Date(injectedString)` is fine.
- Randomness uses the **seeded RNG** in `packages/core/src/seed.ts` (`hashSeed`), never `Math.random()`.
- Enforced automatically: an ESLint `no-restricted-syntax` rule on `packages/core/**` (see `eslint.config.mjs`) + the PostToolUse `check-edit` hook runs ESLint on every edited `src/**` file.
- Renders: no module-scope `new Date()` in components — use a boot const (e.g. `localTodayStr()`) + a `visibilitychange`/focus effect to refresh "today".
- Pure domain modules are TDD'd (`__tests__/`); components/state are verified via tsc + build, not unit tests.
