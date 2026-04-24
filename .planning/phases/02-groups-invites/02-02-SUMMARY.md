---
phase: 02
plan: 02
subsystem: groups-invites / database
tags: [supabase, migration, rpc, pgtap, security-definer, phase-2]
requires:
  - 01-02 (Phase 1 foundation schema: groups, group_members, invites, profiles, handle_new_user trigger)
provides:
  - supabase-rpc/create_group(p_name, p_goal, p_submission_type, p_timezone) -> (group_id uuid, invite_code text)
  - supabase-rpc/redeem_invite(code_input text) -> uuid
  - supabase-rpc/get_invite_preview(code_input text) -> public.invite_preview  [anon-callable]
  - supabase-rpc/leave_group(p_group_id uuid) -> void
  - supabase-rpc/transfer_admin(p_group_id uuid, p_new_admin_user_id uuid) -> void
  - supabase-rpc/delete_group(p_group_id uuid) -> void
  - supabase-rpc/regenerate_invite(p_group_id uuid) -> text
  - supabase-type/public.invite_preview (group_name text, member_count int, admin_display_name text)
  - supabase-helper/public.generate_invite_code() -> text  [internal, no external grant]
  - supabase-check/groups_name_length_check (1..60)
  - supabase-check/groups_goal_length_check (5..140)
  - typescript-types/Database.public.Functions.{create_group, redeem_invite, get_invite_preview, leave_group, transfer_admin, delete_group, regenerate_invite}
affects:
  - dropped-policy/public.invites:invites_mark_used_as_self (from 0002)
  - dropped-policy/public.invites:invites_update_authenticated (from 0001, re-dropped idempotently)
  - test-fixture/supabase/tests/rls_helpers.sql (goal string widened to satisfy new CHECK)
tech-stack:
  added:
    - n/a (Supabase + Postgres are already chosen; this is a schema extension only)
  patterns:
    - "SECURITY DEFINER RPC with typed P0001 errors (Pattern 1)"
    - "SELECT ... FOR UPDATE row-lock to close TOCTOU cap race (Pitfall 5)"
    - "generate_invite_code() helper + 5-retry on unique_violation (Pattern 2)"
    - "Dedicated composite return type for leak-prone previews (Pitfall 3)"
    - "In-function atomic multi-row flip for invariants that span tables (Pitfall 8)"
key-files:
  created:
    - supabase/migrations/0004_phase2_groups_invites.sql
    - supabase/tests/create_group.sql
    - supabase/tests/redeem_invite.sql
    - supabase/tests/get_invite_preview.sql
    - supabase/tests/leave_group.sql
    - supabase/tests/transfer_admin.sql
    - supabase/tests/delete_group.sql
    - supabase/tests/regenerate_invite.sql
    - supabase/tests/invites_policies.sql
  modified:
    - src/types/database.ts (regenerated)
    - supabase/tests/rls_helpers.sql ('goal' -> 'goal row' to satisfy new CHECK)
decisions:
  - "Invite alphabet locked at 31 chars '23456789ABCDEFGHJKMNPQRSTUVWXYZ' (digits 2-9 + A-Z minus O/I/L). 31^8 ~ 8.5e11 codes."
  - "Redemption is RPC-only from Phase 2 forward. Both P1 placeholder invites UPDATE policies are dropped with no replacement."
  - "get_invite_preview returns a dedicated public.invite_preview composite type (3 fields only) so any future schema addition cannot silently leak via `returns groups` / `returns json`."
  - "transfer_admin updates groups.admin_user_id AND both group_members role rows inside one plpgsql function — no intermediate state is externally observable (Pitfall 8 / T-02-TRANSFER-DOUBLE-ADMIN)."
  - "delete_group relies on FK ON DELETE CASCADE from 0001 (group_members.group_id, submissions.group_id, invites.group_id) — no manual sweep in the RPC body."
metrics:
  duration_minutes: 35
  completed_date: "2026-04-24"
  tasks: 4
  files_created: 9
  files_modified: 2
  pgtap_tests: 52
  pgtap_files: 11
  commits: 3
---

# Phase 2 Plan 02: Server-Side Contract (Schema + RPCs + Tests) Summary

Seven SECURITY DEFINER RPCs + `generate_invite_code` helper + `invite_preview` composite type shipped as `0004_phase2_groups_invites.sql`; all 11 pgTAP files (P1: 3, P2: 8) pass — 52 tests total. Migration pushed to the linked remote Supabase project and `src/types/database.ts` regenerated from the post-push schema with all 7 RPC entries and typecheck clean.

## What Was Built

| Surface | Shape | Grants |
|---|---|---|
| `create_group(p_name, p_goal, p_submission_type, p_timezone)` | returns `(group_id uuid, invite_code text)` | authenticated |
| `redeem_invite(code_input text)` | returns `uuid` (joined group_id) | authenticated |
| `get_invite_preview(code_input text)` | returns `public.invite_preview` | **anon**, authenticated |
| `leave_group(p_group_id uuid)` | void; rejects admin caller with `admin_cannot_leave` | authenticated |
| `transfer_admin(p_group_id, p_new_admin_user_id)` | void; atomic 3-row flip | authenticated |
| `delete_group(p_group_id uuid)` | void; cascades via FK | authenticated |
| `regenerate_invite(p_group_id uuid)` | returns `text` (new code); closes prior, mints new | authenticated |
| `generate_invite_code()` helper | returns `text`; 8-char code over 31-char alphabet | (no external grant) |
| `public.invite_preview` composite type | `(group_name text, member_count int, admin_display_name text)` | — |
| `groups_name_length_check` / `groups_goal_length_check` | CHECK constraints | — |

## Invite Alphabet (Open Question #1 / D-02 — Locked)

**31 characters**, literal copy:

```
23456789ABCDEFGHJKMNPQRSTUVWXYZ
```

Digits 2-9 (8 chars) + A-Z minus O/I/L (23 chars) = 31. Keyspace `31^8 ≈ 8.5×10^11`. Documented inline in the migration above the `alphabet constant` declaration.

## pgTAP Coverage

All 11 pgTAP files pass under `supabase test db`:

```
create_group.sql ........ ok  (8 tests)
delete_group.sql ........ ok  (5 tests)
get_invite_preview.sql .. ok  (6 tests)
invites_policies.sql .... ok  (2 tests)
leave_group.sql ......... ok  (4 tests)
profiles_rls.sql ........ ok  (3 tests, P1)
profiles_trigger.sql .... ok  (2 tests, P1)
redeem_invite.sql ....... ok  (9 tests)
regenerate_invite.sql ... ok  (4 tests)
rls_helpers.sql ......... ok  (4 tests, P1)
transfer_admin.sql ...... ok  (5 tests)
Files=11, Tests=52
Result: PASS
```

Key structural assertion inside `redeem_invite.sql` (T-02-CAP-RACE regression guard):

```sql
select matches(
  pg_get_functiondef('public.redeem_invite(text)'::regprocedure)::text,
  '(?i)for update'::text,
  'redeem_invite function body contains FOR UPDATE row-lock per T-02-CAP-RACE mitigation'::text
);
```

Absence assertion inside `invites_policies.sql` (T-02-RLS-OFF — P1 placeholder retirement):

```sql
select is(
  (select count(*)::int from pg_policies
    where schemaname='public' and tablename='invites'
      and policyname='invites_mark_used_as_self'),
  0,
  'P1 placeholder policy invites_mark_used_as_self is dropped (T-02-RLS-OFF)'
);
```

## Migration Push Status

`supabase db push` to the linked remote project `baatomkgtgkrnapisoej` applied pending migrations successfully. Final state from `supabase migration list --linked`:

```
Local | Remote | Time (UTC)
------|--------|------------
0001  | 0001   | 0001
0002  | 0002   | 0002
0003  | 0003   | 0003
0004  | 0004   | 0004
```

`FOR UPDATE` appearances in `0004_phase2_groups_invites.sql`:

```
$ grep -c "for update" supabase/migrations/0004_phase2_groups_invites.sql
4
```

Four occurrences: two inside `redeem_invite` (invite row lock + groups row lock per T-02-CAP-RACE), one inside `transfer_admin` (groups row lock to serialize concurrent transfers), and one in the header comment. `SECURITY DEFINER` appears 7 times — one per RPC.

## Dropped Policies (T-02-RLS-OFF mitigation)

Both P1 placeholders on `public.invites` are DROPPED with no replacement; redemption is RPC-only from this plan forward:

- `invites_update_authenticated` (from `0001_foundation.sql` line 309, originally permitting any authed user to UPDATE any invite row)
- `invites_mark_used_as_self` (from `0002_phase1_review_fixes.sql` line 134, the review-fix stub that still allowed direct UPDATE)

Asserted absent in `supabase/tests/invites_policies.sql` (plan=2, both pass).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `pgTAP like()` overload ambiguity in structural assertion**
- **Found during:** Task 2 first test run.
- **Issue:** The planned `select like(pg_get_functiondef(...), '%for update%', 'msg')` produced `ERROR: function like(text, unknown, unknown) does not exist`. pgTAP's `like()` shadows the SQL `LIKE` operator and its argument resolution was rejecting the `unknown` literal types.
- **Fix:** Replaced with `matches()` (regex-based, unambiguous signature) and explicit `::text` casts: `matches(pg_get_functiondef(...)::text, '(?i)for update'::text, 'msg'::text)`. Semantics preserved — case-insensitive substring match for `for update`.
- **Files modified:** `supabase/tests/redeem_invite.sql`.
- **Commit:** `f5adb4a`.

**2. [Rule 3 — Blocking] New `groups_goal_length_check` broke existing `rls_helpers.sql` test**
- **Found during:** Task 2 first test run.
- **Issue:** `0004` adds `check (char_length(goal) between 5 and 140)` on `public.groups`. The existing P1 `rls_helpers.sql` seeded `goal='goal'` (4 chars), which now violates the constraint and caused that entire test suite (4 tests) to abort.
- **Fix:** Widened the seed value to `'goal row'` (8 chars). Pure test-fixture adjustment — no semantic change to the test.
- **Files modified:** `supabase/tests/rls_helpers.sql`.
- **Commit:** `f5adb4a`.

### Precondition Drift (Pre-existing; Rule 3 — Blocking → Task 3)

**3. [Info] STATE.md claimed P1 migrations were all pushed to remote, but 0002 and 0003 were local-only**
- **Found during:** Task 3 `supabase migration list --linked` output.
- **Evidence:** Remote column showed `0001` only; `0002`, `0003`, and `0004` were all pending. During the `db push`, Postgres emitted `NOTICE: trigger "submissions_owner_immutable_trigger" for relation "public.submissions" does not exist, skipping` when applying `0002` — confirming that trigger had never been pushed before.
- **Resolution:** `npx supabase db push --include-all` applied all three pending migrations (0002, 0003, 0004) in order. No schema-drift warnings; all applied cleanly.
- **Impact on this plan:** None — the plan's success criterion (0004 present on remote) is met, and remote is now fully caught up through the review-fix passes as well.

## Self-Check: PASSED

Verified files exist on disk:

- `supabase/migrations/0004_phase2_groups_invites.sql` — FOUND
- `supabase/tests/create_group.sql` — FOUND
- `supabase/tests/redeem_invite.sql` — FOUND
- `supabase/tests/get_invite_preview.sql` — FOUND
- `supabase/tests/leave_group.sql` — FOUND
- `supabase/tests/transfer_admin.sql` — FOUND
- `supabase/tests/delete_group.sql` — FOUND
- `supabase/tests/regenerate_invite.sql` — FOUND
- `supabase/tests/invites_policies.sql` — FOUND
- `src/types/database.ts` — FOUND (regenerated)

Verified commits exist:

- `90bd4f8` feat(02-02): add 0004 migration with 7 Phase 2 RPCs + helper + preview type — FOUND
- `f5adb4a` test(02-02): add 8 pgTAP suites covering all Phase 2 RPCs + policy absence — FOUND
- `faaae38` chore(02-02): regenerate database.ts types with 7 new Phase 2 RPCs — FOUND

Verified pgTAP suite: 11 files, 52 tests, Result: PASS.
Verified typecheck: `npx tsc --noEmit` exits 0.
Verified remote migration status: 0004 present in both `Local` and `Remote` columns.
