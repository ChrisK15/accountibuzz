---
phase: 02
plan: 05
subsystem: groups-invites / create-group screen + timezone picker
tags: [screens, create-group, timezone-picker, form, rhf-zod, integration-tests]

# Dependency graph
requires:
  - 02-03 (useCreateGroup mutation + SegmentedControl + listTimezones/labelFor primitives)
  - 02-04 (groups/new Stack.Screen registered in app/(app)/_layout.tsx)
  - 02-01 (Intl.supportedValuesOf probe + fallback contract consumed by timezone picker)
provides:
  - app/(app)/groups/new.tsx — 4-field create-group form screen (GRP-01, GRP-02 surface)
  - src/features/groups/IanaTimezonePicker.tsx — pageSheet modal with search + Pitfall 4 fallback
  - tests/groups/createGroupScreen.test.tsx (4 integration cases)
  - tests/groups/ianaTimezonePicker.test.tsx (5 integration cases, incl. STATIC_FALLBACK path)
affects: []

# Tech tracking
tech-stack:
  added: [] # reuses 02-03 primitives + pre-installed RN core
  patterns:
    - "RHF + Zod form pattern mirrored from app/(auth)/login.tsx: Controller per field, mode='onBlur', isValid-gated submit button"
    - "Intl.supportedValuesOf mutation for picker STATIC_FALLBACK test (mirrors tests/intl-supportedvaluesof-probe.test.ts shape)"
    - "Screen-test hook-mock + require() pattern (mirrors tests/groups/groupDetailScreen.test.tsx): module-level jest.mock, process.env set at top, require() after"
    - "Typed RPC error → UI-SPEC copy mapping via err.message switch (extends useCreateGroup's `throw new Error(error.message)` contract from 02-03)"

key-files:
  created:
    - app/(app)/groups/new.tsx
    - src/features/groups/IanaTimezonePicker.tsx
    - tests/groups/createGroupScreen.test.tsx
    - tests/groups/ianaTimezonePicker.test.tsx
  modified: []

decisions:
  - "Default timezone resolved via try { Intl.DateTimeFormat().resolvedOptions().timeZone } catch → 'UTC'; also coalesces empty-string return to 'UTC' defensively (per CLAUDE.md's Hermes-iOS-may-lack-Intl risk)"
  - "IanaTimezonePicker bundled in the Task 1 commit (not Task 2 as the plan template suggests) because app/(app)/groups/new.tsx imports it — pnpm typecheck for Task 1 would otherwise fail. The picker is still tested in its own dedicated file (tests/groups/ianaTimezonePicker.test.tsx) per the plan; only the commit-ordering was tightened for Rule 3 (blocking dependency)."
  - "Screen test stubs IanaTimezonePicker (returns null + captures props) so the screen test does not mount the modal and the 4-field form assertions stay deterministic; the picker's behavioral coverage lives in its own file."
  - "Counter logic turns destructive at `goalLen < 5 || goalLen >= 140` per UI-SPEC §Form labels (line 215: 'turns destructive below 5 or at 140'). Empty/0-length counter is treated as < 5, matching the spec."
  - "Stack.Screen for groups/new was ALREADY registered in app/(app)/_layout.tsx by plan 02-04 (line 8). No layout modifications in this plan — file-based auto-discovery + the existing registration are sufficient."

# Metrics
duration: ~5min
completed: 2026-04-24
---

# Phase 02 Plan 05: Create-group screen + timezone picker Summary

**Shipped `app/(app)/groups/new.tsx` (4-field RHF+Zod form) and `src/features/groups/IanaTimezonePicker.tsx` (pageSheet modal with search + static-fallback defense), plus 9 integration tests (4 screen + 5 picker). 11 P2 test suites green (73 tests); `npx tsc --noEmit` exits 0. GRP-01/GRP-02 UI surface is now complete.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-24T21:45:32Z
- **Completed:** 2026-04-24T21:50:45Z
- **Tasks:** 2
- **Files created:** 4 (2 source + 2 test)
- **Files modified:** 0
- **Tests added:** 9 cases (5 picker + 4 screen)
- **Tests running (whole P2 groups dir):** 73 passing across 11 suites (was 64 across 9 before this plan)
- **Commits:** 2 (one per task)

## Task Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 1 | Build app/(app)/groups/new.tsx (+ IanaTimezonePicker co-dependency) | `afcbdb1` | feat |
| 2 | Integration tests for screen + picker | `fc8f02d` | test |

## Plan Output Requirements (per 02-05-PLAN.md §output)

### 1. Default timezone resolution

**Confirmed.** `app/(app)/groups/new.tsx` lines 52-58:

```ts
const defaultTz = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
})();
```

`try` runs `Intl.DateTimeFormat().resolvedOptions().timeZone`; empty-string returns coalesce to `'UTC'`; any thrown error falls through to the `catch` which returns `'UTC'`. This matches the plan's "try/catch with UTC fallback" contract and is defense-in-depth against the Hermes iOS Intl gap documented in 02-RESEARCH.md §Pitfall 4.

### 2. STATIC_FALLBACK path exercise

**Confirmed.** `tests/groups/ianaTimezonePicker.test.tsx` test case #4 ("renders ≥ 400 rows from STATIC_FALLBACK when Intl.supportedValuesOf is undefined (Pitfall 4 defense)") explicitly does:

```ts
delete (Intl as unknown as { supportedValuesOf?: unknown }).supportedValuesOf;
// ... render picker ... assert data.length >= 400
```

This mirrors the Intl-mutation pattern from `tests/intl-supportedvaluesof-probe.test.ts` (plan 01) and `tests/groups/timezones.test.ts` (plan 03). Test passes — 453 entries from STATIC_FALLBACK render when Intl is absent.

### 3. Stack.Screen for groups/new

**Already registered by plan 02-04.** `app/(app)/_layout.tsx:8`:

```tsx
<Stack.Screen name="groups/new" options={{ headerShown: false }} />
```

Not registered via file-based auto-discovery only — explicit entry already exists. Plan 02-05 made **no layout modifications**. Expo Router's file-based routing would also discover `app/(app)/groups/new.tsx` on its own, but the explicit registration (inherited from 02-04) is the source of truth.

### 4. UI-SPEC copy strings verified in the screen

| UI-SPEC reference | String | Present at |
|---|---|---|
| §Copywriting Contract (line 166) screen title | `Start a group` | `new.tsx:130, 142` (nav + hero) |
| §Copywriting Contract (line 166) subtitle | `Three friends, one shared goal. You'll be the admin.` | `new.tsx:143` |
| §Form labels (line 214) | `Group name` | `new.tsx:150` |
| §Form labels (line 214) placeholder | `Morning runners` | `new.tsx:151` |
| §Form labels (line 215) | `What's the daily goal?` | `new.tsx:168` |
| §Form labels (line 215) placeholder | `Post a photo of your run before 9am.` | `new.tsx:169` |
| §Form labels (line 216) | `What do you post?` | `new.tsx:190` |
| §Form labels (line 216) segment | `Photo` | `new.tsx:196` |
| §Form labels (line 216) segment | `Video` | `new.tsx:197` |
| §Form labels (line 217) | `Group timezone` | `new.tsx:210` |
| §Form labels (line 217) helper | `We'll use this for your daily cutoff.` | `new.tsx:245` |
| §CTA labels (line 184) | `Create group` | `new.tsx:254` |
| §Error state copy (line 258) — `invalid_goal` | `Add a bit more detail — at least 5 characters.` | `new.tsx:86` |
| §Error state copy (line 260) — `invalid_name` | `Give your group a name.` | `new.tsx:88` |
| §Error state copy (line 262) — generic / collision | `Couldn't create the group. Try again in a sec.` | `new.tsx:90, 92` |
| §IanaTimezonePicker (line 378) header | `Pick a timezone` | `IanaTimezonePicker.tsx:102` |
| §IanaTimezonePicker (line 378) placeholder | `Search cities or regions` | `IanaTimezonePicker.tsx:113` |
| §Copywriting Contract (line 232) empty-search | `No match. Try another city or region.` | `IanaTimezonePicker.tsx:159` |

(Line numbers above reference the committed file contents at commit `afcbdb1`.)

## Acceptance Criteria (per plan)

### Task 1

- [x] `app/(app)/groups/new.tsx` exists
- [x] File contains `useCreateGroup` import AND call (3 grep hits)
- [x] File contains `zodResolver(createGroupSchema)` (1 grep hit)
- [x] File contains all 5 exact UI-SPEC strings (verified via grep -q)
- [x] `router.replace(` present with `/groups/` path
- [x] `SegmentedControl` imported from components barrel
- [x] `Intl.DateTimeFormat().resolvedOptions().timeZone` wrapped in try/catch
- [x] Char-counter logic: `goalLen` and `${goalLen}/140`
- [x] `setValue('timezone'` via IanaTimezonePicker `onSelect`
- [x] `pnpm typecheck` exits 0

### Task 2

- [x] `src/features/groups/IanaTimezonePicker.tsx` exists and exports `IanaTimezonePicker`
- [x] Contains `listTimezones` AND `labelFor` imports from `./timezones`
- [x] Contains `presentationStyle="pageSheet"`
- [x] Contains exact string `'No match. Try another city or region.'`
- [x] Contains `'Search cities or regions'` placeholder
- [x] `tests/groups/ianaTimezonePicker.test.tsx` exists with 5 cases (≥ 4)
- [x] `tests/groups/createGroupScreen.test.tsx` exists with 4 cases (≥ 4)
- [x] `pnpm test -- tests/groups` — 11 suites, 73 tests green
- [x] `pnpm typecheck` exits 0

## Exported Symbols (for downstream plans)

### `src/features/groups/IanaTimezonePicker.tsx`

- `IanaTimezonePicker(props: IanaTimezonePickerProps)` — named export
- `interface IanaTimezonePickerProps { visible: boolean; initialValue?: string; onSelect: (iana: string) => void; onDismiss: () => void }`

### `app/(app)/groups/new.tsx`

- `default export NewGroupScreen` — default Expo Router page component; no named exports

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Bundled IanaTimezonePicker into Task 1 commit (not Task 2)**

- **Found during:** Task 1 typecheck pre-check
- **Issue:** The plan template for `app/(app)/groups/new.tsx` imports `IanaTimezonePicker` from `../../../src/features/groups/IanaTimezonePicker`. Task 1's acceptance criterion (`pnpm typecheck exits 0`) cannot pass unless that file exists at commit time. The plan's Task 2 RED-gate narrative assumes the picker does not exist yet ("must FAIL to import"), but that contradicts Task 1's typecheck-green requirement.
- **Fix:** Created the real (non-stub) `IanaTimezonePicker.tsx` as part of the Task 1 commit. Task 2 then shipped the dedicated test files. The picker IS still tested by its own dedicated file as the plan specifies — only the commit ordering was tightened. No shortcut: the picker is the full UI-SPEC-compliant implementation (search + FlatList + accessibilityViewIsModal + pageSheet + static-fallback-exercised), not a stub.
- **Files modified:** None (both files were newly created; ordering of *which* commit they landed in changed).
- **Commits:** `afcbdb1` (Task 1 feat — screen + picker), `fc8f02d` (Task 2 test — both test files).
- **Impact on plan intent:** Zero. All Task 2 acceptance criteria still pass. The RED-gate wording in the plan was a tutorial framing, not a build-time requirement; the plan's own verification step only checks final test pass-through.

### No architectural changes (Rule 4)

None needed. Plan was fully specified; all RPCs/shared primitives were pre-shipped by plans 02-01/02-03/02-04.

### No authentication gates

None encountered. `useCreateGroup` uses the supabase client that is auth-gated by the Phase 1 AuthProvider; in the Jest suite the hook is mocked at module level.

## TDD Gate Compliance

Plan frontmatter `type: execute` — plan-level RED/GREEN/REFACTOR gate does NOT apply.

Task 2 is tagged `tdd="true"` at task level. Because the picker source landed in Task 1 (per the Rule 3 deviation above), the Task 2 RED gate (tests fail-to-import) collapsed: when I ran the tests for the first time, they GREENed immediately on the first-authored source. This matches plan 03/04's documented TDD-shape hygiene note — future phases wanting strict RED/GREEN commit separation should flip the plan frontmatter to `type: tdd`. Task 2 was still committed as a `test(...)` commit (per commit-protocol §3) since the diff is test-only.

## Issues Encountered

- **Worktree `.claude/` path Jest filter:** Same as plans 03/04 — because this worktree lives under `.claude/worktrees/`, Jest's default `testPathIgnorePatterns: /.claude/` filters out every test. Worked around by overriding `--testPathIgnorePatterns='/node_modules/|/.expo/|/dist/|/supabase/'` on each scoped run. Did NOT modify `jest.config.js` (the main-branch CI path doesn't live under `.claude/`). Already logged in `deferred-items.md` from plan 01.
- **`act()` warnings from `@expo/vector-icons`:** Same non-failing cosmetic warning pattern flagged in plan 02-04 — Feather `Icon` loads fonts asynchronously and fires a late `setState`. Tests all pass; warnings are noise. Already logged in `deferred-items.md` from plan 04.
- **Jest worker force-exit:** Same inherited `renderHook`/async-timer leak flagged since plan 01. Noise only.

## User Setup Required

None — no external service configuration. The create-group flow can be smoke-tested on a device/simulator with a signed-in Supabase session (established by Phase 1) once plan 07 wires the kebab-menu navigation to `/groups/new`.

## Known Stubs

None. Every field is wired to its real Zod schema + real `useCreateGroup` RPC hook. The picker renders real IANA entries (Intl-preferred, STATIC_FALLBACK-defended). No placeholder data paths.

## Threat Flags

None. All surface this plan introduces (form fields → `create_group` RPC; Intl probe → picker list) is already covered by the plan's `<threat_model>`:

- T-02-CREATE-GROUP-SPOOF (mitigate): server RPC validates name/goal/submission_type/timezone independently of client Zod — Zod is UX, not authority.
- T-02-TZ-FALLBACK-BLANK (mitigate): `listTimezones()` fallback exercised by `ianaTimezonePicker.test.tsx` case #4.

No new network endpoints, auth paths, file access, or schema changes at trust boundaries introduced.

## Self-Check: PASSED

Files created — verified present on disk:

- `app/(app)/groups/new.tsx` — FOUND
- `src/features/groups/IanaTimezonePicker.tsx` — FOUND
- `tests/groups/createGroupScreen.test.tsx` — FOUND
- `tests/groups/ianaTimezonePicker.test.tsx` — FOUND

Commits in git log:

- `afcbdb1` (Task 1: screen + picker) — FOUND
- `fc8f02d` (Task 2: integration tests) — FOUND

Verified test counts (scoped to tests/groups):
- `tests/groups/ianaTimezonePicker.test.tsx` — 5 passing
- `tests/groups/createGroupScreen.test.tsx` — 4 passing
- Entire `tests/groups/` — 11 suites, 73 passing

Verified typecheck: `npx tsc --noEmit` exits 0.

---

*Phase: 02-groups-invites*
*Plan: 05*
*Completed: 2026-04-24*
