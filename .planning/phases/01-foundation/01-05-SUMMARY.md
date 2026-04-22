---
phase: 01-foundation
plan: 05
subsystem: profile
tags: [profile, avatar, storage, tanstack-query, upload, rhf, zod]
requires:
  - 01-01 (supabase singleton + QueryClient)
  - 01-02 (profiles table + avatars bucket RLS)
  - 01-03 (UI primitives)
  - 01-04 (AuthProvider → useSession, root router gate)
provides:
  - src/features/profile/useProfile.ts (read profile row)
  - src/features/profile/useUpdateProfile.ts (mutate display_name)
  - src/features/profile/useAvatarUpload.ts (pick→resize→upload pipeline)
  - src/features/profile/schemas.ts (Zod displayNameSchema + profileUpdateSchema)
  - app/(app)/_layout.tsx (authenticated stack)
  - app/(app)/profile.tsx (onboarding/view/edit surface)
affects:
  - jest.setup.ts (added expo-image-manipulator + expo-file-system mocks)
tech-stack:
  added:
    - base64-arraybuffer (already in deps; first real use)
    - expo-image-manipulator (resize pipeline)
    - expo-file-system (base64 read)
  patterns:
    - "Canonical RN Supabase storage upload: pick → resize → base64 → ArrayBuffer (NOT Blob) → storage.upload → db.update"
    - "RHF + zodResolver + Controller for form state; schema shared with potential server validation"
    - "useForm `values` prop pulls in async-loaded profile data without manual reset()"
key-files:
  created:
    - src/features/profile/schemas.ts
    - src/features/profile/useProfile.ts
    - src/features/profile/useUpdateProfile.ts
    - src/features/profile/useAvatarUpload.ts
    - app/(app)/_layout.tsx
    - app/(app)/profile.tsx
    - tests/profile-schemas.test.ts
    - tests/avatar-upload.test.ts
  modified:
    - jest.setup.ts (added expo-image-manipulator + expo-file-system mocks)
decisions:
  - "Export bare pickAndUploadAvatar function alongside useAvatarUpload hook — unit tests assert the pure pipeline without needing a QueryClient wrapper."
  - "Render `return null` while profile is loading — root layout does not provide a skeleton surface in P1; empty frame is preferable to flicker."
  - "Skip for now button in onboarding is a no-op stub (still renders onboarding until display_name is saved). Plan 06 manual verification will confirm desired behavior; if product wants true skip, Plan 06 can set a deferred flag."
metrics:
  duration_minutes: ~20
  completed_date: "2026-04-22"
  tasks: 2
  commits: 4
---

# Phase 01 Plan 05: Profile Surface + Avatar Upload Summary

Profile surface (onboarding + view + edit), three TanStack hooks, and the canonical React Native Supabase avatar upload pipeline (base64 → ArrayBuffer, never Blob). Closes AUTH-04.

## What Shipped

### Hooks (`src/features/profile/`)

- **`useProfile(userId)`** — `useQuery` reading the current user's `profiles` row, gated on `!!userId`.
- **`useUpdateProfile(userId)`** — `useMutation` patching `display_name` + `updated_at`, invalidates `['profile', userId]` on success.
- **`useAvatarUpload(userId)`** — wraps `pickAndUploadAvatar` in a mutation with cache invalidation. The bare `pickAndUploadAvatar(userId)` function is also exported for unit-testing the pure pipeline.

### Avatar upload pipeline (canonical form)

1. `ImagePicker.launchImageLibraryAsync` with 1:1 crop, quality 0.8
2. `ImageManipulator.manipulateAsync` resize to 512 px, JPEG compress 0.85
3. `FileSystem.readAsStringAsync` → base64 string
4. `base64-arraybuffer` `decode()` → ArrayBuffer (avoids RN Blob 0-byte bug — 01-RESEARCH.md line 597)
5. `supabase.storage.from('avatars').upload('{userId}/avatar.jpg', buf, { contentType: 'image/jpeg', upsert: true })`
6. `supabase.from('profiles').update({ avatar_path, updated_at }).eq('id', userId)`
7. Returns the path string (or `null` if user cancelled picker)

### Zod schema

`displayNameSchema = z.string().trim().min(2).max(32)` — unicode + emoji permitted, no uniqueness check (per CONTEXT.md Claude's Discretion).

### Profile screen (`app/(app)/profile.tsx`)

Three-state surface driven by `profile.display_name === ''` + local `mode` state:

- **Onboarding** — "Let's set up your profile" header, centered avatar with add-photo affordance, display-name TextInput, sticky Continue + Skip.
- **View** — `Profile` / `Edit` nav, centered Avatar, display name, muted email, two placeholder stat cards (`— DAY STREAK`, `0 POINTS`). Today's-goal card hidden because users have no groups in P1.
- **Edit** — `Edit profile` / `Cancel` nav, tappable avatar with Change-avatar GhostButton, editable display_name, disabled email with helper "Email can't be changed here.", Save changes PrimaryButton, Log out DestructiveTextButton.

Logout triggers native `Alert.alert('Log out?', "You'll need to log back in to keep posting.", …)` with destructive style. Confirming calls `supabase.auth.signOut()` — the `AuthProvider` listener in the root layout redirects to `/(auth)/login`.

## Primitives integrity

No Plan 03 primitives were modified. `TextInput` exposes `disabled` and `helper` props that are consumed as-is for the read-only email field in edit mode.

## Tests

- `tests/profile-schemas.test.ts` — covers reject (empty / 1-char / whitespace / 33-char) and accept (2 / 32 / unicode / emoji / trims).
- `tests/avatar-upload.test.ts` — covers picker cancel path, happy path (correct bucket + path + contentType + upsert, profiles update), and storage error propagation (does not swallow).

Both files pass. `npx tsc --noEmit` exits 0 on the full repo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `avatar-upload.test.ts` ES-hoist bug**
- **Found during:** Task 1 GREEN phase — test suite failed to load even after implementation was correct.
- **Issue:** Jest hoists ES `import` statements above top-level statements, so the `process.env.EXPO_PUBLIC_SUPABASE_*` assignments ran *after* `src/lib/supabase.ts` was imported — tripping its env-var guard (plan 01's anti-misconfiguration check).
- **Fix:** Switched to `require()` inside each `it` block (same pattern as `tests/supabase-client.test.ts`) and added a `beforeEach` that re-asserts env + `jest.resetModules()`.
- **Files modified:** `tests/avatar-upload.test.ts`
- **Commit:** `bdcc4a9`

**2. [Rule 2 — Missing critical] `TextInput` required `onChangeText` for read-only email**
- **Found during:** Task 2 typecheck.
- **Issue:** Primitive's `onChangeText` is required (even when `disabled`). Passing nothing is a type error.
- **Fix:** Passed a no-op `() => {}` with a comment — does not touch the primitive, which remains frozen per plan constraints. Plan 03 could be revisited later to make `onChangeText` optional when `disabled`.
- **Files modified:** `app/(app)/profile.tsx` (no primitive change)
- **Commit:** `9f7455b`

## Auth gates

None — this plan requires no CLI auth or third-party secrets at runtime. All Supabase access is via the singleton client initialized in plan 01.

## Conflicts with 01-04 (parallel execution)

Zero file-level conflicts. Plan 01-04 landed `app/_layout.tsx`, `app/(auth)/*`, `src/features/auth/*` while this plan was being written. The dependency is one-way (this plan imports `useSession` from 01-04). When I first ran `npx tsc --noEmit` mid-execution I observed a TS error in `app/(auth)/login.tsx` (unrelated to my scope — 01-04's to fix); by the time I finished Task 2 it was resolved, so the final typecheck was clean.

## Deferred Issues

Pre-existing contamination in `.claude/worktrees/agent-a00b0e89/` and `agent-a87a6cce/` produces two jest failures when running the full suite (already logged in `deferred-items.md` by plan 01-03). My plan's own tests are green. Cleanup (remove stale worktree dirs OR add to `testPathIgnorePatterns`) remains open.

## Notes for manual verification (Plan 06)

- Observed avatar JPEG size: not yet measured — device walkthrough will capture typical size on real photos. Expected <150 KB per 01-RESEARCH.md.
- Manual flow: sign up → land on onboarding with empty display_name → type name + tap Continue → avatar-less view state → Edit → Change avatar → pick from library → view state re-renders with avatar → Log out → Alert → back to login.

## Self-Check

- `src/features/profile/schemas.ts` — FOUND
- `src/features/profile/useProfile.ts` — FOUND
- `src/features/profile/useUpdateProfile.ts` — FOUND
- `src/features/profile/useAvatarUpload.ts` — FOUND
- `app/(app)/_layout.tsx` — FOUND
- `app/(app)/profile.tsx` — FOUND
- `tests/profile-schemas.test.ts` — FOUND
- `tests/avatar-upload.test.ts` — FOUND
- Commit `bfe1da5` (test RED) — FOUND
- Commit `171be2a` (feat GREEN) — FOUND
- Commit `9f7455b` (profile screen) — FOUND
- Commit `bdcc4a9` (test fix) — FOUND

## Self-Check: PASSED
