---
name: green
description: Run the full repository verification gate for the Next.js web app, shared core, and Expo mobile TypeScript before committing or handing off.
---

# Verify Life Planner

From the repository root, run:

```powershell
npm run verify
npm run clean:next
```

`npm run verify` runs, in order:

1. Root TypeScript typecheck.
2. Full Vitest suite.
3. ESLint.
4. Next.js production build.
5. Expo/mobile TypeScript typecheck.

All five must pass before calling the repository green. If a step fails, report the exact command and error. Run `npm run clean:next` after the gate, including after a failed build when possible, so the development server does not inherit stale production output.

When Expo dependencies, `app.json`, `eas.json`, Metro, or native targets changed, additionally run:

```powershell
npx expo-doctor@latest mobile
```
