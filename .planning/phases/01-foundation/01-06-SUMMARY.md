---
phase: 01-foundation
plan: 06
subsystem: verification
tags: [verification, manual-uat, ci, types-regen, readme, auth-pivot]
requires:
  - 01-01 (Expo scaffold + Supabase singleton + encrypted session storage + Jest harness)
  - 01-02 (Postgres migration + RLS + pgTAP + CI workflows)
  - 01-03 (theme + UI primitives)
  - 01-04 (auth screens + root layout + AuthProvider)
  - 01-05 (profile surface + avatar upload + logout)
provides:
  - src/types/database.ts (regenerated from applied migration; all six Phase-1 tables)
  - README.md (first-time clone onboarding: stack, env, dev loop, RLS CI explanation)
  - Manual iOS UAT sign-off closing AUTH-01/02/03 and PLAT-02
  - Documented OTP pivot for AUTH-03 (supersedes deep-link reset in 01-UI-SPEC + 01-PLAN)
affects:
  - jest.config.js (testPathIgnorePatterns += /.claude/ to exclude stale worktree copies)
  - app/_layout.tsx (Rule 1 tsc fix during finalization)
tech-stack:
  added:
    - (none new this plan — verifies existing stack)
  patterns:
    - "Supabase mobile password reset via OTP code (6–8 digits from `{{ .Token }}` template), not deep-link custom scheme"
    - "Recovery-session gate exemption: after verifyOtp({type:'recovery'}) the user holds a session but must still be routed to /(auth)/reset-password to call updateUser"
    - "Cold-start gate: on route `/` with persisted session, redirect to /(app)/profile (session && !inApp branch covers it)"
key-files:
  created:
    - README.md
    - src/types/database.ts (regenerated — net-new file in repo)
    - .planning/phases/01-foundation/01-06-SUMMARY.md (this file)
  modified:
    - jest.config.js (testPathIgnorePatterns)
    - app/_layout.tsx (useProtectedRoute: cold-start branch + recovery-session exemption + TS tuple-narrowing cast)
    - app/(auth)/forgot-password.tsx (navigates to reset-password?email= instead of emitting redirectTo)
    - app/(auth)/reset-password.tsx (two-step OTP verify → updateUser)
    - src/features/auth/schemas.ts (added otpSchema: 4–10 digit numeric)
    - src/features/profile/useAvatarUpload.ts (expo-file-system/legacy + MediaTypeOptions → ['images'] for SDK 55)
    - jest.setup.ts (mock expo-file-system/legacy)
    - tests/auth-schemas.test.ts (otpSchema coverage)
    - .planning/phases/01-foundation/deferred-items.md (Android UAT + Gmail learning + OTP length note)
    - .planning/STATE.md (phase 01 → complete, 6/6, 100%)
    - .planning/ROADMAP.md (phase 1 checkbox, plan checkboxes, progress row)
decisions:
  - "Pivot AUTH-03 from deep-link reset to OTP code flow. Rationale: Gmail strips custom-scheme URLs from HTML mail bodies, link-prefetch crawlers consume single-use Supabase tokens, and expo-router does not surface URL fragments where Supabase's implicit flow places recovery tokens. OTP is the Supabase-documented mobile pattern and sidesteps all three issues. See commit adfe89e."
  - "Loosen otpSchema to 4–10 digits after observing 8-digit tokens on a live project (commit 5ccb9c6). Tighten back if upstream stabilizes length."
  - "Defer Android UAT rather than gate Phase 1 close on it. Same RN codebase, no iOS-specific hacks, no Android env available; tracked in deferred-items as a hard blocker for any store-ready build."
  - "Keep the `scheme: accountibuzz` field in `app.config.ts` even though auth reset no longer uses it — reserved for future flows (invite universal-links, phase 2)."
metrics:
  duration_minutes: ~120 (task 1 through finalization, excluding UAT wait)
  completed: 2026-04-22
  requirements_closed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, PLAT-02]
  requirements_partial: [PLAT-01]  # iOS PASS, Android DEFERRED
---

# Phase 1 Plan 06: Types Regen + README + Manual Walkthrough Summary

Close-out plan for Phase 1. Regenerated Supabase database types, wrote a top-level README for fresh-clone onboarding, and signed off the manual UAT on iOS. Android walkthrough deferred to an Android-env setup pass. AUTH-03 shipped via an OTP code flow instead of the originally-planned deep-link reset — documented below in full because future-you needs to understand why.

## One-liner

Phase 1 closed with iOS UAT PASS across AUTH-01/02/03/04 + dark-mode visual parity, AUTH-03 pivoted from custom-scheme deep link to Supabase OTP code flow, Android UAT deferred pending Android env setup.

## Tasks

### Task 1 — Regenerate DB types + write README — DONE
- Ran `npm run types:gen` against the local Supabase stack; `src/types/database.ts` is 997 lines and contains aliases for all six Phase-1 tables (`profiles`, `groups`, `group_members`, `submissions`, `invites`, `notifications_outbox`).
- Wrote `README.md` covering: project summary, pinned stack, prerequisites (Node 20+, Docker, Supabase CLI, Expo Go on device), env setup (URL + anon key + disable confirm-email + redirect URLs), local dev loop (`start`/`ios`/`android`/`test`/`test:all`/`db reset`/`types:gen`), RLS CI workflow explanation, project layout, pointer to `.planning/`.
- Added `/.claude/` to `jest.config.js` testPathIgnorePatterns so stale parallel-executor worktrees stop leaking duplicate/failing test copies into `npm test` (Rule 3 blocking fix — plan acceptance requires green `npm test`).
- Commit: **c88082c** — `docs(01-06): regenerate DB types, add README, ignore worktree test leaks`

### Task 2 — Manual iOS + Android walkthrough — PARTIAL (iOS PASS, Android DEFERRED)

UAT environment: iOS Simulator driven by `expo run:ios` (Metro dev-build, not Expo Go QR — `package.json` was updated to `expo run:ios`/`run:android` when the dev client became necessary). User-reported results:

| Step | Requirement | Result |
|------|-------------|--------|
| Signup (email + password, no email confirm) | AUTH-01 | PASS |
| Login → profile view state | AUTH-01 | PASS |
| Onboarding: avatar upload + display name → save | AUTH-04 | PASS |
| Avatar renders on profile post-upload | AUTH-04 | PASS |
| Edit display name → Save → view state updates | AUTH-04 | PASS |
| Log out → log back in → profile view (not onboarding) | AUTH-01 | PASS |
| Force-quit + relaunch → still on profile | **AUTH-02** | **PASS** |
| Password reset end-to-end (OTP) | **AUTH-03** | **PASS** |
| OS dark-mode toggle → tokens flip | PLAT-02 | PASS |
| Android walkthrough | PLAT-01 (Android half) | **DEFERRED** |

**Automated verification at plan close:**
- `npx tsc --noEmit` → exit 0 (after Rule 1 fix below)
- `npx jest` → 27/27 passing, 9 suites (0.7s)
- `npx supabase test db` → 9/9 pgTAP passing (profiles_rls, profiles_trigger, rls_helpers)

- Checkpoint resolved by user report rather than a new commit; the walkthrough is the commit.

## Deviations from Plan

### Rule 1 — Bug: TS2493 on `segments[1]` in `useProtectedRoute`

**Found during:** Task 2 finalization (running `npx tsc --noEmit` to verify plan acceptance criterion).

**Issue:** After commit 5ccb9c6 re-added the `/(auth)/reset-password` gate exemption, `segments[1]` triggered `TS2493: Tuple type '[string]' of length '1' has no element at index '1'` because `useSegments()` returns a narrowed tuple when one segment is present. The user's UAT report claimed tsc was green, but a fresh run on my end surfaced the error. Honesty > optimism: I fixed it.

**Fix:** Cast through `string[]` at the one access site: `(segments as string[])[1]`. No behavior change; the runtime check already worked.

**Files modified:** `app/_layout.tsx`

**Commit:** **c684ec5** — `fix(01-06): cast segments to string[] for onResetPassword guard`

### Significant design pivot — AUTH-03 reset flow (commits adfe89e + 5ccb9c6)

**Originally planned** (01-UI-SPEC + 01-04-PLAN): user taps "Forgot password" → Supabase emails a deep-link (`accountibuzz://reset-password#access_token=...`) → tapping the link opens the app on `/(auth)/reset-password` with the recovery token → user sets new password.

**What broke in reality:**
1. Supabase's default implicit-flow redirect places the recovery token in a **URL fragment** (`#access_token=...`). `expo-router` + `expo-linking` do not surface fragments in the navigation layer.
2. Gmail's HTML renderer strips/rewrites hrefs that use custom schemes like `accountibuzz://`. The email arrives with the link visually present but not tappable to the app.
3. Even where the link survives (Apple Mail etc.), link-prefetch crawlers hit the URL before the user does, **consuming the single-use token** and leaving the user with an already-spent link.

We briefly tried a fragment-parse workaround (reverted), then pivoted to **Supabase's documentation-recommended OTP code flow**:
- Supabase dashboard "Reset Password" email template emits `{{ .Token }}` as a 6–8 digit numeric code (no URL).
- `app/(auth)/forgot-password.tsx` navigates to `reset-password?email=...` on send success; no `redirectTo` is passed.
- `app/(auth)/reset-password.tsx` is a two-step form: enter OTP code → `supabase.auth.verifyOtp({ email, token, type: 'recovery' })` → establishes a recovery session → set new password via `supabase.auth.updateUser({ password })` → auto-logged-in.
- `src/features/auth/schemas.ts` added `otpSchema` (loosened to 4–10 digits after observing real 8-digit tokens on the project — Supabase doesn't guarantee length).
- All `expo-linking` / `Linking` listeners for auth were removed. The `scheme: accountibuzz` field stays in `app.config.ts` for future use (Phase 2 invite universal-links).

Side-effects discovered on the same pivot:
- **Cold-start gate bug:** `useProtectedRoute` only redirected on `session && inAuth`, which left a cold-start on `/` (no group) blank when a persisted session existed. Fixed to `session && !inApp && !onResetPassword` so the root route gets pushed to `/(app)/profile`.
- **Recovery-session exemption:** once `verifyOtp({type:'recovery'})` establishes a session, the same gate would kick the user to profile before `updateUser` runs. Exempt `/(auth)/reset-password` from the session-based redirect.

**SDK 55 deprecations cleaned up in the same commit:**
- `useAvatarUpload` imports from `expo-file-system/legacy` (top-level API is deprecated in SDK 55 and throws at runtime).
- `expo-image-picker` `MediaTypeOptions.Images` → `['images']` (new string-array API).
- `jest.setup.ts` mocks both file-system paths.

**Scope note:** Commits `adfe89e` and `5ccb9c6` technically modify 01-04 and 01-05 territory, but they were applied during 01-06 verification because Task 2 (real-device UAT) surfaced the Gmail/fragment/prefetch issues. Treating them as 01-06 deviations is the accurate lineage — the UAT is what forced the pivot. 01-04 and 01-05 SUMMARYs remain correct for their original shipping intent.

### Deferred — Android UAT (PLAT-01 Android half)

Not a code failure — Android workstation/env is not set up. Same React Native codebase, no iOS-specific hacks in the auth/profile surface, so Android-only regressions are unlikely for foundation-level features. Tracked in `deferred-items.md` as a hard gate for any store-ready build; does not block Phase 2 start.

## Auth Gates

None hit during 01-06. The `npm run start` gate from the original Task 2 design was superseded: the user drove the UAT on an iOS Simulator dev build (`expo run:ios`) rather than Expo Go with a QR scan, and reported results directly back.

## Commits (chronological)

| Hash | Scope | Message |
|------|-------|---------|
| c88082c | 01-06 Task 1 | docs(01-06): regenerate DB types, add README, ignore worktree test leaks |
| adfe89e | 01-04+05 pivot (applied during 01-06 UAT) | fix(01-04+05): pivot reset flow to OTP, fix cold-start gate, SDK 55 deprecations |
| 5ccb9c6 | 01-04 follow-up | fix(01-04): loosen OTP schema to 4-10 digits + restore recovery-session gate exemption |
| c684ec5 | 01-06 finalization | fix(01-06): cast segments to string[] for onResetPassword guard |
| *(pending)* | 01-06 close | docs(01-06): complete Phase 1 — SUMMARY + STATE + ROADMAP |

## Deferred / Known Stubs

No code stubs introduced by this plan. Deferred items pushed to `.planning/phases/01-foundation/deferred-items.md`:
- Android UAT walkthrough (PLAT-01 Android half)
- Gmail-strips-custom-scheme-URLs learning (constrains Phase 2 invite-link domain decision)
- Supabase recovery OTP token length is variable (4–10 digits observed; schema loosened accordingly)
- Stale worktree directories on disk (mitigated via jest ignore pattern; cleanup optional)
- Post-MVP skills audit (`.planning/notes/2026-04-22-revisit-expo-rn-skills.md`)

## State Sync Path Taken

Per the checkpoint note, tried the SDK handlers first:
- `gsd-sdk query state.advance-plan` → errored with `Cannot parse Current Plan or Total Plans from STATE.md` (the "Plan: 4 of 6" free-form line and the "Plan: 01-03 (UI foundation) — complete" line confuse it). No-op.
- `gsd-sdk query state.update-progress` → partially succeeded, advanced progress to 5/6 = 83% based on SUMMARY count on disk. Still didn't know 01-06 is done because this SUMMARY didn't exist yet at that moment.
- `gsd-sdk query roadmap.update-plan-progress 1` → `{ updated: false, reason: "no matching checkbox found" }`. ROADMAP format (`- [ ] **Phase 1: Foundation**` + separate Progress table) isn't what the handler expects.

**Fallback applied:** directly edited `.planning/STATE.md` (frontmatter progress, Current Position, Roadmap At-a-Glance, Performance Metrics, Session Continuity) and `.planning/ROADMAP.md` (Phase 1 checkbox, all six 01-xx plan checkboxes, Progress table row). This is documented so future-you knows the SDK handlers need a parser upgrade before they can close a phase cleanly.

## Self-Check: PASSED

**Files claimed created:**
- FOUND: `/Users/chris/projects/accountibuzz/README.md`
- FOUND: `/Users/chris/projects/accountibuzz/src/types/database.ts`
- (this file is being written now)

**Commits claimed:**
- FOUND: `c88082c` in git log
- FOUND: `adfe89e` in git log
- FOUND: `5ccb9c6` in git log
- FOUND: `c684ec5` in git log

**Automated verification at close (re-run during finalization):**
- `npx tsc --noEmit` → exit 0
- `npx jest` → 27 passed / 27 total, 9 suites
- `npx supabase test db` → 9 tests, all successful

## TDD Gate Compliance

Plan type is `execute`, not `tdd`. No RED/GREEN gate requirements. N/A.
