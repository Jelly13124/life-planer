Status: DONE

Commit(s): 2bb7ad9 refactor: decouple decision style from risk and AI facts

Test result: PASS — `npm test -- src/lib/__tests__/enrichClient.test.ts packages/core/src/__tests__/profile.test.ts`, `npm run typecheck`, and `npx tsc -p mobile/tsconfig.json --noEmit` all succeeded.

Concerns: Left the pre-existing unrelated working-tree changes in `src/lib/enrich.ts` untouched because they were not required for this final Task 3 delta; production code scan found no remaining `lifePathCode`/`lifePathAnswers` or `riskAppetiteFromAxes`/`styleHintForCode` usage outside the legacy lifePath module itself.

Report path: `C:\Users\Jerry\Desktop\lifeplaner\.superpowers\sdd\task-3-report.md`

Fix review follow-up:

- Files:
  - `src/lib/enrich.ts`
  - `src/lib/__tests__/enrichClient.test.ts`

- Tests added/adjusted:
  - strengthened AI-context assertion to require explicit self-reported decision-style wording and forbid personality/judgment framing
  - added parameterized quick/full enrichment-request coverage proving the builder preserves the user-selected `riskAppetite` unchanged
  - added malformed v2 summary coverage proving invalid numeric scores return no style context and do not throw

- Results:
  - PASS — `npm test -- src/lib/__tests__/enrichClient.test.ts`
  - PASS — `npm test -- src/lib/__tests__/enrichClient.test.ts packages/core/src/__tests__/profile.test.ts`
  - PASS — `npm run typecheck`
  - PASS — `npx tsc -p mobile/tsconfig.json --noEmit`

Follow-up fix commit (remaining review findings):

- Files:
  - `src/components/Onboarding.tsx`
  - `src/lib/onboardingProfile.ts`
  - `src/lib/enrich.ts`
  - `src/lib/__tests__/enrichClient.test.ts`

- Root cause:
  - the risk-independence test started from an already-built `Profile`, so it never exercised the real onboarding construction path
  - `buildDecisionStyleContext` assumed `decisionStyle.scores` was a destructurable object once `version === 2`

- TDD evidence:
  - RED — `npm test -- src/lib/__tests__/enrichClient.test.ts` failed because `@/lib/onboardingProfile` did not exist yet, proving the production onboarding path was not extractable/testable
  - GREEN — added a shared pure onboarding-profile builder used by `Onboarding`, then reran the same test file to passing

- Tests added/adjusted:
  - quick/full risk-appetite regression now builds the profile through the extracted onboarding constructor before creating the enrichment request
  - malformed decision-style cases now cover `scores: null`, missing `scores`, missing axis values, non-finite numbers, and out-of-range values, all asserting empty context and no throw

- Results:
  - PASS — `npm test -- src/lib/__tests__/enrichClient.test.ts`
  - PASS — `npm test -- src/lib/__tests__/enrichClient.test.ts packages/core/src/__tests__/profile.test.ts`
  - PASS — `npm run typecheck`
  - PASS — `npx tsc -p mobile/tsconfig.json --noEmit`
