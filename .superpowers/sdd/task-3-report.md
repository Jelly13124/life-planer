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
