---
name: green
description: Run the full verification gate for the web app — TypeScript typecheck + vitest + next build — then clear the .next cache. Use before committing, before merging, or to confirm the app is "green". Reports pass/fail per step.
---

# Verify the web app is green

Run the project's standard gate and report each step. The pure domain + state are covered by vitest; tsc + build catch the rest.

```bash
echo "=== tsc ===" && npx tsc --noEmit && echo "TSC OK" || echo "TSC FAIL"
echo "=== vitest ===" && npx vitest run 2>&1 | grep -E "Test Files|Tests "
echo "=== build ===" && npx next build >/tmp/lpgreen.log 2>&1 && echo "BUILD OK" || (echo "BUILD FAIL"; tail -25 /tmp/lpgreen.log)
rm -rf .next   # building locks/populates .next; clear it so `npm run dev` stays clean
```

Notes:
- All three must pass to call it green. On failure, surface the exact errors (don't just say "failed").
- `rm -rf .next` after building avoids the dev `/` 404 caused by a stale build cache.
- This is the web app only. The mobile app (`mobile/`) verifies separately (`cd mobile && npx tsc --noEmit`).
- After a green run, if you're about to commit, end git commit messages with the project's Co-Authored-By trailer.
