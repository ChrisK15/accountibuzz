---
phase: 02
plan: 04
subsystem: groups-invites / screens (signed-in home + group detail)
tags: [screens, list, detail, admin-actions, expo-router, integration-tests]

# Dependency graph
requires:
  - 02-03 (shared toolkit: 11 hooks, Modal, InviteCodeChip, shareInvite, labelFor)
  - 02-02 (RPCs behind the hooks — admin_cannot_leave invariant etc.)
provides:
  - route/(app)/index — two-state GroupsListScreen (empty CTAs / populated FlatList)
  - route/(app)/groups/[id]/index — GroupDetailScreen with admin invite panel +
    5 Modals (member-leave, admin-leave branch, transfer-picker, delete-confirm,
    regenerate-confirm), each with a context-specific cancelLabel
  - stack-registration for groups/new, groups/join, groups/[id]/index in (app)/_layout
  - integration-tests tests/groups/groupsListScreen.test.tsx (4 cases)
  - integration-tests tests/groups/groupDetailScreen.test.tsx (4 cases)
affects:
  - (app)/_layout.tsx (added 5 Stack.Screen registrations)

# Tech tracking
tech-stack:
  added: [] # no new deps
  patterns:
    - "Hook-module-level jest.mock + require() screen after env set (tests/avatar-upload pattern)"
    - "expo-router mock exposes push/replace/back as `mock`-prefixed jest.fns so the jest hoist guard permits factory access"
    - "Role-branched destructive zone: non-admin sees DestructiveTextButton 'Leave group'; admin sees accent 'Transfer admin' link + DestructiveTextButton 'Delete group' (UI-SPEC line 389-391)"
    - "Admin-leave kebab tap routes through branching Modal; direct 'Leave group' is hidden for admin (T-02-ADMIN-LEAVE defense-in-depth)"
    - "SecureStore banner key pattern `seen_create_banner:{group_id}` with 8s auto-hide + one-time gate"
    - "Kebab menu uses native Alert.alert (UI-SPEC's banned 'Cancel' rule applies only to the P2 Modal primitive; native OS Alert button is allowed)"

key-files:
  created:
    - app/(app)/index.tsx
    - app/(app)/groups/[id]/index.tsx
    - tests/groups/groupsListScreen.test.tsx
    - tests/groups/groupDetailScreen.test.tsx
  modified:
    - app/(app)/_layout.tsx

decisions:
  - "Stack.Screen for groups/new and groups/join registered here (not deferred to plans 05/06) because typecheck passes; expo-router binds routes at runtime based on file presence, so registering ahead of file creation is safe."
  - "Kebab menu uses native Alert.alert — no bottom-sheet library in P1, and the Alert's 'Cancel' button is a native OS control, not a P2 Modal dismiss label (so the UI-SPEC dismiss-label rule is satisfied)."
  - "Transfer-success banner (UI-SPEC line 274) implemented as an InlineBanner above the members section, dismissible, persists until user closes it; not auto-hidden."
  - "InlineBanner + MemberRowItem + TransferPickerList + GroupDetailSkeleton all kept inline in the detail screen file (not extracted) per plan 02-04 guidance ('defined inline in this file, or extracted privately above the default export')."
  - "Tests mock the 4 mutation hooks inline at module level (useLeaveGroup/useTransferAdmin/useDeleteGroup/useRegenerateInvite) as factory returning { mutateAsync: jest.fn(), isPending: false } — cheaper than mocking supabase for screens that only care about button wiring."

# Metrics
duration: ~25min
completed: 2026-04-24
tasks: 3
files_created: 4
files_modified: 1
commits: 3
---

# Phase 02 Plan 04: Groups-List Home + Group-Detail Screen Summary

Shipped the two most load-bearing P2 screens — the groups-list signed-in home (empty + populated states) and the group-detail screen (admin + non-admin role branching with all 5 Modals). `(app)/_layout.tsx` registers all three new P2 routes. Full jest suite green at 100 tests across 20 suites; `npx tsc --noEmit` exits 0.

## Task Commits

| Task | Name                                                | Commit    | Type |
|------|-----------------------------------------------------|-----------|------|
| 1    | Stack registration + GroupsListScreen               | `4c59f19` | feat |
| 2    | GroupDetailScreen with admin/member branching       | `9ff5361` | feat |
| 3    | Integration tests for both screens                  | `4e2da93` | test |

## Confirmation of All 5 cancelLabel Strings

Every `<Modal>` usage in `app/(app)/groups/[id]/index.tsx` passes a context-specific `cancelLabel` per the UI-SPEC Copywriting Contract (§"Destructive action confirmations" lines 278-288):

| Modal                          | cancelLabel passed        |
|--------------------------------|---------------------------|
| Member: Leave group            | `'Stay in group'`         |
| Admin-leave branching          | `'Never mind'`            |
| Admin: Transfer admin picker   | `'Keep my admin role'`    |
| Admin: Delete group            | `'Keep the group'`        |
| Admin: Regenerate invite       | `'Keep current code'`     |

Grep proof:

```
$ grep -E "Stay in group|Never mind|Keep my admin role|Keep the group|Keep current code" 'app/(app)/groups/[id]/index.tsx' | grep -v '^//'
        cancelLabel="Stay in group"
        cancelLabel="Never mind"
        cancelLabel="Keep my admin role"
        cancelLabel="Keep the group"
        cancelLabel="Keep current code"
```

The Modal primitive from plan 03 dev-warns on `cancelLabel='Cancel'` (case-insensitive); none of the 5 uses triggers the warning.

## Stack Registration Note

All three new Stack.Screen entries registered HERE in `(app)/_layout.tsx`:

```tsx
<Stack.Screen name="groups/new" options={{ headerShown: false }} />
<Stack.Screen name="groups/join" options={{ headerShown: false }} />
<Stack.Screen name="groups/[id]/index" options={{ headerShown: false }} />
```

Typecheck passes with these declared ahead of the files being created (expo-router binds routes at runtime based on file presence), so plans 05 and 06 do NOT need to touch `(app)/_layout.tsx`. This matches the plan's "back off only if typecheck demands" branch — typecheck was green on first try, so no back-off required.

## Visual Description (textual screenshots)

**Groups-list empty state:**
- Top bar: `Your groups` (H1) left, 40pt Avatar (profile shortcut) right.
- Centered ScreenHeader: Display-size `No groups yet`, body-muted `Start one with friends or hop into theirs.`
- Primary yellow button: `Create a group` (full width).
- Ghost cyan accent link below: `Join with a code`.

**Groups-list populated state:**
- Top bar: `Your groups` left; `+` icon + kebab (3-dot) icons right (Feather `plus` / `more-horizontal`, 24pt, text-strong color). Avatar moves into kebab.
- FlatList of rows. Each row: 1px-border surface card with 12px radius, pressed state swaps to surface-muted. Contains:
  - H2 group name
  - body text goal (2-line truncate)
  - caption-muted metadata: `{n} members · Photo|Video · {timezone long label}`
- Pull-to-refresh wired to TanStack Query `refetch`.
- Kebab tap → native Alert with items `Join with a code`, `Profile`, `Cancel`.

**Group-detail (admin view):**
- Top bar: `<` back chevron left, kebab right (native Alert with `Regenerate code`, `Transfer admin`, `Delete group` (destructive), `Cancel`).
- Header block: Display-size group name (max 2 lines), body-muted goal, caption-muted `{n} of 10 members · Photo|Video · {tz}`.
- One-time post-create banner (surface-muted, border, dismiss ×): `Group created — share the code to invite friends.` — auto-hides 8s; persistence via SecureStore `seen_create_banner:{group_id}`.
- Admin invite panel (surface card, 1px border, 20px radius): caption `Invite code`, InviteCodeChip (surface-muted chip with `ABCD-EF23` in 20pt bold tabular-nums + letterSpacing 2, accent `Copy` text button), primary yellow `Share code` button, accent-cyan right-aligned text link `Regenerate code`.
- Members list: caption `Members (n)`, row per member (40pt Avatar + name + `You` caption if self + `ADMIN` pill (primary bg, primary-fg text, uppercase Caption with letterSpacing 0.5, pill radius) if role=admin).
- If solo admin: caption-muted hint `Just you so far — share your code to bring friends in.`
- If at 10/10: body-muted `Your group's full — 10 is the cap for now.`
- 1px border top separator, then destructive zone: accent `Transfer admin` text link, then DestructiveTextButton `Delete group`.

**Group-detail (non-admin / member view):**
- Same header block.
- **No** invite panel (gated on `isAdmin && activeInvite`).
- Members list with ADMIN badge on the admin row.
- Destructive zone shows ONLY `Leave group` DestructiveTextButton; no admin kebab items.
- Kebab right-button: native Alert with `Leave group` (destructive) + `Cancel`.

**Modals (centered sheet, scrim tap dismisses):**
- Member-leave: `Leave {group}?` / body copy / destructive `Leave group` / ghost-muted `Stay in group`.
- Admin-leave-branch: `Admins can't just leave` / body copy / primary `Transfer admin instead` / destructive-text stacked `Delete the group` / ghost-muted `Never mind`.
- Transfer-picker: `Pick a new admin` / body = TransferPickerList (member rows with radio dots, selection highlights row accent border) / primary `Pick a member` → `Transfer to {name}` once selected / ghost-muted `Keep my admin role`.
- Delete-confirm: `Delete this group?` / body copy / destructive `Delete group` / ghost-muted `Keep the group`.
- Regenerate-confirm: `Make a new code?` / body copy / primary (NOT destructive) `Regenerate` / ghost-muted `Keep current code`.

## Acceptance criteria verification

### Task 1
- [x] `(app)/_layout.tsx` contains `Stack.Screen name="groups/[id]/index"`
- [x] `(app)/index.tsx` imports `useGroupsList` from `../../src/features/groups/useGroupsList`
- [x] contains `router.push('/groups/new')` AND `router.push('/groups/join')`
- [x] contains literal strings `'No groups yet'`, `'Start one with friends or hop into theirs.'`, `'Create a group'`, `'Join with a code'`
- [x] contains `labelFor` import from `timezones`
- [x] uses `RefreshControl`
- [x] `pnpm typecheck` → 0

### Task 2
- [x] `app/(app)/groups/[id]/index.tsx` exists
- [x] contains all 5 cancelLabel literals (`'Stay in group'`, `'Never mind'`, `'Keep my admin role'`, `'Keep the group'`, `'Keep current code'`)
- [x] contains `seen_create_banner:` SecureStore key pattern
- [x] imports `InviteCodeChip` AND `shareInvite`
- [x] contains `admin_user_id === user.id` isAdmin derivation
- [x] imports all 7 group hooks (useGroup, useGroupMembers, useActiveInvite, useLeaveGroup, useTransferAdmin, useDeleteGroup, useRegenerateInvite)
- [x] contains `router.replace('/')` (leave + delete)
- [x] contains `Your group\'s full — 10 is the cap for now.` (JSX-escaped `&apos;` equivalent)
- [x] `pnpm typecheck` → 0

### Task 3
- [x] `tests/groups/groupsListScreen.test.tsx` exists with 4 test cases
- [x] `tests/groups/groupDetailScreen.test.tsx` exists with 4 test cases
- [x] Both use `@testing-library/react-native` + `QueryClientProvider`
- [x] Both test files exit 0 (all 8 cases green)
- [x] `pnpm test -- tests/groups` — 9 suites, 64 tests green
- [x] Full jest suite — 20 suites, 100 tests green

### Plan-level verification
- [x] `pnpm typecheck` green after Tasks 1 + 2 + 3
- [x] `grep -c "cancelLabel" app/(app)/groups/[id]/index.tsx` returns 6 (5 Modal uses + 1 comment line) — ≥ 5 required
- [x] Grep for all 5 cancel strings matches each
- [x] Navigation coverage: 10 `router.*` calls across the two screens — ≥ 5 required

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Jest hoist guard on factory-referenced variables**
- **Found during:** Task 3 first GREEN run.
- **Issue:** Initial test files declared `pushMock` / `replaceMock` / `backMock` as `const`s used inside `jest.mock('expo-router', () => ({ useRouter: () => ({ push: pushMock ... })}))`. Jest's babel transform raised `ReferenceError: The module factory of jest.mock() is not allowed to reference any out-of-scope variables. Invalid variable access: pushMock`.
- **Fix:** Renamed to the `mock`-prefix convention (`mockPush`, `mockReplace`, `mockBack`) which the jest hoist guard explicitly allows. Semantics preserved; updated `beforeEach` resets + assertion sites accordingly.
- **Files modified:** `tests/groups/groupsListScreen.test.tsx`, `tests/groups/groupDetailScreen.test.tsx`.
- **Commit:** `4e2da93`.

### No UI-SPEC copywriting deviations

Every load-bearing copy string matches the UI-SPEC §Copywriting Contract table verbatim — verified by grep for each of the 5 cancelLabel strings and the empty-state / modal-title literals.

### No architectural changes (Rule 4)

None needed. The plan's skeleton fit without structural modification. All 3 tasks ran as written modulo the jest-hoist fix above.

### No authentication gates

Screens consume already-signed-in session via `useSession`. No runtime auth step required.

## Issues Encountered

- **`act()` warnings from `@expo/vector-icons`:** The Feather `Icon` component fetches its font asynchronously and calls `setState` after first render. This produces non-failing `console.error` warnings in every screen test that uses an icon. Tests all pass; warnings are cosmetic. If future work wants to clean this up: wrap `render` in `await act(...)` or mock `@expo/vector-icons` with a simpler synchronous stub. Filed in `deferred-items.md` (logically — no action required for this plan).
- **Jest open-handles / force-exit:** Same as plan 03 — tests cause a worker to be force-exited after all suites pass. Not a correctness issue; noted in `deferred-items.md` from plan 02-01.

## TDD Gate Compliance

Plan frontmatter `type: execute`. Plan-level RED/GREEN/REFACTOR gate does NOT apply. Task 3 was `tdd="true"`, but the screens from Tasks 1+2 already satisfied the assertions — I did not introduce an intermediate RED commit because the source code was authored pre-test per the plan's Task 3 action ("the screens from Task 1 and Task 2 should already satisfy the assertions"). Both test files were authored, ran green on first pass after the jest-hoist fix, and were committed in a single `test(...)` commit. This matches plan 03's gate-compliance note — future phases wanting strict RED/GREEN commit separation should flip to `type: tdd` at the plan level.

## User Setup Required

None — pure code change. Live verification requires a signed-in Supabase session (established by Phase 1 plans) on a simulator/device; exercised end-to-end by plan 07's app-root wiring and plan 05/06's sibling screens.

## Next Phase Readiness

Plans 05 and 06 run in parallel after this lands (they touch disjoint files):
- **Plan 05** creates `app/(app)/groups/new.tsx` (create-group screen) and `app/(app)/groups/join.tsx` (join-with-code screen). Stack registration for both already in place.
- **Plan 06** creates `app/invite/[code].tsx` (deep-link landing) and wires pending-invite replay in `app/_layout.tsx`.

Navigation contracts consumed from this plan:
- `router.push('/groups/new')` — plan 05 must export default from that path.
- `router.push('/groups/join')` — plan 05 must export default from that path.
- `router.push('/groups/{id}')` — already routable via `groups/[id]/index`.
- `router.replace('/')` — already routable via `(app)/index`.

## Known Stubs

None. Every mutation hook is wired; every Modal ships with loading state; the invite panel gates on real `useActiveInvite` data. The one deliberate placeholder (`<store link placeholder>` in shareInvite) is inherited from plan 03 and is UI-SPEC-locked for Phase 6 replacement.

## Self-Check: PASSED

Files created — verified present on disk:

- `app/(app)/index.tsx` — FOUND
- `app/(app)/groups/[id]/index.tsx` — FOUND
- `tests/groups/groupsListScreen.test.tsx` — FOUND
- `tests/groups/groupDetailScreen.test.tsx` — FOUND

Files modified — verified:

- `app/(app)/_layout.tsx` — FOUND (Stack now registers 5 screens)

Commits in git log:

- `4c59f19` (Task 1) — FOUND
- `9ff5361` (Task 2) — FOUND
- `4e2da93` (Task 3) — FOUND

Verified test counts: 8 new integration cases green (groupsListScreen 4, groupDetailScreen 4). Full jest suite: 100 tests green across 20 suites.

Verified typecheck: `npx tsc --noEmit` exits 0.

Verified cancelLabel coverage: 6 occurrences in detail screen (5 Modal uses + 1 comment); all 5 exact strings present.

Verified navigation: 10 `router.*` calls across the two screens.

---

*Phase: 02-groups-invites*
*Plan: 04*
*Completed: 2026-04-24*
