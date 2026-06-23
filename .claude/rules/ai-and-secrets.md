# AI routes & secrets

- AI lives in **Next API routes** (`src/app/api/*`): enrich (prediction), chat (talk-to-future-self), analyze-choice, decompose-goal, plan-short-goal, arrange-day, etc. Native clients call these — **never call DeepSeek directly from a client** (key would leak).
- Every AI route MUST have: an **offline/local fallback** (works with no key — return a deterministic local result), and a **per-IP rate limit** via `allowRequest` (`src/lib/rateLimit.ts`). The route always returns a valid shape.
- **`DEEPSEEK_API_KEY`** is server-side only, in `.env.local` (gitignored). Model: `deepseek-chat` (override via `LIFEPLANNER_MODEL`).
- **Secrets are off-limits to tools**: `.env*` is gitignored AND the PreToolUse `guard-env` hook blocks reading/writing any `.env*`. The user edits `.env.local` by hand. Don't try to read or write it.
- Supabase: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, RLS-protected). Cloud sync is flag-gated off unless both are set.
- Prediction prompt (`src/lib/enrich.ts`) is **server-only** and heavily tuned: forbidden-word list, anti-prophecy tone, field/country-adaptive realism anchors, friction/causal/multi-dimension requirements, story length ≥3 sentences. Edit surgically + re-eval (don't gut the constraints).
