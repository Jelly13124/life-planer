# Ops & git workflow

- **Dev server**: harness background tasks get reaped between turns — launch **detached** (`Start-Process cmd /c "npm run dev"`). After a `next build`, clear `.next` before `npm run dev` (stale build → dev `/` 404). Use the **`/restart-dev`** skill (kill node → clear `.next` → detached → verify `:3000` 200).
- **Verify gate**: before committing/merging run the **`/green`** skill — `tsc --noEmit` + `vitest run` + `next build`, then `rm -rf .next`. All three must pass.
- **mobile** verifies separately: `cd mobile && npx tsc --noEmit` (root tsconfig excludes `mobile/`).
- **Commits**: commit per coherent task. Big multi-phase work is done **subagent-driven** (implementer → review → commit per phase). End commit messages with the `Co-Authored-By: Claude …` trailer. Commit only when the user asks (autonomous `/goal` runs commit per task).
- **Trunk is `master`** (not `main`). Keep it fast-forwarded to the working branch at checkpoints.
- Working memory lives at repo root (`task_plan.md` / `progress.md` / `findings.md`) per the planning-with-files workflow — keep them at root.
