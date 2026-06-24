// @lifeplanner/core — pure domain barrel.
//
// Both apps primarily DEEP-IMPORT subpaths (e.g. `@lifeplanner/core/types`,
// `@lifeplanner/core/goalTree`) via the package "./*" export map, which is the
// canonical access pattern. This barrel only re-exports the shared type surface
// for ergonomic `import { LIFE_AREAS, type Profile } from "@lifeplanner/core"`.
//
// We intentionally do NOT `export *` from the behaviour modules here: several of
// them legitimately export same-named helpers with different signatures (e.g.
// `goalById` in both goals.ts and goalTree.ts), which would create barrel
// ambiguity. Deep-import those modules directly instead.
export * from "./types";
