# Phase 2: Groups & Invites — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** ~45 new/modified files (client + migration + tests + components)
**Analogs found:** 42 / 45 (three files — `InviteCodeChip`, `SegmentedControl`, `Modal` — are new primitives with partial analogs in P1 button patterns)

This phase is **non-greenfield**. Phase 1 is shipped and every P2 file has a direct P1 analog to mirror. The canonical rule: **copy the shape of the Phase 1 analog; change only what the new feature requires.** Where a P2 concept (e.g. RPC call instead of direct SELECT) does not exist in P1, the pattern is cited from `02-RESEARCH.md §Pattern N`.

---

## File Classification

### Client Code (Expo / React Native / TypeScript)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/groups/schemas.ts` | utility (validation) | transform | `src/features/auth/schemas.ts` | **exact** |
| `src/features/groups/formatInviteCode.ts` | utility | transform | `src/features/auth/schemas.ts` (pure fn style) | role-match |
| `src/features/groups/timezones.ts` | utility (static data + resolver) | transform | — (new concept; follows `02-RESEARCH.md §Pattern 4`) | no analog |
| `src/features/groups/shareInvite.ts` | utility (platform API wrapper) | event-driven | `src/features/profile/useAvatarUpload.ts` top-level `pickAndUploadAvatar` fn | role-match |
| `src/features/groups/useGroupsList.ts` | hook (TanStack Query) | CRUD (read) | `src/features/profile/useProfile.ts` | **exact** |
| `src/features/groups/useGroup.ts` | hook (TanStack Query) | CRUD (read) | `src/features/profile/useProfile.ts` | **exact** |
| `src/features/groups/useGroupMembers.ts` | hook (TanStack Query) | CRUD (read) | `src/features/profile/useProfile.ts` | **exact** |
| `src/features/groups/useActiveInvite.ts` | hook (TanStack Query) | CRUD (read) | `src/features/profile/useProfile.ts` | **exact** |
| `src/features/groups/useCreateGroup.ts` | hook (mutation, RPC) | CRUD (create) | `src/features/profile/useUpdateProfile.ts` | role-match (mutation shape; RPC instead of `.from().update()`) |
| `src/features/groups/useRedeemInvite.ts` | hook (mutation, RPC) | CRUD (create) | `src/features/profile/useUpdateProfile.ts` | role-match |
| `src/features/groups/useLeaveGroup.ts` | hook (mutation, RPC) | CRUD (delete) | `src/features/profile/useUpdateProfile.ts` | role-match |
| `src/features/groups/useTransferAdmin.ts` | hook (mutation, RPC) | CRUD (update) | `src/features/profile/useUpdateProfile.ts` | role-match |
| `src/features/groups/useDeleteGroup.ts` | hook (mutation, RPC) | CRUD (delete) | `src/features/profile/useUpdateProfile.ts` | role-match |
| `src/features/groups/useRegenerateInvite.ts` | hook (mutation, RPC) | CRUD (update) | `src/features/profile/useUpdateProfile.ts` | role-match |
| `src/features/groups/useInvitePreview.ts` | hook (TanStack Query, RPC, anon) | request-response | `src/features/profile/useProfile.ts` | role-match (read via `supabase.rpc` instead of `.from()`) |
| `src/features/groups/usePendingInviteReplay.ts` | hook (side-effect) | event-driven | `src/features/auth/AuthProvider.tsx` (the `recoveryPending` replay useEffect lines 40–76) | **exact** |
| `src/components/SegmentedControl.tsx` | component (primitive) | — | `src/components/PrimaryButton.tsx` (Pressable + theme tokens + tap-feedback transform) | role-match |
| `src/components/InviteCodeChip.tsx` | component (primitive) | event-driven (copy) | `src/components/Avatar.tsx` (composed primitive with theme tokens) + `PrimaryButton.tsx` (Pressable) | role-match |
| `src/components/Modal.tsx` | component (primitive) | event-driven | `src/components/ScreenContainer.tsx` (theme-token layout shell) + `PrimaryButton.tsx` | role-match (no modal exists in P1; closest is stacked-sheet layout) |
| `src/components/index.ts` | barrel export | — | existing `src/components/index.ts` | **exact** |
| `app/(app)/index.tsx` | screen (list + empty state) | CRUD (read) | `app/(app)/profile.tsx` (view/edit branches via `mode` state) | **exact** (shape: TanStack read → branch by state → render primitives) |
| `app/(app)/groups/new.tsx` | screen (form) | CRUD (create via RPC) | `app/(auth)/signup.tsx` / `app/(auth)/login.tsx` | **exact** (RHF + Zod + KeyboardAvoidingView form) |
| `app/(app)/groups/[id]/index.tsx` | screen (detail) | CRUD (read) + event | `app/(app)/profile.tsx` | **exact** |
| `app/(app)/groups/join.tsx` | screen (form) | CRUD (create via RPC) | `app/(auth)/reset-password.tsx` `VerifyStep` (single-input code form) | **exact** |
| `app/invite/[code].tsx` | screen (deep-link target) | request-response + event | `app/(auth)/reset-password.tsx` (branching by `step`, uses `useLocalSearchParams`) | role-match |
| `app/_layout.tsx` | layout / provider (MODIFIED) | event-driven | self (extend existing `RootGate` with `usePendingInviteReplay`) | **exact** self-extension |
| `app/(app)/_layout.tsx` | layout (MODIFIED — add Stack screens) | — | self (extend with groups stack screens) | **exact** |
| `app.config.ts` | config (UNCHANGED) | — | self (scheme already registered) | **exact** — no change needed |
| `package.json` | config (MODIFIED — add deps) | — | self | **exact** |
| `src/types/database.ts` | generated types (REGENERATED) | — | self (re-run `supabase gen types` after 0004) | **exact** |
| `jest.setup.ts` | test config (MODIFIED — add mocks) | — | self | **exact** |

### Database / Migrations

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0004_phase2_groups_invites.sql` | migration | DDL + function definitions | `supabase/migrations/0002_phase1_review_fixes.sql` (append-only idiom, `create or replace`, drop-and-recreate policies) | **exact** (same migration idiom) |

### Tests

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/tests/create_group.sql` | pgTAP | — | `supabase/tests/rls_helpers.sql` (multi-persona setup + role impersonation) | **exact** |
| `supabase/tests/redeem_invite.sql` | pgTAP | — | `supabase/tests/rls_helpers.sql` | **exact** |
| `supabase/tests/get_invite_preview.sql` | pgTAP | — | `supabase/tests/profiles_trigger.sql` (simple multi-assertion with `plan(N)`) | **exact** |
| `supabase/tests/leave_group.sql` | pgTAP | — | `supabase/tests/rls_helpers.sql` | **exact** |
| `supabase/tests/transfer_admin.sql` | pgTAP | — | `supabase/tests/rls_helpers.sql` | **exact** |
| `supabase/tests/delete_group.sql` | pgTAP | — | `supabase/tests/rls_helpers.sql` | **exact** |
| `supabase/tests/regenerate_invite.sql` | pgTAP | — | `supabase/tests/rls_helpers.sql` | **exact** |
| `tests/groups/schemas.test.ts` | Jest unit | — | `tests/profile-schemas.test.ts` | **exact** |
| `tests/groups/formatInviteCode.test.ts` | Jest unit | — | `tests/profile-schemas.test.ts` (pure-fn unit-test idiom) | **exact** |
| `tests/groups/new.test.tsx` | Jest integration (RN Testing Library) | — | `tests/signup.test.ts` | role-match (signup test is closest form-screen test; RN Testing Library integration is a new idiom — follow `jest-expo` preset defaults) |
| `tests/groups/detail.test.tsx` | Jest integration | — | (no close analog; follow `jest-expo` defaults + avatar-upload mocking pattern) | partial-match |
| `tests/groups/pendingInviteReplay.test.tsx` | Jest integration | — | `tests/auth-recovery-cold-start.test.tsx` | **exact** (same storage-backed replay shape) |
| `tests/groups/useGroupsList.test.ts` | Jest unit (hook) | — | `tests/avatar-upload.test.ts` (hook test with supabase mock) | role-match |
| `tests/groups/timezonePicker.test.tsx` | Jest unit | — | `tests/avatar-initials.test.ts` (pure-component render test) | role-match |

---

## Pattern Assignments

### `src/features/groups/schemas.ts` (utility, transform)

**Analog:** `src/features/auth/schemas.ts` — copy the pattern verbatim (named exports per schema + inferred types).

**Imports pattern** (auth/schemas.ts line 1):

```typescript
import { z } from 'zod';
```

**Schema shape + type export pattern** (auth/schemas.ts lines 11–17, 45–49):

```typescript
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

**P2 schemas to create (per UI-SPEC §Form labels):**

- `createGroupSchema` — `{ name: 1–60 chars, goal: 5–140 chars, submission_type: 'photo'|'video', timezone: non-empty string }`
- `joinCodeSchema` — `{ code: z.string().regex(/^[A-Z0-9]{8}$/, 'Codes are 8 letters and numbers. Check for typos.') }` (after normalization strips dashes)

Error messages must match the UI-SPEC §"Error state copy" table verbatim.

---

### `src/features/groups/formatInviteCode.ts` (utility, transform)

**Analog:** pure-function utility — no direct P1 analog; follow the `auth/schemas.ts` named-export style.

**Contract (per UI-SPEC §"Interaction Contracts" + `02-RESEARCH.md §Pattern 2`):**

```typescript
// Alphabet per OPEN QUESTION #1 + A1 — pick one and comment it in the migration too:
export const INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 31 chars, strips 0,1,O,I,L

/** Strip non-alphanum, uppercase, truncate to 8 chars. Returns normalized raw code. */
export function normalizeInviteCode(input: string): string;

/** Render `ABCD-EF12` from a raw 8-char code. */
export function formatInviteCode(raw: string): string;

/** Validate a raw code is exactly 8 chars from INVITE_ALPHABET. */
export function isValidInviteCode(raw: string): boolean;
```

All three are pure functions — trivial to unit-test (`tests/groups/formatInviteCode.test.ts`).

---

### `src/features/groups/timezones.ts` (utility)

**No direct P1 analog.** Copy the canonical shape from **`02-RESEARCH.md §Pattern 4`** (lines 567–599) verbatim:

- `listTimezones()` → `Intl.supportedValuesOf('timeZone')` with static 400-entry fallback
- `labelFor(iana)` → `Intl.DateTimeFormat` → human label
- Static fallback array lives in the same file

**Defensive posture (Pitfall 4):** the fallback is permanent, not a temporary stopgap. Unit test mocks `Intl.supportedValuesOf = undefined` and asserts `listTimezones()` returns the static array.

---

### `src/features/groups/shareInvite.ts` (utility)

**Analog:** `src/features/profile/useAvatarUpload.ts` — top-level `pickAndUploadAvatar` function style (named async fn + minimal React coupling).

**Core pattern (from `02-RESEARCH.md §Code Examples — Share message`):**

```typescript
import { Share } from 'react-native';
import { formatInviteCode } from './formatInviteCode';

export async function shareInvite(groupName: string, rawCode: string): Promise<void> {
  const message =
    `Join my Accountibuzz group ${groupName}: code ${formatInviteCode(rawCode)}\n` +
    `Or open: accountibuzz://invite/${rawCode}\n` +
    `(Get the app: <store link placeholder>)`;
  await Share.share({ message });
  // No result handling per UI-SPEC §Interaction Contracts.
}
```

Message string is **locked verbatim by UI-SPEC §"Native share-sheet message"** — literal `<store link placeholder>` string included.

---

### `src/features/groups/useGroupsList.ts`, `useGroup.ts`, `useGroupMembers.ts`, `useActiveInvite.ts`, `useInvitePreview.ts` (TanStack Query read hooks)

**Analog:** `src/features/profile/useProfile.ts` — exact same shape.

**Imports pattern** (useProfile.ts lines 1–2):

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
```

**Core pattern** (useProfile.ts lines 4–26):

```typescript
export interface ProfileRow { /* typed row */ }

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<ProfileRow> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_path, created_at, updated_at')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data as ProfileRow;
    },
  });
}
```

**P2 hook-specific adaptations:**

| Hook | Query key (per `02-RESEARCH.md §Pattern 5`) | Source |
|------|---------------------------------------------|--------|
| `useGroupsList()` | `['groups']` | `supabase.from('groups').select('id, name, goal, submission_type, timezone, group_members!inner(count)').order('name')` — see `02-RESEARCH.md §Code Examples — Groups-list read hook` |
| `useGroup(id)` | `['group', id]` | `supabase.from('groups').select(...).eq('id', id).single()` |
| `useGroupMembers(id)` | `['group', id, 'members']` | `supabase.from('group_members').select('user_id, role, profiles(display_name, avatar_path)').eq('group_id', id)` |
| `useActiveInvite(id)` | `['group', id, 'invite']` | `supabase.from('invites').select('code, expires_at').eq('group_id', id).is('used_at', null).gt('expires_at', now).single()` — admin-only per RLS |
| `useInvitePreview(code)` | `['invitePreview', code]` | `supabase.rpc('get_invite_preview', { code_input: code }).single()` — **anon-callable RPC** (Pitfall 3) |

**Error-handling invariant (Shared Pattern 4 from P1 + Pattern 1 in `02-RESEARCH.md`):**

```typescript
const { data, error } = await supabase.rpc('...', ...);
if (error) throw error; // message is the typed code: 'group_full', 'invite_expired', ...
```

The hook `throw`s; the mutation's `mutateAsync` caller `try`s and branches on `error.message` for typed errors.

**v5 API reminder (Shared Pattern 5 from P1):** use `isPending`, not `isLoading`.

---

### `src/features/groups/useCreateGroup.ts`, `useRedeemInvite.ts`, `useLeaveGroup.ts`, `useTransferAdmin.ts`, `useDeleteGroup.ts`, `useRegenerateInvite.ts` (TanStack Query mutation hooks)

**Analog:** `src/features/profile/useUpdateProfile.ts` — same mutation shape, `supabase.rpc(...)` replaces `.from('...').update(...)`.

**Imports pattern** (useUpdateProfile.ts lines 1–2):

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
```

**Core pattern** (useUpdateProfile.ts lines 4–24):

```typescript
export function useUpdateProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { display_name: string }) => {
      if (!userId) throw new Error('useUpdateProfile: no userId');
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: input.display_name, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}
```

**Per-mutation adaptations (RPC name, args, invalidation matrix from `02-RESEARCH.md §Pattern 5`):**

| Hook | RPC | Returns | `onSuccess` invalidations |
|------|-----|---------|---------------------------|
| `useCreateGroup` | `create_group(p_name, p_goal, p_submission_type, p_timezone)` | `{ group_id, invite_code }` | `['groups']`; seed `['group', group_id]` + `['group', group_id, 'invite']` via `qc.setQueryData` |
| `useRedeemInvite` | `redeem_invite(code_input)` | `uuid` (group_id) | `['groups']`, `['group', groupId]`, `['group', groupId, 'members']`; also `SecureStore.deleteItemAsync(PENDING_INVITE_KEY)` |
| `useLeaveGroup` | `leave_group(p_group_id)` | `void` | `['groups']`, `qc.removeQueries({ queryKey: ['group', groupId] })` |
| `useTransferAdmin` | `transfer_admin(p_group_id, p_new_admin_user_id)` | `void` | `['group', groupId]`, `['group', groupId, 'members']` |
| `useDeleteGroup` | `delete_group(p_group_id)` | `void` | `['groups']`, `qc.removeQueries({ queryKey: ['group', groupId] })` |
| `useRegenerateInvite` | `regenerate_invite(p_group_id)` | `text` (new_code) | `['group', groupId, 'invite']` |

**Client typed-error branching pattern (from `02-RESEARCH.md §Pattern 1` lines 444–446):**

```typescript
mutationFn: async (code: string) => {
  const { data, error } = await supabase.rpc('redeem_invite', { code_input: code });
  if (error) throw new Error(error.message); // 'group_full' | 'invite_expired' | 'invite_already_used' | 'already_member' | 'invite_not_found'
  return data as string;
},
```

Callers (screens) map `error.message` to the UI-SPEC error-copy table.

---

### `src/features/groups/usePendingInviteReplay.ts` (hook, side-effect)

**Analog:** `src/features/auth/AuthProvider.tsx` — the `recoveryPending` persisted-flag + replay pattern.

**Key analog lines (AuthProvider.tsx 18, 40–76):**

```typescript
export const RECOVERY_PENDING_KEY = 'accountibuzz.recoveryPending';
// ...
Promise.all([
  supabase.auth.getSession(),
  AsyncStorage.getItem(RECOVERY_PENDING_KEY).catch(() => null),
]).then(([{ data }, pending]) => {
  if (data.session && pending === '1') setRecoveryPending(true);
});
```

**P2 adaptation (per `02-RESEARCH.md §Pattern 3`):**

```typescript
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../auth/AuthProvider';

export const PENDING_INVITE_KEY = 'accountibuzz.pendingInviteCode';

export function usePendingInviteReplay() {
  const { session, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (loading || !session) return;
    SecureStore.getItemAsync(PENDING_INVITE_KEY).then((code) => {
      if (!code) return;
      // DO NOT clear here — clear only in useRedeemInvite onSuccess so failures retry.
      router.replace({ pathname: '/invite/[code]', params: { code } });
    });
  }, [session, loading, router]);
}
```

**Why SecureStore (not AsyncStorage like `RECOVERY_PENDING_KEY`):** `02-RESEARCH.md §Don't Hand-Roll` — "Deep-link auth-detour storage → `expo-secure-store` via the existing `LargeSecureStore` adapter". The code is not secret, but using the encrypted adapter matches the P1 pattern for anything that could leak between sessions.

**Anti-pattern to reject (Pitfall 6):** do NOT clear the key on read. Clearing happens only in `useRedeemInvite.onSuccess`.

---

### `src/components/SegmentedControl.tsx` (new primitive)

**Analog:** `src/components/PrimaryButton.tsx` — Pressable + theme tokens + tap-feedback transform.

**Imports pattern** (PrimaryButton.tsx lines 1–7):

```typescript
import { Pressable, Text, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
```

**Tap-feedback idiom (PrimaryButton.tsx lines 34–44):**

```typescript
style={({ pressed }) => [
  {
    /* layout + colors from theme tokens */
    opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
    transform: [{ scale: pressed ? 0.97 : 1 }],
  },
  style,
]}
```

**P2-specific shape (UI-SPEC §"SegmentedControl"):**
- Container `flexDirection: 'row'` with `--surface-muted` bg, `md` radius, equal-width children via `flex: 1`, height 44pt.
- Each segment = Pressable. Active segment gets `--surface` bg + 1px `--border` + bold text + subtle shadow (e1).
- Active press scale 0.98 / 100ms (slightly faster than buttons per UI-SPEC).
- A11y: each Pressable has `accessibilityRole="button"` + `accessibilityState={{ selected }}`; container has `accessibilityLabel` prop.

**Props signature per UI-SPEC:**

```typescript
interface Props {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}
```

---

### `src/components/InviteCodeChip.tsx` (new primitive)

**Analog (composition):** `src/components/Avatar.tsx` for composed-primitive layering + `src/components/PrimaryButton.tsx` for the Copy Pressable + `src/components/TextInput.tsx` for the `--surface-muted` + `--border` + `md` radius chip style.

**TextInput chip styling (TextInput.tsx lines 85–97):**

```typescript
style={[
  t.fonts.body,
  {
    backgroundColor,     // surface / surfaceMuted
    borderColor,         // border / accent / destructive
    borderWidth,
    borderRadius: t.radii.md,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
  },
]}
```

**P2-specific shape (UI-SPEC §"InviteCodeChip" + §Typography row for invite code):**
- Background `--surface-muted`, 1px `--border`, radius `md`, padding `lg` vertical / `xl` horizontal
- Code rendered as: `fontSize: 20, fontFamily: 'Manrope_700Bold', letterSpacing: 2, fontVariant: ['tabular-nums']`
- Rendered via `formatInviteCode(raw)` — display shows `ABCD-EF12`, `code` prop is raw 8-char
- Accent-cyan `Copy` Pressable inline on same row (or below on narrow screens); swaps to `Copied ✓` in `--success` for 2s, then reverts
- Uses `expo-clipboard` `Clipboard.setStringAsync(raw)` + `expo-haptics` `Haptics.notificationAsync(Success)`
- A11y: `accessibilityLabel` reads code letter-by-letter (UI-SPEC §Accessibility): `"Invite code: A, B, C, D, dash, E, F, 1, 2"`

**Props signature per UI-SPEC:**

```typescript
interface Props {
  code: string;          // raw 8-char
  onCopy?: () => void;   // optional callback after copy
}
```

---

### `src/components/Modal.tsx` (new primitive)

**No close P1 analog.** Compose RN `Modal` (from `react-native`) + `ScreenContainer`-style inner layout + `PrimaryButton`/`GhostButton` composition. Follow theme-token usage + tap-feedback patterns from existing buttons.

**Props signature per UI-SPEC §"Modal":**

```typescript
interface Props {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  body: React.ReactNode;
  primaryAction: {
    label: string;
    onPress: () => void;
    variant: 'primary' | 'destructive';
    loading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
    variant: 'destructive-text' | 'ghost';
  };
  cancelLabel: string;   // REQUIRED (no default); dev-warn if value is 'Cancel' case-insensitive
}
```

**Critical dev-mode warning invariant (UI-SPEC §Copywriting — dismiss-label rule):**

```typescript
if (__DEV__ && cancelLabel.toLowerCase() === 'cancel') {
  console.warn(
    "[Modal] cancelLabel='Cancel' is banned by the P2 copywriting contract. " +
    "Provide a context-specific label like 'Stay in group' or 'Keep the group'.",
  );
}
```

**Structure:**
- `<RNModal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>`
- Scrim `View` `rgba(0,0,0,0.45)` light / `rgba(0,0,0,0.65)` dark (use `useTheme().name` to branch), `Pressable` on scrim → `onDismiss`
- Sheet `View`: `--surface` bg, `lg` radius, padding `xl`, `maxWidth: 400`, centered; light mode e2-raised shadow, dark mode 1px `--border`
- Title: `accessibilityRole="header"`, `fonts.heading2`, `textStrong`, centered
- Body: `fonts.body`, `text` color, centered
- Primary button: full-width, `primary` or `destructive` variant (variant-switch the bg color)
- Secondary action (if present): stacked below primary with `lg` gap
- Dismiss Pressable: centered below at `2xl` margin, `accessibilityLabel={cancelLabel}`
- `accessibilityViewIsModal={true}` on sheet

---

### `app/(app)/index.tsx` — Groups list screen

**Analog:** `app/(app)/profile.tsx` — same shape (TanStack read → branch by state → render primitives).

**Imports pattern** (profile.tsx lines 1–30):

```typescript
import { useState } from 'react';
import { ... } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from '../../src/features/auth/AuthProvider';
import { useProfile } from '../../src/features/profile/useProfile';
// ...
import { useTheme } from '../../src/theme/useTheme';
import {
  ScreenContainer, ScreenHeader, Avatar, TextInput,
  PrimaryButton, GhostButton, DestructiveTextButton,
} from '../../src/components';
```

**State-branching pattern (profile.tsx lines 32–61, 92–239):**

```typescript
const { user } = useSession();
const { data, isPending } = useX(...);
if (!user || isPending || !data) return null;
const isEmpty = data.length === 0;
if (isEmpty) { return <EmptyStateBranch />; }
return <PopulatedBranch />;
```

**P2 adaptation (per UI-SPEC §"Groups list"):**
- Read: `const { data: groups, isPending, refetch } = useGroupsList();`
- Loading state (UI-SPEC): 3 skeleton rows with `--surface-muted` blocks (NOT spinner)
- Empty state: `ScreenHeader title="No groups yet" subtitle="Start one with friends or hop into theirs."` + `PrimaryButton "Create a group"` + `GhostButton "Join with a code"` (accent-link style via P1 `GhostButton` which already uses accent color)
- Populated state: nav bar with `+` icon (Feather `plus`) + kebab (Feather `more-horizontal`); `FlatList` of rows with pull-to-refresh via `refreshControl={<RefreshControl refreshing={isPending} onRefresh={refetch} />}`
- Each row (UI-SPEC §"Metadata copy"): group name (H2), 2-line truncated goal (body), caption metadata `{n} members · Photo|Video · {tz_label}`
- Row tap → `router.push('/groups/${id}')`
- Nav bar header reuses the in-place flex row idiom from profile.tsx lines 152–167

---

### `app/(app)/groups/new.tsx` — Create-group screen

**Analog:** `app/(auth)/signup.tsx` / `app/(auth)/login.tsx` — RHF + Zod + KeyboardAvoidingView form.

**Imports pattern** (login.tsx lines 1–17):

```typescript
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../src/lib/supabase';
import { loginSchema, type LoginInput } from '../../src/features/auth/schemas';
import {
  ScreenContainer, ScreenHeader, Logo, TextInput,
  PrimaryButton, GhostButton, FormError,
} from '../../src/components';
import { useTheme } from '../../src/theme/useTheme';
```

**Form skeleton (login.tsx lines 19–119):**

```typescript
export default function Screen() {
  const t = useTheme();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isValid, isSubmitting } } = useForm<Input>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { /* ... */ },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const { error } = await /* rpc or auth call */;
      if (error) { setSubmitError(/* UI-SPEC error copy */); return; }
      // success navigation
    } catch {
      setSubmitError('Something went sideways. Check your connection and try again.');
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScreenContainer>
        <ScreenHeader title="..." subtitle="..." />
        <Controller control={control} name="..." render={({ field }) => (
          <TextInput label="..." value={field.value} onChangeText={field.onChange}
            onBlur={field.onBlur} error={errors.x?.message} />
        )}/>
        {submitError && <FormError>{submitError}</FormError>}
        <PrimaryButton label="..." onPress={onSubmit} loading={isSubmitting} disabled={!isValid} />
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
```

**P2 adaptations (UI-SPEC §"Create group"):**
- 4 fields: group name (TextInput), goal (TextInput `multiline` + char counter), submission type (**new** SegmentedControl, default `'photo'`), timezone (read-only TextInput with chevron → opens IanaTimezonePicker modal)
- Default timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone` in `defaultValues`
- On success: `const { group_id } = await createGroup.mutateAsync(values); router.replace(\`/(app)/groups/\${group_id}\`);`
- Submit error copy per UI-SPEC: `'invalid_goal'` → "Add a bit more detail — at least 5 characters." / etc.

**IanaTimezonePicker modal (UI-SPEC §"IanaTimezonePicker"):** a nested modal component invoked via state; uses `<RNModal presentationStyle="pageSheet">` on iOS. Composes `TextInput` (search) + `FlatList` of `{ iana, label }` entries from `listTimezones()` + `labelFor()`.

---

### `app/(app)/groups/[id]/index.tsx` — Group detail screen

**Analog:** `app/(app)/profile.tsx` — same mode-branching shape, plus the dynamic-route param idiom from `app/(auth)/reset-password.tsx` line 29 (`useLocalSearchParams<{ email?: string }>()`).

**Dynamic-param idiom (reset-password.tsx line 29):**

```typescript
import { useLocalSearchParams } from 'expo-router';
const { id } = useLocalSearchParams<{ id: string }>();
```

**P2 structure (UI-SPEC §"Group detail"):**

Reads (all via the P1 TanStack analog):
```typescript
const { data: group } = useGroup(id);
const { data: members } = useGroupMembers(id);
const { data: activeInvite } = useActiveInvite(id); // admin-only; RLS returns null for non-admins
const { user } = useSession();
const isAdmin = group?.admin_user_id === user?.id;
```

Layout order (per UI-SPEC):
1. Header block: Display group name + body goal + caption metadata
2. Post-create banner (admin + first visit): inline `View` with `--surface-muted` bg + dismiss × + `expo-secure-store` gating with key `seen_create_banner:{id}`
3. Admin invite panel (admin only): card with `InviteCodeChip` + `PrimaryButton "Share code"` (→ `shareInvite`) + accent `Regenerate code` link (opens Regenerate confirmation Modal)
4. Members section: caption "Members (n)" + vertical list of Avatar + name + optional ADMIN badge pill
5. Destructive zone (2xl gap + 1px top border):
   - Non-admin: `DestructiveTextButton "Leave group"` → Member-leave confirmation Modal
   - Admin: accent `Transfer admin` text link → Transfer picker Modal + `DestructiveTextButton "Delete group"` → Delete confirmation Modal
6. Admin "Leave group" taps (from kebab) → Admin-leave branching Modal (not direct leave)

All modals use the new P2 `Modal` primitive with context-specific `cancelLabel` per UI-SPEC table.

---

### `app/(app)/groups/join.tsx` — Join-with-code screen

**Analog:** `app/(auth)/reset-password.tsx` `VerifyStep` (lines 69–156) — single-input code form with typed-error handling.

**Code-entry input idiom (reset-password.tsx lines 123–138):**

```typescript
<Controller
  control={control}
  name="token"
  render={({ field }) => (
    <TextInput
      label="Reset code"
      placeholder="123456"
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      value={field.value}
      onChangeText={field.onChange}
      onBlur={field.onBlur}
      error={errors.token?.message}
    />
  )}
/>
```

**P2 adaptations (UI-SPEC §"Join with code"):**
- Single TextInput, `autoCapitalize="characters"`, `autoCorrect={false}`, `maxLength={9}` (8 + 1 dash)
- `onChangeText`: normalize via `normalizeInviteCode` → re-insert dash after 4 chars for display
- Apply the monospace treatment per UI-SPEC Typography: pass a custom style override with `fontFamily: 'Manrope_700Bold'`, `fontSize: 20`, `letterSpacing: 2`, `fontVariant: ['tabular-nums']` (note: P1 `TextInput` has a `style` prop on the container; an internal style override for the input field itself may require extending the TextInput or using local style — planner to pick the cleanest path, preferring minimal TextInput extension)
- On submit: `const groupId = await redeem.mutateAsync(rawCode); router.replace(\`/(app)/groups/\${groupId}\`);`
- Typed-error branching in catch (UI-SPEC §"Error state copy"):
  ```typescript
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'group_full') setSubmitError("This group's already at 10 members. Ask the admin to make room or start your own.");
    else if (msg === 'invite_expired') setSubmitError("This invite expired. Ask the admin for a fresh code.");
    else if (msg === 'invite_already_used') setSubmitError("This code's already been used. Ask the admin for a new one.");
    else if (msg === 'already_member') setSubmitError("You're already in this group. Head on over.");
    else if (msg === 'invite_not_found') setSubmitError("We don't know that code. Double-check it with whoever invited you.");
    else setSubmitError("Something went sideways. Check your connection and try again.");
  }
  ```

---

### `app/invite/[code].tsx` — Deep-link landing screen

**Analog:** `app/(auth)/reset-password.tsx` — branching-by-state screen (`step` variable), uses `useLocalSearchParams`.

**Branching-by-state idiom (reset-password.tsx lines 26–67):**

```typescript
const [step, setStep] = useState<'verify' | 'setpw'>('verify');
// ...
return <ScreenContainer>{step === 'verify' ? <VerifyStep ... /> : <SetPasswordStep ... />}</ScreenContainer>;
```

**P2 three-path branching (UI-SPEC §"Deep-link landing"):**

```typescript
const { code } = useLocalSearchParams<{ code: string }>();
const { session } = useSession();
const { data: preview, isPending, error } = useInvitePreview(code);

if (isPending) return <SkeletonPreviewCard />;
if (error) return <NotFoundBranch />; // "Invite not found"

if (!session) return <UnauthedBranch preview={preview} onJoinTap={async () => {
  await SecureStore.setItemAsync(PENDING_INVITE_KEY, code);
  router.replace('/(auth)/login');
}} />;

return <AuthedBranch preview={preview} onJoinTap={async () => {
  try {
    const groupId = await redeem.mutateAsync(code);
    await SecureStore.deleteItemAsync(PENDING_INVITE_KEY);
    router.replace(`/(app)/groups/${groupId}`);
  } catch (err) { /* typed-error branching as above; surface inline */ }
}} />;
```

**Critical anti-patterns to reject (`02-RESEARCH.md §Anti-Patterns` lines 637–638):**
- Do NOT route to auth without rendering preview first.
- Do NOT clear `PENDING_INVITE_KEY` before `redeem.mutateAsync` succeeds.

---

### `app/_layout.tsx` — Root layout (MODIFIED, self-extend)

**Analog:** self — extend the existing `RootGate` component with a new `usePendingInviteReplay` call.

**Existing gate (app/_layout.tsx lines 8–44):**

```typescript
function useProtectedRoute() { /* ... session + recoveryPending logic */ }
function RootGate() {
  useProtectedRoute();
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**P2 extension (copy the one-line additions from `02-RESEARCH.md §Code Examples — Pending-invite replay`):**

```typescript
import { usePendingInviteReplay } from '../src/features/groups/usePendingInviteReplay';

function RootGate() {
  useProtectedRoute();
  usePendingInviteReplay();  // NEW
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Rule:** the new hook must NOT run before `loading` is false and `session` exists (already encoded in the hook itself). It coexists with `useProtectedRoute` — recovery flow still wins on priority because the reset-password gate fires from `useProtectedRoute`'s effect before the replay effect has a chance to push a new route.

---

### `supabase/migrations/0004_phase2_groups_invites.sql` — Migration

**Analog:** `supabase/migrations/0002_phase1_review_fixes.sql` — append-only idiom, `create or replace function`, drop-and-recreate policies.

**Migration header/comment style (0002 lines 1–10):**

```sql
-- =============================================================================
-- 0004_phase2_groups_invites.sql — Phase 2 Groups & Invites
-- =============================================================================
-- Adds the P2 RPCs on top of the P1 foundation. This migration is append-only
-- relative to 0001/0002/0003 — it uses drop-if-exists for policies and
-- create or replace for functions so it is idempotent against already-applied
-- state (local + remote).
--
-- RPCs added (all SECURITY DEFINER, P0001 typed errors per research/Pattern 1):
--   public.create_group(p_name, p_goal, p_submission_type, p_timezone)
--   public.redeem_invite(code_input)
--   public.get_invite_preview(code_input)        -- grant anon + authenticated
--   public.leave_group(p_group_id)
--   public.transfer_admin(p_group_id, p_new_admin_user_id)
--   public.delete_group(p_group_id)
--   public.regenerate_invite(p_group_id)
--   public.generate_invite_code()                -- internal helper
--
-- Types added:
--   public.invite_preview (group_name text, member_count int, admin_display_name text)
--
-- Policies dropped (P1 placeholders that P2 supersedes):
--   public.invites_update_authenticated  -- redemption is RPC-only now
--   public.invites_mark_used_as_self (from 0002)  -- same
--
-- CHECK constraints added:
--   public.groups.goal — length between 5 and 140 (D-17)
--   public.groups.name — length between 1 and 60 (UI-SPEC create-group errors)
-- =============================================================================
```

**`create or replace function` pattern (0001 lines 199–212):**

```sql
create or replace function public.redeem_invite(code_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  -- ...
begin
  -- ...
end;
$$;

revoke execute on function public.redeem_invite(text) from public;
grant  execute on function public.redeem_invite(text) to authenticated;
```

**Drop-then-recreate policy idiom (0002 lines 20–40):**

```sql
drop policy if exists "invites_update_authenticated" on public.invites;
-- No replacement policy — redemption moves to RPC-only.
```

**Column CHECK addition idiom:**

```sql
alter table public.groups
  add constraint groups_name_length_check check (char_length(name) between 1 and 60),
  add constraint groups_goal_length_check check (char_length(goal) between 5 and 140);
```

**Schema invariants to honor (Pitfall 1 — source of truth = `0001_foundation.sql`):**
- Column names: `groups.goal` (NOT `goal_description`), `groups.admin_user_id` (NOT `admin_id`)
- No `invite_code` column on `groups` exists; do NOT write `alter table groups drop column invite_code` — it would fail
- `groups.admin_user_id` FK is `on delete restrict` (profile side), so admin-leave must be blocked by the RPC, not by the FK
- `group_members.group_id`, `submissions.group_id`, `invites.group_id` all cascade on group delete — confirmed in 0001 lines 105, 234, 282

**RPC bodies to copy from `02-RESEARCH.md`:**
- `redeem_invite` — §Pattern 1 lines 365–426 (includes FOR UPDATE lock per Pitfall 5)
- `generate_invite_code` — §Pattern 2 lines 472–507
- `create_group` — §Code Examples lines 828–895 (full body)
- `get_invite_preview` — inline in this migration per Pitfall 3 (uses dedicated `invite_preview` type, granted to `anon` + `authenticated`)
- `leave_group` — blocks admin via `if auth.uid() = (select admin_user_id from groups where id = p_group_id) then raise exception 'admin_cannot_leave'` (Pitfall 2)
- `transfer_admin` — atomic update of `groups.admin_user_id` + flip `group_members.role` (Pitfall 8)
- `delete_group` — admin-only; cascade handled by FKs (Pitfall 9 — documented confirmation)
- `regenerate_invite` — close current active invite (`update invites set used_at = now() where group_id = $1 and used_at is null and (expires_at is null or expires_at > now())`), then mint new (Pattern 2 retry loop)

**Final alphabet decision (Open Question #1, A1):** pick **31 chars** `'23456789ABCDEFGHJKMNPQRSTUVWXYZ'` and comment it in the migration. Update `formatInviteCode.ts` `INVITE_ALPHABET` to match.

---

### `src/types/database.ts` (REGENERATED)

After `0004_*` migration applies locally, run:

```bash
supabase gen types typescript --local > src/types/database.ts
```

New types expected: `Database.public.Functions.create_group.Args/Returns`, `redeem_invite`, `get_invite_preview`, `leave_group`, `transfer_admin`, `delete_group`, `regenerate_invite`. Commit the regenerated file.

---

### `package.json` + `jest.setup.ts` (MODIFIED)

**package.json additions (per `02-RESEARCH.md §Environment Availability`):**

```bash
npx expo install expo-clipboard expo-haptics
```

(Optional: `expo-localization` only if Wave 0 Intl probe flakes.)

**jest.setup.ts additions (analog = existing mocks at the top of jest.setup.ts):**

```typescript
// Existing mocks: expo-secure-store, expo-image-picker, expo-image-manipulator, expo-file-system, @react-native-async-storage/async-storage
// Add:
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
  getStringAsync: jest.fn().mockResolvedValue(''),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
```

Conditional Intl mock for `timezonePicker.test.tsx`: set `(Intl as any).supportedValuesOf = undefined` in a `beforeAll` inside the test file to exercise the fallback path.

---

### pgTAP tests (`supabase/tests/*.sql`)

**Analog:** `supabase/tests/rls_helpers.sql` — best multi-persona template with fixture seeding, JWT impersonation, and `set local role authenticated`.

**Imports / fixture seeding idiom (rls_helpers.sql lines 1–25):**

```sql
begin;
select plan(N);

-- Seed auth users (handle_new_user trigger fills profiles)
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin@x.com', 'authenticated', 'authenticated', now(), now());

-- Seed group + memberships (as superuser; bypass RLS)
insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('cccccccc-...', 'g1', 'goal', 'photo', 'UTC', '11111111-...');
insert into public.group_members (group_id, user_id, role) values (...);
```

**Impersonation idiom (rls_helpers.sql lines 27–33):**

```sql
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
```

**Cleanup idiom (rls_helpers.sql lines 62–65):**

```sql
reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
```

**Per-test specific assertions (Wave 0 gaps → `02-RESEARCH.md §Validation Architecture`):**

| Test | Assertions |
|------|-----------|
| `create_group.sql` | RPC returns `(uuid, text)`; groups row inserted with admin_user_id = caller; group_members row exists with role='admin'; invites row exists with 8-char code, non-null expires_at (~7 days), null used_at |
| `redeem_invite.sql` | Success path: member row inserted, used_at set. Error paths (assert `raise exception` messages): `invite_not_found`, `invite_already_used`, `invite_expired`, `already_member`, `group_full` (seed 9 members + redeem; then seed 10 + redeem → expect exception). Lock assertion: structural check that `for update` appears in the function body (`pg_get_functiondef`) |
| `get_invite_preview.sql` | Call with anon role (`set local role anon`) returns 3-tuple; call with non-existent code raises `invite_not_found`; expired invite still returns preview (Pitfall 3 / Open Question #4) |
| `leave_group.sql` | Member succeeds + row gone; admin attempts → `admin_cannot_leave` exception (Pitfall 2) |
| `transfer_admin.sql` | After RPC: exactly one row with role='admin' for the group AND groups.admin_user_id matches (Pitfall 8) |
| `delete_group.sql` | After RPC: 0 rows in groups, group_members, submissions, invites for that group_id (cascade verification per Pitfall 9) |
| `regenerate_invite.sql` | Old active invite has used_at set; new invite row exists with different code, null used_at |

---

### Jest tests (`tests/groups/*.ts`, `*.tsx`)

**Analog:** `tests/profile-schemas.test.ts` (schemas), `tests/avatar-upload.test.ts` (hook + supabase mock), `tests/auth-recovery-cold-start.test.tsx` (SecureStore replay integration).

**Schema unit test shape (profile-schemas.test.ts lines 1–21):**

```typescript
import { schema } from '...';
describe('schema', () => {
  it('rejects invalid input', () => {
    expect(schema.safeParse('').success).toBe(false);
  });
  it('accepts valid input', () => {
    expect(schema.safeParse('valid').success).toBe(true);
  });
});
```

**Hook with supabase mock idiom (avatar-upload.test.ts lines 1–15):**

```typescript
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
}));

describe('useX', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });
  it('...', async () => {
    const { supabase } = require('../src/lib/supabase');
    jest.spyOn(supabase, 'rpc').mockResolvedValueOnce({ data: ..., error: null });
    // ...
  });
});
```

---

## Shared Patterns (cross-cutting — apply to multiple P2 files)

### Shared Pattern 1: Supabase singleton import (P1 Shared Pattern 2, unchanged)

**Invariant:** Every file in `src/features/groups/**` and `app/**` that touches Supabase imports the singleton. Never call `createClient` anywhere.

```typescript
import { supabase } from '../../lib/supabase';           // src/features/**
import { supabase } from '../../src/lib/supabase';       // app/**
```

### Shared Pattern 2: RHF + Zod for every form (P1 Shared Pattern 3, unchanged)

**Apply to:** `app/(app)/groups/new.tsx`, `app/(app)/groups/join.tsx`.

**Invariant:** Zod schema (`schemas.ts` next to feature) + `useForm({ resolver: zodResolver(schema), mode: 'onBlur' })` + `<Controller>` per input. No `useState` per field.

### Shared Pattern 3: supabase-js `{ data, error }` destructure (P1 Shared Pattern 4)

**Apply to:** every `supabase.rpc(...)` and `supabase.from(...)` call in P2 hooks.

**Invariant:**

```typescript
const { data, error } = await supabase.rpc('...', args);
if (error) throw error;    // in queries — React Query surfaces as hook.error
// OR: if (error) throw new Error(error.message);  // in mutations — preserves typed error code
return data;
```

### Shared Pattern 4: TanStack Query v5 (`isPending`, not `isLoading`) (P1 Shared Pattern 5)

**Apply to:** every hook in `src/features/groups/`, every screen that reads `useQuery`/`useMutation` state.

### Shared Pattern 5: Typed-error string branching (NEW in P2 — source: `02-RESEARCH.md §Pattern 1`)

**Apply to:** every screen that calls a P2 RPC mutation.

**Invariant:** PostgreSQL `raise exception 'typed_code'` surfaces on the client as `Error.message === 'typed_code'`. Screens branch:

```typescript
try { await mutateAsync(args); }
catch (err: unknown) {
  const msg = err instanceof Error ? err.message : '';
  switch (msg) {
    case 'group_full': setError("This group's already at 10 members. Ask the admin to make room or start your own."); break;
    case 'invite_expired': setError("This invite expired. Ask the admin for a fresh code."); break;
    // ...UI-SPEC §"Error state copy" table is the full mapping
    default: setError("Something went sideways. Check your connection and try again.");
  }
}
```

**No try/catch inside the hook's `mutationFn`** — hooks throw; screens handle (same as P1 login.tsx pattern).

### Shared Pattern 6: Theme tokens (P1 Shared Pattern — inherited from UI-SPEC §"Design Token Export Shape")

**Apply to:** every P2 component and screen.

**Invariant:**
- Color: `useTheme().colors.primary/accent/destructive/surface/etc.` — never hardcode colors
- Spacing: `useTheme().spacing.xs/sm/md/lg/xl/2xl` — never hardcode numbers
- Radii: `useTheme().radii.sm/md/lg/pill`
- Fonts: `useTheme().fonts.display/heading1/heading2/body/caption`

If a P2 component needs a token not in `src/theme/tokens.ts` → use the closest existing token (UI-SPEC §"Design Token Export Shape"); do NOT fork.

### Shared Pattern 7: Native module feature-degrade (NEW in P2)

**Apply to:** `expo-haptics` (copy-success haptic), `Intl.supportedValuesOf` (timezone picker).

**Invariant:** Wrap in try/catch or typeof check; never throw from a feature-degrade path. Haptics failing should never break the copy action. Intl missing should fall back to the 400-entry static list.

```typescript
try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
catch { /* silent */ }
```

### Shared Pattern 8: Modal `cancelLabel` must be context-specific (NEW in P2, UI-SPEC §Copywriting)

**Apply to:** every Modal invocation in `app/(app)/groups/[id]/index.tsx`.

**Invariant:** Pass a concrete `cancelLabel` string that says what the user is NOT doing. The Modal component dev-warns if the label is literal `'Cancel'` (case-insensitive).

Per UI-SPEC table:
| Modal | cancelLabel |
|-------|-------------|
| Member: Leave group | `"Stay in group"` |
| Admin: Transfer admin picker | `"Keep my admin role"` |
| Admin: Delete group | `"Keep the group"` |
| Admin: Regenerate invite | `"Keep current code"` |
| Admin-leave branching | `"Never mind"` |

### Shared Pattern 9: SecureStore keys are namespaced (NEW in P2, extends P1 `accountibuzz.recoveryPending`)

**Apply to:** `PENDING_INVITE_KEY`, `seen_create_banner:{group_id}` keys.

**Invariant:** All SecureStore keys prefixed `accountibuzz.` or structured as `accountibuzz.scope:id`. Mirrors `RECOVERY_PENDING_KEY = 'accountibuzz.recoveryPending'`.

### Shared Pattern 10: RLS-by-default is unchanged (P1 Shared Pattern 1)

**P2 adds no new tables** → no new RLS to author. But: **P2 MUST DROP** the P1 placeholder policies `invites_update_authenticated` (0001 lines 309–313) and `invites_mark_used_as_self` (from 0002) — both are superseded by RPC-only redemption. CI's `rls-check.yml` continues to pass because no new tables are added and all existing tables retain at least one policy.

---

## No Analog Found

Three primitives in `src/components/` are new to P2 with no close P1 analog. Planner should compose them from the combination of P1 button/input/layout patterns + the canonical spec in UI-SPEC §"Component Additions":

| File | Role | Reason | Fallback Pattern Source |
|------|------|--------|-------------------------|
| `src/components/SegmentedControl.tsx` | component | No toggle-group primitive in P1 | UI-SPEC §Component Additions #1 + mirror PrimaryButton press feedback idiom |
| `src/components/InviteCodeChip.tsx` | component | Novel composition of TextInput-chip + Copy button + tabular-numeric code rendering | UI-SPEC §Component Additions #2 + TextInput styling + PrimaryButton idiom |
| `src/components/Modal.tsx` | component | No modal/dialog primitive in P1 (P1 used `Alert.alert` exclusively) | UI-SPEC §Component Additions #3 + RN `Modal` + ScreenContainer layout tokens |

---

## Metadata

**Analog search scope:** `/Users/chris/projects/accountibuzz/src/`, `/Users/chris/projects/accountibuzz/app/`, `/Users/chris/projects/accountibuzz/supabase/`, `/Users/chris/projects/accountibuzz/tests/`

**Files scanned:** all P1 source files in `src/components/`, `src/features/auth/`, `src/features/profile/`, `src/lib/`, `src/theme/`, `app/`, `supabase/migrations/`, `supabase/tests/`, `tests/`

**Primary analog sources:**
- `src/features/profile/useProfile.ts` — read-hook template
- `src/features/profile/useUpdateProfile.ts` — mutation-hook template
- `src/features/auth/AuthProvider.tsx` — persisted-flag replay template
- `src/features/auth/schemas.ts` — Zod schemas template
- `app/(app)/profile.tsx` — branching screen template
- `app/(auth)/login.tsx` / `signup.tsx` — form screen template
- `app/(auth)/reset-password.tsx` — dynamic-param + branch-by-state template
- `app/_layout.tsx` — root gate extension pattern
- `supabase/migrations/0002_phase1_review_fixes.sql` — append-only migration idiom
- `supabase/tests/rls_helpers.sql` — pgTAP multi-persona template
- `tests/profile-schemas.test.ts` — schema unit test template
- `tests/avatar-upload.test.ts` — hook + supabase mock template
- `tests/auth-recovery-cold-start.test.tsx` — SecureStore replay integration template

**Secondary pattern sources (for files with no exact P1 analog):**
- `.planning/phases/02-groups-invites/02-RESEARCH.md` §Pattern 1 (SECURITY DEFINER RPC), §Pattern 2 (code generation), §Pattern 3 (deep-link detour), §Pattern 4 (timezone picker), §Pattern 5 (query-key invalidation matrix), §Code Examples, §Validation Architecture
- `.planning/phases/02-groups-invites/02-UI-SPEC.md` §Component Additions (SegmentedControl, InviteCodeChip, Modal), §Screen-by-Screen Contract, §Copywriting Contract, §Interaction Contracts

**Pattern extraction date:** 2026-04-24

---

## PATTERN MAPPING COMPLETE
