---
phase: 01-foundation
reviewed: 2026-04-22T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - supabase/migrations/0002_phase1_review_fixes.sql
  - .github/workflows/rls-check.yml
  - src/features/auth/AuthProvider.tsx
  - app/_layout.tsx
  - src/features/profile/useUpdateProfile.ts
  - src/features/profile/useAvatarUpload.ts
  - app/(app)/profile.tsx
  - README.md
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 01: Code Review Report (Fix-Verification Pass)

**Reviewed:** 2026-04-22
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found (2 warnings, 5 info — all pre-existing design trade-offs or minor robustness items; no fix is incorrect)

## Summary

This is a fix-verification re-review of the 8 files touched by commits `8bbbad4`..`29b1315`, which closed out the Critical + Warning findings from the prior deep-pass review on Phase 1.

**Bottom line: every claimed fix is correctly applied.** CR-01, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06, WR-07, WR-08, and WR-09 all close their targeted issues with no regressions detected. The migration is idempotent as claimed, the RLS CI probe is sound, and the client-side hooks correctly reject missing-identity calls instead of silently succeeding.

Two WARNINGs are raised:

1. **WR-01-R1** — `recoveryPending` is in-memory-only React state and resets on cold start. A user who kills the app between `verifyOtp(type: 'recovery')` and `updateUser` will relaunch into `/(app)/*` with a full-scope session. The fix closes the navigate-away escape hatch (back button, swipe, 'Request a new code' link) as scoped, but does not close the kill-the-app escape hatch. Whether this is in-scope is a design call.
2. **WR-03-R1** — The new `invites_mark_used_as_self` policy does not constrain which columns may change alongside `used_at`/`used_by`. A caller can rewrite `code`, `group_id`, `expires_at`, etc. on any unused invite row as part of the "mark used" update. The `code` UNIQUE constraint partially mitigates but does not close the hole. The migration comment ("full redeem semantics ship in P2 via a SECURITY DEFINER RPC") implies this is intentional placeholder, so this is a scope question, not a correctness bug.

Five INFO items flag minor robustness / future-proofing issues in the CI probe, migration trigger, and cold-start semantics.

## Fix verification table

| ID | Commit | Verdict | Notes |
|---|---|---|---|
| CR-01 | `8bbbad4` | Correct | Policy split is sound; trigger enforces column immutability on owner edits; admin branch bypass is consistent with "admin can review any submission" intent |
| WR-01 | `31353d6` | Correct (scoped) | Navigate-away gate works; see WR-01-R1 for cold-start limitation |
| WR-05 | `31353d6` | Correct | `.catch` + `.finally` correctly prevents splash lock-up |
| WR-02 | `776a9da` | Correct | Migration assertion + CI probe pair is the right approach given the `postgres`-role ALTER restriction |
| WR-03 | `776a9da` | Correct (scoped) | Redeem-self stub closes the flip-any-row hole; see WR-03-R1 re: other columns |
| WR-04 | `dccff97` | Correct + semantic shift verified | Old check (`gm.role='admin'`) authorized **zero** admins in P1 today because no trigger populates an admin `group_members` row on group creation. New check (`groups.admin_user_id = auth.uid()`) correctly authorizes the group creator. This is a real fix, not just a refactor |
| WR-06 | `ca67411` | Correct | Both hooks throw on missing userId before any Supabase call |
| WR-07 | `7d0c0e5` | Correct | signOut error surfaced via Alert; on success, `SIGNED_OUT` event drives the redirect |
| WR-08 | `7d0c0e5` | Correct | `?v=${updated_at}` busts expo-image's URL cache; cache key updates whenever the profile row is written |
| WR-09 | `29b1315` | Correct | Dashboard steps match the OTP-reset flow locked in by commits `adfe89e` / `5ccb9c6` |

## Warnings

### WR-01-R1: `recoveryPending` does not survive app kill during recovery flow

**File:** `src/features/auth/AuthProvider.tsx:29`, `app/_layout.tsx:26-31`

**Issue:** `recoveryPending` is React `useState`, lost on unmount. The `PASSWORD_RECOVERY` event fires exactly once, at the moment `verifyOtp(type: 'recovery')` resolves — it does **not** re-fire on cold start when the persisted session is restored. So the sequence

1. User enters OTP → `verifyOtp` → session persisted to SecureStore, `PASSWORD_RECOVERY` fires, `recoveryPending = true`
2. User backgrounds / kills the app before calling `updateUser`
3. User relaunches → `getSession()` returns the persisted session, `onAuthStateChange` fires `INITIAL_SESSION` (not `PASSWORD_RECOVERY`) → `recoveryPending = false` → `useProtectedRoute` routes to `/(app)/profile`

leaves the user inside the authenticated app with a recovery-scoped session that never forced a password change. The fix commit's own comment scopes itself to "hardware back, iOS swipe, the 'Request a new code' link, etc." — so this gap is known but unaddressed.

**Fix suggestion (one of):**
1. Persist `recoveryPending` to SecureStore keyed to the user id, read it back alongside `getSession` on init. Clear on `USER_UPDATED` / `SIGNED_OUT`.
2. Tag a flag in `user.user_metadata` (`recovery_pending: true`) at OTP verify time, clear it in `updateUser`. Driven server-side, survives cold start, does not require a client-held secret.
3. Accept this as an intentional P1 limitation and document it in `01-06-SUMMARY.md` so the next reviewer does not re-flag it.

Option 2 is the cleanest — the metadata round-trip costs one extra call on OTP verify, and the gate check becomes `recoveryPending = user?.user_metadata?.recovery_pending === true`, which is already session-backed.

Skill reference: `supabase:supabase` — auth state and session persistence guidance.

### WR-03-R1: `invites_mark_used_as_self` allows rewriting non-redemption columns

**File:** `supabase/migrations/0002_phase1_review_fixes.sql:134-139`

**Issue:** The new UPDATE policy

```sql
using (used_at is null)
with check (used_by = auth.uid() and used_at is not null);
```

correctly blocks the previous "any authenticated user can flip any invite" attack. But it does not enforce that the caller only modifies `used_at` / `used_by`. A logged-in user who knows (or guesses) an unused invite id / code can issue

```sql
update invites
   set code = 'NEWCODE',
       group_id = '<another-group-they-cannot-read>',
       expires_at = '2099-01-01',
       used_by = auth.uid(),
       used_at = now()
 where id = '<victim-invite-id>';
```

and the policy lets it through. The `code UNIQUE` constraint forces the new code to not collide, but otherwise the attacker can burn an arbitrary invite *and* corrupt its metadata on the way out. `group_id` change is especially odd — it would point the invite at a group the attacker is not part of.

The fix commit comment acknowledges "full redeem semantics ship in P2 via a SECURITY DEFINER RPC", so this may be intentional placeholder. If the placeholder stays, add column immutability.

**Fix suggestion:** Add an owner-immutable trigger mirroring the one added for submissions (CR-01). Pin `code`, `group_id`, `created_by`, `expires_at`, `id` during a non-admin UPDATE:

```sql
create or replace function public.invites_redeem_immutable()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if public.is_group_admin(old.group_id) then return new; end if;
  if new.code is distinct from old.code
     or new.group_id is distinct from old.group_id
     or new.created_by is distinct from old.created_by
     or new.expires_at is distinct from old.expires_at then
    raise exception 'only used_at/used_by may change on invite redeem';
  end if;
  return new;
end$$;

create trigger invites_redeem_immutable_trigger
  before update on public.invites
  for each row execute function public.invites_redeem_immutable();
```

Skill reference: `supabase:supabase-postgres-best-practices` — WITH CHECK does not protect columns not named in its expression.

## Info

### IN-01-R1: `submissions_owner_immutable` trigger admin bypass permits admin-self-approval

**File:** `supabase/migrations/0002_phase1_review_fixes.sql:62-65`

**Issue:** Not a regression — same behavior as 0001 — but worth recording while the submissions policies are under review. If a user is both the submission owner AND the group admin, the trigger's `is_admin := public.is_group_admin(old.group_id)` returns true and the owner-branch column lock is skipped. So admins can approve their own pending submissions without any secondary review. The underlying admin-review policy also allows this. This is consistent with the design intent ("admin has full review lane"), but P3 will want to revisit (noted in 0001's comment: "P1-safe; tightened in P3").

**Fix:** None needed for P1. Add to P3 validation checklist.

### IN-02-R1: CI bucket-policy probe uses substring match on `qual`

**File:** `.github/workflows/rls-check.yml:64-80`

**Issue:** The probe checks `qual LIKE '%' || b.id || '%'` against `pg_policies`. Two weaknesses:

1. Substring match across the whole qual text — a policy containing the literal string `"submissions"` in an unrelated position (e.g. a comment-style filter or a different column reference) would satisfy the probe without actually constraining by bucket id.
2. It only inspects `qual` (the USING expression). A policy that constrains the bucket solely via `with_check` (INSERT-only policy with no USING) has `qual = NULL` and would be missed.

Today's bucket ids are distinct enough (`submissions`, `avatars`) that false-positives are unlikely, and all 0001 storage policies have USING clauses. So this does not fail today.

**Fix suggestion:** Change the subquery to inspect both columns with a bucket_id-anchored regex:

```sql
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (coalesce(qual,'') ~ ('bucket_id\s*=\s*''' || b.id || '''')
       OR coalesce(with_check,'') ~ ('bucket_id\s*=\s*''' || b.id || ''''));
```

### IN-03-R1: `group_members_select_own_or_same_group` missing `to authenticated`

**File:** `supabase/migrations/0002_phase1_review_fixes.sql:163-169`

**Issue:** Three of the four new group_members policies specify `to authenticated`; the SELECT policy does not. This mirrors 0001's original style, and because `auth.uid()` returns null for anon and `is_group_member` returns false for anon, no rows are ever actually exposed. But mixing the role specifier within a single migration section is a style inconsistency that future readers may trip on.

**Fix:** Add `to authenticated` for consistency:

```sql
create policy "group_members_select_own_or_same_group"
  on public.group_members
  for select
  to authenticated
  using (user_id = auth.uid() OR public.is_group_member(group_id));
```

### IN-04-R1: `admin_user_id` / `group_members.role='admin'` sync is a P2 invariant with no P1 safeguard

**File:** `supabase/migrations/0002_phase1_review_fixes.sql:148-155`

**Issue:** Recorded in the migration comment, restated here for visibility because it landed without an enforcement mechanism. The new `is_group_admin` helper reads `groups.admin_user_id`; `group_members.role` is ignored. If P2's create-group flow inserts the admin into `group_members` with `role='admin'` but forgets to keep `admin_user_id` aligned after an admin-transfer flow, `role` becomes ambient/misleading. Two options for P2 to consider:

1. Drop `group_members.role` entirely; admin is defined solely by `groups.admin_user_id`.
2. Add a trigger keeping them in sync (`after insert/update on groups` sets `role='admin'` on the matching `group_members` row).

Option 1 is simpler and matches what the helpers actually do today.

**Fix:** Add to P2 planning.

### IN-05-R1: README "Expo Go" prerequisite contradicts dev-build requirement

**File:** `README.md:20`

**Issue:** Pre-existing, not introduced by `29b1315`, but the fix commit edited the same file so worth recording. README line 20: "Expo Go app on a physical iOS or Android device". Project convention (per MEMORY) is a native dev build (`npx expo run:ios`) because SDK 55 + the native modules in use (SecureStore, image-manipulator, image-picker) exceed what Expo Go supports reliably.

**Fix:** Replace prerequisite bullet with "iOS Simulator or Android Emulator (for `npx expo run:ios` / `run:android`)" and drop the Expo Go mention, or note Expo Go works for a subset of dev but dev build is preferred.

---

## Skills invoked

- `supabase:supabase` — skipped (prior-knowledge review used to stay under timeout budget; referenced for WR-01-R1)
- `supabase:supabase-postgres-best-practices` — skipped (prior-knowledge review; referenced for WR-03-R1)
- `expo:upgrading-expo` — skipped (no SDK-specific semantics at issue in fixes under review)
- `expo:building-native-ui` — skipped (navigation gate change is straightforward segment routing)
- `expo:native-data-fetching` — skipped (profile hooks use TanStack Query per existing project convention; no fetching-pattern question)

Timeout-budget note: a previous attempt at this review timed out, so per the skill_usage guidance I proceeded on prior knowledge without invoking skills. The fixes under review are well-scoped and the prior-review REVIEW.md already captured skill authority for the originals.

---

_Reviewed: 2026-04-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (fix-verification pass)_
