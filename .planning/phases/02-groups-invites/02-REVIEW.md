---
phase: 02-groups-invites
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - app/(app)/_layout.tsx
  - app/(app)/groups/[id]/index.tsx
  - app/(app)/groups/join.tsx
  - app/(app)/groups/new.tsx
  - app/(app)/index.tsx
  - app/(app)/profile.tsx
  - app/(auth)/reset-password.tsx
  - app/(auth)/signup.tsx
  - app/_layout.tsx
  - app/invite/[code].tsx
  - jest.setup.ts
  - package.json
  - src/components/InviteCodeChip.tsx
  - src/components/Modal.tsx
  - src/components/SegmentedControl.tsx
  - src/components/index.ts
  - src/features/auth/AuthProvider.tsx
  - src/features/groups/IanaTimezonePicker.tsx
  - src/features/groups/formatInviteCode.ts
  - src/features/groups/schemas.ts
  - src/features/groups/shareInvite.ts
  - src/features/groups/timezones.ts
  - src/features/groups/useActiveInvite.ts
  - src/features/groups/useCreateGroup.ts
  - src/features/groups/useDeleteGroup.ts
  - src/features/groups/useGroup.ts
  - src/features/groups/useGroupMembers.ts
  - src/features/groups/useGroupsList.ts
  - src/features/groups/useInvitePreview.ts
  - src/features/groups/useLeaveGroup.ts
  - src/features/groups/usePendingInviteReplay.ts
  - src/features/groups/useRedeemInvite.ts
  - src/features/groups/useRegenerateInvite.ts
  - src/features/groups/useTransferAdmin.ts
  - src/types/database.ts
  - supabase/migrations/0004_phase2_groups_invites.sql
  - supabase/migrations/0005_profiles_select_co_member.sql
  - supabase/tests/create_group.sql
  - supabase/tests/delete_group.sql
  - supabase/tests/get_invite_preview.sql
  - supabase/tests/invites_policies.sql
  - supabase/tests/leave_group.sql
  - supabase/tests/profiles_select_co_member.sql
  - supabase/tests/redeem_invite.sql
  - supabase/tests/regenerate_invite.sql
  - supabase/tests/rls_helpers.sql
  - supabase/tests/transfer_admin.sql
findings:
  critical: 0
  warning: 5
  info: 8
  total: 13
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-04-24
**Depth:** standard
**Files Reviewed:** 47 source + test files (35 source TS/TSX + 2 SQL migrations + 10 SQL/JS tests + package.json + jest.setup.ts)
**Status:** issues_found

## Summary

Phase 2 ships the Groups & Invites feature: 7 RPCs, 2 SQL migrations, ~15 React Query hooks/components, 4 screens (groups list, create, join, detail) and a deep-link landing route. The code is high quality overall — the threat model (T-02-INV-REPLAY, T-02-CAP-RACE, T-02-PREVIEW-LEAK, T-02-TRANSFER-DOUBLE-ADMIN) is implemented correctly server-side, RLS is closed (RPC-only writes), invariants are documented in-line, and React Query cache keys follow a consistent `['group', id, ...]` namespace.

No Critical issues were found. Five Warnings concern correctness gaps that surface in real-world but non-default conditions: a stale-avatar issue on the group-detail screen, deep-link codes with separators failing the `length !== 8` shape check, member-list ordering being non-deterministic, a possible RHF type mismatch when `profile.display_name` is null, and an `Alert.alert`-based kebab on the groups list that may not render reliably on iOS with 4+ options. Eight Info-level items cover code-smell and consistency cleanups.

The Supabase migration (`0004_phase2_groups_invites.sql`) is meticulous — every Pitfall called out in the planning docs has a matching SECURITY DEFINER guard, `set search_path = public` is set on every function, and grants are tightened (`revoke ... from public; grant ... to authenticated`). I did not find any issue with the SQL contract.

## Warnings

### WR-01: Stale avatar URLs on group-detail member rows (no cache buster)

**File:** `app/(app)/groups/[id]/index.tsx:51-54`
**Issue:** `avatarUrlFor()` returns the bare `getPublicUrl(...).data.publicUrl` without the `?v={updated_at}` cache-buster used elsewhere in the codebase. The groups-list screen (`app/(app)/index.tsx:51-55`) and profile screen (`app/(app)/profile.tsx:43-48`) explicitly append `?v=${encodeURIComponent(profile.updated_at)}` (per WR-08 of P1) so `expo-image` invalidates its on-device cache after an avatar upload to the stable `{userId}/avatar.jpg` path. The group-detail member rows reuse the same filename per user but skip the buster. Members will see a stale avatar for any other member who recently changed theirs until the URL expires from cache.
**Fix:**
```tsx
// useGroupMembers.ts — include updated_at in the SELECT
.select('user_id, role, profiles(display_name, avatar_path, updated_at)')

// MemberRow shape gains updated_at: string | null

// app/(app)/groups/[id]/index.tsx
function avatarUrlFor(path: string | null | undefined, updatedAt?: string | null): string | null {
  if (!path) return null;
  const base = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  return updatedAt ? `${base}?v=${encodeURIComponent(updatedAt)}` : base;
}
```
And pass `member.updated_at` at both call sites (line 651 and line 738).

### WR-02: Deep-link codes containing dashes return "Invite not found"

**File:** `app/invite/[code].tsx:39-54`
**Issue:** The route param is uppercased but never normalized. `formatInviteCode('ABCDEF12')` yields `ABCD-EF12`, and the share-sheet message at `src/features/groups/shareInvite.ts:14` correctly emits the raw 8-char form (`accountibuzz://invite/ABCDEF12`), so the normal flow works. **However**, users sometimes type the URL manually or paste it into a browser, dropping in the dashed form they saw on the chip. Today `code.length !== 8` collapses any such URL into branch (b) "Invite not found" with no recovery, even though the join screen accepts dashed input fine. The deep-link landing should treat the input symmetrically.
**Fix:**
```tsx
import { normalizeInviteCode } from '../../src/features/groups/formatInviteCode';
// ...
const rawCode = (params.code ?? '').toString();
const code = normalizeInviteCode(rawCode);  // handles dashes, lowercase, whitespace
const invalidCodeShape = code.length !== 8;
```
This makes `accountibuzz://invite/ABCD-EF12` and `accountibuzz://invite/ABCDEF12` equivalent.

### WR-03: Possible RHF crash if `profile.display_name` is null at edit-mode entry

**File:** `app/(app)/profile.tsx:60-62`
**Issue:** `useForm` is given `defaultValues: { display_name: profile?.display_name ?? '' }` (which guards null) but `values: profile ? { display_name: profile.display_name } : undefined` (which does NOT). The `Database['public']['Tables']['profiles']['Row']` type would need to confirm whether `display_name` is `string | null`; the read in `useGroupMembers.ts:32-33` does treat it as nullable (`r.profiles?.display_name ?? null`). RHF + zodResolver expect a string here per `profileUpdateSchema`; passing `null` produces an invalid form state and Zod will fail to validate on first render, leaving Save permanently disabled.

The `if (!user || isPending || !profile) return null;` early return at line 64 doesn't help because `profile.display_name` could still be null after the row exists. Onboarding mode at line 65 (`profile.display_name === ''`) won't catch null either — `null === ''` is false, so a null-displayName user enters the view branch directly and lands in edit mode with broken validation.
**Fix:**
```tsx
values: profile ? { display_name: profile.display_name ?? '' } : undefined,
```
And update the onboarding gate to `const onboarding = !profile.display_name;` so a null also routes through onboarding.

### WR-04: Member list rendering order is non-deterministic

**File:** `src/features/groups/useGroupMembers.ts:18-23`
**Issue:** The query has no `.order(...)` clause, so PostgREST returns rows in physical-row order (which is insertion-time, but could shift on REINDEX/VACUUM and is not guaranteed). Group-detail renders the member list directly from this array (`members.map(...)` at line 403), and `members[0]` is implicitly assumed to be deterministic by the avatar-stack pattern. UI testing today probably renders consistently, but a re-fetch after a join can swap row order with no visible cause. The transfer picker (`members.filter(m => m.user_id !== user?.id)` at line 532) inherits this non-determinism, so target ordering also flickers between renders.
**Fix:** Add a deterministic order — admin first, then members alphabetically by display_name (or by `joined_at`):
```ts
.order('role', { ascending: false })  // 'admin' > 'member' alphabetically; flip if needed
.order('joined_at', { ascending: true })
```
Either Supabase-side, or sort in the mapper. `joined_at` is on `group_members` (per `database.ts:42`), making it the cleanest stable key.

### WR-05: Native `Alert.alert` with 4 options is unreliable on iOS for the admin kebab

**File:** `app/(app)/groups/[id]/index.tsx:222-247`, also `app/(app)/index.tsx:57-69`
**Issue:** iOS `UIAlertController` with `style: .alert` (which is what RN `Alert.alert` produces) is recommended to have at most 2 actions; with 4 buttons (Regenerate / Transfer / Delete / Cancel) iOS stacks them vertically but truncates long labels and on small devices may scroll, hurting discoverability. Apple HIG specifies action sheets for >2 destructive choices. For Android, `Alert` only honors 3 buttons (positive/negative/neutral); button #4 may be silently dropped on some OEM skins.

This is a design + reliability concern rather than a strict bug — the iOS render usually works, and Android's RN polyfill stacks them. But the project already imports `react-native` ActionSheetIOS in some spec docs, and the spec calls this a "kebab menu" which implies action-sheet semantics.
**Fix:** On iOS use `ActionSheetIOS.showActionSheetWithOptions`; on Android use a custom `<Modal>` (or the existing `Modal.tsx` primitive with a list body). At minimum, consolidate the destructive choice (Delete) into its own confirm modal that's reachable from a single primary kebab pick — i.e. limit kebab to 3 choices max.

## Info

### IN-01: `Etc/GMT+N` and `Etc/GMT-N` signs are confusing without comment

**File:** `src/features/groups/timezones.ts:441-470`
**Issue:** The `Etc/GMT+N` IANA convention is *inverted* from common sense (`Etc/GMT+5` is UTC-5, not UTC+5) — a tzdb quirk. Users searching "GMT+5" who match `Etc/GMT+5` will pick the wrong zone. Worth a leading code comment explaining the inversion so future maintainers don't think it's a typo.
**Fix:** Add a comment block above line 441:
```ts
// NOTE: Etc/GMT+N is INVERTED from common sense per POSIX/tzdb spec.
// Etc/GMT+5 represents UTC-5 (the Americas), Etc/GMT-5 is UTC+5 (Asia).
// labelFor() resolves to the human-readable offset so the picker UX is OK.
```

### IN-02: `useGroupMembers.ts` cast assumes single-object embed shape

**File:** `src/features/groups/useGroupMembers.ts:24-28`
**Issue:** PostgREST returns the embedded `profiles(...)` resource as either an object or an array depending on cardinality detection (FK direction matters). The cast `r.profiles?.display_name` works for object form; if PostgREST decides to return an array (which can happen if the FK is many-to-many or the relationship is ambiguous), this silently returns `undefined` for every member. The auto-generated type from `database.ts` would clarify, but the hand-cast bypasses it.
**Fix:** Use the generated `Database` type and let TS enforce the shape, or defensively handle both forms:
```ts
const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
```

### IN-03: `getPublicUrl(...)` is called inside render on every avatar reference

**File:** `app/(app)/groups/[id]/index.tsx:51-54`, `app/(app)/index.tsx:49-55`, `app/(app)/profile.tsx:43-48`
**Issue:** `supabase.storage.from('avatars').getPublicUrl(path)` constructs a fresh string each render. It's pure (no network), so this is a code-smell rather than a bug, but it's redundant work in the member-rows map (called per row per render). Consider memoizing or computing the URL once when the member array updates.
**Fix:** Compute once in a `useMemo` keyed on `members` (in the parent), or in the mapper inside `useGroupMembers.ts` before returning.

### IN-04: `useActiveInvite` orders by `created_at desc` but spec guarantees one active invite

**File:** `src/features/groups/useActiveInvite.ts:19-26`
**Issue:** The 0004 migration's `regenerate_invite` closes any prior active invite (`update ... set used_at = now() where used_at is null`) before minting a new one (D-04: one active at a time). So the `.order('created_at', { ascending: false }).limit(1)` defensive logic is moot — `.maybeSingle()` would suffice without ordering. Kept "just in case" but adds noise; if a regen ever races and you really did get two non-used rows, RLS + uniqueness would still bound the result, and the newer one is what the admin wants. Either remove the ordering (and let the test enforce the invariant) or document why it's defensive.
**Fix:** Either trust the invariant and drop `.order(...)`, or add a one-line comment:
```ts
// Defensive ordering: regenerate_invite (0004) guarantees exactly one
// non-used invite per group, but order desc lets concurrent-regen races
// surface the newer one if the invariant ever drifts.
```

### IN-05: `IanaTimezonePicker` substring search has no diacritic/accent normalization

**File:** `src/features/groups/IanaTimezonePicker.tsx:55-63`
**Issue:** A user searching for "lome" won't find `Africa/Lomé` if the underlying tzdb label uses the accent (it currently doesn't, but the pattern is fragile). For the static fallback list shipped here this isn't an issue (no diacritics), but `Intl.supportedValuesOf` results on some platforms may include them.
**Fix:** Lowercase + diacritic strip both sides:
```ts
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const q = norm(query.trim());
return entries.filter(e => norm(e.iana).includes(q) || norm(e.label).includes(q));
```

### IN-06: `submission_type` typed as `string` in `database.ts` despite enum-like CHECK

**File:** `src/types/database.ts:92`, `src/features/groups/useGroup.ts:11`
**Issue:** The auto-generated `groups.Row.submission_type` is `string`, but every consumer narrows to `'photo' | 'video'` (e.g. `useGroup.ts:11`, `useGroupsList.ts:12`). If the DB ever adds a third option, the cast hides the drift. Either codify a Postgres ENUM type so `types:gen` produces a union, or document the manual narrow.
**Fix:** Convert `groups.submission_type` to a Postgres enum, or add a runtime validator (Zod) at the hook boundary:
```ts
const SubmissionType = z.enum(['photo', 'video']);
// ...
return { ...g, submission_type: SubmissionType.parse(g.submission_type) };
```

### IN-07: `Modal.tsx` `primaryFg` ternary picks the same branch on both sides

**File:** `src/components/Modal.tsx:66-69`
**Issue:**
```ts
const primaryFg = primaryIsDestructive
  ? t.colors.primaryFg // light text on red
  : t.colors.primaryFg; // near-black on yellow
```
Both branches are identical — `t.colors.primaryFg` regardless of variant. The comments suggest the intent was different colors per variant. Then line 69 immediately overrides with `'#FFFFFF'` for destructive in `primaryTextColor`, which is what's actually applied to the `<Text>`. So `primaryFg` is dead state used only for `ActivityIndicator color` (line 156) — meaning the spinner stays the same color (near-black on yellow / on red, where contrast is sub-spec on red).
**Fix:** Either delete the dead ternary and use `primaryFg = primaryTextColor`, or fix the spinner color to match the text:
```ts
const primaryTextColor = primaryIsDestructive ? '#FFFFFF' : t.colors.primaryFg;
const primaryFg = primaryTextColor;  // single source of truth
```

### IN-08: `useCreateGroup` casts RPC `data` through `unknown` twice

**File:** `src/features/groups/useCreateGroup.ts:24`
**Issue:** `const rows = data as unknown as Array<CreateGroupResult>` — the RPC `create_group` is declared `returns table (group_id uuid, invite_code text)`, which Supabase typegen models as an array of records. A direct `data as Array<CreateGroupResult>` would type-check; the double-cast through `unknown` is a sign the auto-generated types weren't aligned. If `types:gen` was rerun this would simplify. Same pattern in `useRedeemInvite.ts:18` (`data as string` for a `returns uuid` should be a `string` per typegen).
**Fix:** Re-run `npm run types:gen` and use the generated `Database['public']['Functions']['create_group']['Returns']` type directly.

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
