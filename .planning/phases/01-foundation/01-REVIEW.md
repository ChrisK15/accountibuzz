---
phase: 01-foundation
reviewed: 2026-04-22T00:00:00Z
depth: standard
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
  warning: 7
  info: 9
  total: 17
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-22
**Depth:** standard
**Files Reviewed:** 51
**Status:** issues_found

## Summary

Phase 01 ships a solid foundation: schema + RLS baseline, auth flow (email/password + OTP reset), component library with design tokens, and profile screen with avatar upload. Supabase client wiring follows the official RN recipe (encrypted session via AES-CTR + AsyncStorage, AppState-gated auto-refresh, `detectSessionInUrl: false`). Zod schemas validate inputs correctly, RLS is enforced by CI probe, pgTAP tests cover the trigger + cross-tenant isolation.

Key concerns worth addressing before Phase 2 tightening:

1. **One critical correctness gap** in the password-reset UX: `resetPasswordForEmail()` is called with no options, which defaults to a **magic-link** email. The UI claims the user will receive a 6-digit code. Unless the Supabase email template was manually switched to expose `{{ .Token }}`, the verifyOtp call will always fail.
2. **Overly permissive `invites_update_authenticated` policy** — any authenticated user can update any invite row, even for groups they don't belong to. Marked P1-safe in a comment, but it is a real cross-tenant write primitive today.
3. **Self-referential RLS on `group_members`** creates latent recursion risk. The helper pattern (`is_group_member`) is already declared in the same file; the initial policies should use it even in P1 to avoid the footgun noted in Supabase's own RLS best-practices docs.
4. Several small bugs in async/error handling (unhandled promise rejection in `AuthProvider.useEffect`, silent no-op on empty `userId` in profile mutations, un-awaited `signOut()` errors).

Skills consulted: `supabase:supabase`, `supabase:supabase-postgres-best-practices`, `expo:upgrading-expo`, `expo:native-data-fetching`.

## Critical Issues

### CR-01: Password reset UI promises OTP code, but `resetPasswordForEmail` sends magic link by default

**File:** `app/(auth)/forgot-password.tsx:36`, `app/(auth)/reset-password.tsx:91-95`, `README.md:29-31`

**Issue:** `supabase.auth.resetPasswordForEmail(email)` is called with no second argument. In the Supabase client the default behavior is to send a **password-recovery magic link**, not an OTP token. The default `recovery` email template contains `{{ .ConfirmationURL }}`, not `{{ .Token }}`. The UI (`forgot-password.tsx` line 68: *"Enter your email and we'll send you a 6-digit code"*) and the follow-up screen (`reset-password.tsx` line 121: *"We sent a code to {email}"*) then call `verifyOtp({ email, token, type: 'recovery' })`, which will fail unless the email template has been manually edited in the Supabase Dashboard to include `{{ .Token }}`.

There is also no mention in `README.md` of editing the recovery email template — step 4 only mentions disabling Confirm email and adding the deep-link redirect URL.

The commit history (`5ccb9c6`) confirms this is the intended OTP-pivot flow, so the gap is in both the call site and the setup docs.

**Fix:**

Either (a) document the email-template edit in the README setup section and keep the current call, or (b) make the intent explicit in code:

```ts
// Option A — document in README the required email template change
// (Dashboard → Authentication → Email Templates → Reset Password → replace
//  {{ .ConfirmationURL }} with {{ .Token }})

// Option B — add an end-to-end smoke test that hits verifyOtp in CI against
// the local inbucket inbox, so a misconfigured template fails CI instead of
// production.
```

At minimum, add a README section similar to:

```markdown
4. In the Supabase Dashboard → Authentication:
   - Providers → Email → Disable "Confirm email" (D-09)
   - **Email Templates → Reset Password → replace `{{ .ConfirmationURL }}` with `{{ .Token }}`**
     so the recovery email contains the 6-digit OTP (see 01-04 summary).
   - URL Configuration → add `accountibuzz://reset-password` to Redirect URLs
```

This is Critical because the flow is end-to-end broken against a stock Supabase project. Any dev who clones the repo and follows the README will hit an invalid-token error after entering the emailed link URL as a "code."

## Warnings

### WR-01: `invites_update_authenticated` allows any logged-in user to mutate any invite row

**File:** `supabase/migrations/0001_foundation.sql:307-313`

**Issue:** The policy `using (auth.uid() is not null)` means any authenticated user can `UPDATE` any row in `public.invites` — including invites for groups they don't belong to, resetting `used_at` / `used_by` on someone else's used invite, or overwriting `code`. The P1 comment labels this "safe" because the `redeem_invite` RPC lands in P2, but the policy itself is live now, and Phase 1 ships demoable fixtures that include the demo group. Any throwaway signed-up user can tamper with invites today.

**Fix:** Gate updates to group admins + the redeemer, and constrain which columns can change:

```sql
-- Replace invites_update_authenticated with:
create policy "invites_mark_used_as_self"
  on public.invites
  for update
  to authenticated
  using (used_at is null)                        -- only un-used rows
  with check (used_by = auth.uid());             -- only self-mark

-- (Full redeem_invite RPC constraint lands in P2 per plan.)
```

Per `supabase:supabase-postgres-best-practices`, every RLS policy should either reference `auth.uid()` in a meaningful way or route through a SECURITY DEFINER function. `auth.uid() is not null` is essentially "authenticated-role-passthrough" and should not ship on a write policy.

### WR-02: `group_members` SELECT policy recursively references its own table — latent RLS recursion risk

**File:** `supabase/migrations/0001_foundation.sql:126-136` (also the nearly-identical INSERT/DELETE policies on lines 139-165)

**Issue:** The policy body `exists (select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid())` runs a subquery against the *same* table whose RLS policy is being evaluated. Postgres avoids infinite recursion here by *not* re-applying the policy to the subquery (since it is the same relation), but this is exactly the anti-pattern Supabase calls out in the RLS performance + correctness guide: it is hard to reason about, tends to produce slow plans, and can surprise you when the table gets referenced from a function/view later.

The helpers `is_group_member` / `is_group_admin` are declared later in the same migration file (lines 199-227) with `SECURITY DEFINER` + `search_path = public` — which is the canonical pattern. The policies should be rewritten to use them even in P1 (the forward declaration order requires moving the helpers above the `group_members` policies, or declaring them with stubs and re-creating later).

**Fix:** Reorder the migration so helpers are declared first, then use them:

```sql
-- Move sections 5 (helpers) above section 4 (group_members policies).
-- Note: is_group_member references group_members, so the TABLE must exist,
-- but the helper function body is not evaluated until called. So order:
--   1. create table public.group_members (+ enable RLS, no policies yet)
--   2. create function is_group_member / is_group_admin
--   3. create policies using the helpers

create policy "group_members_select_own_or_same_group"
  on public.group_members
  for select
  using (
    user_id = auth.uid()
    OR public.is_group_member(group_id)
  );
```

Same refactor for the INSERT (`insert_self_or_admin`) and DELETE (`delete_own_or_admin`) policies.

### WR-03: `AuthProvider` swallows errors from `getSession()` and leaves `loading: true` forever

**File:** `src/features/auth/AuthProvider.tsx:23-37`

**Issue:** The effect kicks off `supabase.auth.getSession().then(...)` with no `.catch(...)`. If the call rejects (storage adapter throws, decrypt failure, etc.), the promise is unhandled and `setLoading(false)` never runs. `useProtectedRoute` in `app/_layout.tsx` returns early while `loading === true`, so the user is stuck on a blank `app/index.tsx` screen with no error, no logs.

The `LargeSecureStore.getItem` path can legitimately throw — if the AES key in SecureStore is missing but the AsyncStorage ciphertext is not (e.g., partial uninstall/reinstall on Android), `_decrypt` attempts `aesjs.utils.hex.toBytes(...)` on a non-hex string.

**Fix:**

```tsx
useEffect(() => {
  let mounted = true;
  supabase.auth
    .getSession()
    .then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
    })
    .catch((err) => {
      console.warn('[AuthProvider] getSession failed', err);
      // Fall through to no-session state rather than stuck loading
    })
    .finally(() => {
      if (mounted) setLoading(false);
    });
  const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
    setSession(s);
  });
  return () => {
    mounted = false;
    listener.subscription.unsubscribe();
  };
}, []);
```

### WR-04: `useUpdateProfile` and `useAvatarUpload` silently no-op when called with empty `userId`

**File:** `app/(app)/profile.tsx:43-44`, `src/features/profile/useUpdateProfile.ts:4-21`, `src/features/profile/useAvatarUpload.ts:53-59`

**Issue:** The profile screen calls `useAvatarUpload(user?.id ?? '')` and `useUpdateProfile(user?.id ?? '')`. If `user` is temporarily null (e.g., during a sign-out transition while the mutation is mid-flight, or during the brief window before `useProfile` settles), the mutations execute with `userId === ''`:

- `useUpdateProfile` runs `.eq('id', '')` — matches zero rows — returns `error: null`. The UI switches back to view mode as if the save succeeded; the user's input vanishes silently.
- `useAvatarUpload` builds path `/avatar.jpg` (leading slash, no UUID). The storage RLS policy `(storage.foldername(name))[1] = auth.uid()::text` will reject it, so this case fails loudly, but the error surface in the UI is `upload.error` — not currently displayed on the profile screen.

The `if (!user || isPending || !profile) return null;` guard at line 57 prevents *rendering* a broken state, but the hooks are already instantiated above the guard, so the mutation *functions* exist and could be triggered from prior render's callbacks.

**Fix:** Accept `string | undefined` and short-circuit:

```ts
// useUpdateProfile.ts
export function useUpdateProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { display_name: string }) => {
      if (!userId) throw new Error('useUpdateProfile: no user');
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: input.display_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}
```

Same pattern for `useAvatarUpload`. Then in `profile.tsx`, pass `user?.id` directly.

### WR-05: `handleLogout` doesn't surface `signOut` errors; profile screen gets stuck if it fails

**File:** `app/(app)/profile.tsx:60-71`

**Issue:** `await supabase.auth.signOut()` is awaited but its `{ error }` result is discarded. If sign-out fails (network dropped mid-tap, token already revoked on server), the UI state sits on the profile screen with no feedback. The `onAuthStateChange` listener in `AuthProvider` will not fire a `SIGNED_OUT` event on error, so the gate in `_layout.tsx` won't redirect.

**Fix:**

```tsx
onPress: async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    Alert.alert(
      'Sign out failed',
      'Check your connection and try again.',
    );
  }
  // Success → AuthProvider listener + root gate redirect to /(auth)/login.
},
```

### WR-06: Avatar URL is cached by CDN but never busted — stale image after re-upload

**File:** `src/features/profile/useAvatarUpload.ts:38`, `app/(app)/profile.tsx:38-41`

**Issue:** Avatar is uploaded to the stable path `{userId}/avatar.jpg` with `upsert: true`. The public URL returned by `getPublicUrl` is stable as well. Supabase Storage responses include a far-future `Cache-Control` (CDN default), and `expo-image` caches by URL. After a user changes their avatar, the Avatar component will keep showing the old image until the cache expires or the app is reinstalled.

The query cache is invalidated, but the *URL string* returned from `getPublicUrl` is identical, so `expo-image` considers it the same resource and skips the refetch.

**Fix:** Either use content-hashed paths, or add a cache-busting query param driven by `profile.updated_at`:

```ts
// In profile.tsx:
const avatarUrl = profile?.avatar_path
  ? `${supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl}?v=${encodeURIComponent(profile.updated_at)}`
  : null;
```

`updated_at` is already refreshed by `useUpdateProfile` and `useAvatarUpload` (both set it explicitly), so the URL changes on every write → `expo-image` refetches.

### WR-07: RLS bucket-policy CI probe uses a fragile substring match

**File:** `.github/workflows/rls-check.yml:54-68`

**Issue:** The check `qual LIKE '%' || b.id || '%'` greps the `qual` column of `pg_policies` for the bucket id anywhere inside the policy expression. Two failure modes:

1. **False negative** on INSERT-only policies — `qual` is only populated for USING clauses. An INSERT policy that only has `WITH CHECK` would have `NULL` in `qual` and be skipped by the LIKE, so a bucket with *only* an insert policy would report as "missing policies." (Not a current issue because the bucket policies here include SELECT, but fragile.)
2. **False positive** if a policy name/body mentions the bucket id in a comment or references a column named similarly.

**Fix:** Use `pg_policies` with explicit expression check on both `qual` and `with_check`, and match the bucket_id as a literal:

```bash
MISSING=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "
  SELECT b.id
  FROM storage.buckets b
  WHERE b.id IN ('submissions', 'avatars')
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND (
          qual       ILIKE '%bucket_id = ''' || b.id || '''%'
          OR with_check ILIKE '%bucket_id = ''' || b.id || '''%'
        )
    );
")
```

## Info

### IN-01: Policy name collision between `public.submissions` and `storage.objects` policies

**File:** `supabase/migrations/0001_foundation.sql:255, 260, 444, 452`

**Issue:** Policy names `submissions_select_group_members` and `submissions_insert_self_in_group` are reused between the `public.submissions` table and the `storage.objects` table. Postgres scopes policy names per table so this is legal, but the duplication makes pg_policies output confusing and is a trap when using `DROP POLICY` without `ON <table>`.

**Fix:** Prefix storage policies to distinguish them:

```sql
create policy "storage_submissions_select_group_members"
  on storage.objects ...
```

### IN-02: `group_members_update_admin` policy has no `WITH CHECK`

**File:** `supabase/migrations/0001_foundation.sql:168-178`

**Issue:** The UPDATE policy only defines `USING` — meaning an admin can freely mutate any column, including setting `user_id` to another user's uuid (which would silently re-parent the row to someone else who then can't see it via their own select policy). This is partially blocked by the FK, but e.g. `role = 'admin'` flipping is not gated.

**Fix:** Add a `with check` that constrains what admin can write (matches post-update row to still be in a group the admin runs):

```sql
create policy "group_members_update_admin"
  on public.group_members
  for update
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));
```

### IN-03: Hardcoded test-password in seed.sql (acceptable, but document rotation story)

**File:** `supabase/seed.sql:30`

**Issue:** `crypt('TestPassword123', gen_salt('bf'))` hardcodes a known password for the seed user. Fine for local dev (the seed is only applied via `supabase db reset`), but there's no guard that prevents it from running against a remote project if someone runs `supabase db push` with the seed included. The test user's UUID (`00000000-…-000000000001`) would be insertable into a production `auth.users` table.

**Fix:** Either rename the file to `supabase/seed.local.sql` with a note that production must not apply it, or add an explicit `do $$ begin if current_setting('server_version_num')::int ... end $$` guard. Supabase CLI runs `seed.sql` automatically for `db reset` (local only), not `db push`, so the risk is low — but worth a README line.

### IN-04: `Skip for now` button on onboarding is a no-op with misleading affordance

**File:** `app/(app)/profile.tsx:129-135`

**Issue:** The "Skip for now" GhostButton's onPress is an empty callback with a comment explaining it's intentional. From the user's perspective, tapping a button that does nothing is confusing — they can't tell whether the tap registered or the app is frozen.

**Fix:** Either remove the button (since it genuinely does nothing) or give it real semantics (e.g., `supabase.auth.signOut()` to bail out, or navigate to a read-only empty home). If the decision is "can't skip onboarding without a display name," then simply removing the button is clearer.

### IN-05: `handleLogout` marked `async` but contains no await

**File:** `app/(app)/profile.tsx:60-71`

**Issue:** `async function handleLogout()` only calls `Alert.alert(...)` synchronously. The inner `onPress` callback is async, but the outer function need not be. Minor style nit.

**Fix:** Drop the `async` on the outer function:

```tsx
function handleLogout() {
  Alert.alert(/* ... */);
}
```

### IN-06: `useProfile` uses non-null assertion even though `enabled` gate protects it

**File:** `src/features/profile/useProfile.ts:20`

**Issue:** `.eq('id', userId!)` uses a bang. The `enabled: !!userId` guard prevents the queryFn from running when userId is undefined, so it's safe at runtime, but the bang is brittle — a future edit that removes `enabled` gains silent `null` equality. Prefer narrowing.

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

### IN-07: `expo-file-system/legacy` import is a known deprecation path in SDK 55

**File:** `src/features/profile/useAvatarUpload.ts:3`

**Issue:** SDK 55 shipped the new File API (`new File(uri).base64()`) and moved `readAsStringAsync` to `expo-file-system/legacy`. Using the legacy path is currently required because the base64-arraybuffer pipeline for Supabase Storage upload is still the recommended recipe. When Supabase publishes an updated RN recipe using `expo-file-system` v2 (or the Blob-URL-upload workaround), this should migrate.

Per `expo:upgrading-expo` guidance: legacy imports are supported in SDK 55 but slated for removal in SDK 56+. Add a TODO tracking the migration so it doesn't slip.

**Fix:** Track as a TODO referencing the Phase/plan where it'll migrate:

```ts
// TODO(phase-2+): migrate to expo-file-system v2 once Supabase storage recipe
// is updated. legacy API is deprecated and scheduled for removal in SDK 56+.
import * as FileSystem from 'expo-file-system/legacy';
```

### IN-08: No client-side image size/dimension validation in avatar upload

**File:** `src/features/profile/useAvatarUpload.ts:19-31`

**Issue:** Server-side, `config.toml` caps avatars at 5 MiB and restricts MIME to png/jpeg/webp. Client-side, there's no check — but since the pipeline forces a resize to 512px + JPEG compression at 0.85 quality, the output will almost certainly be well under 5 MiB. Still, a HEIC image >5MB that fails to resize for some reason would bubble up a server error that the UI doesn't currently render (the mutation's error state isn't wired into the Avatar Pressable).

**Fix:** Surface `upload.error` in the UI (toast/inline error), and optionally add a defensive size check on `resized.uri` before upload.

### IN-09: `rls-check.yml` and `ci.yml` duplicate the `checkout + setup` scaffolding

**File:** `.github/workflows/rls-check.yml`, `.github/workflows/ci.yml`

**Issue:** Two separate workflows trigger on the same `[push, pull_request]` events and duplicate the checkout boilerplate. Not a correctness issue, but a consolidation opportunity — one workflow with two jobs (client + rls) keeps timing and failure signals in a single PR check surface.

**Fix:** Merge into a single workflow file with two jobs. Minor DX win; low priority.

---

_Reviewed: 2026-04-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
