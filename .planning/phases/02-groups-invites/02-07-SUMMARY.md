---
phase: 02
plan: 07
status: complete
completed: 2026-04-24
tasks_completed: 2
tasks_total: 2
---

# Plan 02-07 Summary — Phase 2 Closure Gate

Final checkpoint before `/gsd-verify-work`. Both tasks (automated gate + manual iOS UAT) closed green; phase ready for verification.

---

## Task 1 — Automated gate (final results)

| Check | Command | Result | Notes |
|-------|---------|--------|-------|
| Typecheck | `pnpm typecheck` | ✅ exit 0 | clean tsc |
| Jest | `pnpm test` | ✅ exit 0 | 25 suites / 120 tests |
| pgTAP | `supabase test db` | ✅ exit 0 | 12 files / 56 tests (P1: 3, P2: 8 + 1 added during UAT) |
| expo-doctor | `npx expo-doctor` | ✅ exit 0 | 18/18 checks pass after dep alignment |
| RLS probe | local SQL via docker | ✅ pass | 0 public tables without RLS, 0 without policies, storage.objects RLS on |

**Pre-existing blockers cleared during gate:**
- `design_refs/design_ref_code_from_lovable/` (untracked Vitest reference code) was breaking `pnpm typecheck` and `pnpm test`. Deleted only that subfolder; design PNGs and `token_values.docx` preserved.
- `expo-doctor` 5 issues (4 version mismatches + missing `expo-constants` peer dep) — fixed via `npx expo install --fix` + `npx expo install expo-constants`. Committed as `15ae9e9 chore(02-07): align deps with SDK 55 + install expo-constants peer dep`.

**Deferred to Phase 6 (logged in `deferred-items.md`):**
- Android prebuild warnings (`edgeToEdgeEnabled` removal + `expo-system-ui` install). Android UAT remains deferred per Phase 1 precedent.

---

## Task 2 — Manual iOS UAT (11 checkpoints)

**Device:** iPhone 17 Pro (iOS 26.4 simulator). **Build:** `npx expo prebuild --clean` + `npx expo run:ios --device` after `sudo xcodebuild -runFirstLaunch` and Xcode platform install (one-time setup).

| # | Checkpoint | Verdict | Closes |
|---|---|---|---|
| A | Empty-state home | ✅ Approved | GRP-03 |
| B | Create group + timezone picker | ✅ Approved | GRP-01, GRP-02 |
| C | Admin invite panel + share-sheet | ✅ Approved | INV-01 |
| D | Deep-link redemption (authed admin) | ✅ Approved (after fixes) | INV-02 |
| E | Regenerate invite | ✅ Approved | INV-01 |
| F | Second-user join flow | ✅ Approved | GRP-03, INV-02, INV-03 |
| G | Members list (avatars + ADMIN badge) | ✅ Approved (after fixes) | GRP-04 |
| H | Member leave | ✅ Approved | GRP-05 |
| I | Admin-leave branching | ✅ Approved (after cache fix) | GRP-05 + D-10 |
| J | Deep-link unauth path + replay | ✅ Approved | INV-02 |
| K | 10-member cap | ✅ Auto-approved (pgTAP coverage in `redeem_invite.sql`) | INV-03 |

---

## Bugs caught during UAT and fixed inline

Each bug was a real Phase 2 lane gap that the planned tests didn't catch (mostly because test mocks short-circuited the auth-gate / RLS / cache-cross-session paths). All fixes ship in this phase.

1. **`cbe4164` Post-auth gate redirected to `/(app)/profile` instead of `/(app)/`.** Phase 1 hardcoded the redirect target when profile was the only signed-in route; Phase 2 added the home but never updated the gate. Updated `app/_layout.tsx`, `app/(auth)/reset-password.tsx`, and a stale comment in `app/(auth)/signup.tsx`.

2. **`9370cb9` Auth gate redirected away from `/invite/[code]` for both unauthed and authed users.** The deep-link landing intentionally lives outside `(auth)` and `(app)` to render for both cases, but `useProtectedRoute` had no exemption. Added `onInviteLanding = segments[0] === 'invite'` and applied it to both redirect branches.

3. **`bbb3bf1` "Ready to join?" branch had no escape hatch.** Authed users testing the deep-link with their own group's code had no way to back out. Added a "Not now" `GhostButton` routing to `/(app)/`.

4. **Migration `0005_profiles_select_co_member.sql` (149a824 + commit predecessor).** P1's `profiles_select_own` RLS blocked cross-user reads, so `useGroupMembers`'s embedded select returned null profile rows for other members → "Unnamed" + "U" initials. Added a co-member visibility policy and matching pgTAP test (4 cases). Pushed to remote; 12 pgTAP files / 56 tests pass locally.

5. **`149a824` Avatar `imageUri` not wired in group-detail member rows.** The `Avatar` component supports `imageUri` and renders a real image when present, but `MemberRowItem` and `TransferAdminPicker` were passing only `name`. Built the public URL via `supabase.storage.from('avatars').getPublicUrl(path)` (matching the pattern in `app/(app)/index.tsx` and `app/(app)/profile.tsx`).

6. **`b1a34f3` React Query cache leaked across user sessions.** `queryClient` is module-scoped, so signing out + back in as a different user served the previous user's cached data within `staleTime`. Caught when funny guy signed in after Chris K2 left a group and saw an empty list. Added `queryClient.clear()` to the existing `SIGNED_OUT` branch in `AuthProvider.tsx`.

7. **`d71e955` Profile screen had no back button.** P1 made profile the post-auth landing, so it never needed one; P2 demoted it to a sub-route reachable from the home avatar shortcut, but the back button was never added. Added a chevron-left `Pressable` to view-mode header routing to `/(app)/`.

---

## Test counts (final)

- **Jest:** 120 passing across 25 suites, 0 skipped
- **pgTAP:** 56 passing across 12 files (P1: `profiles_rls`, `profiles_trigger`, `rls_helpers` / P2: `create_group`, `redeem_invite`, `get_invite_preview`, `leave_group`, `transfer_admin`, `delete_group`, `regenerate_invite`, `invites_policies` + new `profiles_select_co_member`)
- **Typecheck:** clean
- **expo-doctor:** 18/18 checks pass

## Migrations on remote

```
0001 0002 0003 0004 0005 — all on Local + Remote
```

## Final Phase 2 status

**Ready for `/gsd-verify-work`** — all binding success criteria from ROADMAP.md §Phase 2 exercised end-to-end on iOS dev build; automated gate green; remote DB schema in lockstep with local.
