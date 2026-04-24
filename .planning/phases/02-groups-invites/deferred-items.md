# Deferred Items — Phase 02 Execution

Items discovered during phase 02 execution that are OUT OF SCOPE for the plan in which they were found. Logged here for future triage per GSD scope-boundary rules.

## 02-01 (discovered 2026-04-24)

### Pre-existing: Jest discovers vitest-based tests in `design_refs/`

- **Found during:** Task 2 of plan 02-01 (add Jest mocks)
- **Symptom:** `pnpm test` exits 1 because `design_refs/design_ref_code_from_lovable/src/test/example.test.ts` imports `vitest` (not installed).
- **Scope check:** Stashing my `jest.setup.ts` edit and re-running `pnpm test` reproduces the exact same failure — this is pre-existing, not caused by plan 02-01.
- **Status of `design_refs/`:** Untracked directory (listed at session start). Appears to be a vendored design reference codebase using Vitest.
- **Real test health:** The 10 application test suites under `tests/` all pass — 31 tests green.
- **Proposed fix (deferred):** Add `'/design_refs/'` to `testPathIgnorePatterns` in `jest.config.js`, OR add `design_refs/` to `.gitignore` + ensure jest's default root globbing excludes it. Either way this is repo-hygiene work, not plan-02-01 scope.

### Pre-existing: `expo-doctor` warnings on other packages

- **Found during:** Task 1 of plan 02-01 (`npx expo-doctor`)
- **Warnings surfaced (none about `expo-clipboard` / `expo-haptics`):**
  - Missing peer dep: `expo-constants` (required by `expo-router`)
  - Version mismatches: `@react-native-async-storage/async-storage` (major: 2.2.0 expected / 3.0.2 found), `react-native-safe-area-context` (~5.6.2 / 5.7.0), `react-native-screens` (~4.23.0 / 4.24.0), `react-native` (0.83.6 / 0.83.1)
- **Scope check:** All pre-existing — untouched by plan 02-01's two additions.
- **Proposed fix (deferred):** Address in a dedicated dependency-hygiene plan or as part of phase 06 pre-rollout hardening.
