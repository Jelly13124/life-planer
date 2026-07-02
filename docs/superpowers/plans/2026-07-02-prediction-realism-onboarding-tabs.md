# Prediction Realism + All-AI Scenarios + Onboarding Parity + Tab Reorder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement Tasks 1–4 task-by-task. Task 5 (prompt realism + eval) is main-control / human-in-loop — NOT a subagent task. Steps use checkbox (`- [ ]`).

**Goal:** Rename scenarios to 高光/平稳/低谷, make all three scenarios AI-generated on mobile (not local), reorder mobile tabs (tree default), expand mobile onboarding to 8 dense pages matching web fields, and tune the enrich prompt to be less optimistic / more realistic.

**Architecture:** Mostly mobile client changes; `/api/enrich` already supports per-scenario AI (`enrich.ts:166-173`), and web's `addScenario` already enriches — so the "local scenarios" bug is mobile-only wiring. One shared server prompt edit (WS-E) affects both platforms.

**Tech Stack:** Expo/React Native, `@lifeplanner/core`, Next API (`/api/enrich`), vitest.

**Spec:** `docs/superpowers/specs/2026-07-02-prediction-realism-onboarding-tabs-design.md`

**Gates:** mobile = `cd mobile && npx tsc --noEmit`. Anything touching web/shared (Task 1 web label, Task 5 enrich) also runs `/green` (`npx tsc --noEmit && npx vitest run && npx next build && rm -rf .next`). Commit per task. No deploy inside tasks — controller OTAs/pushes after.

---

### Task 1: Rename scenarios → 高光 / 平稳 / 低谷 (mobile + web labels)

**Files:** Modify `mobile/app/path/[pathId].tsx`; Modify `src/components/PathDetail.tsx`.

- [ ] **Step 1: Mobile — rename the `SCENARIOS` labels.** In `mobile/app/path/[pathId].tsx`, the const at the top:
```ts
const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "optimistic", label: "乐观" },
  { value: "likely", label: "中性" },
  { value: "conservative", label: "保守" },
];
```
Change the three labels to `"高光"`, `"平稳"`, `"低谷"` (values unchanged).

- [ ] **Step 2: Mobile — rename the climb-bar labels.** In the same file, the array inside the "三种可能的未来" block:
```ts
{ key: "optimistic", label: "乐观", color: "#0f9d6a" },
{ key: "likely", label: "中性", color: "#c77600" },
{ key: "conservative", label: "低谷", color: "#e84a6f" },
```
Change labels to `"高光"`, `"平稳"`, `"低谷"` (keys/colors unchanged).

- [ ] **Step 3: Web — rename the same three scenario labels.** Open `src/components/PathDetail.tsx`, find where the three scenarios are labelled 乐观/中性/保守 (a `SCENARIOS`-like array and/or the odds display). Rename the display text to 高光/平稳/低谷 via the i18n helper: add English entries in `src/i18n/messages.ts` for the new keys if they route through `t(...)` (ADDITIONS ONLY — never rewrite the dict; Chinese-punctuation keys quoted; no ASCII quotes inside Chinese). If the labels are inline literals, replace the literals. Keep `Scenario` enum values (`optimistic`/`likely`/`conservative`) unchanged everywhere.

- [ ] **Step 4: Gate.** `cd mobile && npx tsc --noEmit` (clean) AND web `/green` (tsc + vitest + `next build` + `rm -rf .next`) since web changed.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "feat(A): rename scenarios 乐观/中性/保守 → 高光/平稳/低谷 (labels only, mobile+web)"
```

---

### Task 2: Tab reorder — 人生树 (default) · 日历 · 目标 · 我 (mobile)

**Files:** Modify `mobile/app/(tabs)/index.tsx`; Create `mobile/app/(tabs)/calendar.tsx`; Delete `mobile/app/(tabs)/tree.tsx`; Modify `mobile/app/(tabs)/_layout.tsx`.

- [ ] **Step 1: Make the tree the index (default landing).** Replace the contents of `mobile/app/(tabs)/index.tsx` with:
```ts
export { default } from "../../src/screens/TreeScreen";
```

- [ ] **Step 2: Add the calendar route.** Create `mobile/app/(tabs)/calendar.tsx`:
```ts
export { default } from "../../src/screens/ScheduleScreen";
```

- [ ] **Step 3: Remove the now-redundant tree route.** `git rm "mobile/app/(tabs)/tree.tsx"` (index is the tree now).

- [ ] **Step 4: Reorder + relabel the tabs.** In `mobile/app/(tabs)/_layout.tsx`, replace the four `<Tabs.Screen>` lines with, in this order:
```tsx
      <Tabs.Screen name="index" options={{ title: "人生树", tabBarIcon: icon("sitemap-outline") }} />
      <Tabs.Screen name="calendar" options={{ title: "日历", tabBarIcon: icon("calendar-month-outline") }} />
      <Tabs.Screen name="goals" options={{ title: "目标", tabBarIcon: icon("target") }} />
      <Tabs.Screen name="me" options={{ title: "我", tabBarIcon: icon("account-circle-outline") }} />
```
Update the file's top comment from "底部 4 Tab：首页 / 目标 / 人生树 / 我" to "底部 4 Tab：人生树 / 日历 / 目标 / 我（人生树默认落地）".

- [ ] **Step 5: Audit route references.** Run `grep -rn "\"/tree\"\|'/tree'\|navigate(\"/\")\|push(\"/\")\|\"/\")" mobile/app mobile/src --include=*.tsx`. If anything navigates to `/tree` (gone) or assumes `/` = schedule, update it (`/` is now the tree; the schedule is `/calendar`). In `mobile/src/screens/ScheduleScreen.tsx`, if any visible copy says "首页", it's fine to leave (it's the 日历 tab now — no header shows the route name), but if a title literally reads 首页, change to 日历.

- [ ] **Step 6: Gate.** `cd mobile && npx tsc --noEmit` → clean.

- [ ] **Step 7: Commit.**
```bash
git add -A
git commit -m "feat(C/mobile): tab order 人生树(default)/日历/目标/我; tree is the index route"
```

---

### Task 3: All three scenarios AI-generated (mobile)

**Files:** Modify `mobile/src/state/store.tsx` (`addScenario`); Modify `mobile/app/path/[pathId].tsx` (drop the local-variant prefetch + show predicting overlay).

- [ ] **Step 1: Make `addScenario` enrich the new variant via AI.** In `mobile/src/state/store.tsx`, the current callback is:
```ts
  const addScenario = useCallback(
    (basePathId: string, scenario: Scenario) => {
      const cur = treeRef.current;
      if (!cur) return;
      commit(addScenarioVariant(cur, basePathId, scenario, localGenerator, nowISO()));
    },
    [commit],
  );
```
Replace it with a version that creates the variant locally (geometry) then AI-enriches it (scenario-specific), mirroring `addChoiceBranch`:
```ts
  const addScenario = useCallback(
    (basePathId: string, scenario: Scenario) => {
      const cur = treeRef.current;
      if (!cur) return;
      const next = addScenarioVariant(cur, basePathId, scenario, localGenerator, nowISO());
      const variant = next.paths[next.paths.length - 1];
      commit(next);
      if (hasBackend()) {
        setEnriching(true);
        void enrichPath(next, variant)
          .then((result) => {
            if (!result) return;
            const t = treeRef.current;
            if (!t) return;
            commit({
              ...t,
              paths: t.paths.map((p) => (p.id === variant.id ? applyEnrichToPath(p, result) : p)),
            });
          })
          .catch(() => {})
          .finally(() => setEnriching(false));
      }
    },
    [commit],
  );
```
(`addScenarioVariant` appends the new variant as the last path; `enrichPath`/`applyEnrichToPath`/`hasBackend`/`setEnriching` are already in scope — same imports `addChoiceBranch` uses. If `addScenarioVariant` returns the SAME tree because an identical variant already exists, `variant` would be a pre-existing path — harmless: it just re-enriches it; but to avoid a needless re-enrich, guard: only enrich if `next !== cur`.) Add that guard: wrap the `if (hasBackend())` block in `if (next !== cur && hasBackend())`.

- [ ] **Step 2: Drop the local-variant prefetch in the detail.** In `mobile/app/path/[pathId].tsx`, DELETE the `useEffect` that eagerly generates optimistic/conservative variants (the block with the comment "预取:首次进入时若基础路径已推演完成…" that loops `["optimistic","conservative"]` calling `addScenario`). Scenarios are now generated+enriched on-demand when the user picks them. Leave `pickScenario` as-is (`setScenario(s); if (!variantFor(s)) addScenario(path.id, s);`) — now `addScenario` enriches.

- [ ] **Step 3: Show the predicting animation while a scenario enriches.** In `mobile/app/path/[pathId].tsx`, import the overlay at the top: `import PredictingOverlay from "../../src/components/PredictingOverlay";`. Just before the final closing tag of the screen's returned `<ScrollView>...</ScrollView>` (wrap if needed), render the overlay so it covers the detail while enriching. Concretely, change the outer return to a fragment:
```tsx
  return (
    <>
      <ScrollView ...>
        ...existing content...
      </ScrollView>
      <PredictingOverlay visible={enriching} label={path.choiceLabel} />
    </>
  );
```
(`enriching` is already destructured from `useApp()` in this file. `path` is non-null after the guard. Keep all existing ScrollView props/children unchanged — only wrap it and add the overlay sibling.)

- [ ] **Step 4: Gate.** `cd mobile && npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "feat(B/mobile): all 3 scenarios AI-enriched on demand (drop local variant prefetch)"
```

---

### Task 4: Onboarding — 8 dense pages matching web fields (mobile)

**Files:** Modify `mobile/src/screens/OnboardingScreen.tsx`.

Context: `ProfileInputs` already includes every field (`skills?`, `savings?: SavingsBand`, `debt?: DebtBand`, `familyResponsibility?`, `riskAppetite?`, `nationality?`, `status?`, `hasSideHustle`, `sideHustle`, `hobbies`, etc.) — the screen just doesn't collect them. Option constants are exported from `@lifeplanner/core/profile`: `SAVINGS_OPTIONS`, `DEBT_OPTIONS`, `RISK_OPTIONS` (and grep `packages/core/src/profile.ts` for `EDUCATION_OPTIONS`/`SALARY_OPTIONS`/`RELATIONSHIP_OPTIONS`/family options — reuse whatever exists; the web `Onboarding.tsx` imports the same ones, mirror it).

- [ ] **Step 1: Read both files.** Read the current `mobile/src/screens/OnboardingScreen.tsx` (note its `steps: {title,hint?,required?,body}[]` array pattern, the `Select`/`Input`/chip components it already uses, and how `submit()` assembles `inputs`) and `src/components/Onboarding.tsx` (the web reference for field grouping, option imports, and copy). Follow the mobile file's existing component/style patterns.

- [ ] **Step 2: Add state + option imports for the missing fields.** Add `useState` for: `skills` (string), `savings` (`SavingsBand | ""`), `debt` (`DebtBand | ""`), `familyResponsibility` (its enum `| ""`), `riskAppetite` (`RiskAppetite | ""`), `nationality` (string), `status` (string), `hasSideHustle` (boolean) + `sideHustle` (string). Import the option constants from `@lifeplanner/core/profile` and the types from `@lifeplanner/core/types`.

- [ ] **Step 3: Restructure into 8 steps** (denser — 2–3 related fields per page). Suggested grouping (keep required = name+age only):
  1. 称呼 + 年龄
  2. 学历 + 专业 + 现在的职业
  3. 月薪 + 有无副业(+副业是什么)
  4. 存款 + 负债
  5. 技能/专长 + 爱好
  6. 情感状态 + 家庭责任
  7. 所在地 + 国籍 + 当前身份/阶段
  8. 风险偏好 + 当前面临的岔路(crossroad) + 作息窗(起床/睡觉)
  Build each step's `body` with the existing `Select`/`Input`/chip primitives (mirror the web field for options/labels). Density: put multiple `Field`-style rows per step.

- [ ] **Step 4: Thread all fields into `submit()`'s `inputs`.** Extend the object passed to `onboard(inputs, {start,end})` to include `skills: skills.trim() || undefined`, `savings: savings || undefined`, `debt: debt || undefined`, `familyResponsibility: familyResponsibility || undefined`, `riskAppetite: riskAppetite || undefined`, `nationality: nationality.trim() || undefined`, `status: status.trim() || undefined`, `hasSideHustle`, `sideHustle: sideHustle.trim() || ""`. (These flow into `deriveAreas`/`buildSnapshot`.) Do NOT change the post-onboard "wait for status-quo AI before entering home" behavior added earlier — leave `onboard` untouched.

- [ ] **Step 5: Gate.** `cd mobile && npx tsc --noEmit` → clean. Fix any type mismatch (band enums must match the `SavingsBand`/`DebtBand`/`RiskAppetite`/family type unions exactly — use the real enum values from the option constants, not display labels).

- [ ] **Step 6: Commit.**
```bash
git add mobile/src/screens/OnboardingScreen.tsx
git commit -m "feat(D/mobile): onboarding 8 dense pages — skills/savings/debt/risk/family/nationality/status/sideHustle (web parity)"
```

---

### Task 5: Prediction realism — tune the enrich prompt (MAIN-CONTROL, human-in-loop; NOT a subagent task)

**Files:** Modify `src/lib/enrich.ts` (server-only, heavily tuned — edit surgically).

Process (controller runs this, iterating with eval — do NOT hand to a fire-and-forget subagent):
- [ ] **Step 1:** Re-read `src/lib/enrich.ts`. Identify the feasibility-calibration lines and the arc/optimism framing. Make SURGICAL edits toward realism: (a) instruct more conservative, better-calibrated feasibility (avoid defaulting high / 60%+ unless truly warranted); (b) make the overall arc less uniformly upward — allow stagnation/regression/cost; (c) strengthen the existing "顺利不等于无摩擦" for the optimistic scenario. **Keep** the anti-prophecy tone, forbidden-word list, ≥2 real frictions/path, multi-dimension, causal, story-length constraints — tighten realism only, delete no constraint.
- [ ] **Step 2:** Run the `predict-eval` skill and/or dispatch the `prediction-quality-reviewer` agent on 2–3 fresh sample generations (varied profiles). Grade: real-world anchors, density, no contradiction, no cliché, and NOT over-optimistic.
- [ ] **Step 3:** Iterate Steps 1–2 until samples read realistic (not rosy). 
- [ ] **Step 4:** Gate `/green` (enrich.ts is imported by the build/tests). Commit `feat(E): tune enrich prompt for realism / less optimism (+eval)`.

---

## Final (controller)
- [ ] Full gates: `cd mobile && npx tsc --noEmit` + web `/green`.
- [ ] Update `task_plan.md` / `progress.md`. Push `master`. OTA mobile (`eas update --environment production`, `EXPO_PUBLIC_API_BASE_URL` inline). Web/enrich ships via master→Vercel.
- [ ] Tell the user to relaunch twice + what to verify.

## Self-Review
- **Spec coverage:** WS-A→Task1; WS-C→Task2; WS-B→Task3; WS-D→Task4; WS-E→Task5. All covered. On-demand scenario enrich (Task3 drops prefetch, enriches in `addScenario`). Field parity (Task4 from web). ✓
- **Placeholder scan:** Tasks 1–3 have exact code; Task 4 is structural (mirrors an existing in-repo pattern + explicit field list + real option-constant imports — acceptable for a UI build) with a hard gate; Task 5 is intentionally iterative/human-in-loop (eval), not a code-complete step. No lazy "handle edge cases".
- **Type consistency:** `Scenario` values unchanged (labels only). `addScenario` signature unchanged. Band fields use the real `SavingsBand`/`DebtBand`/`RiskAppetite` unions via core option constants. Route names (`index`=tree, `calendar`=schedule) consistent across Task 2 files.
