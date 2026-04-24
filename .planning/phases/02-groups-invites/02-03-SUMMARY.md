---
phase: 02
plan: 03
subsystem: groups-invites / client toolkit
tags: [shared-primitives, zod, tanstack-query, rn-components, tdd]

# Dependency graph
requires:
  - 02-01 (expo-clipboard + expo-haptics installed; Intl.supportedValuesOf probe locked timezone fallback contract)
  - 02-02 (0004 migration applied; src/types/database.ts regenerated with 7 RPC signatures)
provides:
  - schemas/createGroupSchema (name 1-60, goal 5-140, enum photo|video, timezone non-empty) + joinCodeSchema (31-char alphabet regex)
  - formatInviteCode/INVITE_ALPHABET (identical to 0004 migration alphabet)
  - formatInviteCode/{normalizeInviteCode, formatInviteCode, isValidInviteCode}
  - timezones/listTimezones (Intl-first, 453-entry STATIC_FALLBACK)
  - timezones/labelFor (Intl.DateTimeFormat wrapper, throws-safe)
  - shareInvite/shareInvite (LOCKED D-19 message with <store link placeholder>)
  - hooks/useGroupsList, useGroup, useGroupMembers, useActiveInvite, useInvitePreview (5 read)
  - hooks/useCreateGroup, useRedeemInvite, useLeaveGroup, useTransferAdmin, useDeleteGroup, useRegenerateInvite (6 mutation)
  - hooks/usePendingInviteReplay + PENDING_INVITE_KEY export ('accountibuzz.pendingInviteCode')
  - components/SegmentedControl (photo|video)
  - components/InviteCodeChip (chunked display + Copy + Haptics + a11y letter-by-letter label)
  - components/Modal (centered sheet; dev-warns on 'Cancel' cancelLabel)
affects:
  - src/components/index.ts (appended 3 exports)

# Tech tracking
tech-stack:
  added: [] # no new deps; expo-clipboard + expo-haptics landed in 02-01
  patterns:
    - "TDD RED→GREEN per-task: write test file → run → confirm ImportError fail → write source → confirm pass"
    - "TanStack v5 `isPending` + queryKey contract (Pattern 1/5): read hooks throw `new Error(error.message)` to preserve typed error codes for screen branching"
    - "Shared PENDING_INVITE_KEY constant exported from usePendingInviteReplay, imported by useRedeemInvite — enforces clear-on-success-only invariant (T-02-INV-REPLAY)"
    - "Intl-first + static-fallback pattern from 02-01 probe: try / typeof !== function / length check / catch → STATIC_FALLBACK"
    - "RN component TDD: ThemeContext.Provider wrapper composed inline in test files; act() wraps press handlers that fire async state updates"
    - "Modal dev-warn pattern: `if (__DEV__ && label.toLowerCase() === 'cancel') console.warn(...)` enforces copywriting contract at build time"

key-files:
  created:
    - src/features/groups/schemas.ts
    - src/features/groups/formatInviteCode.ts
    - src/features/groups/timezones.ts
    - src/features/groups/shareInvite.ts
    - src/features/groups/useGroupsList.ts
    - src/features/groups/useGroup.ts
    - src/features/groups/useGroupMembers.ts
    - src/features/groups/useActiveInvite.ts
    - src/features/groups/useInvitePreview.ts
    - src/features/groups/useCreateGroup.ts
    - src/features/groups/useRedeemInvite.ts
    - src/features/groups/useLeaveGroup.ts
    - src/features/groups/useTransferAdmin.ts
    - src/features/groups/useDeleteGroup.ts
    - src/features/groups/useRegenerateInvite.ts
    - src/features/groups/usePendingInviteReplay.ts
    - src/components/SegmentedControl.tsx
    - src/components/InviteCodeChip.tsx
    - src/components/Modal.tsx
    - tests/groups/schemas.test.ts
    - tests/groups/formatInviteCode.test.ts
    - tests/groups/timezones.test.ts
    - tests/groups/segmentedControl.test.tsx
    - tests/groups/inviteCodeChip.test.tsx
    - tests/groups/modal.test.tsx
    - tests/groups/useGroupsList.test.tsx
  modified:
    - src/components/index.ts (appended 3 exports; existing order preserved)

decisions:
  - "STATIC_FALLBACK timezone list: 453 IANA entries covering Africa/Americas/Antarctica/Arctic/Asia/Atlantic/Australia/Europe/Indian/Pacific + Etc/GMT offsets + UTC. Sourced from tzdb (Node 22 / ICU)."
  - "useInvitePreview returns InvitePreview with non-null-coerced fields (falls back to '' / 0). Screens branch on error.message === 'invite_not_found' per 02-RESEARCH §Code Examples."
  - "Mutation hooks use `throw new Error(error.message)` (not `throw error`) so typed Postgres error codes like `admin_cannot_leave` / `group_full` land on `error.message` for screen branching."
  - "usePendingInviteReplay reads useSession(); P1 already exposes { session, loading } on the context value (line 84 of AuthProvider.tsx)."
  - "TDD test for useGroupsList uses the `require()`-after-env-set pattern from tests/avatar-upload.test.ts — avoids hoisting issues with supabase-client env-var guard."

# Metrics
duration: 19min
completed: 2026-04-24
---

# Phase 02 Plan 03: Shared Client Toolkit Summary

**Shipped the entire Phase-2 client toolkit: 4 utility modules, 11 TanStack hooks, 1 pending-invite replay hook, and 3 RN primitives (SegmentedControl, InviteCodeChip, Modal). 56 jest cases green; typecheck clean; INVITE_ALPHABET verified identical to the 0004 migration.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-04-24T20:50:27Z
- **Completed:** 2026-04-24T21:09:10Z
- **Tasks:** 3 (all TDD-shaped at plan level)
- **Files created:** 26 (19 source + 7 test)
- **Files modified:** 1 (components barrel export)
- **Tests added:** 56 cases across 7 files
- **Tests running (whole app):** 92 passing (36 pre-existing + 56 new)
- **Commits:** 3 (one per task)

## Task Commits

| Task | Name                                       | Commit    | Type |
|------|--------------------------------------------|-----------|------|
| 1    | Pure utilities (schemas/format/tz/share)   | `ee3865d` | feat |
| 2    | 3 RN primitives (SegmentedControl/Chip/Modal) | `dbc4c8f` | feat |
| 3    | 11 TanStack hooks + usePendingInviteReplay | `dc5bca3` | feat |

## Exported Symbols (quick reference for plans 04-06)

### `src/features/groups/schemas.ts`
- `createGroupSchema` (zod)
- `joinCodeSchema` (zod)
- `type CreateGroupInput`
- `type JoinCodeInput`

### `src/features/groups/formatInviteCode.ts`
- `INVITE_ALPHABET` = `'23456789ABCDEFGHJKMNPQRSTUVWXYZ'` (31 chars)
- `normalizeInviteCode(input: string): string` — strip, uppercase, slice to 8
- `formatInviteCode(raw: string): string` — chunk as `XXXX-XXXX`
- `isValidInviteCode(raw: string): boolean` — exactly 8 chars all in alphabet

### `src/features/groups/timezones.ts`
- `STATIC_FALLBACK: readonly string[]` — 453 IANA zones
- `listTimezones(): string[]` — Intl-first with fallback
- `labelFor(iana: string): string` — `'America/Los_Angeles — Pacific Standard Time'` or input

### `src/features/groups/shareInvite.ts`
- `shareInvite(groupName: string, rawCode: string): Promise<void>` — RN Share.share wrapper

### `src/features/groups/useGroupsList.ts`
- `useGroupsList(): UseQueryResult<GroupsListRow[]>` — queryKey `['groups']`
- `interface GroupsListRow { id, name, goal, submission_type, timezone, member_count, admin_user_id }`

### `src/features/groups/useGroup.ts`
- `useGroup(id: string | undefined): UseQueryResult<GroupRow>` — queryKey `['group', id]`, `enabled: !!id`
- `interface GroupRow { id, name, goal, submission_type, timezone, admin_user_id, created_at }`

### `src/features/groups/useGroupMembers.ts`
- `useGroupMembers(groupId: string | undefined): UseQueryResult<MemberRow[]>` — queryKey `['group', groupId, 'members']`
- `interface MemberRow { user_id, role, display_name, avatar_path }`

### `src/features/groups/useActiveInvite.ts`
- `useActiveInvite(groupId: string | undefined): UseQueryResult<ActiveInviteRow | null>` — queryKey `['group', groupId, 'invite']`
- `interface ActiveInviteRow { code, expires_at }`

### `src/features/groups/useInvitePreview.ts`
- `useInvitePreview(code: string | undefined): UseQueryResult<InvitePreview>` — queryKey `['invitePreview', code]`, `retry: false`
- `interface InvitePreview { group_name, member_count, admin_display_name }`

### `src/features/groups/useCreateGroup.ts`
- `useCreateGroup(): UseMutationResult<CreateGroupResult, Error, CreateGroupInput>`
- `interface CreateGroupResult { group_id, invite_code }`
- RPC: `create_group(p_name, p_goal, p_submission_type, p_timezone)` — invalidates `['groups']`

### `src/features/groups/useRedeemInvite.ts`
- `useRedeemInvite(): UseMutationResult<string, Error, string>` (returns group_id)
- RPC: `redeem_invite(code_input)` — on success: clears `PENDING_INVITE_KEY` + invalidates `['groups']`, `['group', gid]`, `['group', gid, 'members']`

### `src/features/groups/useLeaveGroup.ts`
- `useLeaveGroup(): UseMutationResult<void, Error, string>`
- RPC: `leave_group(p_group_id)` — invalidates `['groups']`, removes `['group', gid]`
- Server-enforces admin-branching via typed error `admin_cannot_leave` (screens handle)

### `src/features/groups/useTransferAdmin.ts`
- `useTransferAdmin(): UseMutationResult<void, Error, TransferAdminInput>`
- `interface TransferAdminInput { group_id, new_admin_user_id }`
- RPC: `transfer_admin(p_group_id, p_new_admin_user_id)` — invalidates `['group', gid]` + `['group', gid, 'members']`

### `src/features/groups/useDeleteGroup.ts`
- `useDeleteGroup(): UseMutationResult<void, Error, string>`
- RPC: `delete_group(p_group_id)` — invalidates `['groups']`, removes `['group', gid]`

### `src/features/groups/useRegenerateInvite.ts`
- `useRegenerateInvite(): UseMutationResult<string, Error, string>` (returns new code)
- RPC: `regenerate_invite(p_group_id)` — invalidates `['group', gid, 'invite']`

### `src/features/groups/usePendingInviteReplay.ts`
- `PENDING_INVITE_KEY` = `'accountibuzz.pendingInviteCode'`
- `usePendingInviteReplay(): void` — mount in app/_layout.tsx; does NOT clear the key

### `src/components/SegmentedControl.tsx`
- `SegmentedControl(props: SegmentedControlProps)` — equal-width segments, `accessibilityState.selected`
- `interface SegmentedControlProps { options, value, onChange, disabled?, accessibilityLabel?, style? }`

### `src/components/InviteCodeChip.tsx`
- `InviteCodeChip(props: InviteCodeChipProps)` — renders `formatInviteCode(code)` + Copy button
- `interface InviteCodeChipProps { code, onCopy? }`
- On Copy: `Clipboard.setStringAsync(code)` (RAW 8-char) + `Haptics.notificationAsync(Success)` + 2s `'Copied ✓'` label swap

### `src/components/Modal.tsx`
- `Modal(props: ModalProps)` — centered sheet with REQUIRED `cancelLabel` (dev-warns on 'Cancel')
- `interface ModalProps { visible, onDismiss, title, body, primaryAction, secondaryAction?, cancelLabel }`
- `interface ModalAction { label, onPress, variant: 'primary' | 'destructive', loading? }`
- `interface ModalSecondaryAction { label, onPress, variant: 'destructive-text' | 'ghost' }`

## Contract Confirmations

### INVITE_ALPHABET cross-consistency check

| Location | Value |
|---|---|
| `src/features/groups/formatInviteCode.ts:6` | `'23456789ABCDEFGHJKMNPQRSTUVWXYZ'` |
| `src/features/groups/schemas.ts:24` (regex) | `/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/` |
| `supabase/migrations/0004_phase2_groups_invites.sql:98` | `'23456789ABCDEFGHJKMNPQRSTUVWXYZ'` |
| `supabase/migrations/0004_phase2_groups_invites.sql:36` (comment) | Same literal in header doc |

All four match — client and server cannot drift.

### PENDING_INVITE_KEY cross-consistency check

| Location | Reference |
|---|---|
| `src/features/groups/usePendingInviteReplay.ts:18` | Declared: `export const PENDING_INVITE_KEY = 'accountibuzz.pendingInviteCode'` |
| `src/features/groups/usePendingInviteReplay.ts:25` | Used: `SecureStore.getItemAsync(PENDING_INVITE_KEY)` (read, no clear) |
| `src/features/groups/useRedeemInvite.ts:8` | Imported: `import { PENDING_INVITE_KEY } from './usePendingInviteReplay'` |
| `src/features/groups/useRedeemInvite.ts:25` | Used: `SecureStore.deleteItemAsync(PENDING_INVITE_KEY)` (clear-on-success only) |

T-02-INV-REPLAY invariant enforced: only `useRedeemInvite.onSuccess` clears the key, so a failed redeem (invite_expired / already_member / etc.) preserves the retry path.

### STATIC_FALLBACK timezone entry count

453 entries (exceeds ≥ 400 requirement). Spans `Africa/*`, `America/*`, `Antarctica/*`, `Arctic/*`, `Asia/*`, `Atlantic/*`, `Australia/*`, `Europe/*`, `Indian/*`, `Pacific/*`, `Etc/GMT*`, and `UTC`. Includes every zone required by the plan's explicit inclusion list (Los_Angeles, Denver, Chicago, New_York, Anchorage, Phoenix, Honolulu, Toronto, Vancouver, Mexico_City, Sao_Paulo, London, Dublin, Paris, Berlin, Madrid, Rome, Amsterdam, Stockholm, Moscow, Istanbul, Cairo, Lagos, Johannesburg, Tokyo, Shanghai, Hong_Kong, Singapore, Seoul, Kolkata, Dubai, Bangkok, Jerusalem, Sydney, Melbourne, Perth, Auckland, Fiji).

### Acceptance criteria verification

- [x] `src/features/groups/schemas.ts` exports `createGroupSchema`, `joinCodeSchema`, `CreateGroupInput`, `JoinCodeInput`
- [x] Schemas contain exact UI-SPEC copy (`'Add a bit more detail — at least 5 characters.'` verified in grep)
- [x] `formatInviteCode.ts` contains `'23456789ABCDEFGHJKMNPQRSTUVWXYZ'` exactly once
- [x] `timezones.ts` exports `STATIC_FALLBACK` + `listTimezones` + `labelFor`, 453 entries
- [x] `shareInvite.ts` contains literal `<store link placeholder>` and `accountibuzz://invite/`
- [x] 3 components shipped with correct a11y attributes (selected, viewIsModal, letter-by-letter label)
- [x] Components barrel export updated (3 new exports appended)
- [x] All 11 hook files exist with correct queryKeys + RPC names + error-preserving throw
- [x] `PENDING_INVITE_KEY` constant shared (imported by useRedeemInvite from usePendingInviteReplay)
- [x] Modal contains `cancelLabel.toLowerCase() === 'cancel'` dev warn + `accessibilityViewIsModal`
- [x] InviteCodeChip renders `'Copied ✓'` (U+2713) for 2s after copy
- [x] `pnpm test` (all 18 suites) passes: 92 tests green (36 pre-existing + 56 new)
- [x] `pnpm typecheck` (`npx tsc --noEmit`) exits 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan's sample invite codes 'ABCDEF12' contain '1', which is NOT in the 31-char alphabet**

- **Found during:** Task 1 GREEN run — `isValidInviteCode('ABCDEF12')` returned `false` because the plan's test expectations contradicted the plan's own `INVITE_ALPHABET` definition (digits 2-9 only; no 0/1/I/L/O per CONTEXT D-02).
- **Root cause:** Plan text uses `'ABCDEF12'` in 6+ illustrative examples (including acceptance-criteria test names) but the migration-locked alphabet excludes '1'. `ABCDEF12` would never be a legitimate code.
- **Fix:** Rewrote the test cases that assert *validity* to use legal codes (`'ABCDEF23'`, `'23456789'`). Kept `'ABCDEF12'` in the one test case that exercises `formatInviteCode`'s pure string-chunking behavior (it doesn't validate alphabet — normalize does). Also added an extra negative-case test: `isValidInviteCode('ABCDEF21')` → false ('1' outside alphabet), which reinforces the alphabet contract for downstream auditors.
- **Files modified:** `tests/groups/formatInviteCode.test.ts` (test assertion values only — source code `formatInviteCode.ts` is correct as spec'd)
- **Commit:** `ee3865d`
- **Rationale:** The ALPHABET is the source of truth (pinned to the 0004 migration via 3 places grep'd above). Test expectations drifted in the plan prose. Fixing the tests preserves the authoritative alphabet contract AND the test intent.

**2. [Rule 3 — Blocking] Jest test file extension for useGroupsList**

- **Found during:** Task 3 first RED run.
- **Issue:** I originally wrote `tests/groups/useGroupsList.test.ts` (without x), but it returns JSX inside `makeWrapper()` (`<QueryClientProvider ...>`). Babel parser rejects JSX in `.ts` files.
- **Fix:** Renamed to `tests/groups/useGroupsList.test.tsx`. No semantic change.
- **Commit:** `dc5bca3`

**3. [Rule 3 — Blocking] Supabase env-var ordering in useGroupsList test**

- **Found during:** Task 3 GREEN run — `process.env.EXPO_PUBLIC_SUPABASE_URL` was set before `import` statements but the import hoists above `process.env = ...` (ES module semantics) so the supabase singleton's env-var guard fired.
- **Fix:** Matched `tests/avatar-upload.test.ts` pattern — use top-of-file env set + `require()` inside test bodies (instead of `import` at module top). Avoids hoisting hazard. No source-code change required.
- **Commit:** `dc5bca3`

**4. [Rule 3 — Blocking] `getByA11yLabel` removed in RNTL 13**

- **Found during:** Task 2 GREEN run — inviteCodeChip.test.tsx used the legacy `getByA11yLabel` API which `@testing-library/react-native@13.0.1` removed in favor of `getByLabelText`.
- **Fix:** Swapped to `getByLabelText` (same semantics).
- **Commit:** `dbc4c8f`

**5. [Rule 1 — Bug] `act()` warning on InviteCodeChip copy test**

- **Found during:** Task 2 GREEN run — the synchronous `fireEvent.press('Copy')` triggers an `async handleCopy` that calls `setCopied(true)` after the two awaits resolve. RN Testing Library emits an `act()` warning because the setState is outside the render's sync cycle.
- **Fix:** Wrapped the `fireEvent.press` in `await act(async () => { ... })` in the Clipboard-call test (the haptics + label-swap tests already had this).
- **Commit:** `dbc4c8f`

### No architectural changes (Rule 4)

None needed — plan was fully-specified. All 3 tasks ran as written, modulo the 5 small auto-fixes above (all within scope, all documented).

### No authentication gates

All RPC hooks use the shared `supabase` client — authentication is already in place from Phase 1's AuthProvider. No runtime auth step needed in this plan.

## Issues Encountered

- **Jest background workers:** `renderHook` leaves async timers behind; added `--forceExit` in the scoped run command. Not a test correctness issue — all tests pass. Noted in deferred-items.md from 02-01 as a general Jest-open-handles hygiene item.
- **Worktree `.claude/` path:** The project's `jest.config.js` has `.claude/` in `testPathIgnorePatterns` (likely to ignore nested `.claude/` artifacts), but because this worktree lives UNDER `.claude/worktrees/`, Jest filters out *all* tests unless `--testPathIgnorePatterns` is overridden and `--roots="<rootDir>/tests/groups"` is supplied. Used an overridden `testPathIgnorePatterns` in the local run commands; did NOT modify `jest.config.js` (out of plan scope; the CI path where the main branch builds is not inside `.claude/`).

## TDD Gate Compliance

Plan frontmatter `type: execute` — plan-level RED/GREEN/REFACTOR gate does not apply. All 3 tasks tagged `tdd="true"` at task level; for each I confirmed RED (import failure / assertion failure) then wrote source to reach GREEN. All three tasks were committed as single `feat(...)` commits bundling test + source per the plan's acceptance criteria (which validate final green state, not separate RED commits). Noted here for executor-audit hygiene — future phases that need strict RED/GREEN commit separation should flip the plan to `type: tdd` at the frontmatter level.

## User Setup Required

None — no external service configuration. All hooks will compile and typecheck; live end-to-end behavior requires a device/simulator with a signed-in Supabase session (established by the Phase 1 plans) and is exercised by plans 04-06 which actually render the screens.

## Next Phase Readiness

Plans 04/05/06 can now import:
- `createGroupSchema`, `joinCodeSchema` and the 11 hooks from `../../features/groups/*`
- `SegmentedControl`, `InviteCodeChip`, `Modal` from `../../components` (barrel)
- `PENDING_INVITE_KEY` from `../../features/groups/usePendingInviteReplay` for the deep-link auth-detour flow

Plan 07 (app-root wiring) should mount `usePendingInviteReplay()` somewhere in `app/(app)/_layout.tsx` — the hook is a side-effect only; no rendering.

## Known Stubs

None. Every hook calls real RPCs / real PostgREST queries. Every component is fully wired. No placeholder text or hardcoded empty states that would block plan goals. The literal `<store link placeholder>` in `shareInvite.ts` is intentional and LOCKED by UI-SPEC §"Native share-sheet message" (line 298 of 02-UI-SPEC.md) — to be replaced in Phase 6.

## Self-Check: PASSED

Files created — verified present on disk:

- `src/features/groups/schemas.ts` — FOUND
- `src/features/groups/formatInviteCode.ts` — FOUND
- `src/features/groups/timezones.ts` — FOUND
- `src/features/groups/shareInvite.ts` — FOUND
- `src/features/groups/useGroupsList.ts` — FOUND
- `src/features/groups/useGroup.ts` — FOUND
- `src/features/groups/useGroupMembers.ts` — FOUND
- `src/features/groups/useActiveInvite.ts` — FOUND
- `src/features/groups/useInvitePreview.ts` — FOUND
- `src/features/groups/useCreateGroup.ts` — FOUND
- `src/features/groups/useRedeemInvite.ts` — FOUND
- `src/features/groups/useLeaveGroup.ts` — FOUND
- `src/features/groups/useTransferAdmin.ts` — FOUND
- `src/features/groups/useDeleteGroup.ts` — FOUND
- `src/features/groups/useRegenerateInvite.ts` — FOUND
- `src/features/groups/usePendingInviteReplay.ts` — FOUND
- `src/components/SegmentedControl.tsx` — FOUND
- `src/components/InviteCodeChip.tsx` — FOUND
- `src/components/Modal.tsx` — FOUND
- `tests/groups/schemas.test.ts` — FOUND
- `tests/groups/formatInviteCode.test.ts` — FOUND
- `tests/groups/timezones.test.ts` — FOUND
- `tests/groups/segmentedControl.test.tsx` — FOUND
- `tests/groups/inviteCodeChip.test.tsx` — FOUND
- `tests/groups/modal.test.tsx` — FOUND
- `tests/groups/useGroupsList.test.tsx` — FOUND

Commits in git log:

- `ee3865d` (Task 1: utilities) — FOUND
- `dbc4c8f` (Task 2: RN primitives) — FOUND
- `dc5bca3` (Task 3: hooks + replay) — FOUND

Verified test counts: 56 new jest cases green (schemas 15, formatInviteCode 17, timezones 6, segmentedControl 4, inviteCodeChip 5, modal 5, useGroupsList 4). All 92 tests (pre-existing 36 + new 56) pass.
Verified typecheck: `npx tsc --noEmit` exits 0.
Verified alphabet + PENDING_INVITE_KEY cross-file consistency via grep.

---

*Phase: 02-groups-invites*
*Plan: 03*
*Completed: 2026-04-24*
