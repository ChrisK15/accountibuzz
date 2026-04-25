---
phase: 02-groups-invites
fixed_at: 2026-04-24T00:00:00Z
review_path: .planning/phases/02-groups-invites/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-04-24
**Source review:** .planning/phases/02-groups-invites/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (0 Critical + 5 Warning; Info skipped per scope)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: Stale avatar URLs on group-detail member rows (no cache buster)

**Files modified:** `src/features/groups/useGroupMembers.ts`, `app/(app)/groups/[id]/index.tsx`
**Commit:** b3bef49
**Applied fix:** Added `profiles.updated_at` to the member-list SELECT (typed on `MemberRow`), then updated `avatarUrlFor()` to accept an `updatedAt` arg and append `?v={encodeURIComponent(updatedAt)}` when present. Threaded `member.updated_at` through both call sites — the main member-list `MemberRowItem` (line 657) and the `TransferPickerList` (line 744). Now consistent with the pattern used in `app/(app)/index.tsx` and `app/(app)/profile.tsx` for busting expo-image's on-device cache after an avatar upload to the stable `{userId}/avatar.jpg` path.

### WR-02: Deep-link codes containing dashes return "Invite not found"

**Files modified:** `app/invite/[code].tsx`
**Commit:** a21dca0
**Applied fix:** Imported `normalizeInviteCode` from `src/features/groups/formatInviteCode` and routed the raw route param through it (replacing the direct `.toUpperCase()` call). `normalizeInviteCode` already strips dashes/whitespace and uppercases to the 31-char ambiguity-stripped alphabet, so `accountibuzz://invite/ABCD-EF12` and `accountibuzz://invite/ABCDEF12` are now symmetric. Matches the join-screen behavior for dashed pastes.

### WR-03: Possible RHF crash if `profile.display_name` is null at edit-mode entry

**Files modified:** `app/(app)/profile.tsx`
**Commit:** 9016ee3
**Applied fix:** Mirrored the `?? ''` guard from `defaultValues` onto the `values` prop (`profile.display_name ?? ''`). Updated the onboarding gate from `profile.display_name === ''` to `!profile.display_name` so a null display_name also routes through onboarding instead of landing in edit mode with broken Zod validation.

**Note — requires human verification:** Per the auto-generated `database.ts`, `profiles.display_name` is typed `string` (not nullable), and the SQL column is `text not null default ''`. The null case should not occur in practice. The fix is defensive per the review guidance; no functional regression expected since `profile.display_name ?? ''` == `profile.display_name` when the value is a non-null string. The onboarding-gate change from `=== ''` to `!profile.display_name` is equivalent for the empty-string case (`!'' === true`) and additionally handles null.

### WR-04: Member list rendering order is non-deterministic

**Files modified:** `src/features/groups/useGroupMembers.ts`
**Commit:** 583cf01
**Applied fix:** Added explicit `.order('role', { ascending: false })` (puts admin before member — 'admin' > 'member' alphabetically) followed by `.order('joined_at', { ascending: true })` as the stable secondary key. Included `joined_at` in the SELECT and exposed it on the `MemberRow` interface for downstream consumers. The TransferPickerList (`app/(app)/groups/[id]/index.tsx:739`) inherits this stable order since it filters the same array.

### WR-05: Native `Alert.alert` with 4 options is unreliable on iOS for the admin kebab

**Files modified:** `app/(app)/groups/[id]/index.tsx`, `app/(app)/index.tsx`
**Commit:** cd23d27
**Applied fix:** Replaced `Alert.alert(...)` kebab menus with a platform-split implementation:
- **iOS:** `ActionSheetIOS.showActionSheetWithOptions` with proper `cancelButtonIndex` + `destructiveButtonIndex` (HIG-compliant for >2 actions).
- **Android:** A new `KebabSheetAndroid` bottom-sheet component (uses `RNModal` with a scrim + list of pressable rows) — avoids the RN `Alert.alert` 3-button limit and per-OEM-skin quirks where the 4th button is silently dropped.

Destructive choices (`Delete group`, `Leave group`) use `t.colors.destructive` on Android to preserve the visual hierarchy. The kebab modal states (`kebab-admin-android`, `kebab-member-android`) are added to `ModalKind` on the detail screen; the list screen uses a local `kebabOpen` boolean. `Alert` import removed from `app/(app)/index.tsx` (no longer used); retained on the detail screen since error-popup `Alert.alert` calls remain.

---

_Fixed: 2026-04-24_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
