---
phase: 4
reviewers: [gemini, codex]
reviewers_attempted: [gemini, codex]
reviewers_failed: []
reviewed_at: 2026-05-08T21:14:14Z
plans_reviewed: [04-01-PLAN.md, 04-02-PLAN.md, 04-03-PLAN.md, 04-04-PLAN.md, 04-05-PLAN.md, 04-06-PLAN.md, 04-07-PLAN.md]
self_skipped: claude (running inside Claude Code CLI)
notes: |
  Initial pass (2026-05-08T21:01:10Z) collected only Gemini — codex hit a quota error mid-stream.
  This file is the merged result after re-running `/gsd-review --phase 4 --codex` once quota
  reset. Both reviews are preserved in full below; the Consensus Summary is updated to reflect
  both voices.
---

# Cross-AI Plan Review — Phase 4

Two external reviewers (Gemini, Codex) completed structured reviews. Claude was skipped per the
gsd-review independence rule (this orchestration runs inside Claude Code).

## Gemini Review

This review covers implementation plans **04-01 through 04-07** for Accountibuzz Phase 4 (Social Surfaces).

### 04-01: Test Scaffolds
**Summary:** This plan provides the necessary TDD infrastructure to ensure the rest of the phase is driven by RED state. The extraction of the Realtime mock is a vital move for maintainability.

*   **Strengths**
    *   Strong TDD discipline (Nyquist compliance).
    *   The `LayoutAnimation` mock is essential for preventing crashes in Jest environments that lack the native bridge.
*   **Concerns**
    *   **LOW (Maintenance):** Task 1 extracts the `setupChannelMock` helper but does not use it to refactor the existing test (`useTodaySubmissionRealtime.test.tsx`) from which it was taken. While the plan notes "Do NOT modify", this immediately creates two versions of the same complex mock logic to maintain.
*   **Suggestions**
    *   Refactor the original test file to use the new helper in 04-01 to prove the extraction is stable.

### 04-02: Migration 0008 (Server Contract)
**Summary:** A comprehensive migration that correctly identifies the critical missing publication gate (CGF-1). The use of `pg_trigger_depth()` for the column-allowlist bypass is technically superior to the `auth.uid() IS NULL` pattern for this specific data flow.

*   **Strengths**
    *   `CGF-1` publication add is correctly placed as Section 0 (hard gate).
    *   `pg_trigger_depth() > 1` bypass (Appendix §3) correctly distinguishes between the definer trigger path and direct client updates.
    *   Atomic single-statement UPDATE for streak math (Pattern 1) avoids transaction races.
*   **Concerns**
    *   **MEDIUM (Edge Case):** `get_missed_yesterday` uses `(now() AT TIME ZONE g.timezone)::date - 1`. If an admin approves a backlog of submissions from *two* days ago, those members will correctly get streak credit via the trigger, but they will still appear in the "Missed Yesterday" section today because that section only checks "yesterday." This is a design limit of P4 (D-06) but worth noting as a potential source of user confusion.
*   **Suggestions**
    *   In Task 2, explicitly verify the publication state via `psql` as planned; this is the single most likely point of silent failure.

### 04-03: Data Layer (7 Hooks)
**Summary:** Solid TanStack Query implementation. Reusing the `useFocusEffect` lifecycle for Realtime channels is correct for a tabbed application.

*   **Strengths**
    *   `useFocusEffect` prevents channel leaks across tab switches (Pitfall #11).
    *   `useGroupTombstones` correctly decouples cache invalidation for today vs. yesterday (D-07).
*   **Concerns**
    *   **HIGH (Visual Quality):** `useGroupFeedRealtime` Task 2 uses invalidation rather than optimistic prepend because the Realtime payload lacks profile fields. On a new approval, users will see the feed "jump" (Skeleton → Item) instead of a smooth slide-in.
    *   **MEDIUM (Performance):** `useGroupTodayCardRealtime` creates one channel per card on the Today screen. With a 10-group cap, this is fine, but ensures the `setupChannelMock` tests in Task 2 strictly verify the `removeChannel` cleanup.
*   **Suggestions**
    *   In a future phase, consider enriching the Realtime payload or using a small edge function to allow optimistic feed prepends without invalidation.

### 04-04: UI Primitives
**Summary:** High-fidelity implementation of the visual anatomy. The composite a11y labels are excellent and exceed typical MVP standards.

*   **Strengths**
    *   Correct application of Typography Locked Exception §1 (800-weight on points).
    *   `StillToPostAvatarRow` handles member count buckets correctly per UI-SPEC.
*   **Concerns**
    *   **HIGH (Crash Risk):** Task 2 for `MissedYesterdayRow` suggests `backgroundColor: t.colors.surfaceMuted + '66'`. In `src/theme/tokens.ts`, `surfaceMuted` is defined as an `hsl()` string (e.g., `hsl(220, 14%, 92%)`). Appending `'66'` results in an invalid CSS string (`hsl(...)66`) which will fail to render or crash the layout engine.
    *   **LOW (Visual):** `StillToPostAvatarRow` uses `-t.spacing.sm` (8pt) for overlap. With 32pt avatars, this is a 25% overlap; verify this matches the "tight" look of the Lovable mock.
*   **Suggestions**
    *   **Fix:** Use a helper to apply alpha to HSL or use a hardcoded `hsla` literal for the 40% alpha background, matching the precedent set by `StatusPill` and `ReviewPanel` in P3.

### 04-05: Group-Detail Integration
**Summary:** The most complex integration task. Correctly balances Rules of Hooks with conditional rendering.

*   **Strengths**
    *   Order of sections (Leaderboard at top) maximizes "social pressure" impact.
    *   `MediaViewer` reuse saves significant development time.
*   **Concerns**
    *   **MEDIUM (UX):** `LayoutAnimation.configureNext` in `useGroupLeaderboardRealtime`. If multiple approvals land simultaneously (e.g., admin batch-reviews), `LayoutAnimation` may conflict with itself, causing jittery row swaps.
    *   **LOW (a11y):** Ensure the `reduceMotion` state is truly reactive to OS-level changes during the session, as users may toggle this while the app is backgrounded.
*   **Suggestions**
    *   Check dark mode contrast for the 40% alpha tombstone surfaces as flagged in UI-SPEC.

### 04-06: Today Screen Integration
**Summary:** Crucial for the "ambient signal" value proposition.

*   **Strengths**
    *   TanStack Query deduping prevents N+1 network calls despite calling `useGroupLeaderboard` for every row in the FlatList.
*   **Concerns**
    *   **MEDIUM (Logic):** `GroupCardRow` derives `social` as `undefined` if any source is loading. This might cause the social line to "pop" into existence a few frames after the rest of the card renders.
*   **Suggestions**
    *   Consider adding a very small skeleton or height-placeholder for the social line to prevent the card height from jumping when data lands.

### 04-07: Phase Verification
**Summary:** Thorough closeout plan. The inclusion of the 2-device UAT is mandatory.

*   **Strengths**
    *   14-checkpoint walkthrough covers all high-risk Realtime and Tone gates.
*   **Concerns**
    *   None.

---

### Cross-Plan Concerns (Gemini)
1.  **HSL Alpha Bug:** Plans 04-04, 04-05, and 04-06 all rely on the assumption that `token + '66'` produces valid alpha-transparency. This is **false** for the project's HSL tokens. This must be corrected in the "Act" phase of 04-04 to avoid a series of visual regressions.
2.  **Publication Timing:** If `supabase db push` in 04-02 is run against a remote environment without checking the publication state, the Realtime features in 04-05 and 04-06 will fail silently despite all local tests passing.

### Risk Assessment (Gemini): MEDIUM
The plans are architecturally sound and follow established project patterns (SECURITY DEFINER RPCs, TanStack + Realtime patches, `useFocusEffect`). The primary risks are **visual regressions** (the HSL alpha bug) and **silent Realtime failure** (the publication gate). Once these are addressed, the phase is highly likely to achieve all 8 requirements.

**Verdict:** Proceed to execution after correcting the HSL alpha concatenation logic in Plan 04-04.

---

## Codex Review

Based on the supplied plan text, I would not execute Phase 4 as-is. The overall shape is strong, but there are several HIGH-risk issues that can produce false-green tests, broken Realtime behavior, incorrect counters under concurrency, or runtime crashes.

### 04-01 — Test Scaffolds

**Summary**
Good intent: Wave 0 creates RED coverage before implementation, especially for trigger/RPC behavior and Realtime hook lifecycle. Risk is medium-high because some scaffolds are internally inconsistent and may break `typecheck`/CI before implementation, making the RED state noisy rather than useful.

**Strengths**
- Extracts the Realtime channel mock from `tests/submissions/useTodaySubmissionRealtime.test.tsx` lines 51-91.
- Covers the critical server layer with pgTAP before migration work.
- Adds tests for LB-01/LB-02/FEED-01/FEED-02/FEED-03 hook contracts.
- Correctly calls out the need for a Jest-safe `LayoutAnimation` mock.

**Concerns**
- **HIGH:** RED Jest tests importing nonexistent production hooks may make `pnpm typecheck` fail if tests are included in TS config, conflicting with 04-01 success criteria that require `pnpm typecheck` green.
- **HIGH:** RPC permission test expectations conflict with 04-02 grants. `get_today_posted_count` is described as lenient for anon, but 04-02 revokes execute from `public` and grants only to `authenticated`, so true anon calls may fail before function body.
- **MEDIUM:** Helper API naming drifts: `channelName`, `getChannelName`, and `channelName: () => string | null` are all mentioned for `tests/_helpers/mockSupabaseChannel.ts`.
- **MEDIUM:** The concurrency pgTAP test in `handle_submission_approval_idempotency.sql` is only sequential, not concurrent, yet is framed as Pitfall P4-B coverage.
- **MEDIUM:** Dynamic `now()`/today-based pgTAP data makes DST and date-boundary assertions fragile.
- **LOW:** `pnpm test --listTests tests/_helpers/mockSupabaseChannel.ts` does not meaningfully verify the helper.

**Suggestions**
- Decide whether Wave 0 RED files are excluded from `typecheck` until 04-03, or adjust tests to use `jest.mock(..., { virtual: true })` style placeholders.
- Normalize the helper accessor to `getChannelName()`.
- Make permission tests match actual grants: anon should either be `permission denied` or the function must be executable by `public`.
- Do not claim concurrency coverage unless using two sessions, advisory locks, or a deterministic race harness.

### 04-02 — Migration 0008

**Summary**
This is the most important plan and has the largest risk. It covers the right artifacts: publication add, trigger body, RPCs, column-allowlist trigger, grants, and type generation. However, the proposed trigger implementation is vulnerable to stale-read races unless it locks or computes streaks inside the `UPDATE`.

**Strengths**
- Puts `alter publication supabase_realtime add table public.group_members` first, addressing the critical gating finding.
- Uses `SECURITY DEFINER` with `set search_path = public`.
- Adds a defense-in-depth `group_members_counter_immutable` trigger.
- Regenerates `src/types/database.ts` after applying the migration.
- Tests the RPC contract and the trigger body via pgTAP.

**Concerns**
- **HIGH:** Streak race condition. Plan says compute `v_new_streak` with a `SELECT`, then perform `UPDATE public.group_members`. Under concurrent approvals, both transactions can compute from the same stale `last_rolled_date` before either update locks the row. The fix is `SELECT ... FOR UPDATE` or a single `UPDATE ... SET current_streak = CASE ...` based on the locked current row.
- **HIGH:** Same-day branch is specified as no-op, but the described update always does `points = points + 1`. If the trigger ever fires for same `last_rolled_date`, points increment incorrectly.
- **HIGH:** 04-01/04-02 mismatch on `get_today_posted_count` anon behavior: lenient return `0` cannot happen for true anon if execute is revoked from `public`.
- **MEDIUM:** `get_group_leaderboard` order only by `points DESC, current_streak DESC` is nondeterministic for ties. Add `joined_at ASC` or `display_name ASC` as a stable tiebreaker.
- **MEDIUM:** Direct client update tests may hit RLS before the `group_members_counter_immutable` trigger, producing a different error than expected.
- **MEDIUM:** `get_pending_today` semantics are unclear for rejected submissions. 04-01 says pending/rejected submissions are excluded from "still to post," but product-wise a rejected proof may mean the member still needs to post.

**Suggestions**
- Rewrite `handle_submission_approval` as a row-locking operation:
  - either `SELECT ... FOR UPDATE` before computing `v_new_streak`;
  - or a single `UPDATE group_members SET ... CASE ... RETURNING`.
- Explicitly encode same-day as no-op for both streak and points, or prove the schema makes same-day trigger execution impossible.
- Add deterministic leaderboard tiebreakers.
- Reconcile RPC grants/tests before implementation.

### 04-03 — Data Hooks

**Summary**
The hook layer mostly follows good TanStack/Supabase patterns and keeps writes server-owned. The main risk is Realtime payload assumptions, especially relying on `payload.old.status` without ensuring Postgres replica identity supports it.

**Strengths**
- Clear cache keys: `['groupLeaderboard', id]`, `['groupFeed', id, today]`, `['groupTombstones', id, scope]`, `['todaySocialCounts', id]`.
- Realtime hooks use `useFocusEffect`, matching cleanup requirements.
- Read hooks are thin wrappers over server contracts.
- `useGroupFeed` uses server-side `.eq('status', 'approved')`.

**Concerns**
- **HIGH:** `useGroupFeedRealtime` relies on `payload.old.status` for `flippedFromApproved`. Supabase Realtime often does not include full old row data unless `REPLICA IDENTITY FULL` is set. No migration sets that for `submissions`.
- **MEDIUM:** `useGroupTombstones` contract drifts. 04-01 says tests may assert `data.pendingToday`, while 04-03 defines a custom return object `{ pendingToday, missedYesterday, isPending, error }`.
- **MEDIUM:** `useGroupFeed` embedded profile select may need the exact relationship name, not just `profiles(...)`, depending on generated Supabase schema.
- **MEDIUM:** `useGroupTodayCardRealtime` invalidates posted counts on any `group_members` update, even backdated approvals where today's count may not change. Acceptable but noisy.
- **LOW:** Query key strings are duplicated across hooks and screens, increasing drift risk.

**Suggestions**
- Either set `REPLICA IDENTITY FULL` for `submissions` or avoid `old.status` dependence.
- Define exported query-key helpers/constants.
- Make `useGroupTombstones` tests match the final hook shape before implementation.

### 04-04 — Components

**Summary**
The component plan is detailed and mostly UI-complete. Risk is medium because several tests are hard to implement as described, and some RN/API details may be invalid or brittle.

**Strengths**
- Props are explicit and decoupled from 04-03 implementation paths.
- Avatar cache-busting is consistently required.
- GroupCard social prop is backward-compatible.
- Good accessibility intent with composite labels.
- Quiet tombstone treatment aligns with D-08.

**Concerns**
- **HIGH:** FeedItem test plan says to mock `useSignedMediaUrl` via `jest.spyOn`, but the hook is local and not exported, so that spy is not possible.
- **MEDIUM:** `FeedItem` and `MediaViewer` call `useVideoPlayer` unconditionally with `''` for photo mode. Depending on `expo-video`, this may create invalid players or invoke callbacks unexpectedly.
- **MEDIUM:** `accessibilityRole="summary"` in `FeedItem.tsx` may not be a valid React Native accessibility role.
- **MEDIUM:** `t.colors.surfaceMuted + '66'` in `MissedYesterdayRow.tsx` only works if the token is a hex color. If tokens are `rgb(...)` or named colors, the style is invalid.
- **LOW:** Tests using `UNSAFE_getByProps({ style: expect.objectContaining(...) })` are likely brittle because RN styles are often arrays.

**Suggestions**
- Export or dependency-inject signed URL behavior for testability, or mock Supabase storage instead.
- Avoid initializing video player for photos if `expo-video` supports a safer null/undefined source.
- Use a small color-alpha helper rather than string concatenation.
- Verify RN accessibility role types before coding.

### 04-05 — Group Detail Integration

**Summary**
This plan delivers the core user-facing Phase 4 surface, but it has multiple HIGH-risk integration bugs. The most serious are a runtime temporal-dead-zone bug around `reduceMotion`, a locked-order conflict with D-09, and unresolved feed Realtime assumptions inherited from 04-03.

**Strengths**
- Wires all four required sections into group detail.
- Includes top-5 leaderboard expansion.
- Adds fullscreen `MediaViewer`.
- Adds reduce-motion awareness.
- Preserves Realtime hooks at screen level rather than inside repeated section rows.

**Concerns**
- **HIGH:** `useGroupLeaderboardRealtime(id, { reduceMotion })` is shown before `const [reduceMotion, setReduceMotion] = useState(false);`. This will throw at runtime.
- **HIGH:** Section order conflicts with locked D-09. D-09 says `Header → Leaderboard → Today's posts → Still to post → Missed yesterday → Members → Pending review → destructive zone`, but 04-05 says existing PendingReviewRow/InvitePanel/Members blocks remain unchanged, and inserts new sections before PendingReviewRow.
- **HIGH:** `cutoffLabelFor()` computes device-local tomorrow midnight and formats it in group timezone. That is not group-local cutoff time and can be wrong across timezones.
- **MEDIUM:** `MediaViewer` is used in the screen but not included in the Step 1 import list.
- **MEDIUM:** `LayoutAnimation.Presets.easeInEaseOut` may not exist in the 04-01 Jest mock, which only defines `Types`, `Properties`, and `easeInEaseOut`.
- **MEDIUM:** The "cross-fade" implementation fades the new value out/in after props changed; it does not actually cross-fade old-to-new values.
- **LOW:** `tzShortLabelFor()` may return `GMT-7` instead of `PT`, depending on runtime Intl behavior.

**Suggestions**
- Move `reduceMotion` state/effect before any hook that reads it.
- Resolve the D-09 order explicitly, even if that means moving Pending Review below Members.
- Reuse existing cutoff/deadline logic if available; otherwise store deadline semantics server-side.
- Update 04-01 LayoutAnimation mock to include `Presets`.
- Treat media viewer tests as Supabase-storage mocks, not local-hook spies.

### 04-06 — Today Screen Social Signal

**Summary**
The feature is directionally correct, but the derivation logic contradicts the fallback requirement and adds considerable per-card query load. Risk is medium-high because the test expectations and proposed implementation disagree.

**Strengths**
- Puts per-card Realtime subscriptions inside `GroupCardRow`, preserving row lifecycle.
- Keeps existing `useTodaySubmissionRealtime` screen-level channel.
- Composes `posted`, `total`, `points`, and `streak` from existing hooks.
- Preserves tap routing to group detail.

**Concerns**
- **HIGH:** The plan says social is `undefined` when any source is loading, but the code still renders social when `leaderboard` is undefined by defaulting `points`/`streak` to `0`. This fails the planned "leaderboard loading" test.
- **MEDIUM:** Calling `useSession()` inside every `GroupCardRow` is wasteful if the parent already has `user`; pass `userId` down instead.
- **MEDIUM:** `useGroupMembers(group.id)` per card is potentially heavy just to compute `total`. If `GroupsListRow` already has member count, use that.
- **MEDIUM:** `useGroupLeaderboard(group.id)` fetches the full leaderboard per Today card just to find the current user's row. Acceptable for 5-10 groups, but note the cost.
- **LOW:** The stated "5 existing + 4 new = 9 hooks per row" should be verified against the actual file; hook-count documentation is easy to drift.

**Suggestions**
- Make fallback logic strict:
  ```ts
  const social =
    members && leaderboard && postedCount != null && total > 0
      ? { ... }
      : undefined;
  ```
- Pass `userId` from the parent screen to `GroupCardRow`.
- Prefer existing group/member-count data for `total` if available.

### 04-07 — Verification

**Summary**
The verification plan is appropriately strict, especially around two-device Realtime. Risk is medium because some counts and gate descriptions are inconsistent, and local automated verification may not prove the remote/dev Supabase project is migrated correctly.

**Strengths**
- Treats LB-02 cross-device Realtime as a hard gate.
- Includes D-19 direct counter-write rejection.
- Includes fullscreen viewer UAT.
- Updates planning traceability after verification.
- Mirrors prior P3 verification process.

**Concerns**
- **HIGH:** `supabase test db` and local `psql` checks do not prove the remote/dev project used by devices has `group_members` in `supabase_realtime`.
- **MEDIUM:** Hard gate count is inconsistent: summary says 4 hard gates, later lists 6 hard gates.
- **LOW:** The plan references "12 CK" in output, but the checklist has 14 checkpoints.
- **LOW:** Truth says `pnpm test:all`, but task commands run `pnpm test --ci` plus `supabase test db`.

**Suggestions**
- Add a remote publication verification step against the exact Supabase project used for UAT.
- Normalize hard gate list/counts.
- Record exact Supabase project ref in `04-VERIFICATION.md`.

### Cross-Plan Concerns (Codex)

- **Trigger correctness is the biggest blocker.** 04-02's planned `SELECT`-then-`UPDATE` streak math can lose correctness under concurrent approvals.
- **Realtime feed old-row dependency is unsafe.** 04-03/04-05 assume `payload.old.status`; add `REPLICA IDENTITY FULL` or remove that dependency.
- **Wave 0 RED tests may break normal typecheck/CI.** 04-01 needs a controlled RED strategy.
- **RPC permission expectations drift.** Anon behavior for `get_today_posted_count` conflicts with revoke/grant strategy.
- **D-09 ordering is not consistently implemented.** 04-05 preserves old Pending Review placement while locked decisions require Members before Pending Review.
- **Hook/component contracts drift.** `useGroupTombstones` return shape and Today social fallback behavior are inconsistent between tests and implementation plans.
- **Timezone/cutoff logic is weak.** DST and group-local "cutoff" labels need a real source of truth, not device-local Date math.
- **Remote vs local Supabase verification is underspecified.** CGF-1 must be verified on the actual project used by UAT.

### Risk Assessment (Codex): HIGH before revisions

The plans collectively cover all eight P4 requirements on paper: PTS-01..03, LB-01..02, FEED-01..03. But execution as written can still fail core correctness:

- PTS-01/02/03 are at risk from concurrent trigger stale reads and same-day point increments.
- LB-02 is addressed by publication add, but must be verified remotely, not just locally.
- FEED-01 Realtime is at risk from `payload.old.status` assumptions.
- FEED-02/03 are mostly covered, but today/yesterday semantics and timezone edges need tightening.
- The group-detail integration has at least one direct runtime bug with `reduceMotion`.

I would revise 04-02, 04-03, 04-05, and 04-06 before implementation starts.

---

## Consensus Summary

Two reviewers agree the plans are architecturally sound and aligned with project patterns
(SECURITY DEFINER RPCs, TanStack + Realtime patches, `useFocusEffect`, CGF-1 publication add).
They diverge on overall risk: Gemini calls **MEDIUM**, Codex calls **HIGH before revisions**. Codex
catches more concrete bugs (verified by orchestrator below). Aggregate verdict: **HIGH risk
before revisions** — at least three Codex HIGH calls were verified against the codebase as real
defects, not stylistic concerns.

### Agreed Strengths (both reviewers)

- **Wave 0 RED-state TDD scaffolding (04-01)** is solid Nyquist discipline.
- **CGF-1 publication-add as Section 0 of migration 0008** is the right ordering — both flag this
  as the most likely silent-failure mode without it.
- **`pg_trigger_depth() > 1` bypass (04-02)** is correctly chosen over the `auth.uid() IS NULL`
  pattern that would be wrong for the definer-trigger path.
- **`useFocusEffect` lifecycle on every Realtime hook (04-03)** prevents channel leaks
  (Pitfall #11).
- **14-checkpoint UAT in 04-07** covers the high-risk gates (cross-device LB-02, tombstone tone,
  D-19 client counter-write rejection, D-11 viewer).

### Top Concerns (HIGH severity, both reviewers + orchestrator-verified)

1. **HIGH (Codex, verified) — Streak race condition under concurrent approvals (04-02).** The plan
   computes `v_new_streak` with a `SELECT` then issues a separate `UPDATE`. Under concurrent
   approvals on the same `(group_id, user_id)` pair (admin batch-reviews multiple submissions for
   different days for one member), both txns can read the same stale `last_rolled_date` before
   either takes a row lock. **Fix:** rewrite as a single `UPDATE ... SET ... CASE ...` driven by
   the locked current row, OR a `SELECT ... FOR UPDATE` before the SELECT-then-update. PTS-01..03
   correctness is on the line.

2. **HIGH (Codex, verified) — `useGroupFeedRealtime` depends on `payload.old.status` but no
   migration sets `REPLICA IDENTITY FULL` on `submissions` (04-03).** Verified by orchestrator:
   `grep -nE "REPLICA IDENTITY" supabase/migrations/*.sql` returns no results. By default,
   `payload.old` only includes the primary key, so `oldRow?.status !== 'approved'` is always `true`
   for non-PK columns — the `flippedFromApproved` branch will fire on every update, causing
   incorrect feed-cache removal. **Fix:** add `alter table public.submissions replica identity
   full;` to migration 0008, OR drop the `flippedFromApproved` path and accept that feed items
   only ever get added (rejection of an approved submission would require a refetch on next focus).

3. **HIGH (Codex, verified) — `reduceMotion` temporal-dead-zone bug in 04-05.** Verified by
   orchestrator: `04-05-PLAN.md:219` shows
   `useGroupLeaderboardRealtime(id, { reduceMotion });` BEFORE `04-05-PLAN.md:232` declares
   `const [reduceMotion, setReduceMotion] = useState(false);`. This is a runtime ReferenceError on
   first render. **Fix:** move the `useState` + the AccessibilityInfo `useEffect` block above the
   six new hook calls (this also matches Rules-of-Hooks order intent — state declarations precede
   hook invocations that consume them).

4. **HIGH (Codex, verified) — D-09 stack order is violated by 04-05 in practice (04-05).**
   Verified by orchestrator: existing `app/(app)/groups/[id]/index.tsx` has PendingReviewRow at
   line 392 (BEFORE Members at line 481). 04-05 inserts new sections between Header and the
   existing PendingReviewRow without reordering. Result: `Header → 4 new sections →
   PendingReviewRow → InvitePanel → Members → destructive zone`. D-09 requires `... → Members →
   Pending review → destructive zone`. **Fix:** explicitly move `PendingReviewRow` (and possibly
   `InvitePanel`) to after Members in the same plan, or document a deviation from D-09.

5. **HIGH (Gemini, verified) — HSL alpha string concatenation crash/visual-regression risk
   (04-04 → cascades to 04-05).** Verified by orchestrator: `src/theme/tokens.ts:38` defines
   `surfaceMuted: 'hsl(220, 14%, 92%)'`. `t.colors.surfaceMuted + '66'` produces
   `'hsl(220, 14%, 92%)66'` — invalid CSS. Affects 04-04 `MissedYesterdayRow` AND 04-05
   `PLAN.md:272` (the empty-leaderboard callout uses the same idiom). **Fix:** introduce
   `src/theme/applyAlpha.ts` (1-function helper) returning `hsla(...)` from an `hsl(...)` token,
   or hardcode `hsla(...)` literals at consumer sites.

6. **HIGH (Codex) — `get_today_posted_count` permission inconsistency between 04-01 and 04-02.**
   04-01 RPC permissions test asserts the lenient variant returns `0` for true anon, but 04-02
   revokes execute from `public` and grants only to `authenticated`. Anon callers will hit
   `permission denied` before the function body runs. **Fix:** either grant execute to `public`
   for the lenient RPC, or update 04-01 tests to expect `permission denied` for anon.

7. **HIGH (Codex) — Wave 0 RED Jest tests may break `pnpm typecheck` (04-01).** If
   `tsconfig.json` includes the `tests/` tree, the import-failure pattern used to drive RED state
   may produce TS errors that fail the typecheck gate. **Fix:** confirm the existing TS config
   already excludes `tests/`, OR adjust the RED-state strategy to avoid TS-level import errors
   (e.g. `jest.mock('...', () => ({}), { virtual: true })`).

8. **HIGH (Gemini) — `useGroupFeedRealtime` invalidate-vs-optimistic-prepend trade-off (04-03).**
   The plan acknowledges the trade-off (Realtime payload lacks embedded profile fields) but the
   visual UX cost is a "jump" rather than the 200ms slide UI-SPEC line 783 expects. Either accept
   the degradation as MVP scope and downgrade UI-SPEC line 783, or enrich the payload before
   patching the cache. (Becomes moot if Concern #2 is fixed via `REPLICA IDENTITY FULL` AND the
   handler does a follow-up profile fetch before patching.)

9. **HIGH (Codex) — `cutoffLabelFor()` is wrong across timezones (04-05).** Computes
   device-local tomorrow midnight then formats in group timezone — not the group's local cutoff.
   When the device is in a different timezone from the group, the displayed label is incorrect.
   **Fix:** compute tomorrow as `(now() AT TIME ZONE g.timezone)::date + 1` server-side and
   surface via the leaderboard or group RPC, OR derive entirely from group timezone on the
   client (Intl.DateTimeFormat with timeZone option).

10. **HIGH (Codex) — Today GroupCard social fallback contradiction (04-06).** Plan body derives
    `social` with `points: userRow?.points ?? 0` even when `leaderboard` is undefined, but the
    "leaderboard loading" test asserts `social` is undefined while leaderboard is loading. Tests
    and implementation disagree. **Fix:** make the gate strict — `social` is undefined unless
    `members && leaderboard && postedCount != null && total > 0`.

11. **HIGH (Codex) — FeedItem test cannot mock the local `useSignedMediaUrl` via `jest.spyOn`
    (04-04).** The hook is defined inline inside `FeedItem.tsx`. **Fix:** mock at the
    `supabase.storage.from('submissions').createSignedUrl` boundary instead, OR extract
    `useSignedMediaUrl` to a shared file with proper export so a spy is possible.

12. **HIGH (Codex) — Same-day branch increments points incorrectly (04-02).** Even though UNIQUE
    `(group_id, user_id, local_date)` should prevent the trigger from ever firing for
    `local_date = last_rolled_date`, the trigger body unconditionally does `points = points + 1`
    in every branch. Defense-in-depth: gate the points increment on the same recurrence-branch
    condition that gates the streak math, OR document the UNIQUE-constraint guarantee inline.

13. **HIGH (Codex) — Remote publication state not verified during UAT (04-07).** `supabase test
    db` runs against the local stack. The 2-device UAT runs against the dev/remote project.
    LB-02 hard gate can pass locally but fail on devices if the remote project's
    `supabase_realtime` publication doesn't include `group_members`. **Fix:** add a one-line
    `psql -c "select tablename from pg_publication_tables where pubname='supabase_realtime' and
    schemaname='public'" $REMOTE_URL` check to 04-07 Task 1, fed from the same project ref the
    devices use.

### Top Concerns (MEDIUM severity)

- **MEDIUM (Codex) — `get_group_leaderboard` lacks deterministic tiebreakers (04-02).**
  Add `joined_at ASC` or `display_name ASC` to the ORDER BY for stable ordering on ties.
- **MEDIUM (Gemini) — D-06 yesterday-only tombstones can mislabel late-approved 2-day-old
  submissions (04-02).** Worth a UAT note in 04-07.
- **MEDIUM (Gemini) — `LayoutAnimation.configureNext` may conflict with simultaneous approvals
  (04-05).** Verify behavior under bursts during CK-14.
- **MEDIUM (Codex) — `LayoutAnimation.Presets.easeInEaseOut` not in 04-01 Jest mock.** The mock
  exposes `Types`, `Properties`, `easeInEaseOut` but not `Presets`. Extend the mock.
- **MEDIUM (Codex) — `useGroupTombstones` return-shape contract drifts** between 04-01 tests
  (`data.pendingToday`) and 04-03 implementation (`{ pendingToday, missedYesterday, isPending,
  error }`). Pick one before execution.
- **MEDIUM (Codex) — `accessibilityRole="summary"` may not be valid in React Native (04-04).**
  Verify against RN types.
- **MEDIUM (Codex) — `useVideoPlayer('')` may misbehave for photo mode (04-04, 04-05).**
  Confirm `expo-video` handles empty source safely or short-circuit.
- **MEDIUM (Codex) — `useSession()` and `useGroupMembers()` per `GroupCardRow` are wasteful
  (04-06).** Pass `userId` and use `GroupsListRow.member_count` if available.
- **MEDIUM (Gemini) — Today GroupCard social line "pops in" after card initial render (04-06).**
  Pre-allocate vertical space.
- **MEDIUM (Codex) — Hard gate count inconsistent in 04-07** (summary says 4, list says 6).
- **MEDIUM (Codex) — RPC `get_pending_today` semantics for rejected submissions unclear.**
  Currently excludes rejected from "still to post" — but a member with a rejected proof for today
  arguably still needs to post. Product decision needed.

### Lower-Priority Concerns (LOW)

- 04-01 leaves `useTodaySubmissionRealtime.test.tsx` inline mock in place after extracting the
  helper; drift risk over time.
- 04-04 `StillToPostAvatarRow` 25% overlap on 32pt avatars may not match Lovable's "tight" look.
- 04-05 `tzShortLabelFor()` may return `GMT-7` rather than `PT` depending on Intl runtime.
- 04-05 reduce-motion may not reactively respond to OS toggle while app is backgrounded.
- 04-05 cross-fade implementation animates in two halves rather than truly cross-fading
  old-to-new value.
- 04-07 references "12 CK" in one place but checklist has 14 checkpoints.
- 04-07 truth says `pnpm test:all`, task commands run `pnpm test --ci`.
- Helper accessor naming inconsistency (`channelName` vs `getChannelName`) in 04-01.

### Divergent Views

- **Overall risk rating.** Gemini = MEDIUM, Codex = HIGH. Codex catches more concrete defects
  (race condition, replica identity, temporal dead zone, D-09 violation, permission mismatch);
  Gemini focuses on visual / UX and misses the runtime correctness issues. Orchestrator agrees
  with Codex's HIGH rating after verifying the testable claims.
- **04-03 feed Realtime UX.** Gemini flags the invalidate-vs-prepend visual cost as HIGH; Codex
  flags the underlying replica-identity issue as a separate HIGH. They are the same problem from
  two angles — fix the replica identity AND decide on prepend-vs-invalidate.

### Recommended Pre-Execution Replan

The 13 HIGH concerns above warrant a **`/gsd-plan-phase 4 --reviews`** pass before execution.
Minimum scope of the replan:

1. Fix the trigger streak math to be race-safe (single locked UPDATE or `FOR UPDATE`) in 04-02.
2. Add `alter table public.submissions replica identity full;` to migration 0008 in 04-02 and
   reconcile `useGroupFeedRealtime` (04-03) accordingly.
3. Move the `reduceMotion` state/effect block above the six new hook calls in 04-05.
4. Reorder the existing `PendingReviewRow` / `InvitePanel` / `Members` blocks in 04-05 to match
   D-09 (`Members → Pending review → destructive zone`).
5. Introduce `src/theme/applyAlpha.ts` and reference it from 04-04 + 04-05 instead of `+ '66'`.
6. Reconcile `get_today_posted_count` permissions between 04-01 RPC permission tests and 04-02
   grants.
7. Confirm Wave 0 RED Jest scaffolds will not fail `pnpm typecheck` (04-01).
8. Tighten the Today GroupCard `social` derivation to be undefined while any source is loading
   (04-06).
9. Replace device-local `cutoffLabelFor` with a group-tz-only computation (04-05).
10. Add a remote `pg_publication_tables` check against the dev Supabase project to 04-07 Task 1.

After replan, optionally re-run `/gsd-review --phase 4 --all` to verify the fixes hold up.
