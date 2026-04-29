---
phase: 03-capture-admin-review
plan: 02
subsystem: database
tags: [supabase, migration, rpc, pgtap, security-definer, types-regen, tabs-audit]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: submissions table + UNIQUE(group_id,user_id,local_date) + is_group_admin/is_group_member helpers + 0003 admin-immutable trigger
  - phase: 02-groups-invites
    provides: SECURITY DEFINER + p_* arg + typed-error RPC pattern
provides:
  - 4 SECURITY DEFINER RPCs in 0006 migration (submit_today, review_submission, get_pending_review_count, get_pending_review_queue)
  - review_queue_row composite type (admin-only queue return shape)
  - 5 pgTAP test files (4 RPC suites + 0003 trigger backfill)
  - tests/app/tabs-migration.test.ts (D-14 audit sentinel — Plan 03-06 prereq)
affects: [03-03 data layer, 03-05 hooks, 03-06 tabs migration, 03-07 review screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 3 RPC contract: SECURITY DEFINER + set search_path = public + typed errors via raise exception 'X' using errcode = 'P0001'"
    - "Server-derived local_date pattern: (now() AT TIME ZONE groups.timezone)::date — clients NEVER compute date"
    - "Admin-only read-path RPC pattern (per REVIEWS.md C3): SECURITY DEFINER RPC validates is_group_admin BEFORE returning rows; replaces direct table SELECT that relied only on member-read RLS"
    - "Pitfall 9 race guard: SELECT FOR UPDATE in RPC + UPDATE WHERE status='pending' + post-UPDATE not_pending raise"
    - "Threat 7 mitigation: lookup group_id from DB (NOT from client input) before is_group_admin check"

key-files:
  created:
    - supabase/migrations/0006_phase3_capture_review.sql
    - supabase/tests/submit_today.sql
    - supabase/tests/review_submission.sql
    - supabase/tests/get_pending_review_count.sql
    - supabase/tests/get_pending_review_queue.sql
    - supabase/tests/submissions_admin_immutable.sql
  modified: []

key-decisions:
  - "review_queue_row composite type (instead of returns table or returns json) so generated TypeScript types are strongly typed end-to-end after pnpm types:gen"
  - "submissions FK on user_id references public.profiles(id) (NOT public.profiles.user_id) — corrected join in get_pending_review_queue to `left join profiles p on p.id = s.user_id`. The plan PATTERNS text said `p.user_id = s.user_id` which would be wrong against the actual 0001 schema."
  - "9 distinct submission rows seeded in submissions_admin_immutable.sql (one per test case) so each trigger assertion runs against an untouched pending row — avoids state coupling between consecutive UPDATE attempts"

patterns-established:
  - "RPC + composite type pattern: when an admin-only read path needs to be RPC-gated (per REVIEWS.md C3 Mitigation A), define a public.<name>_row composite type for the return shape so types:gen produces a strongly-typed Functions entry"

requirements-completed: []  # See "Status" — checkpoint pending; requirements remain incomplete until Tasks 3-5 ship

# Metrics
duration: ~30min (Tasks 1-2 written; Tasks 3-5 awaiting checkpoint)
completed: 2026-04-29
---

# Phase 03 Plan 02: Capture & Admin Review Server Contract Summary

**Phase 3 server contract drafted: 4 SECURITY DEFINER RPCs (submit + review + queue + count) + 5 pgTAP files (incl. 0003 trigger backfill); awaiting Task 3 schema-push checkpoint.**

## Status

**INCOMPLETE — paused at Task 3 (`checkpoint:human-action`).**

Tasks 1 and 2 are committed. Tasks 3, 4, and 5 require the live remote schema to be pushed via `supabase db push`, which needs `SUPABASE_ACCESS_TOKEN` (or interactive `supabase login`). The worktree agent cannot perform interactive auth flows and the env var is unset. Tasks 4 (types regen + spot-check) and 5 (tabs-migration audit test) depend on Task 3 because:

- Task 4 spot-checks `src/types/database.ts` AFTER `pnpm types:gen` runs against the post-push schema.
- Task 5 (tabs-migration test) is independent of Task 3 BUT a fresh continuation agent should land it together with the regen so all 03-02 artifacts ship in one wave-1 cohort.

## Performance

- **Duration so far:** ~30 min (2026-04-29T01:32–02:02 UTC, planning + 2 task commits)
- **Started:** 2026-04-29T01:32:00Z (approx — worktree spawn)
- **Paused at:** 2026-04-29T02:02:14Z (Task 3 checkpoint)
- **Tasks completed:** 2 of 5
- **Files modified:** 6 (1 migration + 5 pgTAP)

## Accomplishments (so far)

- `supabase/migrations/0006_phase3_capture_review.sql` written with 4 RPCs + 1 composite type, all SECURITY DEFINER + revoke-from-public + grant-to-authenticated; all targeted Pitfalls + Threats addressed in body comments
- 5 pgTAP files written, totaling **51 plan() assertions** across the 4 RPCs + 0003 trigger backfill
- File-level shape verification (grep + count) passed for all 6 artifacts
- Migration is APPEND-ONLY: no edits to 0001..0005, no new tables (CI rls-check.yml passes by construction), no policy drops, no `handle_submission_approval` body change

## Task Commits

1. **Task 1: Write 0006 migration with 4 RPCs + grants** — `50dc2bc` (feat)
2. **Task 2: Write 5 pgTAP test files** — `67005ca` (test)
3. **Task 3: BLOCKING — supabase db push to apply migration + regen types** — *PENDING (human-action checkpoint)*
4. **Task 4: Spot-check src/types/database.ts regeneration + typecheck** — *NOT STARTED (waits on Task 3)*
5. **Task 5: Write tests/app/tabs-migration.test.ts** — *NOT STARTED (cohort with Tasks 3+4 in continuation)*

## Files Created (so far)

- `supabase/migrations/0006_phase3_capture_review.sql` — 4 SECURITY DEFINER RPCs:
  - `submit_today(uuid, text, text, text) returns uuid` — typed errors: not_authenticated, not_member, invalid_media_type, wrong_media_type, caption_too_long, already_submitted_today
  - `review_submission(uuid, text, text) returns void` — typed errors: not_authenticated, invalid_decision, reason_too_long, submission_not_found, not_admin, not_pending
  - `get_pending_review_count(uuid) returns int` — non-admin returns 0 (D-17, no leak)
  - `get_pending_review_queue(uuid) returns setof public.review_queue_row` (PER REVIEWS.md C3) — typed errors: not_authenticated, not_admin
  - + 1 composite type `public.review_queue_row` (id / user_id / caption / media_path / media_type / created_at / display_name / avatar_path / profile_updated_at)
- `supabase/tests/submit_today.sql` — 11 plan() assertions covering SUB-01/02/05/06 + 6 typed errors + server-derived local_date
- `supabase/tests/review_submission.sql` — 12 plan() assertions covering ADM-02/03 + 6 typed errors + Threat 7 cross-group + Pitfall 9 race
- `supabase/tests/get_pending_review_count.sql` — 5 plan() assertions covering ADM-01 admin / non-admin member / stranger / anon (+ empty-group case)
- `supabase/tests/get_pending_review_queue.sql` — 12 plan() assertions covering PER REVIEWS.md C3 admin / non-admin (THE C3 ASSERTION) / cross-group / stranger / anon / empty-group / structural limit-50 + is_group_admin body checks
- `supabase/tests/submissions_admin_immutable.sql` — 11 plan() assertions backfilling 0003 trigger coverage (owner branch × 4 columns + admin branch × 5 identity columns + WR-03 reviewed_by mismatch + admin-happy-path lives_ok)

## Decisions Made

- **Composite return type for `get_pending_review_queue`** instead of `returns table (...)` or `returns json` — chose `create type public.review_queue_row` so generated TypeScript types in `src/types/database.ts` express the queue shape strongly (downstream Plan 03-05 will benefit from non-nullable column types where applicable). Mirrors the `public.invite_preview` composite-type pattern shipped in 0004.
- **Per-test-row seeding in `submissions_admin_immutable.sql`** (9 rows for 11 assertions, one row per failed-UPDATE attempt) — avoids state coupling between consecutive UPDATE attempts and ensures each `throws_ok` runs against a clean pending row in the same transaction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan PATTERNS join clause referenced wrong column**
- **Found during:** Task 1 (writing get_pending_review_queue body)
- **Issue:** The plan's `<action>` block under Task 1 step (5) shows `left join public.profiles p on p.user_id = s.user_id`. But per `0001_foundation.sql` line 42, the `profiles` table primary key is `id` (referencing `auth.users(id)`); there is no `profiles.user_id` column. The literal text would fail to compile.
- **Fix:** Used `left join public.profiles p on p.id = s.user_id` — the correct foreign-key relationship per the existing schema. The composite-type field name `profile_updated_at` (an alias for `p.updated_at`) is unaffected.
- **Files modified:** `supabase/migrations/0006_phase3_capture_review.sql` (only — plan text was the source of the typo)
- **Verification:** Grep confirms `p.id = s.user_id` is the only profile-join clause in the migration body; SUMMARY documents the join shape so downstream Plan 03-03 / 03-05 hooks know to expect this.
- **Committed in:** `50dc2bc` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — plan typo in PATTERNS join clause vs actual schema)
**Impact on plan:** Single-line correction of a literal SQL typo; does not affect the C3 mitigation contract or the typed-error surface. The `<must_haves>` truths and `<acceptance_criteria>` are unaffected because the column name `profile_updated_at` was the contract, not the join column.

## Issues Encountered

- `pnpm` is installed on the host but the project's `package-lock.json` indicates npm; jest/tsc binaries live at `node_modules/.bin/*` which exists in the main checkout but NOT in the worktree. Tasks 4 and 5 will need to either run from the main repo path against worktree files OR install deps via `npm install --no-audit --no-fund` in the worktree before running. This is documented for the continuation agent.
- `SUPABASE_ACCESS_TOKEN` env var is unset in the worktree shell. Per the planner the user must run `supabase login` interactively (preferred) or export the token before invoking `supabase db push`. The worktree agent cannot perform interactive auth flows.

## User Setup Required

**Yes — Task 3 requires `supabase db push` against the live remote.** Per the plan `<user_setup>` block:

```bash
# 1. Either set SUPABASE_ACCESS_TOKEN or run supabase login interactively first
[ -n "$SUPABASE_ACCESS_TOKEN" ] && echo "token set" || echo "RUN: supabase login"

# 2. Push the migration to the linked remote project
cd /Users/chris/projects/accountibuzz/.claude/worktrees/agent-a53c810b736ef4dde && supabase db push

# 3. Verify the 4 new RPCs exist on remote
supabase db dump --schema public 2>/dev/null | grep -E "(submit_today|review_submission|get_pending_review_count|get_pending_review_queue)"
# Expected: at least 4 matches

# 4. Run pgTAP suite locally against the just-pushed schema
supabase test db
# Expected: ALL pgTAP files green (P1 + P2 + 5 new P3 files)

# 5. Regenerate database types from the post-push schema
pnpm types:gen     # or: npx supabase gen types typescript --local > src/types/database.ts

# 6. Verify the 4 new RPC types appear in src/types/database.ts
grep -E "submit_today|review_submission|get_pending_review_count|get_pending_review_queue" src/types/database.ts
# Expected: matches for ALL 4 RPCs under Database.public.Functions
```

After these steps complete, type **"approved — push complete, types regenerated, all pgTAP green"** (or describe failures) so a continuation agent can pick up Tasks 4 and 5.

## Next Phase Readiness

- **Plans 03-03 + 03-05 (data layer + hooks) BLOCKED** until Tasks 3+4 land — they need the regenerated `src/types/database.ts` to import the new RPC types.
- **Plan 03-06 (tabs migration) BLOCKED** until Task 5 lands — the audit test is the integration sentinel.
- **Plan 03-04 (storage prep) UNBLOCKED** — does not depend on anything in 03-02.
- **Plan 03-07 (review screen) BLOCKED** until Task 3 lands AND its own client-side hook is shipped (Plan 03-05) — the C3 server gate (`get_pending_review_queue`) and the C3 client gate (`useGroup(...).is_admin`) together close the deep-link bypass.

## Self-Check: PARTIAL

**Files committed in this session:**

- FOUND: `supabase/migrations/0006_phase3_capture_review.sql` (committed in 50dc2bc)
- FOUND: `supabase/tests/submit_today.sql` (committed in 67005ca)
- FOUND: `supabase/tests/review_submission.sql` (committed in 67005ca)
- FOUND: `supabase/tests/get_pending_review_count.sql` (committed in 67005ca)
- FOUND: `supabase/tests/get_pending_review_queue.sql` (committed in 67005ca)
- FOUND: `supabase/tests/submissions_admin_immutable.sql` (committed in 67005ca)

**Outstanding for completion:**

- [ ] Task 3 — `supabase db push` (human-action)
- [ ] Task 3 — `pnpm types:gen` to regenerate `src/types/database.ts`
- [ ] Task 3 — `supabase test db` green for all 5 new pgTAP files
- [ ] Task 4 — spot-check regen + `pnpm typecheck`
- [ ] Task 5 — write `tests/app/tabs-migration.test.ts` + run jest

---
*Phase: 03-capture-admin-review*
*Plan: 02*
*Status: INCOMPLETE — paused at Task 3 checkpoint (human-action)*
*Paused: 2026-04-29*
