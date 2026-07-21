# Architecture / where things live

- **Root = Next.js 16 app** (App Router, Turbopack, React 19, TS, Tailwind v4): the web client **and** the API backend. Deploy it to serve `/api/*` for any client.
- **`mobile/` = Expo / React Native app** (in progress). Shares the pure domain core.
- **`packages/core/src/**` = pure domain core** (types, goals, daily, calendar, feasibility, choices, quickParse, ics, reminders, schedule, migrateGoals, repository/, generator/, mapLayout/ …). No DOM, no Next, no React. This is the reusable heart — both web and mobile consume it. The web `@/domain/*` alias points here for compatibility.
- **`src/state/AppContext.tsx`** = the single React state hub (reducer + `patchTree` + `treeRef`-read-at-apply single-snapshot pattern). All goal/task/choice/feasibility mutations go through it.
- **`src/lib/`** = API client wrappers (`*Client.ts`), server-only prediction prompt (`enrich.ts`), and infra (`rateLimit`, `featureFlags`, `supabaseClient`, `notifications`).
- **`src/components/`** = UI; `ui/` = shared primitives (Card/Button/SectionHeader/EmptyState/icons), `lib/` = shared component helpers (areaMeta, taskGroups).
- **Persistence**: localStorage key `lifeplanner.tree.v3`; `normalizeLoadedTree` backfills new optional fields (no migrations — optional fields only). Cloud sync via Supabase is **flag-gated** (`isSupabaseCloudEnabled`, off unless `NEXT_PUBLIC_SUPABASE_*` are set).
- **Data model**: two-tier goals — `Goal.kind: "long" | "short"` + `parentGoalId`; long goals grow a life-tree branch (`pathId`); loose goal-less tasks live at `LifeTree.tasks`.
