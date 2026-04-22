---
phase: 01-foundation
fixed_at: 2026-04-22T00:00:00Z
review_path: .planning/phases/01-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-22
**Source review:** `.planning/phases/01-foundation/01-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (1 Critical + 9 Warning)
- Fixed: 10
- Skipped: 0

SQL fixes live in a NEW append-only migration `supabase/migrations/0002_phase1_review_fixes.sql` per the Supabase append-only constraint. All migrations were re-applied locally via `npx supabase db reset`, all pgTAP tests pass, `tsc --noEmit` is clean, and `npx jest` reports 27/27 passing after each fix.

## Fixed Issues

### CR-01: `submissions_update_admin_or_owner_pending` permits owner self-approval (no WITH CHECK)

**Files modified:** `supabase/migrations/0002_phase1_review_fixes.sql`
**Commit:** 8bbbad4
**Applied fix:** Dropped the single monolithic UPDATE policy and replaced it with two policies with explicit `WITH CHECK`: (1) `submissions_update_owner_pending_content` — owner may only touch rows where `user_id = auth.uid() AND status = 'pending'` on both pre- and post-image; (2) `submissions_update_admin_review` — admin-only review lane keyed on `is_group_admin(group_id)`. Added a BEFORE UPDATE trigger `submissions_owner_immutable_trigger` (SECURITY DEFINER) that pins `status`, `user_id`, `group_id`, `local_date`, `reviewed_by`, `reviewed_at`, `rejection_reason` on owner edits — enforcing column-level immutability the RLS layer cannot express. **Requires human verification:** semantic change, no pgTAP coverage yet for the new policies. Suggest adding a pgTAP test in Phase 2 that impersonates an owner, attempts `update submissions set status='approved' where id = own_row` and asserts the update is rejected.

### WR-01: Recovery-session gate bypass — user could land in `/(app)/profile` without setting a new password

**Files modified:** `src/features/auth/AuthProvider.tsx`, `app/_layout.tsx`
**Commit:** 31353d6 (combined with WR-05 since both touch AuthProvider's single useEffect)
**Applied fix:** Added `recoveryPending: boolean` to the `AuthContextValue`. The auth-state listener now flips `recoveryPending=true` on `PASSWORD_RECOVERY` and flips it back to `false` on `USER_UPDATED` / `SIGNED_OUT`. `useProtectedRoute` in `_layout.tsx` short-circuits while `recoveryPending` is true — if the user is not on `/(auth)/reset-password` it forces them back there, regardless of session presence. Closes the exploit where a user could hit the "Request a new code" link (or hardware back / iOS swipe) after `verifyOtp` succeeded and be auto-promoted into `/(app)/profile`. All existing jest tests pass (`tests/auth-schemas.test.ts`, `tests/signup.test.ts`, `tests/signout.test.ts` untouched).

### WR-02: `storage.objects` RLS is not explicitly enabled by the migration

**Files modified:** `supabase/migrations/0002_phase1_review_fixes.sql`, `.github/workflows/rls-check.yml`
**Commit:** 776a9da
**Applied fix:** `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` cannot be run as the migration role (`postgres`) — `storage.objects` is owned by `supabase_storage_admin`, which yields `permission denied (42501) must be owner of table objects`. Instead the migration *asserts* the invariant via a DO-block that raises an exception if `pg_tables.rowsecurity` is false on `storage.objects` — and a CI probe in `rls-check.yml` mirrors the check. If Supabase ever ships with RLS off, the migration and CI both fail loudly with actionable error messages.

### WR-03: `invites_update_authenticated` allowed any logged-in user to mutate any invite row

**Files modified:** `supabase/migrations/0002_phase1_review_fixes.sql`
**Commit:** 1e3e2fb
**Applied fix:** Dropped `invites_update_authenticated` and replaced with `invites_mark_used_as_self` — USING `used_at is null` (can only touch unused invites), WITH CHECK `used_by = auth.uid() and used_at is not null` (the caller must mark themselves, setting a timestamp). Stub-level; full redeem semantics ship in P2 via a SECURITY DEFINER RPC.

### WR-04: `group_members` policies self-reference via raw subquery

**Files modified:** `supabase/migrations/0002_phase1_review_fixes.sql`
**Commit:** dccff97
**Applied fix:** Dropped all four `group_members` policies (SELECT / INSERT / DELETE / UPDATE) and recreated them using the SECURITY DEFINER helpers `is_group_member(group_id)` and `is_group_admin(group_id)` declared in 0001. Folds in IN-04 by adding `WITH CHECK (public.is_group_admin(group_id))` to `group_members_update_admin`. **Requires human verification:** small semantic shift — the old "admin" branch matched via `group_members.role='admin'`; the new branch matches via `groups.admin_user_id = auth.uid()`. Equivalent today (group creator is the only admin) but P2's create-group RPC must keep the two in sync (see IN-01 landmine for context).

### WR-05: `AuthProvider` swallows errors from `getSession()` and leaves `loading: true` forever

**Files modified:** `src/features/auth/AuthProvider.tsx`
**Commit:** 31353d6 (combined with WR-01)
**Applied fix:** Rewrote the `useEffect` to use `.then(...).catch(...).finally(...)` so `setLoading(false)` always fires — even if the storage adapter throws (`aesjs.utils.hex.toBytes` on corrupted AsyncStorage ciphertext). Catches the rejection with a `console.warn` rather than propagating it.

### WR-06: `useUpdateProfile` / `useAvatarUpload` accepted `userId: string` and silently no-op'd on empty string

**Files modified:** `src/features/profile/useUpdateProfile.ts`, `src/features/profile/useAvatarUpload.ts`, `app/(app)/profile.tsx`
**Commit:** ca67411
**Applied fix:** Changed both hook signatures to `string | undefined`, with `if (!userId) throw new Error(...)` at the top of each mutationFn (plus a guard inside `pickAndUploadAvatar`). Profile screen updated to pass `user?.id` directly instead of coercing to `''`. All existing jest tests pass (`tests/avatar-upload.test.ts` still uses a concrete `'user-1'` id).

### WR-07: `handleLogout` discarded `signOut` errors; UI got stuck if signout failed

**Files modified:** `app/(app)/profile.tsx`
**Commit:** 7d0c0e5 (combined with WR-08)
**Applied fix:** Destructured `{ error } = await supabase.auth.signOut()` and raised a second `Alert.alert` on failure so the user sees feedback instead of silently tapping an unresponsive button.

### WR-08: Avatar URL cache-busting missing — `expo-image` showed stale avatar after re-upload

**Files modified:** `app/(app)/profile.tsx`
**Commit:** 7d0c0e5 (combined with WR-07)
**Applied fix:** `avatarUrl` now appends `?v=${encodeURIComponent(profile.updated_at)}`. Because `useUpdateProfile` and `useAvatarUpload` both bump `updated_at`, the cache-busting query string changes on every upload, defeating `expo-image`'s URL cache.

### WR-09: Password reset depends on an undocumented Supabase dashboard email-template edit

**Files modified:** `README.md`
**Commit:** 29b1315
**Applied fix:** Expanded the Dashboard → Authentication setup step to call out the `Email Templates → Reset Password` edit (swap `{{ .ConfirmationURL }}` for `{{ .Token }}`), reference the Phase 1 summary, and explain the symptom a fresh-project user would otherwise hit (link-style email + "invalid token"). Did not attempt to pin the template in `supabase/config.toml` — maintainer confirmed OTP design is intentional and the gap is documentation only (per additional-constraints).

## Skipped Issues

None — all 10 in-scope findings were fixed.

---

## Verification summary

After each fix:
- **TS/TSX changes:** `npx tsc --noEmit` (clean) + `npx jest` (27/27 passing).
- **SQL changes:** `npx supabase db reset` (applies 0001 + 0002 cleanly) + `npx supabase test db` (9/9 pgTAP tests passing).
- **Docs-only (WR-09):** visual diff against REVIEW.md-specified content.

No fixes were rolled back. No regressions introduced to the existing test suite.

## Carried-over landmines (out of scope for iteration 1)

These were flagged in REVIEW.md as Info-level and are *not* fixed in this pass (fix_scope = critical_warning). Noted here so they are not lost:

- **IN-01** — group creator is not auto-enrolled in `group_members`. Fix in P2 `create_group` RPC or via an AFTER INSERT trigger on `public.groups`.
- **IN-02** — adjacent to CR-01; already partially addressed by the `submissions_owner_immutable_trigger` added in this iteration (it already pins `local_date`, `group_id`, `user_id`). No separate fix needed.
- **IN-03** — policy-name collision between `public.submissions` and `storage.objects`. Rename in a future migration.
- **IN-04** — folded into WR-04's rewrite (see `group_members_update_admin` now carries `WITH CHECK`).
- **IN-05** — `seed.sql` hardcoded password. Add a WARNING header in a future docs pass.
- **IN-06** — "Skip for now" no-op button. UX cleanup.
- **IN-07** — `useProfile` non-null assertion. Low-priority refactor.
- **IN-08** — `expo-file-system/legacy` TODO comment. Add when pinning SDK 56.
- **IN-09** — no UI surface for mutation errors on profile screen. UX follow-up.
- **IN-10** — fragile `LIKE` probe in `rls-check.yml`. Tighten probe in a future CI pass.

---

_Fixed: 2026-04-22_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
