---
phase: 04-social-surfaces
plan: 06
subsystem: today-screen-integration
tags: [expo-router, tanstack-query, supabase-realtime, react-native, useFocusEffect, rules-of-hooks]

# Dependency graph
requires:
  - phase: 04-social-surfaces
    plan: 03
    provides: "useGroupSocialCounts, useGroupLeaderboard, useGroupTodayCardRealtime hooks (read + Realtime patcher)"
  - phase: 04-social-surfaces
    plan: 04
    provides: "GroupCard.social prop contract + GroupCardSocialProp interface + minHeight: 20 pre-allocation wrapper"
provides:
  - "app/(app)/index.tsx — Today screen rendering social-signal line on every visible GroupCard via the GroupCardRow inner component; per-card Realtime channels (todaycard:{userId}:{groupId}) subscribed; userId lifted from screen-level useSession and passed down to GroupCardRow as a prop"
  - "tests/app/today-social-signal.test.tsx — 5 RED-then-GREEN Jest tests covering both data-loaded variants (default + be-the-first), both HIGH #10 strict-gate cases (leaderboard loading, postedCount null), and the MEDIUM gate that proves useGroupTodayCardRealtime is called per row with the same parent-supplied userId"
affects: [04-07]

# Tech tracking
tech-stack:
  added: []  # No new libraries — pure integration of 04-03 hooks + 04-04 GroupCard.social prop
  patterns:
    - "STRICT social-prop derivation gate (HIGH #10 RESOLVED): social = (leaderboard && postedCount != null && total > 0) ? {...} : undefined — undefined when ANY source unavailable, NOT a fallback to defaults; tests + implementation agree"
    - "Lifted useSession (MEDIUM RESOLVED): the screen calls useSession() ONCE; GroupCardRow receives userId as a prop — avoids per-row session subscription churn"
    - "GroupsListRow.member_count direct read (MEDIUM RESOLVED): the parent screen's useGroupsList already returns member_count via the PostgREST `group_members!inner(count)` aggregate; GroupCardRow reads it directly and skips useGroupMembers entirely"
    - "collectAllText tree-walk helper for tests: InlineSocialSignal is accessibilityElementsHidden + importantForAccessibility='no-hide-descendants' (UI-SPEC line 885) so the parent GroupCard composite a11y label can carry the social fragment without VoiceOver double-reading. testing-library's getByText filters such subtrees, so the test walks the JSON tree directly. Same pattern is used by 04-04 GroupCard.test.tsx and 04-04 StillToPostAvatarRow.test.tsx."

key-files:
  created:
    - "tests/app/today-social-signal.test.tsx"
  modified:
    - "app/(app)/index.tsx"

key-decisions:
  - "Skipped the conditional useGroupMembers fallback path entirely. The 04-06 plan §Step 2 hedged with 'fall back to useGroupMembers ONLY when the field is absent' — but verifying useGroupsList shows GroupsListRow.member_count is ALWAYS a number (defaults to 0 via aggregate coalesce), so the fallback path is dead code. Removing it (a) keeps Rules-of-Hooks cleaner (no unconditional useGroupMembers call), (b) saves a per-row members fetch unconditionally, and (c) matches the MEDIUM-fix intent of avoiding per-row member_count fetching. If future plans drop member_count from useGroupsList, they will need to add the fallback (or update useGroupsList to keep the field)."
  - "Used the collectAllText tree-walk helper instead of testing-library getByText. The InlineSocialSignal cluster is intentionally hidden from screen readers (a11y label is composed at the parent GroupCard level per UI-SPEC line 885), so testing-library's default text query filters it out. The tree-walk pattern (already established by 04-04 tests) walks the rendered JSON tree to find substrings inside hidden subtrees. Without this, all 5 tests would either fail for the wrong reason (positive asserts) or pass for the wrong reason (negative asserts)."
  - "Reordered hooks within GroupCardRow: NEW hooks (useGroupSocialCounts, useGroupLeaderboard, useGroupTodayCardRealtime) are placed AFTER the existing P3 hooks (useTodaySubmission, useUploadQueue) and BEFORE the cutoff useMemo. Rules of Hooks: every row instance calls the same set of hooks in the same order regardless of state."

requirements-completed: []
# NOTE: This plan touches the read-side surface for LB-01/LB-02/FEED-01
# (the social-signal line on Today GroupCards is a read of leaderboard +
# posted-count). The actual closeout from In Progress → In Review/Done
# lands in 04-07 (Phase 4 Verification). This plan keeps the JIRA stories
# In Progress per the orchestrator instructions in the plan prompt.

# Metrics
duration: ~25min
completed: 2026-05-09
---

# Phase 4 Plan 06: Today Screen Social-Signal Wiring Summary

**Wires the "the group is watching at-a-glance" surface — every visible Today GroupCard now displays the `N/M posted · X pts · 🔥streak` social-signal line backed by 3 hook calls per row (postedCount + leaderboard + per-card Realtime channel) with strict gating (HIGH #10), userId lifted from the parent screen (MEDIUM), and direct member_count consumption from GroupsListRow (MEDIUM). 5 new Jest tests pass; full suite 315/315 green; typecheck clean.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-09 (worktree session)
- **Tasks:** 1 (atomic TDD: RED test → GREEN implementation)
- **Files created:** 1 (test)
- **Files modified:** 1 (`app/(app)/index.tsx`)

## Accomplishments

- **GroupCardRow hook order locked (Rules of Hooks):** Existing 2 hooks (`useTodaySubmission`, `useUploadQueue`) preserved; 3 new hooks added in fixed order (`useGroupSocialCounts`, `useGroupLeaderboard`, `useGroupTodayCardRealtime`). Same set called per row regardless of state.
- **HIGH #10 strict-gate (RESOLVED via REVIEWS replan 2026-05-08):** `social = (leaderboard && postedCount != null && total > 0) ? {...} : undefined`. When ANY source is undefined or loading, social is undefined → InlineSocialSignal does not render → the GroupCard renders byte-identical to its P3 shape. Verified by 2 tests (leaderboard loading, postedCount null) which BOTH walk the rendered tree and assert NO `posted` / `be the first` text exists.
- **MEDIUM useSession lift (RESOLVED via REVIEWS replan 2026-05-08):** `useSession()` is called ONCE at the screen level (line 54, where it was already in P3 for `useTodaySubmissionRealtime`). `userId={user?.id}` is passed down to `GroupCardRow` as a prop. Per-row session subscription churn eliminated. Verified by `awk '/^function GroupCardRow/,/^}/' "app/(app)/index.tsx" | grep -c "useSession()"` returning 0.
- **MEDIUM `member_count` direct read (RESOLVED via REVIEWS replan 2026-05-08):** The plan hedged with a conditional fallback to `useGroupMembers`, but inspection of `src/features/groups/useGroupsList.ts` confirmed `GroupsListRow.member_count` is ALWAYS present (typed as `number`, populated via the `group_members!inner(count)` aggregate). `total = group.member_count` reads directly; no per-row `useGroupMembers` call is ever made. Saves N network calls (one per visible card).
- **Per-card Realtime channel (D-15):** `useGroupTodayCardRealtime(group.id, userId)` mounts one `todaycard:{userId}:{groupId}` channel per visible Today card. The hook short-circuits on undefined inputs and uses `useFocusEffect` for tab-blur teardown (Pitfall 11). On `group_members` UPDATE events, it invalidates `['todaySocialCounts', groupId]`; when the mutation is for the current user, it also invalidates `['groupLeaderboard', groupId]`.
- **Existing screen-level Realtime preserved:** `useTodaySubmissionRealtime(user?.id, getGroupTzs)` from P3 D-13 is unchanged at line 74 (single per-user channel filtered server-side on `user_id`).
- **5 new tests, all green:** Cover the data-loaded default variant (4/6 posted · 11 pts · 🔥3), the be-the-first variant (0/6 posted · be the first), both HIGH #10 strict-gate cases (leaderboard loading, postedCount null), and the MEDIUM gate that proves `useGroupTodayCardRealtime` is called twice with the SAME parent-supplied userId across two rows.

## Task Commits

| # | Phase | Hash | Message |
|---|-------|------|---------|
| RED | TDD red | `91d91f9` | `test(04-06): add failing tests for Today screen social-signal wiring` |
| GREEN | TDD green | `9e9fd37` | `feat(04-06): wire social-signal hooks into Today GroupCardRow` |

## Verbatim Strict-Gate Expression (HIGH #10 audit trail)

```ts
const userRow = leaderboard?.find((r) => r.user_id === userId);
const social: GroupCardSocialProp | undefined =
  leaderboard && postedCount != null && total > 0
    ? {
        posted: postedCount,
        total,
        points: userRow?.points ?? 0,
        streak: userRow?.current_streak ?? 0,
      }
    : undefined;
```

The plan's must_haves (line 20) demanded: `social = (members && leaderboard && postedCount != null && total > 0) ? {...} : undefined`. Implementation matches with the `members` term replaced by the `total > 0` check (since `members` was the `useGroupMembers` data and we removed that path per the MEDIUM fix; `total = group.member_count` IS the source-of-truth members count, and `total > 0` IS the same gate the plan intended). The gate `postedCount != null` is the explicit null-check the plan demands (NOT `?? 0`).

## userId pass-down trace (MEDIUM audit trail)

| Location | Code | Line |
|----------|------|------|
| Screen-level useSession (existing in P3) | `const { user, session } = useSession();` | 54 |
| Screen-level pass-down to GroupCardRow | `userId={user?.id}` | 199 |
| GroupCardRow prop type | `userId: string \| undefined;` | 305 |
| GroupCardRow consumer | `const userRow = leaderboard?.find((r) => r.user_id === userId);` | 333 |
| GroupCardRow Realtime hook | `useGroupTodayCardRealtime(group.id, userId);` | 326 |

`useSession()` calls inside `GroupCardRow` body: **0** (verified via `awk` over the function body).

## member_count optimization status (MEDIUM audit trail)

`useGroupsList` returns rows of type `GroupsListRow` (`src/features/groups/useGroupsList.ts:8-16`):

```ts
export interface GroupsListRow {
  id: string;
  name: string;
  goal: string;
  submission_type: 'photo' | 'video';
  timezone: string;
  member_count: number;  // populated via PostgREST `group_members!inner(count)` aggregate; defaults to 0 via `?? 0`
  admin_user_id: string;
}
```

GroupCardRow reads `const total = group.member_count;` directly. No `useGroupMembers(group.id)` call exists in the file. `grep -c "useGroupMembers" "app/(app)/index.tsx"` returns 0 (NOT imported, NOT called). The plan's hedge — "fall back to useGroupMembers ONLY when the field is absent" — is unreachable because the field is always present. Decision documented under Decisions Made above.

## Total Realtime channel count on Today screen

| Channel | Count | Filter |
|---------|-------|--------|
| `submission_today:{userId}` (per-user, screen-level) | 1 | `user_id=eq.{userId}` |
| `todaycard:{userId}:{groupId}` (per-card, row-level) | N (one per visible group) | `group_id=eq.{groupId}` |

For a user in 6 groups: 1 + 6 = 7 active channels while on the Today screen. All teardown on tab blur via `useFocusEffect` (Pitfall 11). For a user in 0 groups (empty state): 0 channels (the screen short-circuits to the empty UI before mounting GroupCardRow).

## Files Created/Modified

### Created (1 file)

- `tests/app/today-social-signal.test.tsx` — 5 Jest tests + collectAllText tree-walk helper. 263 lines.

### Modified (1 file)

- `app/(app)/index.tsx` — 3 new imports (`useGroupSocialCounts`, `useGroupLeaderboard`, `useGroupTodayCardRealtime`) + 1 type import (`GroupCardSocialProp`); GroupCardRow gains 3 new hook calls + the strict social-prop derivation; FlatList renderItem passes `userId={user?.id}` down. Net +53 lines.

## Decisions Made

### Skipped the conditional `useGroupMembers` fallback path entirely

The plan §Step 2 hedged with "use useGroupMembers UNLESS GroupsListRow has member_count." Inspection of `src/features/groups/useGroupsList.ts` confirms `GroupsListRow.member_count` is ALWAYS a number (typed as `number`, populated via PostgREST aggregate `group_members!inner(count)` with `?? 0` fallback). The conditional fallback would be dead code. Removing it:

- Keeps Rules-of-Hooks cleaner (no unconditional `useGroupMembers` call whose data is never consumed in the happy path).
- Saves a per-row members fetch unconditionally (matches the MEDIUM-fix intent: don't fetch members per row when the count is already on the parent's row).
- If future plans drop `member_count` from `useGroupsList`, they must either keep the field OR add the fallback — visibility from this gap will be obvious during code review on those changes.

### Used `collectAllText` tree-walk helper for test assertions

The InlineSocialSignal cluster (in `src/components/GroupCard.tsx:135-147`) sets `accessibilityElementsHidden={true}` + `importantForAccessibility="no-hide-descendants"`. This is intentional per UI-SPEC line 885: the social-signal text is appended to the parent GroupCard composite a11y label so VoiceOver speaks "{name} group, photo group, no submission yet, 12:00 cutoff, 4 of 6 posted today, 11 points, 3-day streak" as a single sentence rather than reading the social fragment as a separate focus stop.

`@testing-library/react-native`'s default `getByText` / `queryByText` filter such subtrees out — they consider hidden elements invisible. Without a tree-walk, the positive assertions (tests #1, #2) would fail; the negative assertions (tests #3, #4) would pass for the wrong reason (always-empty regardless of impl). The `collectAllText` helper walks the rendered JSON tree directly to find substrings, ignoring a11y filtering. Pattern documented in `04-04-SUMMARY.md` "Auto-fixed Issues #1" and `tests/components/GroupCard.test.tsx`.

### Hook ordering inside GroupCardRow

Order: existing P3 hooks first (useMemo for `today` → `useTodaySubmission` → `useUploadQueue`), then NEW P4 hooks (`useGroupSocialCounts` → `useGroupLeaderboard` → `useGroupTodayCardRealtime`), then existing P3 cutoff useMemo. This places the strict social derivation immediately after the data-fetching hooks (so the gate logic is co-located with the data it gates on) while preserving every existing P3 hook call in its original position. Each FlatList row instance calls the same 5 hooks in the same order.

## Confirmation Checklist (per plan §Output)

- [x] **GroupCardRow hook order documented:** `useTodaySubmission` → `useUploadQueue` → `useGroupSocialCounts` → `useGroupLeaderboard` → `useGroupTodayCardRealtime`. 5 hooks called per row in fixed order.
- [x] **STRICT social-prop derivation (HIGH #10):** verbatim expression captured above. Gate is `leaderboard && postedCount != null && total > 0` — undefined for ALL "any source loading" cases.
- [x] **userId-passed-from-parent confirmation:** trace table above; useSession is called ONCE at screen level (line 54); GroupCardRow has `userId: string | undefined` prop and is passed `userId={user?.id}` from the FlatList renderItem.
- [x] **GroupsListRow.member_count optimization status:** `total = group.member_count;` direct read. `useGroupMembers` is NOT imported, NOT called. Confirmed via `grep -c "useGroupMembers" "app/(app)/index.tsx"` returning 0.
- [x] **Total Realtime channel count on Today screen:** 1 per-user (existing P3, screen-level) + N per-card (NEW P4, one per visible group). For a 6-group user: 7 active channels.

## Acceptance Gates (per plan)

| Gate | Threshold | Actual | Status |
|------|-----------|--------|--------|
| `grep -c "useGroupSocialCounts" "app/(app)/index.tsx"` | ≥ 2 | 2 | PASS |
| `grep -c "useGroupLeaderboard" "app/(app)/index.tsx"` | ≥ 2 | 2 | PASS |
| `grep -c "useGroupTodayCardRealtime" "app/(app)/index.tsx"` | ≥ 2 | 3 | PASS |
| `grep -c "GroupCardSocialProp" "app/(app)/index.tsx"` | ≥ 1 | 2 | PASS |
| HIGH #10 strict-gate `postedCount != null` | ≥ 1 | 1 | PASS |
| MEDIUM useSession-lift gate (inside GroupCardRow body) | = 0 | 0 | PASS |
| MEDIUM userId-prop pass-down gate | ≥ 1 | 2 | PASS |
| MEDIUM member_count gate | ≥ 1 | 2 | PASS |
| `useTodaySubmissionRealtime` preserved | ≥ 1 | 4 | PASS |
| `pnpm test --testPathPattern="tests/app/(today-screen|today-social-signal)"` | exit 0 | 5/5 green | PASS |
| `pnpm typecheck` (npx tsc --noEmit) | exit 0 | exit 0 | PASS |
| `grep -c "minHeight" src/components/GroupCard.tsx` (Iter 1 WARNING-2 lock) | ≥ 1 | 3 | PASS |

## Test Count Breakdown

| Test file | Tests | Status |
|-----------|-------|--------|
| `tests/app/today-social-signal.test.tsx` (NEW) | 5 | All green |

**Plan-06 tests delivered:** 5 new tests in 1 new file.

**Full Jest suite status (post-implementation):** 54 suites total, 315 tests, ALL pass. No regressions introduced.

**Typecheck:** `npx tsc --noEmit` exits 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] First test run failed because InlineSocialSignal is `accessibilityElementsHidden`**

- **Found during:** Task 1 verification (`npx jest tests/app/today-social-signal --forceExit`)
- **Issue:** The first 2 tests (positive asserts on rendered text "4/6 posted · 11 pts · 🔥3" and "0/6 posted · be the first") used `testing-library`'s `getByText` and failed even though the text DID render. Root cause: `InlineSocialSignal` (in `src/components/GroupCard.tsx:135-147`) is intentionally hidden from screen readers via `accessibilityElementsHidden={true}` + `importantForAccessibility="no-hide-descendants"` (per UI-SPEC line 885 — the social text is composed into the parent GroupCard's a11y label to avoid VoiceOver double-reading). `@testing-library/react-native`'s default `getByText` / `queryByText` filter such subtrees out by design. Same root cause as `04-04-SUMMARY.md` Auto-fixed Issue #1 (StillToPostAvatarRow `+N` chip).
- **Fix:** Added the `collectAllText(toJSON())` tree-walk helper to the test file (copied from `tests/components/GroupCard.test.tsx`) which walks the rendered JSON directly. Replaced 4 `getByText` / `queryByText` assertions with `expect(all.some((s) => /pattern/.test(s))).toBe(true|false)` form. Both positive (tests #1, #2) and negative (tests #3, #4) asserts now correctly inspect the rendered tree.
- **Files modified:** `tests/app/today-social-signal.test.tsx`
- **Committed in:** `9e9fd37` (GREEN commit — test fix shipped alongside implementation since the test had to land at the same time as the matching implementation to be meaningful)
- **Why this isn't a Rule 4 architectural concern:** The hidden-from-a11y pattern was intentionally established in 04-04 by the GroupCard author + plan reviewers as the correct UI-SPEC implementation. Test infrastructure should adapt to inspect rendered text in a way that doesn't depend on a11y visibility. This is a test-side fix only; no production behavior changed.

### Out-of-Scope Discoveries (not auto-fixed)

None. The plan was straightforward integration work and the only deviation was the test-side helper above.

---

**Total deviations:** 1 auto-fixed (Rule 1 — test-helper to handle a11y-hidden subtree). No scope creep; no production-code changes beyond the planned wire-up.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The plan is pure integration of existing 04-03 hooks into the existing Today screen. Threat register from the plan unchanged:

- **T-04-17** (Information Disclosure — useGroupLeaderboard called per Today card may leak ex-member data): Mitigation per plan — RPC gates on `is_group_member` (server-side); ex-member screens never reach the Today list (filtered by `useGroupsList` server-side via `group_members!inner`). No code change required here.
- **T-04-18** (DoS — channel-explosion across 10 cards, Pitfall #11): Mitigation per plan — `useGroupTodayCardRealtime` uses `useFocusEffect`; on screen blur, all per-card cleanups fire via `supabase.removeChannel`. Verified by `04-03-SUMMARY.md` Self-Check that `removeChannel` is in the hook source.
- **T-04-19** (Information Disclosure — postedCount RPC leaks group data to non-member): Mitigation per plan — `get_today_posted_count` is lenient (returns 0 for non-member); Today screen only renders cards for groups the user is in. No code change required here.

No threat flags raised.

## Manual Follow-Ups

### JIRA process per CLAUDE.md (Atlassian MCP not invoked from this worktree)

The CLAUDE.md JIRA convention applies to the `feat(04-06)` commit. The orchestrator (or a manual follow-up) needs to:

- **SCRUM-31** (PTS-01 — streak count display in social signal): Already In Progress (per 04-04 SUMMARY). Stays In Progress — closeout to In Review/Done lands in 04-07.
- **SCRUM-36** (LB — leaderboard data feeds social signal): Already In Progress (per 04-03/04-04 SUMMARY). Stays In Progress — closeout to In Review/Done lands in 04-07.
- **SCRUM-37** (FEED — completion-board count via useGroupSocialCounts): Already In Progress (per 04-03/04-04 SUMMARY). Stays In Progress — closeout to In Review/Done lands in 04-07.

**Time spent: ~25 min total** for this plan → round to **30 min** (2 × 15-min increments). Distribute across the 3 affected stories (e.g. ~10 min each), or log all 30 min on a single "Phase 4 today-screen wiring" tracking story.

If Atlassian MCP is configured in the orchestrator's environment, logging the worklog is the only manual step (transitions stay In Progress per the orchestrator instructions in the plan prompt — closeout belongs on 04-07).

## Next Phase Readiness

- **04-07 (Phase 4 Verification):** All Wave 3 deliverables shipped. `app/(app)/index.tsx` (Today screen) now renders the social-signal line per GroupCard. Combined with 04-05 (group-detail integration ran in parallel), Phase 4 is feature-complete from a code-shipped perspective.
- **CK-XX (cross-device Realtime UAT):** The `todaycard:{userId}:{groupId}` channels are filterless except `group_id=eq.{X}`. UAT should verify on 2 devices that an admin approval on Device A (member) shows the social-signal line incrementing on Device B (different member, same group) within ~1s after the trigger fires.
- **No blockers.** All Phase 4 Wave 3 plan deliverables shipped against the canonical specs.

## Self-Check: PASSED

**Files claimed to exist:**
- `app/(app)/index.tsx` — FOUND (modified)
- `tests/app/today-social-signal.test.tsx` — FOUND

**Commits claimed to exist (git log --oneline):**
- `91d91f9` (RED `test(04-06)`) — verified via `git log --oneline -5`
- `9e9fd37` (GREEN `feat(04-06)`) — verified via `git log --oneline -5`

**Acceptance gates re-verified:**
- `grep -c "useGroupSocialCounts" "app/(app)/index.tsx"` = 2
- `grep -c "useGroupLeaderboard" "app/(app)/index.tsx"` = 2
- `grep -c "useGroupTodayCardRealtime" "app/(app)/index.tsx"` = 3
- `grep -c "GroupCardSocialProp" "app/(app)/index.tsx"` = 2
- `grep -c "postedCount != null" "app/(app)/index.tsx"` = 1
- `awk '/^function GroupCardRow/,/^}/' "app/(app)/index.tsx" | grep -c "useSession()"` = 0
- `grep -cE "userId=\{user\?\.id\}|userId,$" "app/(app)/index.tsx"` = 2
- `grep -c "member_count" "app/(app)/index.tsx"` = 2
- `grep -c "useTodaySubmissionRealtime" "app/(app)/index.tsx"` = 4
- `grep -c "useGroupMembers" "app/(app)/index.tsx"` = 0 (correctly absent — MEDIUM fix decision)
- `grep -c "minHeight" "src/components/GroupCard.tsx"` = 3
- All 5 new Jest tests pass; full suite 315/315 pass; npx tsc --noEmit exits 0.

---

*Phase: 04-social-surfaces*
*Plan: 06 (Wave 3)*
*Completed: 2026-05-09*
