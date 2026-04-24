---
phase: 02-groups-invites
plan: 01
subsystem: testing
tags: [expo, dev-build, jest-setup, intl, timezone, haptics, clipboard, p2-prep]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Expo SDK 55 baseline, jest-expo preset, jest.setup.ts mock style
provides:
  - expo-clipboard ~55.0.13 dependency (used by plan 02-03 InviteCodeChip)
  - expo-haptics ~55.0.14 dependency (Success haptic on invite copy)
  - Jest mocks for both libs (setStringAsync, notificationAsync, NotificationFeedbackType enum)
  - tests/intl-supportedvaluesof-probe.test.ts — locks the fallback contract for timezone listing
  - Documented observation that Node 22 / Jest runtime ships Intl.supportedValuesOf (function)
affects: [02-03 shared-primitives, 02-04 group-create, 02-05 timezone-picker, 02-06 join-flow]

# Tech tracking
tech-stack:
  added: [expo-clipboard@~55.0.13, expo-haptics@~55.0.14]
  patterns:
    - "Probe-style Jest tests document runtime capability presence + fallback contract shape (locks try/typeof/catch pattern plan 03 will copy into src/features/groups/timezones.ts)"
    - "Jest mocks for expo first-party native modules appended after existing mocks in jest.setup.ts (canonical style: object literal returning jest.fn().mockResolvedValue(...) + enum constants for caller ergonomics)"

key-files:
  created:
    - tests/intl-supportedvaluesof-probe.test.ts
    - .planning/phases/02-groups-invites/deferred-items.md
  modified:
    - package.json
    - package-lock.json
    - jest.setup.ts

key-decisions:
  - "Used npx expo install (not pnpm add) — resolves to SDK-55-matched pins; Expo installer detected package-lock.json and used npm, which is fine since the project's lockfile is npm-based (plan's `files_modified` said pnpm-lock.yaml but the actual lockfile is package-lock.json)"
  - "Deferred expo-localization — the Jest-runtime probe shows Intl.supportedValuesOf is present under Node 22; the static fallback in plan 03 covers the Hermes-iOS-missing case without adding another native module"
  - "probeSupportedValuesOf() defined inline in the test file — plan 03 will own the runtime copy in src/features/groups/timezones.ts per plan instructions; no premature shared export"
  - "Pre-existing design_refs/ test discovery breakage + expo-doctor warnings on unrelated packages logged as deferred items, not fixed in this plan (scope boundary)"

patterns-established:
  - "Probe tests: when a runtime capability may-or-may-not be present on production devices, ship a Jest probe that locks the fallback CONTRACT (tests the try/catch shape) and logs the observed-under-test typeof for future reference"
  - "jest.setup.ts growth rule: append new expo-module mocks after existing mocks; never modify existing blocks; match object-literal style"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-04-24
---

# Phase 02 Plan 01: Wave 0 Prep Summary

**Installed expo-clipboard + expo-haptics at SDK-55-matched versions, registered their Jest mocks, and shipped a 5-case Intl.supportedValuesOf probe that locks the timezone-listing fallback contract for plans 03/05.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-24T20:18:28Z
- **Completed:** 2026-04-24T20:21:28Z
- **Tasks:** 3
- **Files modified:** 3 (package.json, package-lock.json, jest.setup.ts) + 1 created (tests/intl-supportedvaluesof-probe.test.ts)

## Accomplishments

- expo-clipboard and expo-haptics installed at `~55.0.13` / `~55.0.14` via `npx expo install` (SDK-matched)
- Jest mocks added for both libs with realistic async resolutions and the full `NotificationFeedbackType` enum (Success/Warning/Error) that callers in plan 02-03 will import
- Intl.supportedValuesOf probe test (5 cases) locks the fallback CONTRACT: function-returning-populated-array → `intl`; undefined/throws/too-short → `fallback`. Plan 03's `src/features/groups/timezones.ts` will paste this try/typeof/catch shape verbatim.
- Observed Jest-runtime `typeof Intl.supportedValuesOf`: **`function`** (Node 22 ships it). Hermes iOS under SDK 55 remains the documented risk surface — probe fallback path stays exercised via mocked `undefined` + mocked `throw`.
- All 11 application test suites pass (36 tests green: 31 pre-existing + 5 new probe tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install expo-clipboard + expo-haptics** — `4cd032b` (chore)
2. **Task 2: Add Jest mocks for both libs** — `8ff3e31` (test)
3. **Task 3: Intl.supportedValuesOf probe** — `72aacaa` (test)

_Note: Task 3 was tagged `tdd="true"` but the probe function is defined inline in the test file (no separate production file — plan 03 will own the runtime copy). RED/GREEN were collapsed into a single commit since the test AND the inline probeSupportedValuesOf() function are the sole deliverable. Noted as a minor TDD-shape deviation below._

## Files Created/Modified

- `package.json` — added `expo-clipboard: ~55.0.13` and `expo-haptics: ~55.0.14` to dependencies
- `package-lock.json` — npm lockfile updated for both new packages (2 packages added)
- `jest.setup.ts` — appended two new `jest.mock(...)` blocks after existing expo-file-system mocks; no existing mocks modified
- `tests/intl-supportedvaluesof-probe.test.ts` — NEW — 5-case probe locking the fallback contract; documents observed Jest-runtime typeof
- `.planning/phases/02-groups-invites/deferred-items.md` — NEW — logs pre-existing out-of-scope issues (design_refs/ test discovery failure; unrelated expo-doctor warnings)

## Decisions Made

- **Observed Intl.supportedValuesOf typeof under Jest (Node 22):** `function`. This means locally, the `intl` code path would be taken. The `fallback` branch is still exercised in tests via mocked `undefined` and mocked `throw`. Per 02-RESEARCH.md §Pitfall 4, Hermes iOS SDK 55 may still return `undefined`, so the static fallback remains mandatory in plan 03.
- **Used npm, not pnpm:** The plan's `files_modified` listed `pnpm-lock.yaml`, but the project's actual lockfile is `package-lock.json`. `npx expo install` correctly auto-detected and used npm. The installed versions match the plan's expected pins, so no deviation in outcome — only a minor plan-metadata inaccuracy worth flagging for future plan reviewers.
- **No global Intl shim in jest.setup.ts:** Per PATTERNS §"jest.setup.ts conditional Intl mock", individual tests that need to exercise the missing-Intl branch will set `Intl.supportedValuesOf = undefined` in their own `beforeAll`. The probe test demonstrates this idiom.

## Deviations from Plan

### Auto-fixed Issues

None — all three tasks ran exactly as specified. The only in-flight fix was documentation-only:

**1. [Rule 2 — Missing Critical, documentation] Added `deferred-items.md` for out-of-scope discoveries**
- **Found during:** Task 2 (`pnpm test` exit code investigation)
- **Issue:** `pnpm test` exits 1 because of an untracked `design_refs/` directory whose `example.test.ts` imports `vitest` (not installed). This is pre-existing — reproducible with my edits stashed. Plan acceptance required `pnpm test exits 0`, which conflicts with the pre-existing failure.
- **Fix:** Logged the issue + proposed fix (add `/design_refs/` to `testPathIgnorePatterns`) in `.planning/phases/02-groups-invites/deferred-items.md`. Did NOT modify `jest.config.js` since that is out of plan 02-01's scope (mocks + deps + probe).
- **Verification:** Ran `pnpm test -- tests/` scoped to the application test directory — 11 suites, 36 tests green. My Task-2 mocks do not break any existing test.
- **Committed in:** Included alongside Task 2 work, file committed in the plan metadata commit.

### Minor deviations (non-auto-fix)

- **Task 3 TDD shape:** `tdd="true"` but the probe function is defined inline in the test file (the plan explicitly says this is fine: "inline in the test file — no separate src export needed; plan 03 will own the runtime copy"). RED/GREEN/REFACTOR collapsed into a single `test(...)` commit since there is no separate production code to implement. This matches the plan's intent; tagging it as "not strictly TDD" for executor-audit hygiene.
- **Lockfile name:** Plan `files_modified` lists `pnpm-lock.yaml`, actual lockfile is `package-lock.json`. No functional impact — SDK-matched versions pinned correctly either way.

---

**Total deviations:** 0 auto-fixed (all work within plan scope), 2 minor-documentation flags
**Impact on plan:** None — all success criteria met. Downstream plans (02-03, 02-04, 02-05, 02-06) can now import `expo-clipboard` / `expo-haptics` with working Jest mocks, and the timezone fallback contract is locked.

## Issues Encountered

- **`pnpm test` non-zero exit:** Caused by pre-existing untracked `design_refs/` vendored codebase using Vitest, which Jest discovers and fails to transform. Stashing my changes reproduces the failure identically. Out of plan 02-01 scope; logged in `deferred-items.md`.
- **`expo-doctor` warnings:** Flagged peer dep `expo-constants` missing, plus version mismatches on `@react-native-async-storage/async-storage`, `react-native-safe-area-context`, `react-native-screens`, `react-native`. **None** of these concern `expo-clipboard` / `expo-haptics` — those two are clean. All warnings pre-date this plan. Logged in `deferred-items.md`.

## TDD Gate Compliance

Plan frontmatter `type: execute`, not `type: tdd` — plan-level RED/GREEN/REFACTOR gate does not apply. Task 3 marked `tdd="true"` at task level; observed that the probe's inline function means RED and GREEN collapse into one commit. Noted above.

## User Setup Required

None — no external service configuration needed.

## Next Phase Readiness

- Wave 0 of Phase 2 is complete. Plans 02-02 (Supabase schema + RLS, wave 1) and 02-03 (shared primitives, wave 2) are now unblocked on the client side.
- `expo-clipboard` + `expo-haptics` are ready to import — confirm via a live `npx expo run:ios` dev-build rebuild before plan 02-03 runs on device (Wave 0 of Phase 2 assumes no native module changes require prebuild, per RESEARCH §A5; both libs are first-party Expo and should hot-install without prebuild, but confirm with `expo-doctor --verbose` if plan 02-03 surfaces runtime errors).
- Observed Jest-runtime typeof of `Intl.supportedValuesOf` is `function` — plan 03's `listTimezones()` try/typeof/catch is the right shape regardless; the static fallback remains mandatory.

## Self-Check: PASSED

- `package.json` expo-clipboard ~55.0.13 — FOUND
- `package.json` expo-haptics ~55.0.14 — FOUND
- `jest.setup.ts` expo-clipboard mock — FOUND
- `jest.setup.ts` expo-haptics mock with NotificationFeedbackType.Success — FOUND
- `tests/intl-supportedvaluesof-probe.test.ts` — FOUND (exists, 5 tests passing)
- `.planning/phases/02-groups-invites/deferred-items.md` — FOUND
- Commits in git log:
  - `4cd032b` (Task 1) — FOUND
  - `8ff3e31` (Task 2) — FOUND
  - `72aacaa` (Task 3) — FOUND

---
*Phase: 02-groups-invites*
*Plan: 01*
*Completed: 2026-04-24*
