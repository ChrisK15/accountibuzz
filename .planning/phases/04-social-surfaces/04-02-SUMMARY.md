---
phase: 04
plan: 02
subsystem: db-server-contract
tags: [migration, trigger, rpc, realtime, leaderboard, feed]
status: complete
dependency-graph:
  requires:
    - "0001_foundation.sql (group_members counter columns + trigger STUB + group_members_leaderboard_idx)"
    - "0003_phase1_review_fixes_2.sql (admin-immutable trigger pattern; idempotency basis for D-03)"
    - "20260429173246_phase3_capture_review.sql (RPC shape, typed errors, revoke/grant patterns)"
    - "20260506165538_phase3_realtime_publication.sql (idempotent publication-add idiom)"
  provides:
    - "Race-safe handle_submission_approval body (PTS-01..03 server contract)"
    - "group_members_counter_immutable trigger (D-19 defense-in-depth)"
    - "get_pending_today RPC (FEED-02)"
    - "get_missed_yesterday RPC (FEED-03)"
    - "get_today_posted_count RPC (D-13 Today GroupCard signal)"
    - "get_group_leaderboard RPC (LB-01 read path with deterministic tiebreaker)"
    - "supabase_realtime publication includes group_members (CGF-1, LB-02 prerequisite)"
    - "submissions replica identity FULL (CGF-2 / HIGH #2, payload.old completeness)"
  affects:
    - "04-03 hooks (Wave 2) compile against regenerated src/types/database.ts after Task 3 push"
    - "04-04 components (Wave 2) render rows produced by these RPCs"
    - "04-05 group-detail (Wave 3) wires the RPCs and Realtime channels"
    - "04-06 today-screen (Wave 3) wires get_today_posted_count + leaderboard + per-card Realtime"
    - "04-07 phase verification (Wave 4) consumes pgTAP output that flips RED→GREEN after Task 2"
tech-stack:
  added: []
  patterns:
    - "Race-safe single-locked-row UPDATE with CASE expression (HIGH #1 fix)"
    - "REPLICA IDENTITY FULL for Realtime payload.old fidelity (HIGH #2 fix)"
    - "pg_trigger_depth() > 1 bypass for definer-trigger path (D-19 cleaner than auth.uid() IS NULL)"
    - "Strict revoke-from-public + grant-to-authenticated on every SECURITY DEFINER RPC"
    - "Deterministic ORDER BY tiebreaker (joined_at ASC) on leaderboard ranking"
key-files:
  created:
    - supabase/migrations/20260508233129_phase4_points_streaks_feed.sql
  modified: []
decisions:
  - "Single locked-row UPDATE with CASE replaces the SELECT-then-UPDATE form from 04-RESEARCH.md §Code Examples lines 681-713 (HIGH #1)"
  - "Belt-and-suspenders gating of points increment on the same recurrence-branch CASE that gates streak math (HIGH #12)"
  - "pg_trigger_depth() > 1 bypass chosen over auth.uid() IS NULL because definer-trigger path runs in the calling admin's JWT context"
  - "joined_at ASC tiebreaker over display_name ASC because joined_at is immutable and display_name can change"
metrics:
  duration: in-progress (Task 1 of 3 complete)
  completed: 2026-05-08
---

# Phase 4 Plan 02: Migration 0008 (server contract) Summary

Race-safe single-UPDATE streak trigger + REPLICA IDENTITY FULL + 4 SECURITY DEFINER RPCs in one append-only migration, with the publication-add and replica-identity gates that LB-02 / FEED-01 Realtime depend on. Migration apply (Task 2) is a [BLOCKING] human-verify checkpoint — execution paused awaiting human reviewer to push the migration to the linked Supabase project.

## Status: COMPLETE (2026-05-08)

All 3 tasks done. Task 2's blocking checkpoint resolved when the user attempted `supabase db push` and hit a pre-existing migration-history mismatch with two Phase 3 MCP-applied migrations. User chose to apply 0008 via Supabase MCP (same pattern Phase 3 used). Task 3 (types regen + typecheck) ran inline after migration was applied. pgTAP CLI run is deferred to plan 04-07 alongside the filename normalization fix that will repair the history.

## Tasks Completed

### Task 1 — Write `20260508233129_phase4_points_streaks_feed.sql`

**Status:** DONE
**Commit:** `4e96b8f` — `feat(04-02): write migration 0008 (race-safe trigger + replica identity full + 4 RPCs)`

**Acceptance gates (all satisfied):**

| Gate | Check | Result |
|------|-------|--------|
| File exists | `test -f supabase/migrations/20260508233129_phase4_points_streaks_feed.sql` | OK |
| CGF-1 publication | `grep -c "alter publication supabase_realtime add table public.group_members"` | 1 |
| CGF-2 / HIGH #2 replica identity | `grep -c "alter table public.submissions replica identity full"` | 1 |
| Section ordering | publication (line 79) → replica identity (line 91) → trigger function (line 121) | OK |
| Trigger body present | `grep -c "create or replace function public.handle_submission_approval"` | 1 |
| HIGH #1 race-safe (no SELECT-into-v_new_streak) | `grep -cE "^\s*select\s+.*\s+into\s+v_new_streak"` | 0 |
| HIGH #1 CASE branches | `grep -cE "case$\|when last_rolled_date is null"` | 8 (≥4 required) |
| HIGH #12 same-day no-points | `grep -c "points = points + case"` | 1 |
| pg_trigger_depth() bypass | `grep -c "pg_trigger_depth()"` | 4 |
| group_members_counter_immutable | `grep -c "create or replace function public.group_members_counter_immutable"` | 1 |
| 4 RPCs present | get_pending_today / get_missed_yesterday / get_today_posted_count / get_group_leaderboard | 1 each |
| HIGH #6 strict-grant | revoke + grant on get_today_posted_count | 1 each |
| Total revoke/grant pairs | ≥4 each | 4 each |
| errcode 'P0001' | ≥7 | 8 |
| MEDIUM tiebreaker | `grep -cE "joined_at\s+asc"` | 1 |
| Non-comment line count | sanity ≥100 | 251 |

### Task 2 — Apply migration (CHECKPOINT RESOLVED 2026-05-08)

**Status:** DONE — applied via Supabase MCP `apply_migration` (orchestrator inline; user-approved path)

**What happened:** The user attempted `supabase db push` from a configured terminal, but the CLI rejected it because the remote migration history contains two MCP-applied migrations from Phase 3 (`20260429173246_phase3_capture_review`, `20260506165538_phase3_realtime_publication`) that have no corresponding local files (local has the same SQL under `20260429173246_phase3_capture_review.sql` / `20260506165538_phase3_realtime_publication.sql`). The CLI's suggestion to `supabase migration repair --status reverted` would have produced fictional history (the schema changes ARE on remote). User chose Option A from the orchestrator's checkpoint prompt: apply 0008 via Supabase MCP — same pattern Phase 3 used for those two earlier migrations. Filename normalization (renaming local files to match remote timestamp version IDs) is deferred to plan 04-07 closeout as a follow-up.

**Migration applied:** `20260508233129_phase4_points_streaks_feed` (registered on remote `baatomkgtgkrnapisoej` via `mcp__plugin_supabase_supabase__apply_migration`).

**Direct schema verification (in lieu of pgTAP CLI):**

| Check | Result |
|-------|--------|
| `pg_publication_tables` includes `public.group_members` under `supabase_realtime` | ✓ true |
| `pg_publication_tables` includes `public.submissions` under `supabase_realtime` | ✓ true (preserved from 0007) |
| `submissions.relreplident` | ✓ `f` (FULL) |
| `pg_proc` has `get_pending_today` | ✓ true |
| `pg_proc` has `get_missed_yesterday` | ✓ true |
| `pg_proc` has `get_today_posted_count` | ✓ true |
| `pg_proc` has `get_group_leaderboard` | ✓ true |
| `pg_trigger` has `group_members_counter_immutable_trigger` on `group_members` | ✓ true |
| `pg_proc` has `handle_submission_approval` (replaces 0001 stub) | ✓ true |

**pgTAP execution deferred to plan 04-07** (Phase 4 closeout). The 4 new pgTAP files (`handle_submission_approval_streak.sql`, `handle_submission_approval_idempotency.sql`, `phase4_rpc_permissions.sql`, `phase4_rpc_correctness.sql`) cannot run via `supabase test db` until the migration-history mismatch is repaired (filename normalization). Schema state has been verified directly via `mcp__plugin_supabase_supabase__execute_sql`; pgTAP will run in 04-07 as part of the full automated suite gate.

### Task 3 — `pnpm types:gen` + `pnpm typecheck` + commit `src/types/database.ts`

**Status:** DONE — types regenerated via Supabase MCP `generate_typescript_types`, merged into existing `src/types/database.ts`, project-source typecheck green.

**Commit:** `819ad28` — `feat(04-02): regenerate src/types/database.ts with Phase 4 RPCs`

**What changed in `src/types/database.ts`:** 4 new function signatures inserted alphabetically into the `public.Functions` block:
- `get_group_leaderboard` (returns 9-column row with profile fields embedded)
- `get_missed_yesterday` (returns 4-column member-with-profile row)
- `get_pending_today` (returns 4-column member-with-profile row)
- `get_today_posted_count` (returns `number`)

The `graphql_public` and `storage` schemas were preserved (matches Phase 3's 03-02 merge pattern). No other public-schema definitions changed (group_members, submissions, etc. retain their 0001 shapes).

**Typecheck:** `pnpm typecheck` reports 0 errors in project source (`src/`, `app/`, `tests/`, `jest.setup.ts`). Pre-existing failures in untracked `design_refs/design_code_for_claude/` (Lovable mockup; not project source) are unchanged.

## Verification Snapshots

| Check | Status |
|-------|--------|
| Schema state (publications + replica identity + RPCs + triggers) | ✓ all 9 direct checks pass |
| `pnpm typecheck` (project source) | ✓ 0 errors |
| Migration registered on remote | ✓ `20260508233129_phase4_points_streaks_feed` |
| pgTAP `supabase test db` | DEFERRED to 04-07 (CLI blocked by migration-history mismatch — fix during closeout) |

These cannot be run from this worktree until the human reviewer applies the migration.

## Deviations from Plan

None during Task 1. Migration body matches the plan section-by-section, with all REVIEWS replan 2026-05-08 fixes integrated:
- HIGH #1 race-safe trigger (single locked-row UPDATE with CASE)
- HIGH #2 replica identity FULL on submissions
- HIGH #6 strict-grant on get_today_posted_count
- HIGH #12 same-day no-points belt-and-suspenders gating
- MEDIUM joined_at ASC tiebreaker on get_group_leaderboard

## Race-Safe Trigger Pattern (for future maintainers)

The trigger body uses a SINGLE locked-row UPDATE with a CASE expression. Do NOT refactor back to the SELECT-then-UPDATE form shown in 04-RESEARCH.md §"Code Examples > Migration shape" lines 681-713 — that form has a read-modify-write window where two concurrent admin approvals on different days for the same `(group_id, user_id)` can both compute their `v_new_streak` from the same stale `last_rolled_date` before either takes a row lock, producing incorrect streak math.

The CASE-driven single UPDATE form takes the row lock during the UPDATE itself; both branches' computation reads from the locked snapshot, so concurrent approvals serialize correctly under Postgres MVCC.

Why points use the same CASE: HIGH #12 belt-and-suspenders. Even though `uq_submissions_user_group_local_date` makes same-day trigger fires structurally impossible, gating `points = points + case ... else 0 end` on the recurrence branch ensures that if the constraint is ever relaxed (e.g. for a re-submission feature in P5+), points won't double-count.

## Self-Check: PASSED

**Files claimed to exist:**
- `supabase/migrations/20260508233129_phase4_points_streaks_feed.sql` — FOUND
- `.planning/phases/04-social-surfaces/04-02-SUMMARY.md` — this file
- `src/types/database.ts` — regenerated, 4 new RPCs typed

**Commits claimed:**
- `4e96b8f` (Task 1 migration) — verified via `git log --oneline`
- `819ad28` (Task 3 types regen) — verified via `git log --oneline`

**Schema verification:** all 9 direct schema checks against remote `baatomkgtgkrnapisoej` pass.

**Deferred to 04-07 closeout:** filename normalization (rename local 0006/0007/0008 to match remote timestamp version IDs so future `supabase db push` works) + pgTAP CLI run (currently blocked by the same history mismatch).

## Manual Follow-Ups

- **JIRA process per CLAUDE.md:** Atlassian MCP not invoked from this worktree. The continuation agent (or a manual follow-up) needs to:
  - Identify the SCRUM stories under the Phase 4 epic at comp586.atlassian.net matching requirements `[PTS-01, PTS-02, PTS-03, LB-01, LB-02, FEED-01, FEED-02, FEED-03]`
  - Move each from "To Do" → "In Progress" (first commit transition)
  - Log time spent (Task 1 took roughly 30 minutes — context loading + migration drafting + acceptance gate verification; round to 30 min)
  - Final transition (In Progress → In Review) belongs on the closing commit, after Task 3 lands
