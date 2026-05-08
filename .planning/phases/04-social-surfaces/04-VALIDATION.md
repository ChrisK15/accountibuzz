---
phase: 4
slug: social-surfaces
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `jest@^29.7.0` (RN component + hook tests) + `pgTAP` via `supabase test db` (DB layer) |
| **Config file** | `package.json` `scripts.test` and `scripts.test:all`; `supabase/tests/*.sql` |
| **Quick run command** | `pnpm test --findRelatedTests <files>` |
| **Full suite command** | `pnpm test:all` (`jest && supabase test db`) |
| **Estimated runtime** | ~30s Jest + ~10s pgTAP |

---

## Sampling Rate

- **After every task commit:** `pnpm test --findRelatedTests <changed-files>` + `pnpm typecheck`
- **After migration commit:** `supabase test db` + `pnpm types:gen` + `pnpm typecheck`
- **After every plan wave:** `pnpm test:all` + `pnpm typecheck` + `expo-doctor`
- **Before `/gsd-verify-work`:** Full suite must be green + manual UAT walkthrough (2-device LB-02 mirror of P3 CK-5)
- **Max feedback latency:** ~40 seconds (Jest + pgTAP combined)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-02-XX | 02 | 1 | PTS-01, PTS-02, PTS-03 | T-04-01 | Trigger body credits points + streak only on `null → approved` transition | pgTAP unit (4 branches) | `supabase test db` | ❌ W0 (`supabase/tests/handle_submission_approval_streak.sql`) | ⬜ pending |
| 04-02-XX | 02 | 1 | PTS-01, PTS-03 | T-04-02 | Re-approval cannot double-credit (D-03 idempotency) | pgTAP unit | `supabase test db` | ❌ W0 (`supabase/tests/handle_submission_approval_idempotency.sql`) | ⬜ pending |
| 04-02-XX | 02 | 1 | FEED-02, FEED-03 | T-04-03 | RPCs deny non-members + return `not_authenticated` for anon | pgTAP permissions | `supabase test db` | ❌ W0 (`supabase/tests/phase4_rpc_permissions.sql`) | ⬜ pending |
| 04-02-XX | 02 | 1 | FEED-02, FEED-03, PTS-03 | T-04-04 | RPC return sets correct under DST + cross-tz groups | pgTAP correctness | `supabase test db` | ❌ W0 (`supabase/tests/phase4_rpc_correctness.sql`) | ⬜ pending |
| 04-03-XX | 03 | 2 | LB-01 | — | Leaderboard hook returns rows ordered by points desc, current_streak desc | Jest hook test | `pnpm test src/features/groups/useGroupLeaderboard.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 2 | LB-02 | — | Realtime channel patches cache via setQueryData on UPDATE | Jest mock-channel | `pnpm test src/features/groups/useGroupLeaderboardRealtime.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 2 | FEED-01 | — | Feed hook returns today's approved submissions only | Jest hook test | `pnpm test src/features/submissions/useGroupFeed.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 2 | FEED-02, FEED-03 | — | Tombstone hooks return today-pending + yesterday-missed sets | Jest hook test | `pnpm test src/features/groups/useGroupTombstones.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-XX | 03 | 2 | LB-01 (Today card) | — | Social-counts hook returns today posted-count | Jest hook test | `pnpm test src/features/groups/useGroupSocialCounts.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Final task IDs assigned by gsd-planner (above are placeholders).*

---

## Wave 0 Requirements

- [ ] `supabase/tests/handle_submission_approval_streak.sql` — D-02 4 branches (NULL / consecutive / gap / same-day no-op), D-01 server-derived `local_date` proof, D-04 `longest_streak` update path
- [ ] `supabase/tests/handle_submission_approval_idempotency.sql` — D-03 (re-fire blocked by WHEN clause + 0003 trigger), Pitfall P4-B concurrency assertion
- [ ] `supabase/tests/phase4_rpc_permissions.sql` — non-member raises `not_member`, anon raises `not_authenticated`
- [ ] `supabase/tests/phase4_rpc_correctness.sql` — `get_pending_today` / `get_missed_yesterday` return sets + DST-edge case in `America/New_York`
- [ ] `src/features/groups/useGroupLeaderboard.test.ts` — Jest hook test (mock supabase)
- [ ] `src/features/groups/useGroupLeaderboardRealtime.test.ts` — Jest mock-channel test
- [ ] `src/features/submissions/useGroupFeed.test.ts` — Jest hook test for feed read
- [ ] `src/features/groups/useGroupTombstones.test.ts` — Jest hook test (today + yesterday variants)
- [ ] `src/features/groups/useGroupSocialCounts.test.ts` — Jest hook test for posted-today count

*4 pgTAP files (parity with 0006's 4) + 5 Jest test files. Existing test infrastructure (jest-expo, supabase CLI for pgTAP) is sufficient — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Leaderboard updates near real-time across two devices | LB-02 | Cross-device Realtime ordering can't be deterministically simulated in CI | Two devices in same group; one approves a submission; assert leaderboard reorders on the other device within ~1s (mirror P3 CK-5) |
| Tombstone visual treatment reads as fact, not judgment | FEED-03 / D-08 | Subjective UX assessment | Open group-detail at start-of-day with at least one member who missed yesterday; assert tombstone row reads quietly (muted gray, no red banner) per UI-SPEC |
| Social-signal line cross-fade vs. instant swap | D-13 (Claude's discretion) | UI feel call | Approve a submission; observe Today GroupCard signal line update; UI-SPEC resolves to "instant swap" — confirm matches |
| group-detail stacked sections render in correct order under ScrollView | D-09 | Layout integration with existing screen | Visual walkthrough — Header → Leaderboard → Today's posts → Still to post → Missed yesterday → Members → Pending review (admin) → Destructive zone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
