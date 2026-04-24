---
phase: 2
slug: groups-invites
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (`jest-expo` preset) for RN/TS + pgTAP (`supabase test db`) for SQL — both wired in P1 |
| **Config file** | `jest.config.js` + `jest.setup.ts` (RN); `supabase/tests/*.sql` for pgTAP |
| **Quick run command** | `pnpm test` (Jest only) |
| **Full suite command** | `pnpm test:all` (= `jest && supabase test db`) |
| **Estimated runtime** | ~60 seconds (Jest ≤10s per file; pgTAP full suite ≤30s) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- <related-file>` (< 10s)
- **After every plan wave:** Run `pnpm test:all` (< 60s)
- **Before `/gsd-verify-work`:** Full suite must be green + `pnpm typecheck` green + manual iOS walkthrough (Android deferred per P1 precedent)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | 01 | 0 | REQ-meta | — | Deps + Jest mocks present before any code lands | setup | `pnpm install && pnpm test` | ❌ W0 | ⬜ pending |
| — | 02 | 1 | GRP-01, GRP-02 | T-02-INV-ENUM, T-02-SQL-INJ | `create_group` atomically inserts group + admin member + first invite | pgTAP | `supabase test db` → `create_group.sql` | ❌ W0 | ⬜ pending |
| — | 02 | 1 | GRP-01 | — | `generate_invite_code()` returns 8-char ambiguity-stripped uppercase | pgTAP | `create_group.sql` / `generate_invite_code.sql` | ❌ W0 | ⬜ pending |
| — | 02 | 1 | GRP-05 | T-02-ADMIN-LEAVE | `leave_group` member DELETE succeeds; admin rejected with `admin_cannot_leave` | pgTAP | `leave_group.sql` | ❌ W0 | ⬜ pending |
| — | 02 | 1 | GRP-05 | — | `transfer_admin` leaves exactly one admin; callable only by current admin | pgTAP | `transfer_admin.sql` | ❌ W0 | ⬜ pending |
| — | 02 | 1 | GRP-05 | — | `delete_group` cascades members + submissions + invites; admin-only | pgTAP | `delete_group.sql` | ❌ W0 | ⬜ pending |
| — | 02 | 1 | INV-01 | — | `regenerate_invite` closes prior active row, inserts new one, admin-only | pgTAP | `regenerate_invite.sql` | ❌ W0 | ⬜ pending |
| — | 02 | 1 | INV-02 | T-02-INV-REPLAY, T-02-PREVIEW-LEAK | `redeem_invite` happy path + `invite_expired` / `invite_already_used` / `invite_not_found` / `already_member` errors | pgTAP | `redeem_invite.sql` | ❌ W0 | ⬜ pending |
| — | 02 | 1 | INV-02 | T-02-PREVIEW-LEAK | `get_invite_preview` callable by anon role; uniform response (never leaks expired/used state) | pgTAP | `get_invite_preview.sql` | ❌ W0 | ⬜ pending |
| — | 02 | 1 | INV-03 | T-02-CAP-RACE | `redeem_invite` rejects `group_full` at 10; `FOR UPDATE` lock present in function body | pgTAP (structural + behavioral) | `redeem_invite.sql` | ❌ W0 | ⬜ pending |
| — | 02 | 1 | INV-02 | — | Placeholder policy `invites_mark_used_as_self` dropped — redemption is RPC-only | pgTAP (absence assertion) | `invites_policies.sql` | ❌ W0 | ⬜ pending |
| — | 03 | 2 | GRP-01 | — | Zod schemas for create-group and join-code validate per D-17 (5–140 chars, segmented type, IANA tz) | unit (Jest) | `pnpm test -- groups/schemas.test.ts` | ❌ W0 | ⬜ pending |
| — | 03 | 2 | INV-02 | — | `formatInviteCode` strips non-alphanum, uppercases, inserts 4-char dash | unit (Jest) | `pnpm test -- groups/formatInviteCode.test.ts` | ❌ W0 | ⬜ pending |
| — | 04 | 2 | GRP-03 | — | `useGroupsList()` returns only groups the user is a member of | unit + RLS | `pnpm test -- groups/useGroupsList.test.ts` + `groups_list_rls.sql` | ❌ W0 | ⬜ pending |
| — | 04 | 2 | GRP-04 | — | Group-detail screen renders header + members + admin panel; non-member blocked by RLS | integration (RN Testing Library) + existing P1 pgTAP | `pnpm test -- groups/detail.test.tsx` | ❌ W0 | ⬜ pending |
| — | 05 | 2 | GRP-01 | — | Create-group screen submits via RPC, routes to detail, shows post-create banner (D-18) | integration (RN Testing Library) | `pnpm test -- groups/new.test.tsx` | ❌ W0 | ⬜ pending |
| — | 05 | 2 | GRP-01 | — | Timezone picker: static-fallback branch renders + search filters (Hermes iOS `Intl.supportedValuesOf` gap) | integration (Jest) | `pnpm test -- groups/timezonePicker.test.tsx` | ❌ W0 | ⬜ pending |
| — | 06 | 2 | INV-02 | T-02-INV-REPLAY | Deep-link auth detour: SecureStore round-trip + post-auth replay routes to `/invite/{code}` | integration (Jest + SecureStore mock) | `pnpm test -- groups/pendingInviteReplay.test.tsx` | ❌ W0 | ⬜ pending |
| — | 06 | 2 | INV-02 | — | Code-entry screen accepts `ABCD-EF12` and raw `ABCDEF12`; surfaces typed RPC errors | integration (Jest) | `pnpm test -- groups/join.test.tsx` | ❌ W0 | ⬜ pending |
| — | 07 | 3 | all | — | Schema push applied (`supabase db push`) before `pnpm types:gen` + full suite | manual + CLI | `supabase db push && pnpm types:gen` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/tests/create_group.sql` — pgTAP for GRP-01 + GRP-02 + code-gen collision path
- [ ] `supabase/tests/redeem_invite.sql` — INV-02 + INV-03 (expired/used/not-found/already-member/group-full + `FOR UPDATE` lock assertion)
- [ ] `supabase/tests/get_invite_preview.sql` — INV-02 unauth path + uniform-response assertions
- [ ] `supabase/tests/leave_group.sql` — GRP-05 (member ok, admin rejected)
- [ ] `supabase/tests/transfer_admin.sql` — exactly one admin after success invariant
- [ ] `supabase/tests/delete_group.sql` — cascade behavior (members + submissions + invites)
- [ ] `supabase/tests/regenerate_invite.sql` — INV-01 prior-row close + new-row insert
- [ ] `supabase/tests/invites_policies.sql` — placeholder `invites_mark_used_as_self` absent
- [ ] `tests/groups/schemas.test.ts` — Zod schema unit tests (create-group + join-code)
- [ ] `tests/groups/formatInviteCode.test.ts` — code-format utility tests
- [ ] `tests/groups/new.test.tsx` — create-group screen integration
- [ ] `tests/groups/detail.test.tsx` — group-detail screen integration
- [ ] `tests/groups/pendingInviteReplay.test.tsx` — SecureStore detour flow
- [ ] `tests/groups/useGroupsList.test.ts` — hook unit test
- [ ] `tests/groups/timezonePicker.test.tsx` — picker fallback + search
- [ ] `tests/groups/join.test.tsx` — code-entry screen integration
- [ ] `jest.setup.ts` mock additions: `expo-clipboard`, `expo-haptics`, conditional mock for `Intl.supportedValuesOf`
- [ ] `npx expo install expo-clipboard expo-haptics` (+ optional `expo-localization`)
- [ ] After `0004` migration applies: `pnpm types:gen` and commit updated `src/types/database.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native share sheet copy renders per D-19 | INV-01 | React Native `Share.share` opens OS-level sheet; cannot be rendered in Jest | iOS dev build: group detail → tap "Share code" → verify sheet shows pre-formatted message + code + `accountibuzz://invite/...` link |
| Custom-scheme deep link opens the app on a physical iOS device | INV-02 | OS-level link routing cannot be exercised in Jest | iOS dev build installed → tap `accountibuzz://invite/ABCDEF12` from Notes app → verify app opens on invite screen (or auth detour) |
| iOS walkthrough of full happy path | all | RN Testing Library covers logic; visual polish and gesture correctness need eyes | Create group → share code → second device enters code → member appears; admin regenerates → old code rejected; member leaves → disappears from list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
