---
phase: 04-social-surfaces
plan: 01
subsystem: testing
tags: [jest, pgtap, supabase-realtime, react-query, typescript, virtual-mocks]

# Dependency graph
requires:
  - phase: 03-capture-admin-review
    provides: "Channel-chain Realtime mock pattern (useTodaySubmissionRealtime test) extracted into reusable helper"
  - phase: 01-foundation
    provides: "handle_submission_approval no-op stub + group_members counter columns + group_members_leaderboard_idx (P4 test scaffolds target the eventual replacements)"
provides:
  - "tests/_helpers/mockSupabaseChannel.ts — single canonical channel-chain mock factory exporting setupChannelMock()"
  - "jest.setup.ts — global LayoutAnimation mock with Presets.easeInEaseOut for 04-04 / 04-05 component tests"
  - "4 RED pgTAP scaffolds (40 assertions total) for handle_submission_approval body + 4 new RPCs"
  - "5 RED Jest scaffolds (20 tests total) for the 5 not-yet-existing Phase 4 hooks"
  - "Refactored useTodaySubmissionRealtime.test.tsx — single canonical channel mock site (drift fix)"
affects: [04-02, 04-03, 04-04, 04-05, 04-06]

# Tech tracking
tech-stack:
  added: []  # No new libraries; all infrastructure (jest, pgTAP, @testing-library/react-native, @tanstack/react-query) already pinned
  patterns:
    - "Virtual jest mock factories ({ virtual: true }) for not-yet-existing modules — keeps typecheck green during RED phase (HIGH #7 mitigation)"
    - "In-place patching of cached react-native module to inject test surfaces (LayoutAnimation mock) without re-evaluating react-native"
    - "Single canonical channel-chain mock helper consumed by every Realtime hook test (eliminates drift)"

key-files:
  created:
    - "tests/_helpers/mockSupabaseChannel.ts"
    - "supabase/tests/handle_submission_approval_streak.sql"
    - "supabase/tests/handle_submission_approval_idempotency.sql"
    - "supabase/tests/phase4_rpc_permissions.sql"
    - "supabase/tests/phase4_rpc_correctness.sql"
    - "tests/features/groups/useGroupLeaderboard.test.tsx"
    - "tests/features/groups/useGroupLeaderboardRealtime.test.tsx"
    - "tests/features/submissions/useGroupFeed.test.tsx"
    - "tests/features/groups/useGroupTombstones.test.tsx"
    - "tests/features/groups/useGroupSocialCounts.test.tsx"
  modified:
    - "jest.setup.ts"
    - "tests/submissions/useTodaySubmissionRealtime.test.tsx"

key-decisions:
  - "Patched LayoutAnimation onto the cached react-native module via Object.defineProperty instead of using jest.mock('react-native', ...) + jest.requireActual — avoids TurboModuleRegistry DevMenu init crash"
  - "Virtual-mocked every not-yet-existing Phase 4 hook module so pnpm typecheck stays green during Wave 0 RED state (HIGH #7)"
  - "Anon caller of get_today_posted_count asserts SQLSTATE 42501 permission denied (HIGH #6 strict-grant interpretation, NOT lenient is(..., 0))"
  - "Tombstone hook returns the locked shape { pendingToday, missedYesterday, isPending, error } (MEDIUM #3)"

patterns-established:
  - "Virtual-mock pattern: jest.mock(MODULE_PATH, () => ({ <hook_name>: jest.fn() }), { virtual: true }) at the top of every RED hook test so the import resolves at typecheck time"
  - "Channel-chain helper consumption: `const { wrapper, on, getChannelName } = setupChannelMock(supabase)` — every Realtime hook test follows this exact shape"
  - "In-place RN module patching for global test surfaces (LayoutAnimation) — avoids re-evaluating react-native and tripping native bridge requirements"

requirements-completed: [PTS-01, PTS-02, PTS-03, LB-01, LB-02, FEED-01, FEED-02, FEED-03]
# NOTE: Wave 0 only LANDS the test scaffolds for these requirements — actual
# acceptance still gates on Waves 1–3 flipping the RED tests to GREEN.

# Metrics
duration: ~50min
completed: 2026-05-08
---

# Phase 4 Plan 01: Wave 0 Test Infrastructure Summary

**Single canonical channel-chain mock helper, LayoutAnimation jest mock with Presets, 4 RED pgTAP scaffolds (40 assertions), and 5 RED Jest scaffolds (20 tests) — every Wave 1+ Phase 4 task now has a failing test to drive against.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-05-08T22:25:00Z (approx)
- **Completed:** 2026-05-08T23:15:54Z
- **Tasks:** 4 (all atomic commits)
- **Files created:** 10
- **Files modified:** 2

## Accomplishments

- **Channel-chain helper extracted (Task 1):** `tests/_helpers/mockSupabaseChannel.ts` exports a single `setupChannelMock(supabase)` factory; the existing `tests/submissions/useTodaySubmissionRealtime.test.tsx` was refactored to consume it (drift fix per LOW concern from REVIEWS.md).
- **LayoutAnimation mock with Presets (Task 2):** `jest.setup.ts` now patches `LayoutAnimation` (with `Presets.easeInEaseOut`, `Types`, `Properties`, `create`, `configureNext`) onto the cached react-native module so 04-05's `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` resolves at test time (MEDIUM #4 fix).
- **4 RED pgTAP scaffolds (Task 3, 40 assertions):** `handle_submission_approval_streak.sql` (8), `handle_submission_approval_idempotency.sql` (5), `phase4_rpc_permissions.sql` (17), `phase4_rpc_correctness.sql` (10). Coverage includes D-01 cross-tz proof, D-02 four-branch streak recurrence, D-03 idempotency, D-19 column-allowlist, HIGH #6 strict-grant anon assertion, MEDIUM tiebreaker `joined_at ASC` proof.
- **5 RED Jest scaffolds (Task 4, 20 tests):** Every Phase 4 hook (LB-01, LB-02, FEED-01, FEED-02/03, social-counts) has a RED test file. Each file uses `{ virtual: true }` jest.mock so `pnpm typecheck` stays green (HIGH #7 mitigation). The tombstone test asserts the locked shape `{ pendingToday, missedYesterday, isPending, error }` (MEDIUM #3 pinned).

## Task Commits

Each task committed atomically:

1. **Task 1: Extract channel-chain mock helper + refactor source test** — `675a3df` (test)
2. **Task 2: Add LayoutAnimation Jest mock with Presets.easeInEaseOut** — `773bf93` (test)
3. **Task 3: Create 4 RED pgTAP scaffolds for Phase 4 DB layer** — `80ddff5` (test)
4. **Task 4: Create 5 RED Jest scaffolds for Phase 4 hooks** — `c474a69` (test)

## Files Created/Modified

### Created

- `tests/_helpers/mockSupabaseChannel.ts` — `setupChannelMock(supabase)` factory exporting `RealtimeFixture` with `getChannelName()` accessor (single canonical name; no `channelName` alias).
- `supabase/tests/handle_submission_approval_streak.sql` — 8 assertions covering D-02 NULL/consecutive/gap/longest_streak branches + D-01 server-derived local_date proof (LA + NY groups).
- `supabase/tests/handle_submission_approval_idempotency.sql` — 5 assertions covering D-03 WHEN clause idempotency, 0003 admin-immutable defense-in-depth, two-day serial proxy for concurrency (with inline note: pgTAP single-session, race-safety relies on locked-row UPDATE pattern from 04-02 §Section 1, HIGH #1 from REVIEWS.md), D-19 column-allowlist trigger smoke test.
- `supabase/tests/phase4_rpc_permissions.sql` — 17 assertions: 4 RPCs × 4 personas (anon, stranger, member, admin) + ex-member + cross-group admin + D-19 trigger. **Anon × `get_today_posted_count` asserts `throws_ok(... '42501', NULL, ...)` permission denied** (HIGH #6 strict-grant interpretation locked).
- `supabase/tests/phase4_rpc_correctness.sql` — 10 assertions: 4-member seed for `get_pending_today` / `get_missed_yesterday` correctness + DST/cross-tz isolation in NY group + **deterministic tiebreaker proof** (Bob before Carol on identical points/streak via `joined_at ASC`, MEDIUM tiebreaker fix RESOLVED via REVIEWS replan 2026-05-08).
- `tests/features/groups/useGroupLeaderboard.test.tsx` — 4 tests for LB-01 RPC ordering / nullable narrowing.
- `tests/features/groups/useGroupLeaderboardRealtime.test.tsx` — 5 tests for LB-02 / D-20 channel name + filter + setQueryData patch + cleanup.
- `tests/features/submissions/useGroupFeed.test.tsx` — 4 tests for FEED-01 PostgREST embed + filter chain + flat-shape mapping.
- `tests/features/groups/useGroupTombstones.test.tsx` — 4 tests for FEED-02/03; final test asserts the **locked return shape** `{ pendingToday, missedYesterday, isPending, error }` (MEDIUM #3 pinned).
- `tests/features/groups/useGroupSocialCounts.test.tsx` — 3 tests for D-13/D-15 `get_today_posted_count` (with null-coercion to 0).

### Modified

- `jest.setup.ts` — added LayoutAnimation patch on cached react-native module via `Object.defineProperty` (66 lines added).
- `tests/submissions/useTodaySubmissionRealtime.test.tsx` — replaced inline `function setup()` with imports of `setupChannelMock` from the new helper at every call site (10 sites; assertion bodies unchanged).

## Decisions Made

### LayoutAnimation mock implementation (deviated from plan literal)

The plan suggested `jest.mock('react-native', () => ({ ...jest.requireActual('react-native'), LayoutAnimation }))`. That approach trips `TurboModuleRegistry.getEnforcing(...): 'DevMenu'` because `requireActual('react-native')` re-evaluates RN's core init BEFORE jest-expo's NativeModule mocks apply, breaking 40 of 40 test suites.

**Adopted approach:** Load react-native once through the jest-expo path, then patch `LayoutAnimation` onto the cached module object via `Object.defineProperty(RN, 'LayoutAnimation', { value: layoutAnimationMock })`. Because Node module cache is shared, every later `import { LayoutAnimation } from 'react-native'` sees the mocked surface — including 04-05's call site. Per-test files that fully replace react-native (e.g. `jest.mock('react-native', () => ({ AppState }))`) are unaffected because their mock REPLACES our patched module.

The mock surface still satisfies every plan acceptance criterion (`grep -c "Presets:" jest.setup.ts` returns 1, `grep -c "easeInEaseOut" jest.setup.ts` returns 8, `grep -c "LayoutAnimation"` returns 10).

### Virtual mock pattern (per plan)

Each of the 5 RED Jest test files declares `jest.mock(MODULE_PATH, () => ({ <hook>: jest.fn() }), { virtual: true })` BEFORE the import statement. This makes typecheck see a valid module for `import { useGroupLeaderboard } from '../../../src/features/groups/useGroupLeaderboard'` even though the file does not exist yet. **`pnpm typecheck` exits 0 (HIGH #7 GATE PASSED).**

When 04-03 lands the real production hook files, the `{ virtual: true }` mock continues to work — jest.mock prefers a real factory over a virtual one when both are valid. No follow-up cleanup is required.

### HIGH #6 strict-grant interpretation locked

`phase4_rpc_permissions.sql` Test 4 asserts:
```sql
select throws_ok(
  $$select public.get_today_posted_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$,
  '42501', NULL,
  'anon × get_today_posted_count raises 42501 permission denied (HIGH #6 strict-grant: public has no execute grant)'
);
```
This commits to the strict-grant interpretation: 04-02 must `revoke execute on function public.get_today_posted_count(uuid) from public; grant execute ... to authenticated;` so anon callers hit the SQL grant gate BEFORE the function body. The lenient `is(..., 0)` interpretation is ruled out.

### MEDIUM #3 tombstone return shape locked

`useGroupTombstones.test.tsx` Test 4 asserts the canonical shape `{ pendingToday, missedYesterday, isPending, error }` directly (NOT nested under `data`, NOT `{ today, yesterday }`). This shape is what 04-03 must produce.

### MEDIUM tiebreaker (joined_at ASC) locked

`phase4_rpc_correctness.sql` Test 6 asserts via `results_eq` that the leaderboard returns Bob before Carol when both have identical `(points=5, current_streak=3)` because Bob joined earlier. 04-02's `get_group_leaderboard` ORDER BY must be `points DESC, current_streak DESC, joined_at ASC`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LayoutAnimation mock approach broke all tests via TurboModuleRegistry crash**

- **Found during:** Task 2 (verifying acceptance criteria — `pnpm test --testPathPattern=tests/groups/groupDetailScreen`)
- **Issue:** The plan-suggested `jest.mock('react-native', () => ({ ...jest.requireActual('react-native'), LayoutAnimation }))` triggers `TurboModuleRegistry.getEnforcing(...): 'DevMenu' could not be found`. The factory's `requireActual` re-evaluates RN's core init before jest-expo's NativeModule mocks (which mock DevSettings) have applied. Result: 40 of 40 test suites fail to start.
- **Fix:** Replaced the `jest.mock` factory with an in-place patch on the cached react-native module via `Object.defineProperty(RN, 'LayoutAnimation', { configurable: true, writable: true, value: layoutAnimationMock })`. The patch runs AFTER react-native is fully initialized via the standard jest-expo path, so DevSettings is properly mocked. Every later `import { LayoutAnimation } from 'react-native'` sees the patched surface (Node module cache is shared).
- **Files modified:** `jest.setup.ts`
- **Verification:** Full Jest suite (40 suites / 240 tests) green; typecheck green; the LayoutAnimation surface includes Presets.easeInEaseOut + Types + Properties + create + configureNext per plan acceptance criteria.
- **Committed in:** `773bf93` (Task 2 commit)

**2. [Rule 1 - Bug] useGroupFeed test chain-builder helper had implicit-any types**

- **Found during:** Task 4 (running `pnpm typecheck`)
- **Issue:** The local `setupFromChain` helper in `useGroupFeed.test.tsx` had recursive arrow functions whose return types couldn't be inferred (TS7022/TS7023/TS7024 implicit-any errors). HIGH #7 GATE requires `pnpm typecheck` to exit 0.
- **Fix:** Added explicit return type `ChainNode` interface and annotated `buildEq(): jest.Mock` and `selectSpy: jest.fn((): ChainNode => ...)`.
- **Files modified:** `tests/features/submissions/useGroupFeed.test.tsx`
- **Verification:** `pnpm typecheck` exits 0.
- **Committed in:** `c474a69` (Task 4 commit, pre-staging fix)

---

**Total deviations:** 2 auto-fixed (Rule 1 — both bugs)
**Impact on plan:** Both auto-fixes essential for HIGH #7 typecheck gate to pass. No scope creep; both changes preserve plan acceptance criteria byte-for-byte (correct mock surface, correct virtual-mock count, correct test counts).

## Issues Encountered

- **Worktree node_modules layout:** The worktree had no lockfile, so `pnpm install` produced a `.pnpm` symlink layout that broke `transformIgnorePatterns` (jest couldn't transform `react-native@0.83.6` under the symlinked path). Recovered by copying the upstream `package-lock.json` into the worktree and re-installing via `npm install`. Future worktree-mode runs of this project should expect the same setup step.
- **Jest `--testPathPattern` collision with `.claude/` ignore pattern:** The project's `jest.config.js` has `'/.claude/'` in `testPathIgnorePatterns`, which matches the worktree's path (`.claude/worktrees/agent-...`). Worked around by passing `--testPathIgnorePatterns="/node_modules/"` to override the default during verification runs. The actual scaffolds work fine when the project is run from `/Users/chris/projects/accountibuzz/` (non-worktree) — this is purely a worktree-mode verification quirk.

## Test Count Breakdown

| File | Type | Assertions / Tests | RED Signal |
|------|------|-------|-----------|
| `supabase/tests/handle_submission_approval_streak.sql` | pgTAP | 8 | Counter columns stay at 0 because `handle_submission_approval` body is still the no-op stub from 0001 |
| `supabase/tests/handle_submission_approval_idempotency.sql` | pgTAP | 5 | Same as above; D-19 trigger does not exist |
| `supabase/tests/phase4_rpc_permissions.sql` | pgTAP | 17 | 42883 `undefined_function` for all 4 not-yet-existing RPCs |
| `supabase/tests/phase4_rpc_correctness.sql` | pgTAP | 10 | Same — 42883 `undefined_function` |
| `tests/features/groups/useGroupLeaderboard.test.tsx` | Jest | 4 | Virtual mock returns `undefined`; `result.current.isPending` throws |
| `tests/features/groups/useGroupLeaderboardRealtime.test.tsx` | Jest | 5 | Virtual mock returns `undefined`; channel never subscribed |
| `tests/features/submissions/useGroupFeed.test.tsx` | Jest | 4 | Virtual mock returns `undefined`; from-chain spies never invoked |
| `tests/features/groups/useGroupTombstones.test.tsx` | Jest | 4 | Virtual mock returns `undefined`; locked shape unmet |
| `tests/features/groups/useGroupSocialCounts.test.tsx` | Jest | 3 | Virtual mock returns `undefined`; data never settles |

**Totals:** 40 pgTAP assertions across 4 files + 20 Jest tests across 5 files = 60 RED assertions ready for Waves 1–3 to flip GREEN.

**Confirmed RED state at commit time:**
- Jest run on the 5 new test files (npm test -t "useGroupLeaderboard|useGroupLeaderboardRealtime|useGroupFeed|useGroupTombstones|useGroupSocialCounts"): 18 fail / 2 pass (the 2 passing tests are the negative-case `does not query when groupId is undefined` assertions which return early without exercising the missing hook).
- Full Jest suite (40 existing suites): 240/240 pass — additive change.
- `pnpm typecheck` exits 0 — virtual mocks satisfy module resolution (HIGH #7 GATE PASSED).
- pgTAP files NOT executed in this worktree (no local supabase running); structural assertions confirm files are well-formed and contain the required hooks (`select plan(N)`, `throws_ok '42501'`, `joined_at` in correctness, `HIGH #1 from REVIEWS` note in idempotency).

## Channel-Chain Helper API Surface

Downstream plans (04-03, 04-04) MUST consume `setupChannelMock` exactly as shown:

```ts
import { setupChannelMock } from '../_helpers/mockSupabaseChannel';
// inside an it():
const { supabase } = require('../../src/lib/supabase');
const { wrapper, channel, on, subscribe, removeChannel, getHandler, getChannelName, qc } = setupChannelMock(supabase);
```

**Exported types and accessors:**
- `RealtimeFixture` interface — destructure shape (qc, wrapper, channel, on, subscribe, removeChannel, getHandler, getChannelName)
- `RealtimePayload` and `Handler` types — for typed handler signatures
- `setupChannelMock(supabase)` — returns a fresh `RealtimeFixture`; calls `jest.spyOn` on `supabase.channel` and `supabase.removeChannel`
- `getChannelName(): string | null` — the canonical accessor (NOT `channelName`); returns the FIRST argument passed to `supabase.channel(name)` or `null` if `channel()` was never called
- `getHandler(): Handler | null` — returns the third argument passed to `.on('postgres_changes', config, handler)` so tests can drive synthetic payloads via `act(() => handler({ new: row }))`

## Manual Follow-Ups

### JIRA stories (Atlassian MCP not available in this worktree)

The CLAUDE.md JIRA convention applies (each Phase 4 commit references a phase scope). The orchestrator should apply these JIRA updates after merging:

- **SCRUM-31..SCRUM-38 (PTS-01, PTS-02, PTS-03, LB-01, LB-02, FEED-01, FEED-02, FEED-03)** — these stories are gated by Wave 0 having shipped its RED tests, but Wave 0 alone does not move them past "To Do → In Progress". Recommended action: leave them at "To Do" until Waves 1–3 flip the RED tests to GREEN; this plan's commits should NOT trigger a state advance for the PTS/LB/FEED stories.
- A separate "Wave 0 — Phase 4 test infrastructure" SCRUM story (if one exists or is created by the orchestrator) MAY be moved to "In Review" or "Done" by the orchestrator since this plan IS that story's scope. Time logged: ~50 min, rounded to **1h** in 15-min increments.

If Atlassian MCP is configured in the orchestrator's environment, transitioning the Wave 0 story is the only manual step; the eight PTS/LB/FEED stories stay at "To Do" until 04-02..04-06 land.

## Next Phase Readiness

- **Wave 1 (04-02 migration):** All 4 pgTAP files target the migration's surface — trigger body, RPCs, allowlist trigger. Run `supabase test db` after the migration; the 40 RED assertions should flip GREEN. Expected new code paths to verify: `handle_submission_approval` four-branch streak math, `get_pending_today` / `get_missed_yesterday` / `get_today_posted_count` / `get_group_leaderboard` RPCs with typed errors and proper grants, BEFORE UPDATE column-allowlist on group_members.
- **Wave 2 (04-03 hooks):** Each of the 5 Jest test files has a single virtual-mock declaration that 04-03 will replace by creating the real production module. The `{ virtual: true }` flag ensures the test continues to work seamlessly during the swap.
- **Wave 3 (04-04 / 04-05 components):** LayoutAnimation calls (`LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`) now resolve at jest test time without crashing on the missing native bridge.
- **No blockers.** Every Wave 1+ task has at least one RED test to drive against (Nyquist compliance per 04-VALIDATION.md).

## Self-Check: PASSED

- All 10 created files exist on disk (verified via `ls`).
- All 4 task commits exist in git log (`675a3df`, `773bf93`, `80ddff5`, `c474a69`).
- Existing 40 test suites / 240 tests still pass after all changes (additive change confirmed).
- `pnpm typecheck` exits 0 (HIGH #7 gate).
- 5 new Jest test suites fail at runtime (RED state) — exactly as planned for Wave 0.
- pgTAP scaffolds contain all required structural assertions (`select plan(N)`, JWT claims, `throws_ok 42501`, `joined_at` tiebreaker, `HIGH #1` inline note).

---

*Phase: 04-social-surfaces*
*Plan: 01 (Wave 0)*
*Completed: 2026-05-08*
