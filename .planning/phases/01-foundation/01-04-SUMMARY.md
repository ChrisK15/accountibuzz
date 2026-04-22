---
phase: 01-foundation
plan: 04
subsystem: auth
tags: [auth, expo-router, deep-link, forms, zod, rhf]
requires:
  - src/lib/supabase.ts (plan 01)
  - src/lib/queryClient.ts (plan 01)
  - src/theme/ThemeProvider.tsx (plan 03)
  - src/components/* primitives (plan 03)
provides:
  - app/_layout.tsx (session-aware root gate)
  - app/(auth)/ stack with four screens
  - src/features/auth/AuthProvider + useSession
  - src/features/auth/schemas (loginSchema, signupSchema, forgotSchema, resetSchema)
affects:
  - Route plan — 01-05's /(app)/profile is now the authed-user landing target
tech-stack:
  added:
    - react-hook-form (already in deps from plan 03 verification — now in use)
    - @hookform/resolvers (already in deps — now in use)
  patterns:
    - Session gate via useProtectedRoute in root layout (useSegments + session)
    - RHF + zod resolver + Controller binding per form input
    - Deep link recovery: verifyOtp({ type: 'recovery' }) then updateUser({ password })
key-files:
  created:
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
  modified: []
decisions:
  - "Custom scheme deep link accepted for MVP; Universal Links deferred (T-04-01)"
  - "Generic not-found copy accepted as user-enumeration tradeoff (T-04-04)"
  - "verifyOtp used when deep link includes token_hash; falls back to existing session otherwise"
metrics:
  duration: ~35m
  completed: 2026-04-22
  tasks: 2
  commits: 3
  files_created: 13
---

# Phase 01 Plan 04: Auth Screens + Expo Router Summary

Session-aware root layout with four RHF+Zod auth screens wired to the Supabase singleton; password-reset deep link (`accountibuzz://reset-password`) handled end-to-end via `verifyOtp({ type: 'recovery' })` → `updateUser({ password })`.

## What Shipped

- Root `app/_layout.tsx` wraps `ThemeProvider → QueryClientProvider → AuthProvider → RootGate`. `useProtectedRoute` redirects unauth users into `/(auth)/login` and authed users out of `(auth)` into `/(app)/profile` (route owned by plan 01-05).
- `AuthProvider` fetches the initial session with `supabase.auth.getSession()` (gated by `loading`) and subscribes to `onAuthStateChange`. `useSession()` throws when used outside the provider. A re-export shim `useSession.ts` is provided for consumers that prefer that import path.
- Zod schemas: `loginSchema` (permissive password — server enforces), `signupSchema` + `resetSchema` (8 chars + number + symbol via regex, `refine` for password-match), `forgotSchema` (email only). Typed inputs exported for RHF generics.
- Four screens use `ScreenContainer` + `KeyboardAvoidingView` + the primitives barrel (`Logo`, `ScreenHeader`, `TextInput`, `PrimaryButton`, `GhostButton`, `FormError`). RHF `Controller` binds each input to the primitive's value/onChangeText/onBlur. Primary CTA is disabled when `isValid === false`.
- Reset-password screen extracts `token_hash` (preferred) or `token` from `useLocalSearchParams`, calls `supabase.auth.verifyOtp({ type: 'recovery', token_hash })` in a `useEffect`, and falls back to an already-established session when no token param is present. On `verifyOtp` failure the screen switches to an expired-link state with a back-to-forgot link.

## Error copy (verbatim from UI-SPEC lines 192-198)

| Screen | Condition | String used |
|--------|-----------|-------------|
| login | invalid credentials | `"That email and password don't match. Try again or reset your password."` |
| signup | email already in use | `"That email's already signed up. Try logging in instead."` |
| signup / login / forgot | any | `"Something went sideways. Check your connection and try again."` |
| forgot-password | email not found | `"We couldn't find an account with that email."` |
| reset-password | token expired / invalid | `"This reset link has expired. Request a new one."` |
| (RHF / Zod) | invalid email | `"Enter a valid email address."` |
| (RHF / Zod) | passwords don't match | `"Passwords don't match. Give it another shot."` (signup) / `"Passwords don't match."` (reset) |

Error-to-copy mapping in `signup.tsx` and `forgot-password.tsx` switches on `error.message` substring match (`/already|registered|exists/i`, `/not found|no user|no account/i`). Supabase never returns raw stack traces here so T-04-06 is upheld (no `error.message` rendered directly).

## Supabase Dashboard state (pre-existing, confirmed)

- Email confirmation: disabled (per orchestrator brief — signup immediately yields a session).
- Redirect URLs include `accountibuzz://reset-password` (per orchestrator brief).
- No new dashboard changes required by this plan.

## Deep-link flow verification

- Wired in code; full device walkthrough deferred to Plan 01-06 Task 1 per `<verification>` block of the PLAN.
- `app.config.ts` already declares `scheme: 'accountibuzz'` from plan 01.
- `reset-password.tsx` handles both the "Supabase already applied the session" path and the "token_hash in params" path, so either behavior (depending on Supabase's deep-link PKCE handling) is covered.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] `FormError` prop mismatch.** Plan's example showed `<FormError message={...} />` but the primitive (from plan 03) accepts `children: string`. Corrected all four usages to `<FormError>{msg}</FormError>`. No ambiguity — the primitive's API is the source of truth.
2. **[Rule 2 - Missing critical functionality] Signup error branching.** PLAN specified two distinct signup error copy strings ("already signed up" vs network). Added `error.message` substring classification so the right UI copy is shown. Without this we would always render one generic string regardless of cause.
3. **[Rule 2 - Missing critical functionality] Reset-password deep-link verifyOtp step.** PLAN noted the ambiguity between "Supabase already applied session" vs "token in params". Implemented both branches: when `token_hash`/`token` is present we call `verifyOtp({ type: 'recovery', token_hash })` in a `useEffect`, and if that fails (expired/invalid) we flip to the expired-link state. Without this branch, users arriving via the email link with a token param (but no auto-session) would see the form silently fail on `updateUser`.

### Out-of-scope items discovered (not fixed, per scope boundary)

- **Stale worktree at `.claude/worktrees/agent-a00b0e89/`.** `npx jest` picks up duplicate test files from that directory; two of them fail (`storage-adapter`, `supabase-client`) because the worktree has stale `node_modules`. Not introduced by this plan — the worktree predates me. Did not fix because (a) it's outside my declared file scope and (b) cleaning it could delete work in progress. Recommend `rm -rf .claude/worktrees/agent-a00b0e89/` or adding `.claude/worktrees/**` to `jest.config.js` `testPathIgnorePatterns` as a separate maintenance task.
- **`tests/avatar-upload.test.ts` shows as modified and `app/(app)/` is untracked.** Both belong to plan 01-05 running in parallel. Left untouched per coordination rules.
- **`.planning/config.json` modified.** Present at session start; not touched by this plan.

### Conflicts with 01-05

- None in code. 01-04 owns `app/_layout.tsx`, `app/index.tsx`, `app/(auth)/**`, `src/features/auth/**`. 01-05 owns `app/(app)/**` and `src/features/profile/**`. The only indirect coupling is the route string `'/(app)/profile'` which the root gate redirects to — that file is 01-05's responsibility and was already created by that agent by the end of my session (observed `app/(app)/` as untracked in `git status`).
- Suggest a post-merge smoke: verify `router.replace('/(app)/profile')` resolves once both plans' routes are on disk.

## TDD Gate Compliance

- RED gate (`test(01-04): add failing tests for auth Zod schemas`) at commit `1a6f93d` — confirmed failing against missing schemas module.
- GREEN gate (`feat(01-04): add root layout, AuthProvider, and auth Zod schemas`) at commit `915d3af` — all four schema tests pass.
- Task 2 tests (`tests/signup.test.ts`, `tests/signout.test.ts`) are integration smoke tests against the existing Supabase singleton from plan 01; they do not exercise screen code. Documented here because they pass on first write — this is intentional per the plan's test spec, not a skipped RED gate.

## Verification Results

- `npx jest tests/auth-schemas.test.ts tests/signup.test.ts tests/signout.test.ts` — 8/8 passing.
- `npx tsc --noEmit` — no errors in 01-04 scope. Pre-existing errors in `tests/profile-schemas.test.ts` / `tests/avatar-upload.test.ts` were resolved by 01-05 completing in parallel (profile features now exist on disk).

## Commits

| Type | Hash | Message |
|------|------|---------|
| test | 1a6f93d | test(01-04): add failing tests for auth Zod schemas (RED) |
| feat | 915d3af | feat(01-04): add root layout, AuthProvider, and auth Zod schemas |
| feat | 097f5b2 | feat(01-04): add login, signup, forgot-password, reset-password screens |

## Self-Check: PASSED

Verified files exist:
- FOUND: app/_layout.tsx
- FOUND: app/index.tsx
- FOUND: app/(auth)/_layout.tsx
- FOUND: app/(auth)/login.tsx
- FOUND: app/(auth)/signup.tsx
- FOUND: app/(auth)/forgot-password.tsx
- FOUND: app/(auth)/reset-password.tsx
- FOUND: src/features/auth/AuthProvider.tsx
- FOUND: src/features/auth/useSession.ts
- FOUND: src/features/auth/schemas.ts
- FOUND: tests/auth-schemas.test.ts
- FOUND: tests/signup.test.ts
- FOUND: tests/signout.test.ts

Verified commits:
- FOUND: 1a6f93d
- FOUND: 915d3af
- FOUND: 097f5b2
