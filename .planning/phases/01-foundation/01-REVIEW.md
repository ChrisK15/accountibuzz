---
phase: 01-foundation
reviewed: 2026-04-22T00:00:00Z
depth: deep
files_reviewed: 51
files_reviewed_list:
  - supabase/config.toml
  - supabase/migrations/0001_foundation.sql
  - supabase/migrations/0002_phase1_review_fixes.sql
  - supabase/seed.sql
  - supabase/tests/profiles_trigger.sql
  - supabase/tests/profiles_rls.sql
  - supabase/tests/rls_helpers.sql
  - .github/workflows/rls-check.yml
  - .github/workflows/ci.yml
  - src/theme/tokens.ts
  - src/theme/useTheme.ts
  - src/theme/ThemeProvider.tsx
  - src/components/PrimaryButton.tsx
  - src/components/SecondaryButton.tsx
  - src/components/GhostButton.tsx
  - src/components/DestructiveTextButton.tsx
  - src/components/TextInput.tsx
  - src/components/FormLabel.tsx
  - src/components/FormError.tsx
  - src/components/Avatar.tsx
  - src/components/AvatarInitials.tsx
  - src/components/Logo.tsx
  - src/components/ScreenContainer.tsx
  - src/components/ScreenHeader.tsx
  - src/components/index.ts
  - tests/tokens.test.ts
  - tests/avatar-initials.test.ts
  - app/_layout.tsx
  - app/index.tsx
  - app/(auth)/_layout.tsx
  - app/(auth)/login.tsx
  - app/(auth)/signup.tsx
  - app/(auth)/forgot-password.tsx
  - app/(auth)/reset-password.tsx
  - src/features/auth/AuthProvider.tsx
  - src/features/auth/useSession.ts
  - src/features/auth/schemas.ts
  - tests/auth-schemas.test.ts
  - tests/signup.test.ts
  - tests/signout.test.ts
  - src/features/profile/schemas.ts
  - src/features/profile/useProfile.ts
  - src/features/profile/useUpdateProfile.ts
  - src/features/profile/useAvatarUpload.ts
  - app/(app)/_layout.tsx
  - app/(app)/profile.tsx
  - tests/profile-schemas.test.ts
  - tests/avatar-upload.test.ts
  - jest.setup.ts
  - README.md
  - src/types/database.ts
  - jest.config.js
findings:
  critical: 0
  warning: 5
  info: 9
  total: 14
status: issues_found
---

# Phase 01: Code Review Report (Deep Pass — Current State)

**Reviewed:** 2026-04-22
**Depth:** deep
**Files Reviewed:** 51
**Status:** issues_found

## Summary

This deep pass inspects the Phase 01 foundation after two rounds of fixes (0001 + 0002, plus the TS fix commits). The schema + RLS work is in good shape: the CR-01 submissions self-approval hole is closed by the split owner/admin lanes plus the BEFORE-UPDATE immutability trigger; the WR-02 storage.objects invariant now runs at migration time and in CI; the WR-04 helper-based group_members policies are cleaner and cross-table consistent. No net-new critical issues were found.

What remains are a handful of warnings the fix-verification pass already tagged (WR-01-R1 cold-start recovery bypass, WR-03-R1 column-level looseness on invites) plus a few new angles found by cross-file tracing:

- An admin can still move a submission between groups they administer (post-image `group_id` isn't pinned in the admin-review policy or trigger).
- Admin review does not verify `reviewed_by = auth.uid()` — audit metadata is unconstrained.
- The onboarding "Skip for now" button on `/(app)/profile` is a literal no-op; the user sees no state change.
- `initialsFor` mangles surrogate-pair names (emoji-first display names render as `\uD83D + f`).
- Three pgTAP coverage gaps land squarely on newly-added logic (owner-immutable trigger, invites redeem-self policy, storage.objects avatars path gate). A regression in any of the three 0002 fixes would not fail CI.

Info-grade items include duplicates of the fix-verification pass (kept here with context so this document is self-contained): CI probe substring false-positive risk, missing `to authenticated` on the new owner-pending-content policy, and the README dev-build / Expo Go inconsistency.

## Warnings

### WR-01: Recovery-pending flag does not survive app kill (cold-start bypass)

**File:** `src/features/auth/AuthProvider.tsx:29`, `app/_layout.tsx:26-31`
**Issue:** `recoveryPending` is held only in React state. If the user kills the app between `verifyOtp({ type: 'recovery' })` and `updateUser({ password })`, the next launch:
1. Restores the recovery session from `LargeSecureStore` via `supabase.auth.getSession()`.
2. Initialises `recoveryPending` to `false` (no `PASSWORD_RECOVERY` event fires on cold start — only `INITIAL_SESSION`).
3. `useProtectedRoute` evaluates `session && !inApp && !onResetPassword` → replace to `/(app)/profile`.

A user mid-reset who backgrounded/killed the app is silently promoted into the app without completing password change. This is the same risk the `recoveryPending` flag was introduced to close; it closes the in-session case but not the cold-start case. Fix-verification pass tracked this as WR-01-R1 — preserved here because it is the largest remaining foundation gap and the only one reachable from user-reachable state.

**Fix:** Persist recovery intent in `expo-secure-store` when `PASSWORD_RECOVERY` fires and clear it on `USER_UPDATED` / `SIGNED_OUT`:

```ts
// AuthProvider.tsx
import * as SecureStore from 'expo-secure-store';
const RECOVERY_KEY = 'accountibuzz.recoveryPending';

useEffect(() => {
  let mounted = true;
  SecureStore.getItemAsync(RECOVERY_KEY)
    .then((v) => mounted && setRecoveryPending(v === '1'))
    .catch(() => {});
  supabase.auth.getSession().then(/* ... */);

  const { data: listener } = supabase.auth.onAuthStateChange((e, s) => {
    setSession(s);
    if (e === 'PASSWORD_RECOVERY') {
      setRecoveryPending(true);
      SecureStore.setItemAsync(RECOVERY_KEY, '1').catch(() => {});
    }
    if (e === 'USER_UPDATED' || e === 'SIGNED_OUT') {
      setRecoveryPending(false);
      SecureStore.deleteItemAsync(RECOVERY_KEY).catch(() => {});
    }
  });
  // ...
}, []);
```

A lighter-touch alternative: on cold start, `supabase.auth.signOut()` if the restored session's `aal` / `amr` carries only recovery. Either works; SecureStore persistence is the simpler mental model and mirrors the existing session-storage pattern.

### WR-02: Admin can move a submission between groups they administer

**File:** `supabase/migrations/0002_phase1_review_fixes.sql:35-40` (policy) + `46-87` (trigger)
**Issue:** `submissions_update_admin_review` checks `public.is_group_admin(group_id)` in both USING and WITH CHECK, but the two `group_id`s are evaluated on different row images — USING on the pre-image, WITH CHECK on the post-image. An attacker who admins *two* groups can:

```sql
update public.submissions
   set group_id = '<other_group_this_user_also_admins>'
 where id = '<target>';
```

USING passes (admin on `old.group_id`). WITH CHECK passes (admin on `new.group_id`). `submissions_owner_immutable` skips the whole check because `is_group_admin(old.group_id)` is true on line 62. The row migrates. This also lets an admin sidestep the `(group_id, user_id, local_date)` UNIQUE by moving a pending submission out of its collision.

Practical impact in P1 is low (no create-group UI ships until P2), but the policy semantics are wrong and will be wrong the moment anyone holds two admin roles.

**Fix:** Pin `group_id`, `user_id`, `local_date` (and `media_path`/`media_type`) on admin review too — admins legitimately change `status`, `reviewed_by`, `reviewed_at`, `rejection_reason` and nothing else. Either tighten `submissions_owner_immutable` to check these on the admin branch as well, or add a second trigger:

```sql
create or replace function public.submissions_admin_review_shape()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if public.is_group_admin(old.group_id) and auth.uid() <> old.user_id then
    if new.group_id   is distinct from old.group_id
       or new.user_id    is distinct from old.user_id
       or new.local_date is distinct from old.local_date
       or new.media_path is distinct from old.media_path
       or new.media_type is distinct from old.media_type then
      raise exception 'admin may not modify submission identity/media columns';
    end if;
  end if;
  return new;
end; $$;
```

### WR-03: Admin review does not constrain `reviewed_by` to `auth.uid()`

**File:** `supabase/migrations/0002_phase1_review_fixes.sql:35-40`
**Issue:** `submissions_update_admin_review`'s WITH CHECK only asserts the admin condition on the group. An admin issuing:

```sql
update public.submissions
   set status = 'approved',
       reviewed_by = '<other-admin-uuid>',
       reviewed_at = now()
 where id = '<target>';
```

succeeds. The audit row now attributes the review to someone else. For a single-admin group today this is cosmetic, but the audit trail is load-bearing for the streak/points triggers that land in P4 (which will key off `reviewed_by` for attribution).

**Fix:** Add to the admin-review WITH CHECK:

```sql
create policy "submissions_update_admin_review"
  on public.submissions
  for update
  to authenticated
  using (public.is_group_admin(group_id))
  with check (
    public.is_group_admin(group_id)
    and (reviewed_by is null or reviewed_by = auth.uid())
  );
```

Or pin `reviewed_by = auth.uid()` in the admin-shape trigger from WR-02.

### WR-04: Onboarding "Skip for now" button is a literal no-op

**File:** `app/(app)/profile.tsx:141-148`
**Issue:**

```tsx
<GhostButton
  label="Skip for now"
  onPress={() => {
    /* stays on profile view state; display_name remains empty so we stay in onboarding until saved */
  }}
/>
```

Tapping the button does nothing visible — the user is still in onboarding because `onboarding = profile.display_name === ''` is still true. Users interpret unresponsive buttons as broken taps and either rage-tap or leave. The only path out of onboarding is to set a display name.

**Fix:** Either (a) drop the button, (b) wire it to set a placeholder display name (`update.mutate({ display_name: 'Friend' })`) and route to `/(app)/profile`, or (c) surface a one-line confirmation (`Alert.alert('You can skip now, but your groups will see a blank name.')`). Given the onboarding semantics the plan documents, option (a) is probably correct — there's no real "skip" state in P1.

### WR-05: `initialsFor` mangles surrogate-pair names

**File:** `src/components/AvatarInitials.tsx:15-17`
**Issue:** `parts[0].slice(0, 1)` and `parts[0][0]` index by UTF-16 code unit, not code point. `initialsFor('🔥 flame')` returns `'\uD83Df'` — a lone high surrogate followed by `f`, which most renderers show as "�f". Any name whose first word is an emoji (or whose last word is an emoji, for two-word names) will render garbled in the initials avatar.

The existing `hueFor('🔥 flame')` test on `tests/avatar-initials.test.ts:15-19` confirms emoji names are a supported input, but there's no `initialsFor` coverage for that case — so the bug slipped.

**Fix:** Use `Array.from` / string iterator to iterate by code point:

```ts
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const firstChar = (s: string) => Array.from(s)[0] ?? '';
  if (parts.length === 1) return firstChar(parts[0]).toUpperCase();
  return (firstChar(parts[0]) + firstChar(parts[parts.length - 1])).toUpperCase();
}
```

And add test coverage:

```ts
expect(initialsFor('🔥 Flame')).toBe('🔥F');
expect(initialsFor('Alex 🔥')).toBe('A🔥');
```

## Info

### IN-01: `submissions_update_owner_pending_content` omits `to authenticated`

**File:** `supabase/migrations/0002_phase1_review_fixes.sql:26-31`
**Issue:** Wait — on re-read, the policy *does* include `to authenticated` on line 29. This item is WITHDRAWN. (Kept as a numbered placeholder so subsequent IN-XX references in commit history remain stable; see IN-01b below for the actual finding.)

### IN-01b: Consider `to authenticated` on `submissions_update_admin_review` — already present

The admin-review policy at line 38 also has `to authenticated`. Both 0002 policies are correctly role-scoped. No action.

### IN-02: `invites_mark_used_as_self` does not constrain mutable columns

**File:** `supabase/migrations/0002_phase1_review_fixes.sql:134-139`
**Issue:** WITH CHECK asserts `used_by = auth.uid() and used_at is not null`, so the redeemer can only mark-used-as-self. But the policy does not stop them from simultaneously mutating `code`, `group_id`, `created_by`, `expires_at` on the same row. Blast radius is limited (the attacker burns the invite in the same statement and can only burn it once), but they could, for example, change `code` to a value they plan to share or change `group_id` to point at an arbitrary group before the used-flag is set — a malicious redeemer who then argues the invite was for a different group.

In P2 when the `redeem_invite` SECURITY DEFINER RPC lands, this policy should be dropped entirely (RPC owns the path).

**Fix (P1 scope, optional):** Accept the risk and document it; close properly in P2 by dropping the policy when the RPC ships. Record "drop `invites_mark_used_as_self`" in the P2 plan.

### IN-03: Admin-is-also-row-key coupling between `groups.admin_user_id` and `group_members.role`

**File:** `supabase/migrations/0002_phase1_review_fixes.sql:144-156` (comment)
**Issue:** The 0002 comment explicitly notes the semantic shift from `group_members.role='admin'` to `groups.admin_user_id` in the group_members policies. The comment states "P2's create-group flow is responsible for keeping them in sync." That responsibility is not yet codified — no trigger, no RPC, nothing stops `group_members.role` drifting from `groups.admin_user_id`. As long as RLS policies route through `is_group_admin` (which reads `groups.admin_user_id`), drift is harmless for access control but confusing for humans reading `group_members.role`.

**Fix:** In the P2 create-group plan, either (a) drop `group_members.role` entirely (single source of truth = `groups.admin_user_id`) or (b) enforce sync via a trigger on `groups` that mirrors `admin_user_id` into `group_members.role`. Record the decision in a P2 CONTEXT entry.

### IN-04: `handle_submission_approval` trigger's WHEN clause relies on 0002's immutability trigger

**File:** `supabase/migrations/0001_foundation.sql:379-384`
**Issue:** The AFTER UPDATE trigger fires `when (old.status is distinct from new.status and new.status = 'approved')`. Today `submissions_owner_immutable` (0002:46-87) blocks owners from changing `status`, so the WHEN clause is never true on owner paths — correct. But if a future migration weakens or drops the immutability trigger (e.g., to allow owner self-deletion via a status 'withdrawn'), the P4 approval trigger would fire on owner-initiated approvals and self-credit points/streak. The two fences should be explicitly linked so the coupling is not lost.

**Fix:** Add a one-liner comment above the approval trigger definition referencing 0002's immutability trigger as the guarantor that only admin-originated UPDATEs can trip the `when` clause.

### IN-05: RLS CI probe uses substring-LIKE match against `pg_policies.qual`

**File:** `.github/workflows/rls-check.yml:64-80`
**Issue:** The bucket-policy probe uses `qual LIKE '%' || b.id || '%'`. Because `qual` is the full policy USING-expression text, and because bucket IDs are common English words, the probe can false-positive:
- Avatar policies mentioning the word "submissions" in a comment inside a definer helper
- A future bucket named "user" would match nearly every policy.

For the current two-bucket layout (`avatars`, `submissions`) this works in practice. Fix-verification pass previously filed this — preserved here for self-containment.

**Fix:** Query `pg_policies` where `tablename = 'objects' and schemaname = 'storage'` and match by the policy NAME prefix (`avatars_*`, `submissions_*`) — or, better, require at least one SELECT/INSERT policy per bucket with an explicit name-prefix convention enforced in review.

### IN-06: Client-supplied `updated_at` in profile mutations

**File:** `src/features/profile/useUpdateProfile.ts:14`, `src/features/profile/useAvatarUpload.ts:49`
**Issue:** Both hooks pass `updated_at: new Date().toISOString()` from the client. If the device clock is skewed forwards (timezone / user-set date), the server row gets a future timestamp; skewed backward, the server could regress `updated_at` below a previously-stored value. Downstream impact: `?v=${updated_at}` avatar cache-bust (`app/(app)/profile.tsx:44`) works for the cache-bust purpose (value differs) but not as a monotonic version. If two devices update concurrently, last-write-wins silently.

**Fix:** Let the DB own `updated_at`. Add a BEFORE UPDATE trigger on `public.profiles`:

```sql
create or replace function public.profiles_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

create trigger profiles_touch_updated_at_trg
  before update on public.profiles
  for each row execute function public.profiles_touch_updated_at();
```

Then drop the `updated_at` field from both client hook payloads.

### IN-07: Test coverage gap — owner-immutable trigger, invites redeem-self, storage path gates

**File:** `supabase/tests/` (missing files)
**Issue:** The two biggest 0002 safety fixes have no pgTAP coverage:

- `submissions_owner_immutable_trigger` — no test proves an owner's `update ... set status='approved'` raises. A future migration that drops the trigger would pass CI.
- `invites_mark_used_as_self` — no test proves a stranger cannot flip `used_by`/`used_at` on an invite for a group they don't belong to.
- Storage RLS — no pgTAP test impersonates users and hits `storage.objects` via `set_config('request.jwt.claims', ...)`. The avatar path-traversal gate (`(storage.foldername(name))[1] = auth.uid()::text`) is the canonical Pitfall-5 mitigation with no regression guard.

**Fix:** Add three pgTAP files:

- `supabase/tests/submissions_owner_immutable.sql` — seed user + group + pending submission, impersonate owner, attempt status flip, assert raise.
- `supabase/tests/invites_redeem_self.sql` — seed invite, impersonate stranger, attempt update, assert zero rows affected.
- `supabase/tests/storage_avatars_path.sql` — impersonate user A, attempt insert into `storage.objects` with `name='<userB>/avatar.jpg'`, assert RLS rejects.

These are all pure pgTAP — no RN harness needed.

### IN-08: README dev-build vs Expo Go inconsistency

**File:** `README.md:19`, cross-reference with project memory `feedback_rn_dev_build_required`
**Issue:** The prerequisites list instructs users to install "Expo Go app on a physical iOS or Android device", but project memory (and the stack research) says the project requires a dev build (`npx expo run:ios`) because SDK 55 + native modules (expo-secure-store, expo-image-manipulator, expo-image) are used from day one. Expo Go on SDK 55 may work for this specific Phase 01 surface (the native modules are pre-bundled in Expo Go for SDK 55), but per project convention new developers should be guided to `npx expo run:ios` immediately.

**Fix:** Replace the Expo Go line with:

```md
- Xcode (macOS) for iOS builds — this project uses a dev build from day one (`npm run ios` / `npx expo run:ios`), not Expo Go. See PITFALLS.md.
- Android Studio for Android builds (UAT deferred, see STATE.md).
```

### IN-09: `KeyboardAvoidingView` on Android has undefined behavior

**File:** `app/(auth)/login.tsx:54`, `app/(auth)/signup.tsx:59`, `app/(auth)/forgot-password.tsx:61`, `app/(auth)/reset-password.tsx:51`, `app/(app)/profile.tsx:95,248`
**Issue:** All six screens use `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`. On Android, `undefined` means the component adds no keyboard avoidance — the keyboard overlays the form. Standard RN pattern is `'height'` on Android. Since Android UAT is deferred this hasn't been caught empirically, but will regress the moment Android UAT runs.

**Fix:** `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` — or, since the pattern repeats six times, extract a `<ScreenKeyboardShell>` wrapper in `src/components/` that encapsulates both the `KeyboardAvoidingView` and `ScreenContainer`.

---

## Cross-cutting observations (non-findings)

These are not defects — they are context worth noting for Phase 2+:

- **Policy split mental model**: The two 0002 submissions UPDATE policies (`owner_pending_content` + `admin_review`) are OR-combined by Postgres RLS. An admin who is also the owner of a row (e.g. the group's sole member) evaluates both — `owner_immutable` skips its check for admins, so admin acts as admin. This is correct but non-obvious; a comment in 0002 would help future readers.
- **Root gate effect dep on `segments`**: `useSegments()` returns a fresh array each render but Expo Router memoises by route — the effect does not thrash. Traced the replace → segment-change → effect cycle; each replace converges within one segment update.
- **AuthProvider single `useEffect`**: `getSession()` and `onAuthStateChange` are registered in the same effect with a `mounted` flag. Clean; no leak on fast refresh.
- **`app/index.tsx` renders `null` during cold start until the effect fires**: users see a blank `background` color for one render (no splash). Acceptable for P1; consider a splash screen or `expo-splash-screen` integration in P2 to mask the gap.
- **RLS policies on `group_members` using SECURITY DEFINER helpers**: `is_group_member` reads `group_members` and `is_group_admin` reads `groups`. Recursion hazard would exist if `is_group_member` were called from a `group_members` policy *and* RLS were enabled on the function's target — but SECURITY DEFINER bypasses RLS, so no infinite recursion. Verified.
- **`avatars_select_public` policy is effectively cosmetic**: the `avatars` bucket is marked `public = true` in `config.toml`, so `getPublicUrl` returns an unauthenticated URL. The SELECT policy is a defence-in-depth layer for signed-URL / authenticated-client access paths; fine as-is.

---

## Sources consulted

- **Supabase RLS guide — "Use `(select auth.uid())` inside policies and prefer SECURITY DEFINER helpers over self-referential subqueries"** — informed the WR-02/WR-03 analysis and the helper-based `group_members` policies.
- **Supabase Storage Row-Level Security documentation — `storage.foldername(name)` path-prefix pattern** — used to validate the avatar path-traversal gate in 0001 and the missing pgTAP coverage in IN-07.
- **Postgres docs on `ROW LEVEL SECURITY` USING vs WITH CHECK semantics** — pre-image vs post-image distinction underlies WR-02 (admin can change `group_id`).
- **Supabase auth `onAuthStateChange` event list (INITIAL_SESSION, PASSWORD_RECOVERY, USER_UPDATED, SIGNED_OUT)** — confirms that `PASSWORD_RECOVERY` does not fire on cold start from a persisted recovery session, which underlies WR-01.
- **Expo SDK 55 release notes — New Architecture only, `expo-file-system` legacy module** — context for the `expo-file-system/legacy` import in `useAvatarUpload`.
- **React Native `KeyboardAvoidingView` docs — `behavior='padding'|'height'|'position'` per-platform recommendations** — informs IN-09.
- **Unicode Technical Standard #10 + JavaScript string iteration semantics (surrogate pairs / code points)** — underlies WR-05 (`initialsFor` emoji mangling).
- **PITFALLS.md §3 (RLS-off-by-default)** and **Pitfall 5 (avatar path traversal)** as cited inline in `0001_foundation.sql` — used to re-validate that CI probes and policy names match the pitfalls list.
- **Project memory — `feedback_rn_dev_build_required`** — informs IN-08 (README Expo Go vs dev-build).

---

_Reviewed: 2026-04-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
