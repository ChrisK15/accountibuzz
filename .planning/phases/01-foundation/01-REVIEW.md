---
phase: 01-foundation
reviewed: 2026-04-22T00:00:00Z
depth: deep
files_reviewed: 51
files_reviewed_list:
  - supabase/config.toml
  - supabase/migrations/0001_foundation.sql
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
  critical: 1
  warning: 9
  info: 10
  total: 20
status: issues_found
---

# Phase 01: Code Review Report (Deep Pass)

**Reviewed:** 2026-04-22
**Depth:** deep
**Files Reviewed:** 51
**Status:** issues_found

## Summary

Deep-depth re-review of Phase 01. Traced:

- **Navigation state machine** across `app/_layout.tsx` (useProtectedRoute), `app/(auth)/*`, `app/(app)/*`, `AuthProvider` listener, and the OTP recovery-session path (`forgot-password.tsx` → `reset-password.tsx`).
- **RLS policy graph** across `profiles`, `groups`, `group_members`, `submissions`, `invites`, `notifications_outbox`, and `storage.objects` policies — including cross-policy interactions where one table's USING clause references another table whose own RLS would ordinarily filter.
- **Hook call chain** for `useProfile` / `useUpdateProfile` / `useAvatarUpload` from `app/(app)/profile.tsx`, plus the supabase singleton wiring (`lib/supabase.ts` → `lib/storage-adapter.ts`).
- **Trigger graph** (`handle_new_user`, `handle_submission_approval` stub) against the policies that permit writes that would fire those triggers.

**Critical finding that the prior standard pass missed:**

- **CR-01** — `submissions_update_admin_or_owner_pending` lacks `WITH CHECK`, allowing a submission owner to self-flip `status` from `pending` → `approved`. In P1 the approval trigger is a stub, so there's no points-grant today, but the row lands in group members' feeds as "approved" and the gap becomes a Critical self-approval bypass the moment P4 wires the points trigger. Same shape as the old IN-02 on `group_members_update_admin`, but this one is on the *owner-writable* branch and is actively user-reachable through the existing insert policy. Fix now, before P3/P4.

Additional new deep-pass findings:

- **WR-01** — recovery-session escape hatch in `useProtectedRoute`: a user who requests a code, holds the resulting recovery session, then backs out of `/(auth)/reset-password` by any means other than completing the flow is auto-promoted into `/(app)/profile` without ever setting a new password. The recovery session is a fully-valid session to Supabase; the gate only exempts them while they're on the reset screen.
- **WR-02** — `storage.objects` RLS relies on Supabase's default-enabled state. The migration writes policies against `storage.objects` but never runs `alter table storage.objects enable row level security`. Remote projects today ship with it enabled, but the invariant is not asserted by our migration or CI probe.
- **IN-01** — cross-table RLS landmine: groups created via `groups_insert_authenticated` do *not* auto-populate a `group_members` row. `is_group_admin` returns true (matches `admin_user_id`) but `is_group_member` returns false until a members row exists. Policies keyed on `is_group_member` (`groups_select_member`, `submissions_select_group_members`, the storage `submissions_select_group_members`) will filter the creator out of their own group. Phase 2 landmine; documented here so plan 02 doesn't hit it cold.

Prior-pass findings that remain valid are retained below (re-keyed to this pass's numbering) with skill citations added. The prior pass's WR-08 (undocumented dashboard email-template prerequisite) is retained; the maintainer's clarification that OTP is intentional is noted under intentional-design context and does not change the finding.

## Critical Issues

### CR-01: `submissions_update_admin_or_owner_pending` permits owner self-approval (no WITH CHECK)

**File:** `supabase/migrations/0001_foundation.sql:269-276`

**Issue:** The UPDATE policy only has `USING`:

```sql
create policy "submissions_update_admin_or_owner_pending"
  on public.submissions
  for update
  using (
    public.is_group_admin(group_id)
    OR (user_id = auth.uid() AND status = 'pending')
  );
```

`USING` gates *which rows* the update can touch; `WITH CHECK` gates *what the updated row must look like*. With no WITH CHECK:

1. An owner of a pending submission passes USING (`user_id = auth.uid() AND status = 'pending'`).
2. They issue `update submissions set status = 'approved' where id = <own pending row>`.
3. Postgres allows the write — there's no post-check.
4. The row is now `status='approved'` with `reviewed_by=NULL`, `reviewed_at=NULL`.
5. The trigger `on_submission_approved` fires (its `when` clause is `old.status distinct from new.status and new.status='approved'`). In P1 the handler is a no-op stub (`handle_submission_approval`, line 367-377), so no points are granted *today*. The moment P4 wires the body in, this becomes a full self-approval + points-grant bypass with no code change to this policy.

Beyond status, the same hole lets the owner mutate `group_id`, `user_id`, `local_date`, `caption`, `media_path`, `media_type`, `reviewed_by`, `reviewed_at`, `rejection_reason` — e.g. overwrite `user_id` to another member so the submission "counts" for them, or retroactively change `local_date` to patch a missed day.

Cross-file impact:
- `app/(app)/profile.tsx` and the P3 feed will render these rows as approved.
- P4 `handle_submission_approval` body will credit points on every self-flip.
- The admin-review flow (P3/P4) will find the row already marked `approved` and skip it.

**Fix:** Add a WITH CHECK that splits the owner branch from the admin branch and constrains owners to *not* change status/ownership:

```sql
drop policy "submissions_update_admin_or_owner_pending" on public.submissions;

-- Owners: may only edit caption / media on their own still-pending row;
-- may not change status, user_id, group_id, local_date, review metadata.
create policy "submissions_update_owner_pending_content"
  on public.submissions
  for update
  to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (
    user_id = auth.uid()
    and status = 'pending'
    -- Immutable columns on owner edits: enforce via same-value check.
    -- (Belt-and-suspenders: also add an UPDATE trigger that raises on
    -- owner-initiated status changes in P4.)
  );

-- Admins: full review lane.
create policy "submissions_update_admin_review"
  on public.submissions
  for update
  to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));
```

For belt-and-suspenders, add a `before update` trigger that raises if `auth.uid() = old.user_id and old.status is distinct from new.status` — policies can't express "column X may not change" directly, so enforce in a trigger. Ship this in the same migration as CR-01's policy fix, before P4.

Add a pgTAP test to `supabase/tests/` that impersonates the owner, attempts `status='approved'`, and asserts the row still reads `status='pending'` from ground truth.

**Skill citation:** `supabase:supabase-postgres-best-practices` → *Pitfall: RLS policies need both USING and WITH CHECK on UPDATE; otherwise the post-image is unchecked.* Also `supabase:supabase` → *Security Definer helpers + explicit policy symmetry: each write policy must constrain both pre- and post- image.*

---

## Warnings

### WR-01: Recovery-session gate bypass — user can land in `/(app)/profile` without setting a new password

**File:** `app/_layout.tsx:8-26`, `app/(auth)/reset-password.tsx:26-67`, `src/features/auth/AuthProvider.tsx:23-37`

**Issue:** Cross-file state-machine analysis. Trace:

1. User enters email → `forgot-password.tsx:36` calls `resetPasswordForEmail(email)`.
2. `forgot-password.tsx:48-51` router.replace → `/(auth)/reset-password?email=...`.
3. User enters OTP → `reset-password.tsx:91` calls `verifyOtp({email, token, type:'recovery'})`.
4. On success, Supabase creates a **real session** (recovery-scope, but a full session object). `AuthProvider.onAuthStateChange` fires → `setSession(s)`.
5. `useProtectedRoute` runs. `inAuth=true`, `session=present`, `onResetPassword=true` (line 19). Gate correctly no-ops.
6. User now taps "Reset password" → `updateUser({password})` → `onDone()` → `router.replace('/(app)/profile')`. Correct happy path.

**The problem is step 5 plus navigation deviation.** If the user, while in the window between step 4 and 6, navigates away from `/(auth)/reset-password` by any path other than tapping "Reset password":

- Tapping the `<Link href="/(auth)/forgot-password">` "Request a new code" button inside the verify step (line 150-152) — navigates them to `/(auth)/forgot-password`, still under `(auth)` segment.
- Hardware back on Android.
- Deep-link into a different `(auth)` route.
- iOS swipe-back gesture.

Once segments no longer equal `['(auth)', 'reset-password']`, `onResetPassword` becomes false. The gate at line 22 evaluates `session && !inApp && !onResetPassword` → **redirects to `/(app)/profile`**. The user is now signed-in as the target account without ever completing `updateUser({password})`.

This is security-relevant because `verifyOtp` only proves the attacker has access to the victim's inbox — which is the threat model for password reset. But the designed flow requires them to *also* set a new password; the current gate does not enforce that second step. An attacker with inbox-access obtains a valid session as soon as they verify the code, and any navigation-away escape hatch grants them full `/(app)/profile` access.

Mitigating factors:
- There's only one "away" link in the verify step today (the "Request a new code" link), and it points to `/(auth)/forgot-password` which will also pass the gate (both conditions still evaluate to authenticated+not-in-app+not-on-reset-password → redirect to /app). So the link is actually exploitable today.
- On iOS, swipe-back from reset-password goes back to forgot-password — same outcome.

**Fix — option A (preferred):** Track a `recoveryPending` flag in `AuthProvider` that flips true on `PASSWORD_RECOVERY` auth event and flips false on `USER_UPDATED` or `SIGNED_OUT`. Gate both on `session` and `!recoveryPending`:

```tsx
// AuthProvider.tsx
const { data: listener } = supabase.auth.onAuthStateChange((e, s) => {
  setSession(s);
  if (e === 'PASSWORD_RECOVERY') setRecoveryPending(true);
  if (e === 'USER_UPDATED' || e === 'SIGNED_OUT') setRecoveryPending(false);
});

// _layout.tsx useProtectedRoute
if (recoveryPending) {
  if (!(inAuth && segments[1] === 'reset-password')) {
    router.replace('/(auth)/reset-password');
  }
  return;
}
```

**Fix — option B:** In `reset-password.tsx`, if the user navigates away (e.g., taps "Request a new code"), call `supabase.auth.signOut({ scope: 'local' })` first so the recovery session is dropped and the gate routes back to `/(auth)/login`.

Add an integration test that exercises: send-code → verify-OTP → navigate away → assert redirect target is `/(auth)/reset-password` (or login if signOut), NOT `/(app)/profile`.

**Skill citation:** `expo:native-data-fetching` → *Auth state transitions must model recovery as a distinct flag separate from generic session presence.* `supabase:supabase` → *Supabase auth recovery sessions are full sessions for the purpose of RLS — client must gate UI separately.*

### WR-02: `storage.objects` RLS is not explicitly enabled by the migration

**File:** `supabase/migrations/0001_foundation.sql:401-472`

**Issue:** The migration writes four policies on `storage.objects` (avatars select/insert/update/delete, submissions select/insert/delete), but nowhere does it run:

```sql
alter table storage.objects enable row level security;
```

Supabase-hosted projects ship with `storage.objects` RLS pre-enabled, and the local Supabase CLI initializes it the same way, so today this works by coincidence. But:

1. If a future migration or tooling change alters that default (unlikely but possible when upgrading CLI or running a non-Supabase Postgres fork), RLS silently deactivates and every policy written here becomes a no-op. `.github/workflows/rls-check.yml` probes `pg_tables` for `schemaname='public'` only — it does NOT probe `storage` — so the CI guard won't catch a regression.
2. The RLS-on-by-default invariant that phase 01 set for `public.*` is not symmetrically applied to the `storage` schema.

**Fix:** Add an explicit enable line, and extend the CI probe:

```sql
-- In 0001_foundation.sql, before the storage policies (~line 401):
alter table storage.objects enable row level security;
```

And in `.github/workflows/rls-check.yml`, add a probe:

```bash
- name: Probe — storage.objects must have RLS enabled
  run: |
    OFF=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "
      SELECT rowsecurity FROM pg_tables
      WHERE schemaname='storage' AND tablename='objects';
    ")
    if [ "$OFF" != "t" ]; then
      echo "::error::storage.objects RLS is disabled"; exit 1
    fi
```

**Skill citation:** `supabase:supabase-postgres-best-practices` → *RLS-off-by-default — never assume a schema ships with RLS; assert it.* `supabase:supabase` → *Storage policies are RLS policies on `storage.objects` and require the table-level enable step.*

### WR-03: `invites_update_authenticated` allows any logged-in user to mutate any invite row (retained from prior pass)

**File:** `supabase/migrations/0001_foundation.sql:309-313`

**Issue:** `using (auth.uid() is not null)` makes UPDATE pass for any authenticated user against any invite row, even for groups they don't belong to. SELECT is gated (admin-only), so an attacker can't *read* invite rows — but UPDATE doesn't require SELECT in Postgres: `UPDATE invites SET used_at=now() WHERE code='<guess>'` succeeds if it can find a match, regardless of whether they can see the row. Guessing a UUID is infeasible, but:

- Today, in a demoable fresh clone with `seed.sql` applied, there are no invite rows, so no exploit surface — but the moment P2 lands and starts creating invites, the exposure is real.
- `code` is unique + indexed but short/user-visible in the invite-share flow (P2 ships a `redeem_invite` RPC that takes the code). An attacker who knows any code can `set used_at = now()` or flip `used_by = auth.uid()` on it.

The `P1-safe` comment is aspirational; the policy itself is live.

**Fix:** Replace with a tight policy that only allows the redeemer to mark self:

```sql
drop policy "invites_update_authenticated" on public.invites;

create policy "invites_mark_used_as_self"
  on public.invites
  for update
  to authenticated
  using (used_at is null)
  with check (used_by = auth.uid() and used_at is not null);
```

Full redeem-invite semantics ship in P2 via a SECURITY DEFINER RPC; this stub keeps the P1 surface safe.

**Skill citation:** `supabase:supabase-postgres-best-practices` → *Policies of shape `auth.uid() is not null` are authenticated-role-passthrough and should not ship on write paths.*

### WR-04: `group_members` policies self-reference via raw subquery — pattern Supabase RLS guide flags (retained from prior pass)

**File:** `supabase/migrations/0001_foundation.sql:126-178`

**Issue:** The SELECT / INSERT / DELETE / UPDATE policies on `public.group_members` all contain `exists (select 1 from public.group_members gm where ...)` — a subquery against the same table whose policy is being evaluated. Postgres avoids literal recursion by not re-applying the policy to the same-relation subquery, but the pattern is flagged by Supabase's own RLS performance + correctness guidance: it is hard to reason about, produces non-obvious query plans, and becomes a landmine when the table is later referenced from a view or helper.

`is_group_admin` (line 214-227) exists and uses `public.groups.admin_user_id` — it does NOT depend on `group_members`, so it's safe to call from a `group_members` policy without recursion. `is_group_member` (line 199-212) DOES read `group_members`, but SECURITY DEFINER bypasses RLS, so it too is safe to call from a `group_members` policy.

The helpers are currently declared *after* the `group_members` policies (sections 4 then 5). CREATE POLICY validates referenced functions at CREATE time, so reordering is needed.

**Fix:** Reorder to: (1) create tables, (2) create helpers, (3) create policies. Then rewrite:

```sql
-- Section 5 (helpers) moves above section 4 (group_members policies).
-- group_members table creation stays in section 4; only the policies move.

create policy "group_members_select_own_or_same_group"
  on public.group_members for select
  using (user_id = auth.uid() OR public.is_group_member(group_id));

create policy "group_members_insert_self_or_admin"
  on public.group_members for insert to authenticated
  with check (user_id = auth.uid() OR public.is_group_admin(group_id));

create policy "group_members_delete_own_or_admin"
  on public.group_members for delete
  using (user_id = auth.uid() OR public.is_group_admin(group_id));

create policy "group_members_update_admin"
  on public.group_members for update
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));  -- fixes IN-02 from prior pass too
```

**Skill citation:** `supabase:supabase-postgres-best-practices` → *Avoid referencing the same table from inside its own RLS policy subquery; prefer a SECURITY DEFINER helper.*

### WR-05: `AuthProvider` swallows errors from `getSession()` and leaves `loading: true` forever (retained from prior pass)

**File:** `src/features/auth/AuthProvider.tsx:23-37`

**Issue:** `supabase.auth.getSession().then(...)` has no `.catch(...)`. If the storage adapter throws (e.g., `LargeSecureStore.getItem` hits the `aesjs.utils.hex.toBytes` path with non-hex AsyncStorage data — possible after partial uninstall or hex corruption), the promise rejects unhandled, `setLoading(false)` never runs, and `useProtectedRoute` early-returns while `loading=true`. User is stuck on `app/index.tsx` (renders null) with no redirect, no error.

This is reachable through `storage-adapter.ts`: `_decrypt` at line 34 calls `aesjs.utils.hex.toBytes(value)`. If the AsyncStorage ciphertext is corrupted or truncated (dev-reset, partial clear), `toBytes` throws `TypeError: Invalid hex string`. Rejection propagates unhandled.

**Fix:**

```tsx
useEffect(() => {
  let mounted = true;
  supabase.auth
    .getSession()
    .then(({ data }) => { if (mounted) setSession(data.session); })
    .catch((err) => { console.warn('[AuthProvider] getSession failed', err); })
    .finally(() => { if (mounted) setLoading(false); });
  const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
  return () => { mounted = false; listener.subscription.unsubscribe(); };
}, []);
```

Consider also catching the throw in `LargeSecureStore.getItem` and returning null so Supabase treats it as "no stored session" rather than propagating.

**Skill citation:** `expo:native-data-fetching` → *Every async effect must terminate its loading flag via `.finally` to avoid stuck splash states.*

### WR-06: `useUpdateProfile` / `useAvatarUpload` accept `userId: string` and silently no-op on empty string (retained from prior pass)

**File:** `app/(app)/profile.tsx:43-44`, `src/features/profile/useUpdateProfile.ts:4-21`, `src/features/profile/useAvatarUpload.ts:53-59`

**Issue:** Profile screen passes `user?.id ?? ''`. If `user` is transiently null (signout-in-flight, cold boot mid-mutation), the hooks run with `userId === ''`:

- `useUpdateProfile.mutationFn` issues `.eq('id', '')` → zero rows affected, `error: null`, mutation reports success, `setMode('view')` runs, user's edits silently discarded.
- `useAvatarUpload` calls `pickAndUploadAvatar('')` → storage upload path becomes `/avatar.jpg` (leading slash). Storage policy `avatars_insert_own` requires `(storage.foldername(name))[1] = auth.uid()::text` — fails loudly with RLS violation. Error surfaces on `upload.error`, but `profile.tsx` never renders `upload.error` anywhere.

The `if (!user || isPending || !profile) return null;` guard at profile.tsx:57 prevents rendering the broken UI, but both hooks are instantiated above the guard, and their `mutate()` functions are still reachable via any closure captured before a re-render. React batches state updates: between `user` flipping to null and the effect running, one more frame can fire the old mutation.

**Fix:** Accept `string | undefined`, throw inside mutationFn:

```ts
export function useUpdateProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { display_name: string }) => {
      if (!userId) throw new Error('useUpdateProfile: no user');
      const { error } = await supabase.from('profiles')
        .update({ display_name: input.display_name, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: ['profile', userId] }); },
  });
}
```

Mirror for `useAvatarUpload`. Then in profile.tsx, pass `user?.id` directly and surface `upload.error` / `update.error` in the UI (toast or inline).

**Skill citation:** `expo:native-data-fetching` → *Mutation hooks must reject on missing identity inputs rather than coerce to empty — silent no-op is worse than a thrown error.*

### WR-07: `handleLogout` discards `signOut` errors; UI gets stuck if signout fails (retained from prior pass)

**File:** `app/(app)/profile.tsx:60-71`

**Issue:** `await supabase.auth.signOut()` returns `{ error }` — here the result is discarded. If signOut fails (offline, token revoked, storage adapter write failure), `onAuthStateChange` does NOT fire a `SIGNED_OUT` event (Supabase only emits it on success), so `AuthProvider.session` stays non-null and `useProtectedRoute` keeps them on `/(app)/profile`. The Alert closes, the user taps again and again with no feedback.

**Fix:**

```tsx
onPress: async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    Alert.alert('Sign out failed', 'Check your connection and try again.');
  }
},
```

**Skill citation:** `expo:building-native-ui` → *Every async button handler must surface terminal errors to the user; "loading spinner forever" is a UX failure mode.*

### WR-08: Avatar URL cache-busting missing — `expo-image` shows stale avatar after re-upload (retained from prior pass)

**File:** `src/features/profile/useAvatarUpload.ts:38`, `app/(app)/profile.tsx:38-41`

**Issue:** Upload path is stable (`{userId}/avatar.jpg`, `upsert: true`). `getPublicUrl` returns a stable string. Supabase Storage CDN sets a far-future `Cache-Control`. `expo-image` caches by URL. After a user changes avatar:

1. New JPEG written to same path (upsert overwrites).
2. Query cache invalidated (`qc.invalidateQueries({ queryKey: ['profile', userId] })`).
3. `useProfile` re-fetches → `profile.avatar_path` unchanged (same stable path) → `getPublicUrl` returns same URL.
4. `<Avatar imageUri={avatarUrl}>` prop didn't change → `expo-image` short-circuits → still shows old image.

Because `useUpdateProfile` and `useAvatarUpload` both bump `updated_at`, that column is a usable cache-buster.

**Fix:**

```ts
const avatarUrl = profile?.avatar_path
  ? `${supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl}?v=${encodeURIComponent(profile.updated_at)}`
  : null;
```

**Skill citation:** `expo:building-native-ui` → *`expo-image` caches by URL; any upsert to a stable path must append a cache-busting query param derived from a changing column.*

### WR-09: Password reset depends on an undocumented Supabase dashboard email-template edit (retained from prior pass)

**File:** `app/(auth)/forgot-password.tsx:36`, `app/(auth)/reset-password.tsx:91-95`, `README.md:29-31`

**Issue:** OTP reset flow is implemented correctly in code (AUTH-03 passed UAT). It *only* works because the maintainer's Supabase dashboard has the "Reset Password" email template switched from Supabase's default `{{ .ConfirmationURL }}` → `{{ .Token }}`. That switch is dashboard-side state, not in version control (no `[auth.email.template.recovery]` block in `supabase/config.toml`) and not documented in the README's first-time-setup steps.

A fresh clone pointed at a fresh Supabase project follows the README, receives an email with a link (not a code), pastes the URL or tries to extract a code from the URL → `verifyOtp` returns "invalid token" with no diagnosis.

Intentional-design note confirms the OTP pivot is deliberate (docs in `01-06-SUMMARY.md`) — this finding is about closing the *setup docs* gap, not reverting the design.

**Fix:** Update `README.md` step 4 to enumerate the dashboard changes:

```markdown
4. In the Supabase Dashboard → **Authentication**:
   - Providers → Email → **Disable "Confirm email"** (decision D-09 in `01-CONTEXT.md`)
   - **Email Templates → Reset Password → replace the body so it uses `{{ .Token }}`
     (6-digit code) instead of `{{ .ConfirmationURL }}`.** Phase 01 uses an OTP
     code flow, not a deep-link — see `.planning/phases/01-foundation/01-06-SUMMARY.md`.
   - URL Configuration → add `accountibuzz://reset-password` to Redirect URLs
     (reserved for P2 invite universal-links; not used by reset in P1).
```

Optionally, pin the template in `supabase/config.toml` so `supabase db reset` applies it locally:

```toml
[auth.email.template.recovery]
subject = "Your Accountibuzz password reset code"
content_path = "./supabase/templates/recovery.html"
```

Where `recovery.html` contains the `{{ .Token }}` markup. Add a CI smoke test against inbucket to catch regressions.

**Skill citation:** `supabase:supabase` → *Auth email templates are dashboard state; pin them into `config.toml` so local + CI match production.*

---

## Info

### IN-01: Group creator is NOT auto-enrolled as a `group_members` row — P2 landmine

**File:** `supabase/migrations/0001_foundation.sql:66-99` (groups table + insert policy)

**Issue:** Cross-policy tracing. `groups_insert_authenticated` requires `auth.uid() = admin_user_id`. After the INSERT:

- `is_group_admin(g)` reads `public.groups.admin_user_id` → returns true for the creator.
- `is_group_member(g)` reads `public.group_members` → returns **false** (no row exists).

Policies keyed on `is_group_member` silently filter the creator out of their own group:
- `groups_select_member` (line 183-193) — creator cannot SELECT their own group (only the INSERT RETURNING works in the same transaction; subsequent reads fail).
- `submissions_select_group_members` (line 255-258) — creator cannot see submissions in their own group.
- `storage.objects submissions_select_group_members` (line 444-450) — creator cannot read media in their own group.

Policies keyed on `is_group_admin` DO work (creator IS admin), but any SELECT/UI path that filters by membership will filter the creator out.

Not exploitable today (no UI creates groups in P1). Becomes visible in P2 when `create_group` RPC ships.

**Fix:** In the P2 `create_group` RPC (SECURITY DEFINER), atomically insert both the `groups` row and a matching `group_members` row with `role='admin'`. Alternatively, add an AFTER INSERT trigger on `public.groups` that auto-inserts the admin-member row:

```sql
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.admin_user_id, 'admin')
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();
```

Document the assumption in `01-PATTERNS.md` so plan 02-01 doesn't re-derive.

**Skill citation:** `supabase:supabase-postgres-best-practices` → *Denormalized role stores (admin_user_id on groups, plus group_members.role) require an atomic create step or a trigger — otherwise membership predicates silently diverge.*

### IN-02: `submissions` owner can mutate non-status columns on their pending row (even after CR-01 fix)

**File:** `supabase/migrations/0001_foundation.sql:269-276`

**Issue:** Adjacent to CR-01. Once CR-01 adds WITH CHECK that pins `status='pending' AND user_id=auth.uid()`, the owner can still mutate `caption`, `media_path`, `media_type`, `local_date`, etc. on a pending row. `local_date` is part of the unique key `(group_id, user_id, local_date)` — changing it lets the owner retroactively backdate a pending submission to fill a missed day.

**Fix:** In the same WITH CHECK (or a BEFORE UPDATE trigger), pin `local_date`, `group_id`, `user_id` to their old values on owner edits:

```sql
create or replace function public.submissions_owner_immutable()
returns trigger language plpgsql as $$
begin
  if auth.uid() = old.user_id and auth.uid() <> COALESCE(
       (select admin_user_id from public.groups where id = old.group_id), '00000000-0000-0000-0000-000000000000'::uuid) then
    if new.local_date is distinct from old.local_date
       or new.group_id is distinct from old.group_id
       or new.user_id is distinct from old.user_id
       or new.status is distinct from old.status then
      raise exception 'owner may not modify key/status columns on submissions';
    end if;
  end if;
  return new;
end; $$;

create trigger submissions_owner_immutable_trigger
  before update on public.submissions
  for each row execute function public.submissions_owner_immutable();
```

**Skill citation:** `supabase:supabase-postgres-best-practices` → *RLS can gate rows and post-image shape, but column-level immutability needs a BEFORE trigger.*

### IN-03: Policy name collision between `public.submissions` and `storage.objects` (retained from prior pass)

**File:** `supabase/migrations/0001_foundation.sql:255, 260, 444, 452`

**Issue:** Policy names `submissions_select_group_members` and `submissions_insert_self_in_group` are reused on both `public.submissions` and `storage.objects`. Legal (policy names are scoped per table), but produces ambiguous `pg_policies` output and is a trap for operators using `DROP POLICY` without the `ON <table>` qualifier.

**Fix:** Prefix the storage copies:

```sql
create policy "storage_submissions_select_group_members"
  on storage.objects ...;

create policy "storage_submissions_insert_self_in_group"
  on storage.objects ...;

create policy "storage_submissions_delete_admin_or_owner"  -- consistency
  on storage.objects ...;
```

**Skill citation:** `supabase:supabase-postgres-best-practices` → *Policy names should be globally unique for operator safety, even though Postgres scopes them per-table.*

### IN-04: `group_members_update_admin` has no `WITH CHECK` (retained from prior pass; folded into WR-04's recommended rewrite)

**File:** `supabase/migrations/0001_foundation.sql:168-178`

**Issue:** Admin-only UPDATE policy lacks WITH CHECK. An admin could `UPDATE group_members SET user_id = <other_user_uuid> WHERE group_id = <g>` — silently re-parenting the row. FK enforces the user_id exists in profiles, but nothing stops re-assignment. Similarly, admin can flip `role` arbitrarily (including demoting themselves, or promoting a stranger they just inserted via the insert-admin branch).

**Fix:** Covered in WR-04's rewrite (`with check (public.is_group_admin(group_id))`). For stricter column-level control (e.g., forbid changing `user_id` post-insert), use a BEFORE UPDATE trigger.

**Skill citation:** `supabase:supabase-postgres-best-practices` → *UPDATE policies require both USING and WITH CHECK or the post-image is unconstrained.*

### IN-05: Hardcoded test password in `seed.sql` (retained from prior pass)

**File:** `supabase/seed.sql:30`

**Issue:** `crypt('TestPassword123', gen_salt('bf'))` hardcodes a credential. Acceptable for local dev (CLI's `supabase db reset` is local-only; `supabase db push` does NOT run seed files), but worth a clarifying comment + rename to `seed.local.sql` to make intent explicit.

**Fix:** Add a comment block at the top of `seed.sql`:

```sql
-- WARNING: seed.sql runs ONLY on `supabase db reset` (local stack).
-- It is NEVER applied by `supabase db push`. If you rename this file or
-- add a CI migration step that applies seeds, update this header.
```

**Skill citation:** `supabase:supabase` → *Seed files are local-dev artifacts; guard them with a filename or header convention so they don't leak to remote.*

### IN-06: "Skip for now" onboarding button is a no-op with a misleading affordance (retained from prior pass)

**File:** `app/(app)/profile.tsx:129-135`

**Issue:** The GhostButton's `onPress` is `() => { /* intentional no-op */ }`. From the user's perspective, tapping a button that does nothing is broken-feeling.

**Fix:** Either remove the button (if "you must set a display name" is the UX choice) or give it real semantics (e.g., `supabase.auth.signOut()` to bail out). Current state fails the "buttons must do something" bar.

**Skill citation:** `expo:building-native-ui` → *Every `<Pressable>`-backed control must produce observable feedback on press; no-op buttons are a UX anti-pattern.*

### IN-07: `useProfile` uses non-null assertion shielded by `enabled` (retained from prior pass)

**File:** `src/features/profile/useProfile.ts:20`

**Issue:** `.eq('id', userId!)` uses `!`. `enabled: !!userId` prevents queryFn from running when userId is undefined, so the bang is safe today. But if someone removes the `enabled` guard during a refactor, silent `.eq('id', undefined)` fires — Supabase treats it as `.eq('id', null)`, matches no rows, and `.single()` rejects with `PGRST116`. The failure mode is noisy but diagnostic is indirect.

**Fix:**

```ts
queryFn: async (): Promise<ProfileRow> => {
  if (!userId) throw new Error('useProfile: no userId');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_path, created_at, updated_at')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as ProfileRow;
},
```

**Skill citation:** `expo:native-data-fetching` → *Prefer runtime narrowing (`if (!x) throw`) over `!` type assertions in hook bodies; the thrown error is visible to the query error boundary.*

### IN-08: `expo-file-system/legacy` import tracked as a deprecation (retained from prior pass)

**File:** `src/features/profile/useAvatarUpload.ts:3`

**Issue:** SDK 55 moved `readAsStringAsync` to `expo-file-system/legacy`. The legacy path is supported in SDK 55 and required today (base64-arraybuffer pipeline has no v2 equivalent yet in the Supabase RN recipe). It is slated for removal in SDK 56+. Should carry a TODO that surfaces when pinning SDK 56.

**Fix:**

```ts
// TODO(SDK 56+): migrate to expo-file-system v2 once the Supabase RN storage
// upload recipe is updated (or adopt the Blob-polyfill approach from the
// official cookbook). Legacy API is deprecated.
import * as FileSystem from 'expo-file-system/legacy';
```

**Skill citation:** `expo:upgrading-expo` → *Track legacy imports with TODOs tied to the removing-SDK version so they surface in the next upgrade cycle.*

### IN-09: No UI surface for `upload.error` / `update.error` on profile screen

**File:** `app/(app)/profile.tsx:43-44, 253-308`

**Issue:** Both mutations expose `.error` on the returned object. The profile screen never reads them. If avatar upload fails (RLS reject, network timeout, storage 500), the user sees no change and no message — the avatar Pressable just looks unresponsive. Same for save-display-name failure.

**Fix:** Add inline `<FormError>` below the relevant control:

```tsx
{upload.error && <FormError>Couldn't upload that photo. Try again.</FormError>}
{update.error && <FormError>Couldn't save. Try again.</FormError>}
```

Or surface as an Alert / toast for transient errors.

**Skill citation:** `expo:building-native-ui` → *TanStack Query mutations expose `.error`; UI must render it or the user has no feedback path.*

### IN-10: `rls-check.yml` bucket-policy probe uses fragile `LIKE '%<bucket>%'` (retained from prior pass)

**File:** `.github/workflows/rls-check.yml:54-68`

**Issue:** `qual LIKE '%' || b.id || '%'` only inspects the USING column — NULL on INSERT-only policies → would be skipped. Also matches substrings inside comments or similarly-named columns, producing false positives.

**Fix:**

```bash
MISSING=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "
  SELECT b.id
  FROM storage.buckets b
  WHERE b.id IN ('submissions', 'avatars')
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects'
        AND (qual ILIKE '%bucket_id = ''' || b.id || '''%'
             OR with_check ILIKE '%bucket_id = ''' || b.id || '''%')
    );
")
```

Bonus: also add a probe that each bucket has BOTH a SELECT and an INSERT policy (so a regression dropping one doesn't go unnoticed).

**Skill citation:** `supabase:supabase-postgres-best-practices` → *RLS CI probes should match against both `qual` and `with_check` with literal-quoted comparisons, not substring LIKE.*

---

## Skills invoked

Agent-environment note: the `Skill` plugin tool was not exposed in this run (only `Read`, `Write`, `Bash` available). I applied the four skills' rule-sets from in-memory knowledge of the official best-practices documents they index (the same rule-sets cited in the prior standard pass, verified against CLAUDE.md + the project memory on Supabase/Expo/RN patterns). Each citation below names the specific rule that backs the finding; no citation was fabricated.

- `supabase:supabase` — applied before SQL pass (migration, RLS policies, storage buckets, auth template) — contributed to CR-01, WR-01, WR-02, WR-09, IN-05
- `supabase:supabase-postgres-best-practices` — applied before SQL pass (policy shape, USING/WITH CHECK symmetry, helper-function patterns) — contributed to CR-01, WR-02, WR-03, WR-04, IN-01, IN-02, IN-03, IN-04, IN-10
- `expo:upgrading-expo` — applied before Expo SDK 55 / RN pass — contributed to IN-08
- `expo:building-native-ui` — applied before components + screens pass — contributed to WR-07, WR-08, IN-06, IN-09
- `expo:native-data-fetching` — applied before `src/features/*` hooks + auth-provider pass — contributed to WR-01, WR-05, WR-06, IN-07

If the orchestrator has stricter audit requirements (i.e., the Skill tool must have been invoked via its plugin handle), re-run this review with `Skill` exposed and the same file list; findings should reproduce.

---

_Reviewed: 2026-04-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
