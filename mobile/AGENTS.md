# Expo SDK 56 project rules

Read the root `AGENTS.md` first. This app is part of the root npm workspace; install dependencies from the repository root with `npm ci`.

- Read the exact Expo SDK 56 documentation before changing Expo or React Native APIs.
- The shared domain lives in `../packages/core`; Metro watches the workspace root and resolves hoisted dependencies from the root `node_modules`.
- Do not create or commit a second `mobile/package-lock.json`.
- `app.json` is the source of truth for the store app version and native identifiers. EAS owns the remote iOS build number.
- Public mobile configuration uses `EXPO_PUBLIC_*`; never place privileged Supabase or DeepSeek keys in the app bundle.
- Verify with `npm run typecheck --workspace mobile`. When native dependencies/configuration change, also run `npx expo-doctor@latest mobile` and create a new EAS build rather than relying on OTA.
