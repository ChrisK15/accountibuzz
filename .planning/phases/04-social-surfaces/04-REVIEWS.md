---
phase: 4
reviewers: [gemini]
reviewers_attempted: [gemini, codex]
reviewers_failed: [codex]
reviewed_at: 2026-05-08T21:01:10Z
plans_reviewed: [04-01-PLAN.md, 04-02-PLAN.md, 04-03-PLAN.md, 04-04-PLAN.md, 04-05-PLAN.md, 04-06-PLAN.md, 04-07-PLAN.md]
self_skipped: claude (running inside Claude Code CLI)
---

# Cross-AI Plan Review — Phase 4

Codex was attempted but exited with `Quota exceeded. Check your plan and billing details.` (gpt-5.5,
mid-stream). Gemini is the sole external reviewer that completed successfully. The Claude CLI was
skipped per the gsd-review independence rule (this orchestration runs inside Claude Code).

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

### Cross-Plan Concerns
1.  **HSL Alpha Bug:** Plans 04-04, 04-05, and 04-06 all rely on the assumption that `token + '66'` produces valid alpha-transparency. This is **false** for the project's HSL tokens. This must be corrected in the "Act" phase of 04-04 to avoid a series of visual regressions.
2.  **Publication Timing:** If `supabase db push` in 04-02 is run against a remote environment without checking the publication state, the Realtime features in 04-05 and 04-06 will fail silently despite all local tests passing.

### Risk Assessment: MEDIUM
The plans are architecturally sound and follow established project patterns (SECURITY DEFINER RPCs, TanStack + Realtime patches, `useFocusEffect`). The primary risks are **visual regressions** (the HSL alpha bug) and **silent Realtime failure** (the publication gate). Once these are addressed, the phase is highly likely to achieve all 8 requirements.

**Verdict:** Proceed to execution after correcting the HSL alpha concatenation logic in Plan 04-04.

---

## Codex Review

Codex review failed mid-stream with `ERROR: Quota exceeded. Check your plan and billing details.`
(gpt-5.5 model). 133,198 tokens were consumed before the error. No review content was produced.

To retry: `cat /tmp/gsd-review-prompt-04.md | codex exec --skip-git-repo-check -` once quota resets,
or run `/gsd-review --phase 4 --codex` again.

---

## Consensus Summary

Only one external reviewer (Gemini) produced a complete review, so this is not a true multi-AI
consensus — it is a single-reviewer pass with the orchestrator (Claude Code) verifying one
high-severity claim against the codebase.

### Agreed Strengths

(Single reviewer — no consensus possible.) Gemini affirmed:
- The Wave 0 RED-state TDD scaffolding (04-01) is solid Nyquist discipline.
- The `pg_trigger_depth() > 1` bypass in 04-02 is technically correct for the definer-trigger path
  (chosen explicitly over the `auth.uid() IS NULL` pattern that would be wrong here).
- CGF-1 publication-add as Section 0 of migration 0008 is the right ordering.
- `useFocusEffect` lifecycle on every Realtime hook (04-03) prevents channel leaks (Pitfall #11).
- 14-checkpoint UAT in 04-07 covers the high-risk gates (cross-device LB-02, tombstone tone, D-19
  client counter-write rejection, D-11 viewer).

### Top Concerns (Highest Priority)

1. **HIGH — HSL alpha string concatenation crash/visual-regression risk (04-04 → cascades to
   04-05/04-06).** Gemini flagged that `t.colors.surfaceMuted + '66'` is invalid CSS because
   `surfaceMuted` is an `hsl(...)` string in `src/theme/tokens.ts`. **Verified by orchestrator:**
   `src/theme/tokens.ts:38` defines `surfaceMuted: 'hsl(220, 14%, 92%)'` (light) and `:53`
   `'hsl(220, 15%, 14%)'` (dark). Concatenating `'66'` yields `'hsl(220, 14%, 92%)66'` — invalid CSS.
   The 40% alpha background spec from UI-SPEC §Color §Token Mapping line 247 must be implemented via
   `hsla(...)` literals OR an `applyAlpha(token, alpha)` helper, not by string-concatenating an
   8-bit hex alpha to an HSL token. This needs fixing in 04-04 Task 2 (`MissedYesterdayRow`) AND
   anywhere 04-05 inlines the same idiom for the empty-leaderboard callout (PLAN line 272) and the
   feed-skeleton background (PLAN line 341 uses `t.colors.surfaceMuted` directly without alpha,
   which is fine; but PLAN line 272 has the bug). Also occurs in 04-04 PLAN inside
   `MissedYesterdayRow`. **Pre-execution fix recommended.**

2. **HIGH — `useGroupFeedRealtime` chooses invalidate over optimistic prepend (04-03).** The plan
   acknowledges the trade-off (Realtime payload lacks embedded profile fields needed for a complete
   FeedItem render), but Gemini calls out the visual UX cost: the feed will "jump" (skeleton →
   item) on each approval rather than smoothly slide in. UI-SPEC line 783 reads "feed slide-in
   200ms via LayoutAnimation" — invalidation produces a flicker, not a slide. Either accept the
   degradation as MVP scope (and downgrade UI-SPEC line 783 expectations), or enrich the Realtime
   handler to fetch the missing profile fields before patching the cache, or add a placeholder
   skeleton item that gets replaced when the invalidate-driven refetch returns.

3. **MEDIUM — D-06 yesterday-only tombstones can mislabel late-approved 2-day-old submissions
   (04-02).** When admin approves a backlog from 2+ days ago, the trigger correctly credits streak
   (the gap branch handles it), but the affected member still appears in "Missed Yesterday" because
   the RPC only computes against `today - 1`. This is consistent with locked decision D-06
   (yesterday-only in P4; persisted `daily_misses` table is P5 scope), but worth a UAT note in
   04-07 — admins doing late approvals may see counterintuitive section content.

4. **MEDIUM — `LayoutAnimation.configureNext` may conflict with simultaneous approvals (04-05).**
   When admin batch-reviews, multiple Realtime patches arrive in quick succession. `configureNext`
   only schedules the next layout transaction; rapid-fire calls can produce jittery or skipped
   animations. UI-SPEC line 380 says one animation per cache patch — verify behavior under
   bursts during 04-07 CK-14 (currently classified as a soft gate).

5. **MEDIUM — Today GroupCard social line "pops in" after card initial render (04-06).** Because
   `social = undefined` while any of the 3 hook reads is loading, the card layout height changes
   when data lands. Suggestion: pre-allocate vertical space (skeleton placeholder for the line)
   so the card height is stable across the loading → loaded transition.

### Lower-Priority Concerns

- **LOW — 04-01 leaves the `useTodaySubmissionRealtime.test.tsx` inline mock in place** rather than
  proving the extraction by refactoring the source test file. Drift risk.
- **LOW — 04-05 reduce-motion state may not react to OS-level toggle while app is backgrounded.**
  Plan does install an `addEventListener('reduceMotionChanged', ...)`, so this should self-correct
  on resume; verify behavior during UAT.
- **LOW — 04-04 `StillToPostAvatarRow` overlap of 8pt on 32pt avatars (25%) might not match the
  Lovable mock's "tight" look.** Visual review during 04-05 wiring.

### Divergent Views

(Single reviewer — none.)

### Notes for the Planner

- **Re-running `/gsd-review --phase 4 --codex`** when codex quota resets would give a true
  cross-AI consensus. Until then, treat this as Gemini + orchestrator-verified single-reviewer
  output.
- The HSL alpha bug is a pre-execution blocker and worth a small replan: introduce
  `src/theme/applyAlpha.ts` (a 1-function helper that takes an `hsl(...)` token and an alpha
  fraction, returns `hsla(...)`), and reference it from 04-04 Task 2 + 04-05 PLAN line 272.
