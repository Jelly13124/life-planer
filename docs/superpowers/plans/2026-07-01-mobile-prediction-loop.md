# Mobile Prediction Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Expo mobile app, let a user commit to one predicted path, auto-decompose it into path-linked goals, and watch the "optimistic future" probability climb as they complete tasks.

**Architecture:** The climb math already exists in `packages/core` (`effectiveFeasibility` → `scenarioOdds`, driven by `pathProgress` of goals whose `pathId` matches). The gaps are mobile-only: no "chosen path" concept, goals never carry `pathId`, and the path-detail screen doesn't surface the commit / climb / plan. We add a small optional core field + pure helpers (TDD), then wire the mobile store and rebuild the path-detail screen into a "cockpit". Web is untouched.

**Tech Stack:** TypeScript, React Native (Expo Router), `@lifeplanner/core` (pure domain, vitest), Zustand-free React context store.

**Spec:** `docs/superpowers/specs/2026-07-01-mobile-prediction-loop-design.md`

---

### Task 1: Core — `chosenPathId` field + choose/clear/access helpers

**Files:**
- Modify: `packages/core/src/types.ts` (add optional field to `LifeTree`)
- Modify: `packages/core/src/tree.ts` (add `choosePath`/`clearChosenPath`/`chosenPath`; clear dangling id in `removePath`)
- Test: `packages/core/src/__tests__/chosenPath.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/chosenPath.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTree, addPath, choosePath, clearChosenPath, chosenPath, removePath } from "../tree";
import { localGenerator } from "../generator/localGenerator";
import type { Profile } from "../types";

const NOW = "2026-07-01T00:00:00.000Z";
const profile = (): Profile => ({
  name: "测试", age: 28, education: "本科", major: "", occupation: "", salary: "1万 - 2万",
  hasSideHustle: false, sideHustle: "", hobbies: "", relationship: "single", location: "上海",
  status: "", snapshot: "", crossroad: "",
  areas: { career: 50, wealth: 50, relationships: 50, health: 50, growth: 50 },
});

function treeWithPath() {
  const t = addPath(createTree(profile(), localGenerator, NOW), "去创业", localGenerator, NOW);
  const choice = t.paths.find((p) => p.kind === "choice")!;
  return { t, choiceId: choice.id };
}

describe("chosenPath", () => {
  it("choosePath sets chosenPathId for a choice path", () => {
    const { t, choiceId } = treeWithPath();
    const next = choosePath(t, choiceId, NOW);
    expect(next.chosenPathId).toBe(choiceId);
    expect(chosenPath(next)?.id).toBe(choiceId);
  });

  it("choosePath ignores status-quo and unknown ids", () => {
    const { t } = treeWithPath();
    const sq = t.paths.find((p) => p.kind === "status-quo")!;
    expect(choosePath(t, sq.id, NOW).chosenPathId).toBeUndefined();
    expect(choosePath(t, "nope", NOW).chosenPathId).toBeUndefined();
  });

  it("clearChosenPath resets to null", () => {
    const { t, choiceId } = treeWithPath();
    const chosen = choosePath(t, choiceId, NOW);
    expect(clearChosenPath(chosen, NOW).chosenPathId).toBeNull();
  });

  it("removePath clears a dangling chosenPathId", () => {
    const { t, choiceId } = treeWithPath();
    const chosen = choosePath(t, choiceId, NOW);
    const removed = removePath(chosen, choiceId, NOW);
    expect(removed.chosenPathId).toBeNull();
    expect(chosenPath(removed)).toBeNull();
  });

  it("chosenPath returns null when unset", () => {
    const { t } = treeWithPath();
    expect(chosenPath(t)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/Users/Jerry/Desktop/lifeplaner && npx vitest run packages/core/src/__tests__/chosenPath.test.ts`
Expected: FAIL — `choosePath`/`clearChosenPath`/`chosenPath` not exported from `../tree`.

- [ ] **Step 3: Add the field to `LifeTree`**

In `packages/core/src/types.ts`, inside `export interface LifeTree { ... }` (near `dayStart?`/`guideDismissed?` optional fields), add:

```ts
  chosenPathId?: string | null; // 用户「正在走」的那条路（选定）；未选 = undefined/null
```

- [ ] **Step 4: Implement the helpers in `tree.ts`**

Append to `packages/core/src/tree.ts`:

```ts
// 选定「我要走的这条路」：只允许选存在的 choice 路（status-quo / 未知 id 忽略）。
export function choosePath(tree: LifeTree, pathId: string, now: string): LifeTree {
  const p = tree.paths.find((x) => x.id === pathId);
  if (!p || p.kind !== "choice") return tree;
  return { ...tree, chosenPathId: pathId, updatedAt: now };
}

// 取消选定。
export function clearChosenPath(tree: LifeTree, now: string): LifeTree {
  if (tree.chosenPathId == null) return tree;
  return { ...tree, chosenPathId: null, updatedAt: now };
}

// 访问器：选定的那条路（未选或已被删 → null）。
export function chosenPath(tree: LifeTree): LifePath | null {
  if (!tree.chosenPathId) return null;
  return tree.paths.find((p) => p.id === tree.chosenPathId) ?? null;
}
```

- [ ] **Step 5: Make `removePath` clear a dangling `chosenPathId`**

In `packages/core/src/tree.ts`, in `removePath`, change the final `return { ... }` to also reset `chosenPathId` when the chosen path was removed:

```ts
  const nextChosen =
    tree.chosenPathId && toRemove.has(tree.chosenPathId) ? null : tree.chosenPathId;

  return {
    ...tree,
    paths: tree.paths.filter((p) => !toRemove.has(p.id)),
    decisions: tree.decisions.filter((d) => !toRemove.has(d.pathId)),
    goals: (tree.goals ?? []).filter((g) => !(g.pathId && toRemove.has(g.pathId))),
    chosenPathId: nextChosen,
    updatedAt: now,
  };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run packages/core/src/__tests__/chosenPath.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/tree.ts packages/core/src/__tests__/chosenPath.test.ts
git commit -m "feat(core): chosenPathId + choosePath/clearChosenPath/chosenPath helpers"
```

---

### Task 2: Core — deterministic offline fallback `localPathGoals`

**Files:**
- Create: `packages/core/src/pathGoals.ts`
- Test: `packages/core/src/__tests__/pathGoals.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/pathGoals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { localPathGoals } from "../pathGoals";
import type { LifePath, LifeArea, MetricPoint } from "../types";

const series = (a: number, b: number): MetricPoint[] => [
  { age: 28, value: a }, { age: 43, value: b },
];

function path(overrides: Partial<LifePath> = {}): LifePath {
  return {
    id: "p1", choiceLabel: "去创业", kind: "choice", summary: "", color: "#000",
    curve: "rise-gentle", endValue: 60, nodes: [], parentId: null, forkAge: 28, scenario: "likely",
    metrics: {
      career: series(50, 80),      // +30 (biggest)
      wealth: series(50, 65),      // +15
      relationships: series(50, 45), // -5
      health: series(50, 52),      // +2
      growth: series(50, 70),      // +20 (2nd)
    } as Record<LifeArea, MetricPoint[]>,
    ...overrides,
  };
}

describe("localPathGoals", () => {
  it("returns goals for the top-gain areas, deterministic order", () => {
    const goals = localPathGoals(path(), 3);
    expect(goals.map((g) => g.area)).toEqual(["career", "growth", "wealth"]);
    expect(goals[0].title).toContain("去创业");
    expect(goals.length).toBe(3);
  });

  it("respects the count cap and never returns zero for a real path", () => {
    expect(localPathGoals(path(), 2)).toHaveLength(2);
    expect(localPathGoals(path(), 1)).toHaveLength(1);
  });

  it("is pure — same input yields identical output", () => {
    expect(localPathGoals(path(), 3)).toEqual(localPathGoals(path(), 3));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/__tests__/pathGoals.test.ts`
Expected: FAIL — cannot find module `../pathGoals`.

- [ ] **Step 3: Implement `localPathGoals`**

Create `packages/core/src/pathGoals.ts`:

```ts
import { AREA_LABELS, LIFE_AREAS, type LifeArea, type LifePath } from "./types";

export interface PathGoalDraft {
  area: LifeArea;
  title: string;
  why: string;
}

// 从一条路确定性派生 N 个「打基础」目标：按各领域指标净增（末-首）降序取前 N。
// 纯、无随机、无 Date —— AI 拆解失败/离线时的兜底。
export function localPathGoals(path: LifePath, count = 3): PathGoalDraft[] {
  const ranked = LIFE_AREAS.map((area) => {
    const s = path.metrics[area] ?? [];
    const first = s[0]?.value ?? 50;
    const last = s[s.length - 1]?.value ?? first;
    return { area, gain: last - first };
  }).sort((a, b) => b.gain - a.gain);

  const n = Math.max(1, Math.min(count, ranked.length));
  return ranked.slice(0, n).map(({ area }) => ({
    area,
    title: `${path.choiceLabel}·${AREA_LABELS[area]}打基础`,
    why: `为「${path.choiceLabel}」在${AREA_LABELS[area]}上先攒下底子。`,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/__tests__/pathGoals.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/pathGoals.ts packages/core/src/__tests__/pathGoals.test.ts
git commit -m "feat(core): localPathGoals — deterministic path→goals fallback"
```

---

### Task 3: Mobile store — choose/clear, addLongGoal pathId, decomposePathIntoGoals

**Files:**
- Modify: `mobile/src/state/store.tsx`

- [ ] **Step 1: Add imports**

In `mobile/src/state/store.tsx`:
- Extend the `@lifeplanner/core/tree` import (currently `import { createTree, addPath, addScenarioVariant, removePath } from "@lifeplanner/core/tree";`) to:

```ts
import { createTree, addPath, addScenarioVariant, removePath, choosePath as domainChoosePath, clearChosenPath as domainClearChosenPath } from "@lifeplanner/core/tree";
```

- Add after the `goalTree` import block:

```ts
import { localPathGoals } from "@lifeplanner/core/pathGoals";
```

- Ensure `LifeArea` and `LifePath` are in the `@lifeplanner/core/types` type import at the top (add if missing): change to include `LifeArea, LifePath`.

- [ ] **Step 2: Extend the `AppValue` interface**

In the `interface AppValue { ... }`, add (near `addChoiceBranch`/`removeBranch`):

```ts
  chosenPathId: string | null;
  choosePath: (pathId: string) => void;
  clearChosenPath: () => void;
  decomposePathIntoGoals: (pathId: string) => Promise<void>;
```

Change the existing `addLongGoal` signature to accept an optional path link:

```ts
  addLongGoal: (area: GoalArea, title: string, why?: string, endDate?: string, pathId?: string | null) => void;
```

- [ ] **Step 3: Thread `pathId` through the store `addLongGoal`**

Replace the `addLongGoal` callback body:

```ts
  const addLongGoal = useCallback(
    (area: GoalArea, title: string, why?: string, endDate?: string, pathId?: string | null) => {
      const cur = treeRef.current;
      if (!cur || !title.trim()) return;
      const { tree: next } = domainAddLongGoal(cur, { area, title: title.trim(), why, endDate, pathId: pathId ?? null }, nowISO());
      commit(next);
    },
    [commit],
  );
```

- [ ] **Step 4: Add choose/clear/decompose callbacks**

Add near `removeBranch` (after the `addScenario` callback):

```ts
  const choosePath = useCallback(
    (pathId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(domainChoosePath(cur, pathId, nowISO()));
    },
    [commit],
  );

  const clearChosenPath = useCallback(() => {
    const cur = treeRef.current;
    if (!cur) return;
    commit(domainClearChosenPath(cur, nowISO()));
  }, [commit]);

  // 把一条路拆成 2-3 个挂路长期目标：AI 优先（复用 /api/goals，把这条路作为 choice 上下文），
  // 失败/离线 → 本地确定性兜底 localPathGoals。逐个建目标并挂 pathId。
  const decomposePathIntoGoals = useCallback(
    async (pathId: string) => {
      const cur = treeRef.current;
      if (!cur) return;
      const path = cur.paths.find((p) => p.id === pathId);
      if (!path || path.kind !== "choice") return;

      let drafts: { area: LifeArea; title: string; why: string }[] = [];
      if (hasBackend()) {
        try {
          const ai = await fetchGoalSuggestions(cur.profile.snapshot || "", [path.choiceLabel], "zh");
          drafts = ai.slice(0, 3).map((g) => ({ area: g.area, title: g.title, why: g.why }));
        } catch {
          // 忽略，走本地兜底
        }
      }
      if (drafts.length === 0) drafts = localPathGoals(path, 3);

      for (const d of drafts) {
        const t = treeRef.current;
        if (!t) break;
        const { tree: next } = domainAddLongGoal(t, { area: d.area, title: d.title, why: d.why, pathId }, nowISO());
        commit(next);
      }
    },
    [commit],
  );
```

- [ ] **Step 5: Expose the new values**

In the `useMemo<AppValue>` return object, add:

```ts
      chosenPathId: t?.chosenPathId ?? null,
      choosePath,
      clearChosenPath,
      decomposePathIntoGoals,
```

And add `choosePath, clearChosenPath, decomposePathIntoGoals` to the `useMemo` dependency array (alongside `addLongGoal`).

- [ ] **Step 6: Typecheck**

Run: `cd C:/Users/Jerry/Desktop/lifeplaner/mobile && npx tsc --noEmit`
Expected: no output (clean). If `fetchGoalSuggestions`/`GoalSuggestion` are not already imported from `../lib/api`, add `fetchGoalSuggestions` to that import.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/state/store.tsx
git commit -m "feat(mobile/store): choosePath/clearChosenPath, addLongGoal pathId, decomposePathIntoGoals"
```

---

### Task 4: Mobile path detail — the "cockpit" (commit + climb bars + plan)

**Files:**
- Modify: `mobile/app/path/[pathId].tsx`

- [ ] **Step 1: Read the current file and pull the app fields**

Near the top of `PathDetailScreen`, replace `const { tree, addScenario } = useApp();` with:

```ts
  const app = useApp();
  const { tree, addScenario } = app;
  const isChosen = app.chosenPathId === path?.id;
  const linkedGoals = app.longGoals.filter((g) => g.pathId === path?.id && g.status === "active");
```

(Keep the existing early-return `if (!tree || !path)` block below unchanged; the derived consts read `path?.id` so they are safe before the guard.)

- [ ] **Step 2: Add the "选这条路" commit block**

Immediately after the disclaimer `<Text style={styles.disclaimer}>…</Text>` and before the `现实可行度` block, add (only for choice paths):

```tsx
      {isChoice ? (
        <View style={styles.commitBox}>
          {isChosen ? (
            <>
              <View style={styles.commitRow}>
                <Text style={styles.commitOn}>✓ 正在走这条路</Text>
                <Pressable onPress={() => app.clearChosenPath()} hitSlop={8}>
                  <Text style={styles.commitCancel}>取消</Text>
                </Pressable>
              </View>
              <Text style={styles.commitHint}>完成下面的目标任务，会把这条路的乐观未来往上推。</Text>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  app.choosePath(path.id);
                  if (linkedGoals.length === 0) void app.decomposePathIntoGoals(path.id);
                }}
                style={({ pressed }) => [styles.commitBtn, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.commitBtnText}>选这条路</Text>
              </Pressable>
              <Text style={styles.commitHint}>选定后 AI 会把它拆成几个目标，完成任务即推高乐观未来。</Text>
            </>
          )}
        </View>
      ) : null}
```

- [ ] **Step 3: Add the three-scenario climb bars**

The file already computes `const odds = scenarioOdds(eff?.value ?? path.feasibility);`. After the `现实可行度` (`feasBox`) block, add a persistent climb display:

```tsx
      {isChoice ? (
        <View style={styles.climbBox}>
          <Text style={styles.climbTitle}>三种可能的未来</Text>
          {([
            { key: "optimistic", label: "乐观", color: "#0f9d6a" },
            { key: "likely", label: "中性", color: "#c77600" },
            { key: "conservative", label: "低谷", color: "#e84a6f" },
          ] as const).map((row) => (
            <View key={row.key} style={styles.climbRow}>
              <Text style={styles.climbLabel}>{row.label}</Text>
              <View style={styles.climbTrack}>
                <View style={[styles.climbFill, { width: `${odds[row.key]}%`, backgroundColor: row.color }]} />
              </View>
              <Text style={[styles.climbPct, row.key === "optimistic" && { color: row.color, fontWeight: "800" }]}>
                {odds[row.key]}%
              </Text>
            </View>
          ))}
          {eff && eff.bump > 0 ? (
            <Text style={styles.climbNote}>你的行动已把乐观未来推高 +{eff.bump}%。</Text>
          ) : (
            <Text style={styles.climbNote}>完成挂在这条路上的任务，乐观占比会往上爬。</Text>
          )}
        </View>
      ) : null}
```

- [ ] **Step 4: Add the plan (linked goals) section**

Before the `聊天入口` (`chatBtn`) at the bottom, add:

```tsx
      {isChosen ? (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.sectionLabel}>这条路的计划</Text>
          {linkedGoals.length === 0 ? (
            <Pressable
              onPress={() => void app.decomposePathIntoGoals(path.id)}
              style={({ pressed }) => [styles.planBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.planBtnText}>让 AI 拆一版目标</Text>
            </Pressable>
          ) : (
            linkedGoals.map((g) => (
              <View key={g.id} style={styles.planRow}>
                <Text style={styles.planGoalTitle} numberOfLines={1}>{g.title}</Text>
                <Text style={styles.planGoalPct}>{app.progressOf(g)}%</Text>
              </View>
            ))
          )}
        </View>
      ) : null}
```

- [ ] **Step 5: Add styles**

Add to the `StyleSheet.create({ ... })` at the bottom:

```ts
  commitBox: { marginTop: 14 },
  commitRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commitOn: { fontSize: 16, fontWeight: "700", color: colors.success },
  commitCancel: { fontSize: 13, color: colors.fgMuted },
  commitBtn: { backgroundColor: colors.accent, borderRadius: radii.sm, paddingVertical: 13, alignItems: "center" },
  commitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  commitHint: { fontSize: 12, color: colors.fgMuted, marginTop: 8, lineHeight: 18 },
  climbBox: { marginTop: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radii.md, backgroundColor: "#fff", padding: 14 },
  climbTitle: { fontSize: 13, fontWeight: "700", color: colors.fg, marginBottom: 10 },
  climbRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  climbLabel: { width: 32, fontSize: 13, color: colors.fg },
  climbTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: "#eee", overflow: "hidden" },
  climbFill: { height: 10, borderRadius: 5 },
  climbPct: { width: 44, textAlign: "right", fontSize: 13, color: colors.fg },
  climbNote: { fontSize: 12, color: colors.fgMuted, marginTop: 4 },
  planBtn: { borderWidth: 1, borderColor: colors.accent, borderRadius: radii.sm, paddingVertical: 12, alignItems: "center" },
  planBtnText: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  planRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  planGoalTitle: { flex: 1, fontSize: 15, color: colors.fg },
  planGoalPct: { fontSize: 13, fontWeight: "700", color: colors.accent, marginLeft: 12 },
```

Verify `colors.success` exists in `mobile/src/theme` (Task 4 Step 6 confirms). If it does not, use `"#0f9d6a"` literally in `commitOn`.

- [ ] **Step 6: Typecheck**

Run: `cd C:/Users/Jerry/Desktop/lifeplaner/mobile && npx tsc --noEmit`
Expected: no output. Fix any missing `colors.*` token by substituting a literal hex already used in this file.

- [ ] **Step 7: Commit**

```bash
git add "mobile/app/path/[pathId].tsx"
git commit -m "feat(mobile): path-detail cockpit — commit path + scenario climb bars + plan"
```

---

### Task 5: Mobile tree — "✓ 正在走" marker on the chosen path

**Files:**
- Modify: `mobile/src/screens/TreeScreen.tsx`

- [ ] **Step 1: Read `chosenPathId` from the store**

In `TreeScreen`, the store is destructured as `const { tree, addChoiceBranch, addChoiceBranchAt, removeBranch, enriching } = useApp();`. Add `chosenPathId`:

```ts
  const { tree, addChoiceBranch, addChoiceBranchAt, removeBranch, enriching, chosenPathId } = useApp();
```

- [ ] **Step 2: Mark the chosen path's endpoint label**

In the endpoint label `<SvgText>` that renders `{truncate(p.choiceLabel, 10)}`, prefix a check when chosen. Replace that `<SvgText>`’s child expression:

```tsx
                  <SvgText
                    x={p.end.x + 16}
                    y={p.end.y - 2}
                    fill={isSq ? DARK.textMuted : DARK.text}
                    fontSize={19}
                    fontWeight="700"
                  >
                    {(p.id === chosenPathId ? "✓ " : "") + truncate(p.choiceLabel, 10)}
                  </SvgText>
```

- [ ] **Step 3: Also mark the path list card**

In the `choices.map((p) => ( ... ))` legend card, change the title `<Text style={styles.legendTitle}>{p.choiceLabel}</Text>` to:

```tsx
                <Text style={styles.legendTitle}>{(p.id === chosenPathId ? "✓ " : "") + p.choiceLabel}</Text>
```

- [ ] **Step 4: Typecheck**

Run: `cd C:/Users/Jerry/Desktop/lifeplaner/mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/TreeScreen.tsx
git commit -m "feat(mobile/tree): mark the chosen path with a ✓ 正在走 badge"
```

---

### Task 6: Verify everything green + OTA

**Files:** none (verification + deploy)

- [ ] **Step 1: Core green (web gate)**

The core is shared with web. Run the `/green` gate from repo root:

Run: `npx tsc --noEmit && npx vitest run 2>&1 | grep -E "Test Files|Tests " && npx next build > /tmp/lpg.log 2>&1 && echo BUILD_OK && rm -rf .next`
Expected: TSC clean, all vitest pass (includes the 2 new core test files), `BUILD_OK`. Web behavior is unchanged (only an optional field added).

- [ ] **Step 2: Mobile typecheck**

Run: `cd C:/Users/Jerry/Desktop/lifeplaner/mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Manual smoke (describe for the user — do not block)**

On a device/simulator: open a choice path → tap "选这条路" → ✓ appears on tree + AI/local goals get created → schedule & complete a task under a linked goal → return to the path → optimistic bar is higher and note shows "+Y%".

- [ ] **Step 4: OTA publish (iOS, production channel)**

Run: `cd C:/Users/Jerry/Desktop/lifeplaner/mobile && EXPO_NO_TELEMETRY=1 CI=1 npx eas update --branch production --environment production --platform ios --message "feat: 选定路线 + 拆计划 + 乐观爬升"`
Expected: `✔ Published!` with runtime `1.0.0`. (JS-only change → OTA per memory `mobile-ota-first`.)

- [ ] **Step 5: Fast-forward master + push**

```bash
cd C:/Users/Jerry/Desktop/lifeplaner
git push origin feat/goal-planning-mainline
git push origin HEAD:master
git branch -f master HEAD
```

---

## Self-Review

- **Spec coverage:** ① data model → Task 1; goals-carry-pathId → Task 3 Step 3; ② tree marker → Task 5; ③ cockpit commit/climb/plan → Task 4; ④ climb wiring reuses core (no task needed, verified in Task 6 Step 3); AI decompose + offline fallback → Task 2 (fallback) + Task 3 Step 4 (AI-first). All covered.
- **Placeholder scan:** none — every code step has full code.
- **Type consistency:** `choosePath`/`clearChosenPath`/`chosenPath` (core) vs `choosePath`/`clearChosenPath`/`decomposePathIntoGoals` (store) consistent; `chosenPathId` field name consistent across core/store/UI; `localPathGoals(path, count)` signature consistent between Task 2 and Task 3.
