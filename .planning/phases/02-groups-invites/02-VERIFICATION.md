---
phase: 02-groups-invites
verified: 2026-04-24T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run full Jest suite and confirm 120 tests pass across 25 suites"
    expected: "pnpm test exits 0 with no failures"
    why_human: "Cannot execute pnpm test in verification context; 02-07-SUMMARY.md reports 120/25 green but final state must be confirmed post all review fixes (b3bef49, a21dca0, 9016ee3, 583cf01, cd23d27)"
  - test: "Run pgTAP suite and confirm 56 tests pass across 12 files"
    expected: "supabase test db exits 0 with 12 files (P1: 3, P2: 8, UAT-added: 1)"
    why_human: "Cannot run supabase test db in verification context"
  - test: "Run pnpm typecheck and confirm exit 0"
    expected: "No TypeScript errors"
    why_human: "Cannot run tsc in verification context"
  - test: "iOS dev build: create a group, verify creator becomes admin (GRP-01, GRP-02)"
    expected: "Group created with correct name/goal/submission_type/timezone; creator's member row has role=admin"
    why_human: "Live device verification of data flow from create_group RPC through group-detail screen"
  - test: "iOS dev build: view groups list and drill into a group (GRP-03, GRP-04)"
    expected: "Groups list shows all groups user belongs to; group detail shows name, goal, members with ADMIN badge, submission type, timezone metadata"
    why_human: "Visual rendering and navigation can only be confirmed on device"
  - test: "iOS dev build: admin generates invite link, share sheet fires with correct message (INV-01)"
    expected: "Share sheet contains group name, dashed code, accountibuzz://invite/{raw_code}, and '<store link placeholder>' literal"
    why_human: "Share sheet content requires device"
  - test: "iOS dev build: joining via code and deep link (INV-02)"
    expected: "Code entry normalizes dashes; deep-link unauth path writes PENDING_INVITE_KEY then routes to login; post-login replay lands on invite screen; join succeeds"
    why_human: "Multi-session auth-detour flow requires real auth state"
  - test: "iOS dev build: 10-member cap enforcement (INV-03)"
    expected: "group_full error surfaces with correct copy when group is at 10 members — accepted via pgTAP coverage per plan 07 Checkpoint K"
    why_human: "10-device live test is impractical; pgTAP structural + behavioral test is the authoritative proof per 02-07-SUMMARY.md"
  - test: "iOS dev build: member and admin leave flows (GRP-05)"
    expected: "Member leave navigates to home; admin-leave branching modal shows transfer + delete paths; transfer works; delete cascades and navigates to home"
    why_human: "Branching modal state and navigation back to home require real device"
---

# Phase 2: Groups & Invites — Verification Report

**Phase Goal:** Users can form the container for accountability — create a group and bring friends in via a shareable link.
**Verified:** 2026-04-24
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create a group (name, goal, submission type photo\|video, IANA timezone) and becomes its admin | ✓ VERIFIED | `app/(app)/groups/new.tsx` wires `useCreateGroup` → `create_group` RPC (SECURITY DEFINER, atomically inserts groups + admin group_members + invite rows). Form validates via `createGroupSchema` Zod. Default tz from `Intl.DateTimeFormat().resolvedOptions().timeZone` with UTC fallback. On success: `router.replace('/groups/${result.group_id}')`. |
| 2 | User can view the list of groups they belong to and drill into a group's details, members, and rules | ✓ VERIFIED | `app/(app)/index.tsx` uses `useGroupsList` (queries `groups` + `group_members!inner(count)`, maps to `GroupsListRow[]`). FlatList with pull-to-refresh. Row tap navigates to `/groups/{id}`. Group detail `app/(app)/groups/[id]/index.tsx` uses `useGroup` + `useGroupMembers` + `useActiveInvite` — renders name, goal, metadata, members with ADMIN badge, submission type, timezone. |
| 3 | Admin can generate a shareable invite link/code; tapping it (or entering the code) joins the recipient to the group | ✓ VERIFIED | `create_group` RPC mints first invite atomically. `useRegenerateInvite` calls `regenerate_invite` RPC (closes prior, mints new). `InviteCodeChip` copies raw code to Clipboard + haptic. `shareInvite()` fires OS share sheet with `accountibuzz://invite/{code}`. `app/invite/[code].tsx` outside `(app)` group (unauth-accessible); three branches (loading/not-found/unauth/authed). `app/(app)/groups/join.tsx` normalizes + redeems. `usePendingInviteReplay` wired in `app/_layout.tsx` after `useProtectedRoute`. WR-02 fix: `normalizeInviteCode` applied to deep-link param. |
| 4 | Group membership is capped at 10 members (soft cap enforced) | ✓ VERIFIED | `redeem_invite` RPC: `SELECT 1 FROM groups WHERE id = inv.group_id FOR UPDATE` row-lock, then count check → `group_full` error (P0001). pgTAP `redeem_invite.sql` seeds exactly 10 members + asserts 11th attempt raises `group_full`. Structural `pg_get_functiondef LIKE '%for update%'` assertion. UI surfaces copy `"This group's already at 10 members..."`. Detail screen shows `Your group's full — 10 is the cap for now.` at `members.length === 10`. |
| 5 | User can leave a group they belong to | ✓ VERIFIED | `leave_group` RPC rejects admin with `admin_cannot_leave`. Non-admin `useLeaveGroup` deletes member row → `router.replace('/')`. Admin-leave flow opens branching modal (`'Admins can\'t just leave'`, `'Never mind'`) → transfer or delete paths. `transfer_admin` RPC atomically updates both tables (one admin invariant). `delete_group` cascades via FK ON DELETE CASCADE. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0004_phase2_groups_invites.sql` | 7 RPCs + helper + type + policy drops + CHECKs | ✓ VERIFIED | 8 functions found (create_group, redeem_invite, get_invite_preview, leave_group, transfer_admin, delete_group, regenerate_invite, generate_invite_code). Policy drops confirmed. CHECK constraints confirmed. Alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` present. 4 `for update` occurrences, 7 `security definer` occurrences. |
| `supabase/migrations/0005_profiles_select_co_member.sql` | Co-member RLS policy for profile visibility | ✓ VERIFIED | UAT bug #4 fix — `profiles_select_co_member` policy enables cross-user profile reads for group members. |
| `supabase/tests/` (8 P2 files + 1 UAT-added) | pgTAP coverage for all RPCs | ✓ VERIFIED | 12 total SQL test files. `redeem_invite.sql` has `for update` structural assertion + all 5 error paths. `invites_policies.sql` asserts both dropped policies. `get_invite_preview.sql` uses `set local role anon`. `leave_group.sql` covers `admin_cannot_leave`. |
| `src/types/database.ts` | Regenerated with 7 new Functions entries | ✓ VERIFIED | Contains `create_group`, `delete_group`, `get_invite_preview`, `leave_group`, `redeem_invite`, `regenerate_invite`, `transfer_admin`. |
| `src/features/groups/schemas.ts` | Zod schemas createGroupSchema + joinCodeSchema | ✓ VERIFIED | Contains exact error messages per UI-SPEC. Alphabet regex enforced. |
| `src/features/groups/formatInviteCode.ts` | INVITE_ALPHABET + normalize/format/isValid | ✓ VERIFIED | `INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'` matches migration exactly. |
| `src/features/groups/timezones.ts` | Intl-first listTimezones + 400+ STATIC_FALLBACK | ✓ VERIFIED | 503 lines; 453 single-quote characters indicating 400+ array entries. `listTimezones()` try/typeof/catch fallback. |
| `src/features/groups/shareInvite.ts` | Share sheet with locked message format | ✓ VERIFIED | Per earlier plan; `accountibuzz://invite/` and `<store link placeholder>` literal present (per SUMMARY confirmation). |
| All 11 hook files under `src/features/groups/` | RPC mutation + read hooks | ✓ VERIFIED | All 17 files present (11 hooks + usePendingInviteReplay + 4 utilities + IanaTimezonePicker). Every mutation hook calls `supabase.rpc()` + `throw new Error(error.message)`. |
| `src/features/groups/usePendingInviteReplay.ts` | Shared PENDING_INVITE_KEY + router.replace | ✓ VERIFIED | `PENDING_INVITE_KEY = 'accountibuzz.pendingInviteCode'` exported. `useRedeemInvite` imports it and calls `SecureStore.deleteItemAsync(PENDING_INVITE_KEY)` in onSuccess. |
| `src/components/SegmentedControl.tsx` | Equal-width segmented control with a11y | ✓ VERIFIED | `accessibilityState={{ selected, disabled }}` present. |
| `src/components/InviteCodeChip.tsx` | Chunked display + Clipboard + Haptics | ✓ VERIFIED | `Clipboard.setStringAsync(code)` (raw), `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`, `'Copied ✓'` label, `formatInviteCode` import. |
| `src/components/Modal.tsx` | Dev-warn on 'Cancel' cancelLabel | ✓ VERIFIED | `if (__DEV__ && cancelLabel.toLowerCase() === 'cancel') console.warn(...)`. `accessibilityViewIsModal` present. |
| `src/components/index.ts` | Barrel exports SegmentedControl, InviteCodeChip, Modal | ✓ VERIFIED | All three exported. |
| `src/features/groups/IanaTimezonePicker.tsx` | FlatList + search + listTimezones | ✓ VERIFIED | `listTimezones()` call, `labelFor` import, `presentationStyle="pageSheet"`, `'Search cities or regions'` placeholder, `'No match. Try another city or region.'` empty state. |
| `app/(app)/index.tsx` | Groups-list home with empty + populated states | ✓ VERIFIED | `useGroupsList`, empty-state copy `'No groups yet'`, CTAs, FlatList, pull-to-refresh via `RefreshControl`. |
| `app/(app)/groups/[id]/index.tsx` | Group detail with invite panel, members, 5 modals | ✓ VERIFIED | All 5 context-specific cancelLabels: `'Stay in group'`, `'Never mind'`, `'Keep my admin role'`, `'Keep the group'`, `'Keep current code'`. `InviteCodeChip`, `shareInvite`, all 6 mutation hooks, `router.replace('/')` for leave + delete. |
| `app/(app)/groups/new.tsx` | Create-group form with IanaTimezonePicker | ✓ VERIFIED | `zodResolver(createGroupSchema)`, `useCreateGroup`, exact UI-SPEC strings, `router.replace('/groups/${result.group_id}')`, char counter, `Intl.DateTimeFormat().resolvedOptions().timeZone` with try/catch. |
| `app/(app)/groups/join.tsx` | Code-entry screen with normalization | ✓ VERIFIED | `normalizeInviteCode`, `useRedeemInvite`, all 6 typed-error strings, `autoCapitalize="characters"`, `maxLength={9}`. |
| `app/invite/[code].tsx` | Deep-link landing (OUTSIDE (app) group) | ✓ VERIFIED | Outside `(app)` route group. Three branches. `sessionLoading \|\| previewPending` gate. `SecureStore.setItemAsync(PENDING_INVITE_KEY, code)` at ≥2 call sites. NO `deleteItemAsync` call. WR-02 fix: `normalizeInviteCode` applied to route param. |
| `app/_layout.tsx` | Root layout with usePendingInviteReplay + invite exemption | ✓ VERIFIED | `usePendingInviteReplay()` after `useProtectedRoute()`. `onInviteLanding = segments[0] === 'invite'` exempts deep-link from auth redirect (UAT fix). |
| `app/(app)/_layout.tsx` | Stack registration for P2 routes | ✓ VERIFIED | `groups/new`, `groups/join`, `groups/[id]/index` all registered. |
| `jest.setup.ts` | expo-clipboard + expo-haptics mocks | ✓ VERIFIED | Both mocks present with `NotificationFeedbackType` enum. |
| `package.json` | expo-clipboard ~55.0.13, expo-haptics ~55.0.14 | ✓ VERIFIED | Both at SDK-55-matched versions. |
| `tests/intl-supportedvaluesof-probe.test.ts` | 5-case probe locking fallback contract | ✓ VERIFIED | File exists. |
| `tests/groups/` (14 test files) | All plan test files | ✓ VERIFIED | 14 files present including all screen integration tests and UAT-driven coverage. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/_layout.tsx` | `usePendingInviteReplay()` | inside RootGate after useProtectedRoute | ✓ WIRED | Confirmed at lines 49+54; ordering correct |
| `app/invite/[code].tsx` | `SecureStore.setItemAsync(PENDING_INVITE_KEY, code)` → auth route | onJoinTap / onSignUp handlers | ✓ WIRED | Two call sites confirmed (login + signup paths); no `deleteItemAsync` |
| `app/(app)/groups/join.tsx` | `useRedeemInvite` → `router.replace('/groups/{id}')` | onSubmit handler | ✓ WIRED | `redeem.mutateAsync(values.code)` → `router.replace` confirmed |
| `src/features/groups/useRedeemInvite.ts` | `SecureStore.deleteItemAsync(PENDING_INVITE_KEY)` | onSuccess | ✓ WIRED | Only clearing point confirmed; imports PENDING_INVITE_KEY from usePendingInviteReplay |
| `src/features/groups/formatInviteCode.ts` | migration `0004` generate_invite_code() | shared INVITE_ALPHABET | ✓ WIRED | Both contain `'23456789ABCDEFGHJKMNPQRSTUVWXYZ'` exactly |
| `src/components/InviteCodeChip.tsx` | expo-clipboard + expo-haptics | Clipboard.setStringAsync + Haptics.notificationAsync | ✓ WIRED | Both imports and both calls present |
| `app/(app)/groups/[id]/index.tsx` | shareInvite() + 4 mutation hooks | button onPress handlers | ✓ WIRED | All 5 mutation hooks imported and called; shareInvite wired to Share code button |
| `supabase/migrations/0004` | FOR UPDATE row lock in redeem_invite | SELECT...FOR UPDATE on groups row | ✓ WIRED | 4 `for update` occurrences; pgTAP structural assertion confirms |
| `app/(auth) / (app)` routes | invite exemption | `onInviteLanding = segments[0] === 'invite'` | ✓ WIRED | UAT fix; both redirect branches check `!onInviteLanding` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `app/(app)/index.tsx` | `groups` | `useGroupsList` → `supabase.from('groups').select(...)` | Yes — `.from('groups')` query with `group_members!inner(count)` aggregate | ✓ FLOWING |
| `app/(app)/groups/[id]/index.tsx` | `group`, `members`, `activeInvite` | `useGroup`, `useGroupMembers`, `useActiveInvite` → PostgREST queries | Yes — all three hooks query Supabase tables directly | ✓ FLOWING |
| `app/(app)/groups/new.tsx` | `result` (group_id, invite_code) | `useCreateGroup` → `supabase.rpc('create_group', ...)` | Yes — SECURITY DEFINER RPC with real DB inserts | ✓ FLOWING |
| `app/(app)/groups/join.tsx` | `groupId` | `useRedeemInvite` → `supabase.rpc('redeem_invite', ...)` | Yes — RPC with FOR UPDATE row lock + member insert | ✓ FLOWING |
| `app/invite/[code].tsx` | `preview` | `useInvitePreview` → `supabase.rpc('get_invite_preview', ...)` | Yes — anon-callable RPC returns 3-field `invite_preview` type | ✓ FLOWING |
| `src/components/InviteCodeChip.tsx` | `code` prop | passed from `activeInvite.code` in group detail screen | Yes — activeInvite fetched from DB via useActiveInvite | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — cannot start iOS simulator or Supabase local DB in verification context. Manual UAT (02-07 Task 2) covered all 11 behavioral checkpoints on an actual iOS device with a live Supabase instance.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| GRP-01 | 02-02, 02-03, 02-05 | User can create a group (name, goal, timezone, submission type) | ✓ SATISFIED | `create_group` RPC + `app/(app)/groups/new.tsx` form + `IanaTimezonePicker`. UAT Checkpoint B approved. |
| GRP-02 | 02-02, 02-05 | Group creator is the admin | ✓ SATISFIED | `create_group` atomically inserts `group_members` row with `role='admin'`. `isAdmin = group.admin_user_id === user.id`. UAT Checkpoint B approved. |
| GRP-03 | 02-03, 02-04 | User can view the list of groups they belong to | ✓ SATISFIED | `useGroupsList` + `app/(app)/index.tsx` FlatList. UAT Checkpoint A (empty) + F (populated) approved. |
| GRP-04 | 02-03, 02-04 | User can view group's details, members, and rules | ✓ SATISFIED | `app/(app)/groups/[id]/index.tsx` renders header (name/goal/metadata), members list with ADMIN badge, submission rules. UAT Checkpoint G approved. |
| GRP-05 | 02-02, 02-03, 02-04 | User can leave a group | ✓ SATISFIED | `leave_group` RPC (admin-blocked server-side). Member-leave modal + `router.replace('/')`. Admin-leave branching modal. UAT Checkpoints H + I approved. |
| INV-01 | 02-02, 02-03, 02-04 | Admin can generate a shareable invite link/code | ✓ SATISFIED | `create_group` mints first invite; `regenerate_invite` RPC refreshes. `InviteCodeChip` + `shareInvite()`. UAT Checkpoints C + E approved. |
| INV-02 | 02-02, 02-03, 02-06 | User can join a group by opening an invite link or entering an invite code | ✓ SATISFIED | Code-entry: `app/(app)/groups/join.tsx` normalizes + redeems. Deep-link: `app/invite/[code].tsx` unauth/authed branches + replay. UAT Checkpoints D + F + J approved. |
| INV-03 | 02-02, 02-04, 02-06 | Group size capped at 10 members | ✓ SATISFIED | `redeem_invite` FOR UPDATE + count check → `group_full`. pgTAP seeds 10 members + asserts 11th fails. UI surfaces cap copy. UAT Checkpoint K accepted via pgTAP coverage. |

**All 8 Phase 2 requirements (GRP-01 through GRP-05, INV-01 through INV-03) are SATISFIED.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/groups/timezones.ts` | 441-470 | `Etc/GMT+N` sign inversion not commented (IN-01) | ℹ️ Info | Code smell; labelFor resolves to human offset so UX is OK |
| `src/features/groups/useGroupMembers.ts` | 24-28 | profiles embed cast assumes object shape, not array (IN-02) | ℹ️ Info | Could silently return undefined if PostgREST returns array; no current breakage |
| `app/(app)/groups/[id]/index.tsx` | 51-54 | getPublicUrl() called per-render per member (IN-03) | ℹ️ Info | Pure call, no network; code smell only |
| `src/features/groups/useActiveInvite.ts` | 19-26 | `.order()` defensive but invariant guarantees single active invite (IN-04) | ℹ️ Info | No correctness impact |
| `src/features/groups/IanaTimezonePicker.tsx` | 55-63 | No diacritic normalization in search (IN-05) | ℹ️ Info | Static fallback has no diacritics; edge case |
| `src/types/database.ts` | 92 | `submission_type` typed as `string` not union (IN-06) | ℹ️ Info | Narrows manually at hook boundary; no crash risk |
| `src/components/Modal.tsx` | 66-69 | `primaryFg` ternary is dead state (same value both branches) (IN-07) | ℹ️ Info | `primaryTextColor` drives the actual color; spinner contrast on red is suboptimal |
| `src/features/groups/useCreateGroup.ts` | 24 | Double cast through `unknown` (IN-08) | ℹ️ Info | Works; `types:gen` rerun would simplify |

All 8 items are Info-level only (carried forward from 02-REVIEW.md; the 5 Warning-level items were all fixed in 02-REVIEW-FIX.md commits b3bef49, a21dca0, 9016ee3, 583cf01, cd23d27). No blockers or warnings remain.

### Human Verification Required

#### 1. Full Automated Test Suite

**Test:** Run `pnpm test && pnpm typecheck && supabase test db` from the project root.
**Expected:** Jest 120/25 green, TypeScript clean, pgTAP 56/12 green — matching 02-07-SUMMARY.md Task 1 results after all review fixes were applied.
**Why human:** Cannot execute test runners in verification context. The 5 review-fix commits landed after the 02-07 automation gate ran — final post-fix state needs confirmation.

#### 2. Create Group → Admin Role (GRP-01, GRP-02)

**Test:** On iOS dev build, tap `Create a group`, fill all 4 fields, tap `Create group`.
**Expected:** Routes to group detail; post-create banner `'Group created — share the code to invite friends.'` appears; admin invite panel visible; member row shows ADMIN badge for creator.
**Why human:** Live RPC round-trip + visual render; TanStack Query cache population from `create_group` return value.

#### 3. Groups List + Drill-In (GRP-03, GRP-04)

**Test:** View home with ≥1 group, confirm FlatList; tap a row, confirm detail screen.
**Expected:** List shows name, member count, submission type, timezone label. Detail shows goal, members, rules metadata.
**Why human:** Visual appearance and navigation flow require device.

#### 4. Admin Invite Panel + Share Sheet (INV-01)

**Test:** On group detail as admin, tap `Share code`.
**Expected:** OS share sheet opens with message containing group name, dashed code, deep-link URL, and `<store link placeholder>`.
**Why human:** Share sheet is a native OS surface not testable without a device.

#### 5. Deep-Link Unauth Path + Replay (INV-02)

**Test:** Signed-out user taps `accountibuzz://invite/{code}` link; taps `Sign in to join`; logs in; lands back on invite screen; taps `Join group`.
**Expected:** Preview renders before auth prompt; PENDING_INVITE_KEY persists through login; post-login replay triggers; group joined.
**Why human:** Multi-session state, SecureStore persistence, OS deep-link handling — cannot mock reliably.

#### 6. Member + Admin Leave Flows (GRP-05)

**Test:** As member, tap `Leave group` → confirm modal → leave. As admin, tap kebab `Leave group` → branching modal appears. Tap `Transfer admin instead` → picker modal. Tap `Delete group` → confirm → group deleted.
**Expected:** All cancelLabels match spec strings; leave navigates to home; delete cascades.
**Why human:** Modal state machine and navigation back to home require device interaction.

#### 7. 10-Member Cap UI (INV-03)

**Test:** With a group at 10 members, attempt to join via code.
**Expected:** `"This group's already at 10 members. Ask the admin to make room or start your own."` displayed.
**Why human:** Seeding 10 members manually on device for cap test. pgTAP coverage accepted as authoritative for the RPC enforcement per plan 07 Checkpoint K.

---

## Gaps Summary

No gaps found. All 5 roadmap success criteria are verified against the codebase. All 8 requirement IDs (GRP-01 through GRP-05, INV-01 through INV-03) are satisfied by implemented artifacts. All 5 review warnings were fixed before this verification. The 8 remaining Info-level items from code review are documented but do not block goal achievement.

The `human_needed` status reflects that several truths require live device confirmation to close fully — the automated code inspection found everything correctly implemented, but visual rendering, share-sheet content, OS deep-link behavior, and multi-session auth-detour flows cannot be confirmed without an iOS device.

---

_Verified: 2026-04-24_
_Verifier: Claude (gsd-verifier)_
