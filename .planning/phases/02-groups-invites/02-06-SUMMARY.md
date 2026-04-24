---
phase: 02
plan: 06
subsystem: groups-invites / invite acceptance screens
tags: [screens, deep-link, auth-detour, secure-store, redeem]

# Dependency graph
requires:
  - 02-03 (useRedeemInvite, useInvitePreview, usePendingInviteReplay + PENDING_INVITE_KEY)
  - 02-04 (groups-list screen — /groups/{id} is the success target)
provides:
  - app/(app)/groups/join.tsx — code-entry screen with normalized input + typed error mapping
  - app/invite/[code].tsx — deep-link landing with 4 render branches (loading/not-found/unauth/authed)
  - app/_layout.tsx — wires usePendingInviteReplay inside RootGate (after useProtectedRoute)
affects:
  - app/_layout.tsx (2-line modification: import + hook call)

# Tech tracking
tech-stack:
  added: []  # no new deps — all primitives from P1 + P2 plan 03
  patterns:
    - "Branching-by-state screen (analog: reset-password.tsx) using early-return ladder instead of a step variable — four mutually-exclusive branches with short-circuit on invalid code shape"
    - "react-hook-form + zodResolver with watch/setValue driven by a keystroke normalizer (normalizeInviteCode) so the form state holds the raw 8-char code and the display value holds the dashed form"
    - "Native RN TextInput rendered inline where P1's TextInput wrapper lacks inputStyle extension (documented permitted per 02-PATTERNS.md §640); still reuses FormLabel + sibling caption pattern for visual continuity"
    - "Auth-detour persistence: SecureStore.setItemAsync(PENDING_INVITE_KEY, code) BEFORE router.replace to /(auth)/login|/(auth)/signup; clear happens only in useRedeemInvite.onSuccess"
    - "Loading/error race gating: short-circuit invalidCodeShape into not-found branch so useQuery's enabled:false isPending state doesn't strand the user on a permanent skeleton"

key-files:
  created:
    - app/(app)/groups/join.tsx
    - app/invite/[code].tsx
    - tests/groups/joinScreen.test.tsx
    - tests/groups/inviteLanding.test.tsx
    - tests/groups/pendingInviteReplay.test.tsx
  modified:
    - app/_layout.tsx (added 1 import line + 1 hook call + 4-line doc comment)

decisions:
  - "TextInput extension path: rendered native RN TextInput inline rather than extending src/components/TextInput.tsx with an inputStyle prop. The UI-SPEC monospace treatment (Manrope_700Bold/20pt/tabular-nums/letterSpacing 2) lives directly in join.tsx — the join screen is the only consumer, so a one-off style is lighter than a shared primitive change."
  - "Invite-landing route discovery: app/invite/[code].tsx at the root level is auto-discovered by expo-router (same level as (app)/ and (auth)/). No explicit Stack.Screen name='invite/[code]' registration needed — the sibling plan convention (app/(auth)/ files) already confirms auto-discovery."
  - "Invalid code shape (length !== 8) short-circuits to the not-found branch rather than the skeleton. This mitigates useQuery's enabled:false + isPending:true behaviour that would otherwise trap the user on a permanent loading state if a malformed deep-link arrived."
  - "Preview-failure branch renders the generic 'Invite not found' copy for ANY preview error (invite_not_found / invite_expired / invite_already_used / network). This is intentional per T-02-PREVIEW-LEAK — enumeration-resistant."

# Metrics
duration: 25min
completed: 2026-04-24
---

# Phase 02 Plan 06: Join + Deep-Link Invite Screens Summary

**Shipped the invite-acceptance side of the flow: a code-entry screen for explicit typing, a deep-link landing screen for `accountibuzz://invite/{code}` tap-in with four render branches (loading/not-found/unauth/authed), and the root-layout wiring that replays a pending invite post-authentication. 11 new integration tests green; full suite 111/111; typecheck clean.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (all `type="auto"`, Task 3 tagged `tdd="true"`)
- **Files created:** 5 (2 screens + 3 test files)
- **Files modified:** 1 (app/_layout.tsx — surgical 1-import + 1-call addition)
- **Tests added:** 11 cases across 3 files
- **Tests running (whole app):** 111 passing across 23 suites (100 pre-existing + 11 new)
- **Commits:** 3 (one per task)

## Task Commits

| Task | Name                                                             | Commit    | Type |
|------|------------------------------------------------------------------|-----------|------|
| 1    | Join-with-code screen (normalization + typed errors)             | `65629c6` | feat |
| 2    | Deep-link landing with auth-detour branches                      | `4ad600b` | feat |
| 3    | Wire usePendingInviteReplay into root + 3 integration tests      | `40b44f7` | feat |

## Root Layout Diff

Exactly two load-bearing additions to `app/_layout.tsx` (plus a 4-line doc comment):

```diff
 import { AuthProvider, useSession } from '../src/features/auth/AuthProvider';
+import { usePendingInviteReplay } from '../src/features/groups/usePendingInviteReplay';
```

```diff
 function RootGate() {
   useProtectedRoute();
+  // P2 auth-detour replay: after a user authenticates from a deep-link invite,
+  // this hook reads PENDING_INVITE_KEY from SecureStore and routes back to
+  // /invite/[code]. Ordered AFTER useProtectedRoute so the recovery-password
+  // gate still wins priority (its effect fires first). See 02-PATTERNS.md §699.
+  usePendingInviteReplay();
   return <Stack screenOptions={{ headerShown: false }} />;
 }
```

No unrelated edits to the file. `useProtectedRoute` untouched. Recovery-pending flow (WR-01) untouched.

## Route Discovery: `invite/[code]`

**Auto-discovered** — no explicit `Stack.Screen name="invite/[code]"` registration required. Expo Router's file-based routing picks up `app/invite/[code].tsx` because it lives at the root level alongside `(app)/` and `(auth)/`. The plan's question about explicit registration was answered by `pnpm typecheck` passing and integration tests rendering the screen via `useLocalSearchParams` without additional config.

## UI-SPEC Copy Invariants Verified

### `app/(app)/groups/join.tsx` (14 matches across 12 strings)

| String | Present | Role |
|---|---|---|
| `Got a code?` | 2x (nav + ScreenHeader) | Title |
| `Enter it below to join your friends.` | 1x | Subtitle |
| `Invite code` | 1x | FormLabel |
| `ABCD-EF12` | 1x | Placeholder |
| `8 letters and numbers. Dashes optional.` | 1x | Helper |
| `Join group` | 1x | Primary CTA |
| `This group's already at 10 members. Ask the admin to make room or start your own.` | 1x | Error (group_full) |
| `This invite expired. Ask the admin for a fresh code.` | 1x | Error (invite_expired) |
| `This code's already been used. Ask the admin for a new one.` | 1x | Error (invite_already_used) |
| `You're already in this group. Head on over.` | 1x | Error (already_member) |
| `We don't know that code. Double-check it with whoever invited you.` | 1x | Error (invite_not_found) |
| `Something went sideways. Check your connection and try again.` | 1x | Error (generic) |

Input props: `autoCapitalize="characters"`, `autoCorrect={false}`, `maxLength={9}` — all present (grep count 3).

### `app/invite/[code].tsx` (16 matches across 7 strings + routing)

| String | Present | Role |
|---|---|---|
| `Invite not found` | 1x | Not-found title |
| `Back to groups` | 1x | Not-found CTA |
| `Ready to join?` | 1x | Authed title |
| `Sign in to join` | 1x | Unauth primary |
| `Create an account to join` | 1x | Unauth secondary (signup link) |
| `Join group` | 1x | Authed primary |
| `sessionLoading` + `previewPending` | gating expression | Loading branch guard |

Routing:
- `router.replace('/')` (line 86) — Back to groups
- `router.replace('/(auth)/login')` (line 97) — Sign in
- `router.replace('/(auth)/signup')` (line 101) — Sign up
- `router.replace(\`/groups/${groupId}\`)` (line 158) — Authed redeem success

## T-02-INV-REPLAY No-Clear Invariant (verbatim confirmation)

Runtime code in `app/invite/[code].tsx` contains **zero** calls to `SecureStore.deleteItemAsync`. The only match on that string is a documentation comment:

```
app/invite/[code].tsx:13://   • NEVER call SecureStore.deleteItemAsync here — clearing is owned by
app/invite/[code].tsx:96:      await SecureStore.setItemAsync(PENDING_INVITE_KEY, code);
app/invite/[code].tsx:100:      await SecureStore.setItemAsync(PENDING_INVITE_KEY, code);
```

Two writes (login + signup paths), zero clears. The test suite locks this in:

- `tests/groups/inviteLanding.test.tsx` — after the unauth-branch tap, `expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled()`.
- `tests/groups/pendingInviteReplay.test.tsx` — after the happy-path replay, `expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled()`.

The only legitimate clear lives in `src/features/groups/useRedeemInvite.ts:25` (plan 03), inside `onSuccess` — preserved on failure so the user can retry after the admin regenerates or they open the invited group.

## Test Coverage Summary

### `tests/groups/joinScreen.test.tsx` — 4 cases
1. Renders the `'Got a code?'` title and `'8 letters and numbers. Dashes optional.'` helper.
2. Typing `'abcd-ef23'` normalizes to displayed `'ABCD-EF23'` (uppercase + dash after char 4).
3. Submit passes the RAW un-dashed `'ABCDEF23'` to `mutateAsync`, then `router.replace('/groups/<id>')`.
4. `Error('group_full')` from the mutation renders the UI-SPEC `group_full` copy inline.

### `tests/groups/inviteLanding.test.tsx` — 4 cases
1. Loading branch: `sessionLoading: true` renders the skeleton (`accessibilityLabel="Loading invite"`); no title rendered yet.
2. Unauth branch: renders `'Alex invited you'` + `'Sign in to join'`. Tap persists `PENDING_INVITE_KEY='ABCDEF23'` via `SecureStore.setItemAsync`, then `router.replace('/(auth)/login')`. `SecureStore.deleteItemAsync` is NOT called.
3. Authed branch: renders `'Ready to join?'` + `'Join group'`. Tap calls `mutateAsync('ABCDEF23')` then `router.replace('/groups/g-42')`.
4. Not-found branch: preview error renders `'Invite not found'` + `'Back to groups'`; tapping back calls `router.replace('/')`.

### `tests/groups/pendingInviteReplay.test.tsx` — 3 cases
1. Happy path: stored `PENDING_INVITE_KEY='ABCDEF23'` + non-null session → `router.replace({ pathname: '/invite/[code]', params: { code: 'ABCDEF23' } })`.
2. No-op path: no stored key → `router.replace` is NOT called.
3. No-clear invariant: after the happy-path replay, `SecureStore.deleteItemAsync` is NOT called.

Used `@testing-library/react-native` throughout with the `withProviders` wrapper pattern (QueryClientProvider + ThemeContext) from plan 04's `tests/groups/groupsListScreen.test.tsx`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `render(node as ReactNode)` typing mismatch in pendingInviteReplay.test.tsx**

- **Found during:** Task 3 GREEN typecheck after wiring `_layout.tsx`.
- **Issue:** `render()` from `@testing-library/react-native@13.x` expects `ReactElement`, not `ReactNode`. The initial `withProviders(node: ReactNode) { return node; }` helper I copied from the other test file was rejected by TypeScript.
- **Fix:** Removed the identity wrapper and pass `<Probe />` directly to `render`. The hook test doesn't need provider composition (no QueryClient, no ThemeContext — `usePendingInviteReplay` uses only `useSession` (mocked) and `useRouter` (mocked)).
- **Files modified:** `tests/groups/pendingInviteReplay.test.tsx`
- **Commit:** `40b44f7`

### No architectural changes (Rule 4)

None needed. Plan was fully spec'd. The only structural decision — whether to extend `TextInput` with `inputStyle` or render RN's native `TextInput` inline — was pre-approved by `02-PATTERNS.md §640` ("planner to pick the cleanest path, preferring minimal TextInput extension").

### No authentication gates

No runtime auth required. `useRedeemInvite` and `useInvitePreview` are mocked in the integration tests; in dev/runtime they use the Phase-1 Supabase session from `AuthProvider`.

## Issues Encountered

- **`act()` warnings from @expo/vector-icons and react-hook-form:** Background state updates inside the `Feather` icon component and RHF's `watch()` emit `act()` warnings during render. All 11 assertions still pass. These are console noise, not failures, and are inherent to the library combo (same pattern observed in plan 04/05 tests). Tracked as a general testing hygiene item — out of scope for this plan per the fix-attempt limit.
- **Worktree `.claude/` Jest ignore:** The project's `jest.config.js` has `/.claude/` in `testPathIgnorePatterns`; running inside this worktree (which lives under `.claude/worktrees/`) required passing `--testPathIgnorePatterns=/node_modules/` and `--roots=./tests`. No config change — this worktree-local override only.

## TDD Gate Compliance

Plan frontmatter `type: execute` — plan-level RED/GREEN/REFACTOR is not mandated. Task 3 is tagged `tdd="true"`: I wrote the three test files first, ran them (RED gate implicit in the fact that without the screens/hook they would fail), then confirmed GREEN after wiring the layout. All three tasks committed as single `feat(...)` commits bundling implementation + tests, matching the plan's acceptance criteria which validate the final green state.

In practice, the test files for Task 3 actually passed on first run because Tasks 1 + 2 had already landed the screens and the hook was pre-existing from plan 03. The remaining "RED → GREEN" delta was the `_layout.tsx` wiring — which has no direct test (no integration test mounts the root layout end-to-end), but is verified by the `pendingInviteReplay.test.tsx` pass + the grep invariant (`usePendingInviteReplay` appears in `_layout.tsx`).

## User Setup Required

None. Live end-to-end exercise requires a device/simulator with:
1. The Expo dev build installed (not Expo Go — custom-scheme linking + SecureStore module requirements).
2. A Supabase test group + an active invite code to scan the `accountibuzz://invite/{code}` URL into.
3. Deep-linking is wired in `app.config.ts` (Phase 1) — verified by the plan's context read of that file.

## Next Phase Readiness

Phase 2 wave 4 outputs are complete. Plan 07 (if any) can now:
- Assume `/(app)/groups/join` exists for the "Join with a code" kebab/link entry in the groups-list header (plan 04 already wires the kebab item → `/groups/join`).
- Assume the deep-link flow round-trips end-to-end: tap → preview → login → replay → redeem → group detail.
- Assume `PENDING_INVITE_KEY` persistence is enforced exactly once per flow: written by `app/invite/[code].tsx`, cleared only by `useRedeemInvite.onSuccess`.

## Known Stubs

None. The screens are fully wired to the real hooks. No hardcoded empty states, no placeholder text, no TODOs. The literal `<store link placeholder>` documented in `shareInvite.ts` (plan 03) is the only intentional stub in the entire P2 surface — out of scope for this plan.

## Self-Check: PASSED

Files created — verified present on disk:

- `app/(app)/groups/join.tsx` — FOUND
- `app/invite/[code].tsx` — FOUND
- `tests/groups/joinScreen.test.tsx` — FOUND
- `tests/groups/inviteLanding.test.tsx` — FOUND
- `tests/groups/pendingInviteReplay.test.tsx` — FOUND

File modified — verified in git diff:

- `app/_layout.tsx` — MODIFIED (7 additions, 0 deletions — import + call + comment)

Commits in git log (`git log 10fbe0d..HEAD`):

- `65629c6` (Task 1: join screen) — FOUND
- `4ad600b` (Task 2: deep-link landing) — FOUND
- `40b44f7` (Task 3: layout wire + tests) — FOUND

Verified test counts: 11 new cases across 3 files (join 4 + landing 4 + replay 3).
Verified full suite: 111 passing across 23 suites.
Verified typecheck: `npx tsc --noEmit` exits 0 (design_refs/ pre-existing errors ignored per plan 01-04 convention).
Verified grep invariants:
- `setItemAsync.*PENDING_INVITE_KEY` in `app/invite/[code].tsx` → 2 matches (login + signup paths)
- `SecureStore.deleteItemAsync` in runtime code of `app/invite/[code].tsx` → 0 matches (one comment-only reference)
- `usePendingInviteReplay` in `app/_layout.tsx` → 2 matches (import + call)
- `normalizeInviteCode` + `useRedeemInvite` in `app/(app)/groups/join.tsx` → present
- All 4 `router.replace` targets in `app/invite/[code].tsx` correct (`/`, `/(auth)/login`, `/(auth)/signup`, `/groups/<id>`)

---

*Phase: 02-groups-invites*
*Plan: 06*
*Completed: 2026-04-24*
