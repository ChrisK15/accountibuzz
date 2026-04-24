---
phase: 01-foundation
fixed_at: 2026-04-22T00:00:00Z
review_path: .planning/phases/01-foundation/01-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report (Iteration 2)

**Fixed at:** 2026-04-22
**Source review:** `.planning/phases/01-foundation/01-REVIEW.md` (deep re-review, post-0002)
**Iteration:** 2 (first iteration's report superseded; see git history for iter-1 report content)

**Summary:**
- Findings in scope: 5 (all Warnings; 9 Info findings out of scope per `fix_scope=critical_warning`)
- Fixed: 5
- Skipped: 0

All five warnings from the 2026-04-22 deep re-review were fixed. Each fix is an atomic commit. The SQL changes are in a new append-only migration (`0003_phase1_review_fixes_2.sql`) — 0001 and 0002 were NOT edited. Post-fix verification: `npx tsc --noEmit` clean, `npx jest` 31/31 passing (4 new test cases added), `supabase db reset` applies 0001+0002+0003 cleanly, `supabase test db` passes 9/9 existing pgTAP tests.

## Fixed Issues

### WR-05: `initialsFor` mangles surrogate-pair names

**Files modified:** `src/components/AvatarInitials.tsx`, `tests/avatar-initials.test.ts`
**Commit:** 52c533f
**Applied fix:** Replaced UTF-16 code-unit indexing (`parts[0].slice(0,1)`, `parts[0][0]`) with code-point iteration via `Array.from(s)[0]`. Added three new test cases: `'🔥 Flame' → '🔥F'`, `'Alex 🔥' → 'A🔥'`, `'🔥' → '🔥'` (single-word emoji-only name). All 4 existing tests still pass.

### WR-04: Onboarding "Skip for now" button is a literal no-op

**Files modified:** `app/(app)/profile.tsx`
**Commit:** 4fcbf4f
**Applied fix:** Removed the button entirely (option (a) from the review). P1 has no legitimate partial-onboarding state — `onboarding = display_name === ''` is the only gate, and exit requires a saved display name. Left a breadcrumb comment in place of the removed JSX so a future contributor re-adding a skip path understands the prerequisite: any "skip" flow must write a placeholder display name or redefine the `onboarding` predicate. The Continue button was already the only legitimate path out of onboarding, so there is no functional regression.

### WR-01: Recovery-pending flag does not survive app kill (cold-start bypass)

**Files modified:** `src/features/auth/AuthProvider.tsx`, `tests/auth-recovery-cold-start.test.tsx` (new)
**Commit:** 46262ad
**Applied fix:** Persist `recoveryPending` to AsyncStorage under key `accountibuzz.recoveryPending` on `PASSWORD_RECOVERY`; clear it on `USER_UPDATED` | `SIGNED_OUT`. On cold start, restore the flag *alongside* `getSession()` via `Promise.all(...)` so the gate effect in `app/_layout.tsx` reads both the session and the flag on the same render — otherwise a one-frame race lets the gate redirect to `/(app)` before the flag arrives. AsyncStorage (not SecureStore) per constraint — the flag is a boolean, not a secret.

**Stale-flag guard:** only hydrate `recoveryPending=true` when the restored session is non-null. A user who cleared app data but left the flag behind won't be pinned to `/(auth)` with nothing to redirect to.

Added `tests/auth-recovery-cold-start.test.tsx` (new file) with three cases:
1. Flag + session both present → `recoveryPending=true` hydrates (the primary bypass fix).
2. Flag present but no session → `recoveryPending=false` (stale-flag guard).
3. No flag persisted → `recoveryPending=false` (clean slate).

Uses `react-test-renderer` directly — `@testing-library/react-native`'s `render` had a flaky interaction with the jest-expo preset + our minimal RN mock that produced "Can't access .root on unmounted test renderer". Functionally equivalent for context-capture.

### WR-02 + WR-03: Admin cross-group submission moves and `reviewed_by` spoofing

**Files modified:** `supabase/migrations/0003_phase1_review_fixes_2.sql` (new)
**Commit:** 9b45500
**Applied fix:** Single new migration (append-only; 0001 and 0002 untouched; `create or replace function` + `drop trigger if exists` idempotent against local + remote current state). Extended `submissions_owner_immutable` (from 0002) with an admin branch that:

- **WR-02 fix:** pins `group_id`, `user_id`, `local_date`, `media_path`, `media_type` as immutable on admin UPDATE paths. Admin may now only mutate the reviewed allowlist: `status`, `reviewed_by`, `reviewed_at`, `rejection_reason`. Closes the "admin of two groups moves row between them" escape (pre-image/post-image evaluation split) AND the "move pending row to sidestep the `(group_id, user_id, local_date)` UNIQUE" escape.
- **WR-03 fix:** whenever an admin transitions `status` to `'approved'` or `'rejected'`, `reviewed_by` must equal `auth.uid()`. Prevents crediting the decision to another admin's uuid — load-bearing for P4 streak/points triggers that key off `reviewed_by` for attribution.

Trigger approach (vs. WITH CHECK) chosen per constraint. WITH CHECK alone cannot pin `reviewed_by = auth.uid()` against WR-03 (evaluates post-image only; doesn't coordinate with the caller identity as the trigger's `auth.uid()` call does), so a trigger fence is load-bearing for WR-03 regardless — co-locating WR-02 into the same function keeps the shape policy discoverable in one place.

**Requires human verification:** the admin-branch allowlist is new behavior. No pgTAP coverage added in this pass — that's IN-07 scope (Info, out of fix_scope). Suggested follow-up: add `supabase/tests/submissions_admin_immutable.sql` that seeds two admin'd groups, impersonates the admin, attempts a cross-group move, and asserts the trigger raises; and that attempts `set status='approved', reviewed_by=<other_uuid>` and asserts raise.

---

## Verification summary

After each fix:
- **TS/TSX changes (WR-01, WR-04, WR-05):** `npx tsc --noEmit` (clean) + `npx jest` (31/31 passing; 4 new tests added).
- **SQL changes (WR-02 + WR-03):** `supabase db reset` applies 0001+0002+0003 cleanly; `supabase test db` passes 9/9 existing pgTAP tests.
- **No rollbacks:** every fix applied cleanly on first attempt.

## Out-of-scope findings (IN-01..IN-09)

Not fixed — `fix_scope=critical_warning`. Quick triage:

- **IN-01 / IN-01b:** withdrawn in review; no action needed.
- **IN-02:** `invites_mark_used_as_self` column-level looseness. Landing in P2 when SECURITY DEFINER redeem_invite RPC ships; policy drops at that point.
- **IN-03:** `group_members.role` vs `groups.admin_user_id` drift. Codify in the P2 create-group plan (either drop `role` or add a mirror trigger).
- **IN-04:** Coupling-comment between `handle_submission_approval` and `submissions_owner_immutable`. One-liner cross-reference comment; defer to next migration.
- **IN-05:** RLS probe substring false-positive risk. Tighten in a future CI pass.
- **IN-06:** Client-supplied `updated_at` on profile mutations. Candidate for a BEFORE UPDATE trigger in a later migration.
- **IN-07:** pgTAP coverage gaps (owner-immutable, invites redeem-self, storage avatars path). Three new test files worth a dedicated pass.
- **IN-08:** README Expo Go vs dev-build wording. Docs-only.
- **IN-09:** `KeyboardAvoidingView` Android behavior. UX fix before Android UAT.

---

_Fixed: 2026-04-22_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
