# Phase 4: Social Surfaces - Research

**Researched:** 2026-05-08
**Domain:** Postgres trigger body + 3 SECURITY DEFINER RPCs + Realtime channel topology + 4 TanStack hooks for the leaderboard / feed / still-to-post / tombstone surfaces
**Confidence:** HIGH (every claim is grounded in shipped migrations 0001/0003/0006/0007, the established P3 hook pattern in `useTodaySubmissionRealtime.ts`, and the locked CONTEXT.md decisions D-01..D-21; one unknown — whether `group_members` is in the supabase_realtime publication — is resolved in §Critical Gating Findings below)

## Summary

Phase 4 is **server-mostly with a thin UI layer on top**. The 0008 migration replaces the `handle_submission_approval` stub body, adds 3 read-side SECURITY DEFINER RPCs, optionally adds a column-allowlist trigger on `group_members`, and **must** add `group_members` to `supabase_realtime` (0007 only added `submissions`). The frontend adds 4 TanStack hooks that mirror the established `useTodaySubmissionRealtime.ts` pattern verbatim — `useFocusEffect` lifecycle, single-column `postgres_changes` filter, client-side narrowing, `setQueryData` cache patches.

Every locked decision D-01..D-21 from CONTEXT.md is feasible against the shipped schema. Two non-obvious gates emerged during research: (1) `group_members` realtime publication is missing; (2) the AFTER UPDATE WHEN trigger from 0001 §10 fires inside the same transaction as `review_submission`'s atomic-and-conditional UPDATE, so streak math and points are committed atomically with the status flip — but a `BEFORE UPDATE` trigger from 0003 fires first, so the trigger body must NOT do anything that depends on running before the row reaches its final state.

**Primary recommendation:** Ship the 0008 migration in this order: (1) `alter publication supabase_realtime add table public.group_members`; (2) `handle_submission_approval` body via `create or replace function ... return new`; (3) optional column-allowlist BEFORE UPDATE trigger on `group_members` (recommended — see §3 below); (4) three SECURITY DEFINER RPCs with `revoke ... from public; grant ... to authenticated;`; (5) ≥4 pgTAP files. Every RPC computes its own `local_date` inline from `(now() AT TIME ZONE g.timezone)::date` — there is no shared helper today. The frontend layer is 4 hooks + 4 in-place section components inside `app/(app)/groups/[id]/index.tsx` (existing `ScrollView`, not `FlatList`) + 1 new GroupCard prop.

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-21)

These 21 decisions are **locked** — research evaluates feasibility, not alternatives.

**Approval Trigger + Streak Math (D-01..D-04):**
- **D-01**: Streak math anchors to `submissions.local_date` (server-derived). Trigger reads `NEW.local_date` and `group_members.last_rolled_date`.
- **D-02**: Streak recurrence — NULL → 1; consecutive (`local_date = last_rolled_date + 1`) → +1; gap (`local_date > last_rolled_date + 1`) → 1; same-day (`local_date = last_rolled_date`) → no-op (UNIQUE prevents anyway). Always: `last_rolled_date = local_date`, `points = points + 1`, `longest_streak = greatest(longest_streak, current_streak)`.
- **D-03**: Idempotency relies on the 0003 admin-immutable trigger + the `WHEN (old.status IS DISTINCT FROM new.status AND new.status = 'approved')` clause. No `points_credited_at` guard.
- **D-04**: Leaderboard reads denormalized `group_members` columns directly via single indexed join with `profiles`. No view, no RPC indirection.

**Tombstone Strategy (D-05..D-08):**
- **D-05**: SECURITY DEFINER RPC `get_missed_yesterday(group_id uuid)`. Computed at query time from `group_members LEFT JOIN submissions` filtered by `local_date = yesterday AND status = 'approved'`. Yesterday = `(now() AT TIME ZONE groups.timezone)::date - 1`.
- **D-06**: Yesterday-only tombstones in P4. Multi-day deferred.
- **D-07**: Symmetric SECURITY DEFINER RPC `get_pending_today(group_id uuid)`. Two narrow RPCs (not one combined surface).
- **D-08**: Streak break rendered quietly. No "X just lost their streak" badges.

**Per-Group Surface Layout (D-09..D-12):**
- **D-09**: Single scrollable group-detail screen with stacked sections. Order: Header → Leaderboard → Today's posts → Still to post → Missed yesterday → Members → (admin) Pending review → destructive zone. No new routes.
- **D-10**: Leaderboard top-5, tap-to-expand to full ranking.
- **D-11**: Feed item = avatar + name + 80×80 thumbnail + relative time + optional caption. Video autoplays muted+looping.
- **D-12**: Approved-only visibility. `submissions` SELECT RLS already aligns; no policy changes.

**Today Screen Evolution (D-13..D-16):**
- **D-13**: Today GroupCard gains social-signal line `N/M posted today · X pts · 🔥streak`. N from `get_today_posted_count`, M from group_members count, points/streak from leaderboard read for user's own row.
- **D-14**: Empty state: `0/M posted · be the first`.
- **D-15**: Per-group Realtime channel per visible Today card, alongside the existing per-user channel from P3 D-13. Filter: `group_members.group_id=eq.{id}`. Cleanup via `useFocusEffect`.
- **D-16**: GroupCard tap routes to group-detail (unchanged).

**RPCs (D-17..D-19):**
- **D-17**: 3 new SECURITY DEFINER RPCs — `get_pending_today`, `get_missed_yesterday`, `get_today_posted_count`. Membership-gated.
- **D-18**: Counter trigger body lives inside `handle_submission_approval`. AFTER UPDATE OF status, WHEN approved transition.
- **D-19**: Counter columns blocked from client. Defense-in-depth column-allowlist trigger on `group_members` UPDATE — **research recommends shipping it** (see §3 below).

**Realtime (D-20..D-21):**
- **D-20**: Group-detail leaderboard subscribes to `postgres_changes` UPDATE on `public.group_members` filtered on `group_id=eq.{X}`. Patch via `setQueryData`. Teardown via `useFocusEffect`.
- **D-21**: Group-detail feed subscribes to `postgres_changes` UPDATE on `public.submissions` filtered on `group_id=eq.{X}`. Client-side narrows to `local_date = today AND (NEW.status = 'approved' OR OLD.status = 'approved')`. On approval, optimistically prepend + invalidate leaderboard.

### Claude's Discretion (research recommendations below)

- Tombstone copy → see §UI/UX Patterns (UI-SPEC already locks this).
- Avatar-row treatment for Still to post → UI-SPEC §"Still to post (FEED-02) copy" locks the behavior (overlapping circles, +N overflow chip).
- Empty-state copy for leaderboard → UI-SPEC locks "Nobody's on the board yet — submit today to start the streak."
- Whether `longest_streak` is exposed in P4 → **research recommends NO** (cheap to add; UI-SPEC §"Leaderboard row copy" doesn't render it; defer to P6 polish).
- Cross-fade on social-signal line update → **UI-SPEC §"Realtime status-change copy" already resolved this to instant text swap, no fade**.
- Leaderboard read shape → **research recommends a small RPC `get_group_leaderboard(group_id)` for stable contract** rather than a direct PostgREST select (see §6 below for rationale).
- Existing UI primitives reused → UI-SPEC names them (`Avatar`, `AvatarInitials`, `GroupCard`, `StatusPill`).
- pgTAP coverage → **research recommends 4 files** (see §5 below).

### Deferred Ideas (OUT OF SCOPE)

- Persisted `daily_misses` table → P5 (read-side RPC contract from D-05/D-07 stays stable; swap-in is non-breaking).
- Push notifications for "member posted" / "approved" / "streak broken" → P5 (NOTIF-02..04).
- Re-engagement / comeback narrative → P6 (RE-01..04).
- Multi-day tombstone history (last 7 days) → not on roadmap.
- Reactions / comments / DMs on feed posts → permanently out of scope (PROJECT.md).
- Streak-broken badge / "last streak: N days" chip → P6 polish or never.
- `longest_streak` surface on leaderboard → P6 polish.
- Group-health view for admins → P6 (RE-02).
- Feed pagination beyond today → not needed (FEED-01 = single-day window).
- Cross-fade animation on Today social-signal line → **resolved in UI-SPEC: instant swap, no animation.**
- Architecture-doc reword (`last_verified_local_date` → `last_rolled_date`) → low priority.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PTS-01 | Each verified submission awards 1 point and increments streak in that group | §1 trigger body (`points = points + 1` + streak recurrence) |
| PTS-02 | A day without a verified submission resets streak to zero | P5 owns the time-based reset; P4's trigger gap-branch handles late-approval-after-gap (D-02) |
| PTS-03 | Streaks and points derived server-side, consistent with group timezone | §1 trigger body uses `NEW.local_date` (set by P3's `submit_today` from `now() AT TIME ZONE g.timezone`) |
| LB-01 | Group leaderboard ranked by points + current streak | §6 leaderboard read uses `group_members_leaderboard_idx` shipped in 0001 |
| LB-02 | Leaderboard updates near real time | §4 Realtime topology — `postgres_changes` UPDATE on `group_members`, **but `group_members` must first be added to `supabase_realtime` publication** (see §Critical Gating Findings) |
| FEED-01 | Today's approved submissions visible | §6 `useGroupFeed` hook — direct PostgREST select on `submissions` filtered by group_id + local_date + status='approved' |
| FEED-02 | Feed shows who hasn't submitted yet today | §2 `get_pending_today` RPC |
| FEED-03 | Feed shows missed-day tombstones for yesterday | §2 `get_missed_yesterday` RPC |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Streak / points math (D-01..D-04, PTS-01..03) | Database (Postgres trigger) | — | Anti-Pattern #3: don't put business logic in edge functions when triggers suffice. AFTER UPDATE trigger runs in the same TX as `review_submission`'s UPDATE — atomicity for free. |
| Leaderboard read (LB-01, D-04) | API/PostgREST or DB-RPC | Client (TanStack cache) | Single indexed read off `group_members_leaderboard_idx` + `profiles` join. Recommend wrap in RPC for stable contract (see §6). |
| Leaderboard live update (LB-02, D-20) | DB → Realtime → Client | — | Realtime CDC; client patches via `setQueryData`. Anti-Pattern #2 explicitly forbids polling here. |
| Today's-posts feed (FEED-01, D-21) | API/PostgREST | Client (TanStack) | Direct select on `submissions`; existing RLS gates membership. |
| Pending-today / Missed-yesterday RPCs (FEED-02/03, D-05/D-07) | DB-RPC (SECURITY DEFINER) | Client (TanStack) | Membership gate must be server-enforced (Pitfall #3 trap if it leaks); RLS alone won't cover the LEFT-JOIN-based "absence" query shape. |
| Today GroupCard social-signal line (D-13..D-15) | Client (TanStack) | DB → Realtime | Cheap aggregate `get_today_posted_count` + per-card Realtime channel; Anti-Pattern #4 (per-group, not global). |
| Column-allowlist enforcement (D-19) | Database (BEFORE UPDATE trigger) | RLS | RLS `group_members_update_admin` allows admins to UPDATE any column; trigger pins counter columns (parallel to 0003 admin-immutable trigger on submissions). |

## Standard Stack

### Core (already pinned — verified against `package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.58.0` | Realtime + PostgREST + RPC | Already pinned; `postgres_changes` + RPC client. [VERIFIED: package.json line 22] |
| `@tanstack/react-query` | `^5.59.0` | Server state cache + Realtime patches | v5 uses `isPending` not `isLoading`; existing hooks all use this. [VERIFIED: package.json] |
| `expo-router` | `~55.0.13` | `useFocusEffect` for Realtime cleanup | Existing pattern in `useTodaySubmissionRealtime.ts`. [VERIFIED: package.json] |
| `expo-video` | `~55.0.15` | Feed item video thumbnail playback | UI-SPEC §"Design System" specifies `useVideoPlayer` + `<VideoView />` muted+looping at 80×80. [VERIFIED: package.json line 35] |
| `expo-image` | `~55.0.9` | Feed item photo thumbnail; avatar rendering | Existing pattern; URL-cache-bust via `?v={updated_at}` per WR-01. [VERIFIED: package.json line 33] |

**No new dependencies.** Phase 4 is a pure addition layer on top of the existing stack.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `Intl.DateTimeFormat` | built-in | Group-tz `local_date` math on the client | Already used in `time.ts`; reusable for D-21 client-side narrowing (`todayLocalDate(group.timezone, new Date())`). [VERIFIED: src/features/submissions/time.ts] |
| `pgTAP` | shipped via `supabase test db` | Migration test coverage | Pattern established in 0006's 4 test files (P3); P4 mirrors with ≥4 files (see §5). [VERIFIED: supabase/tests/ directory] |

**Version verification** (run before plan execution):
```bash
# All Phase 4 dependencies are already installed at the pinned versions.
# Confirm no drift:
pnpm list @supabase/supabase-js @tanstack/react-query expo-router expo-video expo-image
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct PostgREST leaderboard select | Wrap in RPC `get_group_leaderboard(group_id)` | **Recommended (see §6).** RPC gives stable contract for `pnpm types:gen` + composite return type with `display_name` / `avatar_path` / `joined_at` + `current_streak` + `points` joined in one query, avoiding N+1 (Pitfall #13). Direct select would require PostgREST embedded select syntax `group_members?select=user_id,points,current_streak,profiles(display_name,avatar_path,updated_at)` which works but ties the leaderboard contract to PostgREST quirks. |
| Combined "today status" RPC | `get_pending_today` + `get_missed_yesterday` + `get_today_posted_count` (3 separate) | **CONTEXT D-07 locks separation.** Decouples cache invalidation: today's-not-yet flips when a member submits; yesterday's-misses flips only at midnight rollover. |
| BEFORE UPDATE trigger on group_members (column-allowlist) | RLS `group_members_update_admin` only | **Recommended: ship the trigger.** RLS allows admins to UPDATE any column; counter columns must be definer-only. Parallel to 0003 admin-immutable on submissions. (See §3.) |
| Polling leaderboard | `postgres_changes` Realtime | **CONTEXT D-20 locks Realtime.** Anti-Pattern #2 explicitly. |

## Architecture Patterns

### System Architecture Diagram (Phase 4 layer)

```
┌────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Expo + RN)                              │
│                                                                         │
│  Today screen (existing FlatList)                                       │
│   └─ GroupCardRow (1 per visible group)                                 │
│      ├─ useTodaySubmission [P3 — unchanged]                             │
│      ├─ useUploadQueue     [P3 — unchanged]                             │
│      ├─ useGroupSocialCounts(group.id)  [NEW] ──┐                       │
│      └─ useFocusEffect → channel "todaycard:{group.id}"                 │
│                       (filter: group_members.group_id=eq.{id})          │
│                                                                         │
│  Group-detail screen (existing ScrollView)                              │
│   ├─ Header / metadata chips [unchanged]                                │
│   ├─ Leaderboard section                                                │
│   │   ├─ useGroupLeaderboard(group.id)   [NEW] ──┐                      │
│   │   └─ useFocusEffect → channel "group-lb:{id}"│                      │
│   │                  (filter: group_members.group_id=eq.{id})           │
│   ├─ Today's posts section                                              │
│   │   ├─ useGroupFeed(group.id, today)   [NEW] ──┤                      │
│   │   └─ useFocusEffect → channel "group-feed:{id}"                     │
│   │                  (filter: submissions.group_id=eq.{id};             │
│   │                   client narrows to local_date=today + status flip) │
│   ├─ Still-to-post section                                              │
│   │   └─ useGroupTombstones(group.id, 'today')  [NEW] (no realtime)     │
│   ├─ Missed-yesterday section                                           │
│   │   └─ useGroupTombstones(group.id, 'yesterday') [NEW] (no realtime)  │
│   └─ Members + (admin) Pending review + destructive zone [unchanged]    │
└─────────────────────────────────────────────────────────────────────────┘
                                  │ HTTPS / WSS
┌────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (Postgres 15)                          │
│                                                                         │
│  Migration 20260508233129_phase4_points_streaks_feed.sql                          │
│   ├─ alter publication supabase_realtime add table public.group_members │
│   ├─ replace handle_submission_approval body                            │
│   │     [SECURITY DEFINER, AFTER UPDATE OF status WHEN approved]        │
│   │     UPDATE group_members SET points/current_streak/longest_streak/  │
│   │                                last_rolled_date in single statement │
│   ├─ optional: group_members_counter_immutable BEFORE UPDATE trigger    │
│   │     [parallels 0003's admin-immutable on submissions]               │
│   ├─ get_pending_today(uuid)         [SECURITY DEFINER, stable]         │
│   ├─ get_missed_yesterday(uuid)      [SECURITY DEFINER, stable]         │
│   ├─ get_today_posted_count(uuid)    [SECURITY DEFINER, stable]         │
│   ├─ (recommended) get_group_leaderboard(uuid)                          │
│   │                                  [SECURITY DEFINER, stable]         │
│   └─ pgTAP: streak_recurrence + idempotency + rpc_permissions +         │
│             rpc_correctness                                             │
└─────────────────────────────────────────────────────────────────────────┘

  Trigger fire path (write):
    review_submission RPC (P3)                                            │
      └─ UPDATE submissions SET status='approved' WHERE id=... AND status='pending'
          ├─ BEFORE UPDATE: submissions_owner_immutable [P3 0003] — admin branch
          └─ AFTER UPDATE OF status WHEN approved: handle_submission_approval [P4]
              └─ UPDATE group_members SET points/streak/last_rolled_date
                  ├─ BEFORE UPDATE: group_members_counter_immutable [P4, NEW]
                  │      — checks auth.uid() IS NULL (definer path) → skip
                  └─ AFTER UPDATE: → Realtime CDC → client postgres_changes filter
                                    → setQueryData on ['leaderboard', group_id]
                                    → setQueryData on ['todaySocialCounts', group_id]
```

### Recommended Project Structure (P4 additions)

```
src/features/
├── submissions/
│   ├── useGroupFeed.ts              [NEW — D-21 + FEED-01]
│   └── useGroupFeedRealtime.ts      [NEW — D-21 channel-per-screen]
├── groups/
│   ├── useGroupLeaderboard.ts       [NEW — D-04 + LB-01]
│   ├── useGroupLeaderboardRealtime.ts [NEW — D-20]
│   ├── useGroupTombstones.ts        [NEW — D-05 + D-07 + FEED-02/03 (combined hook)]
│   └── useGroupSocialCounts.ts      [NEW — D-13 + D-15 powering Today GroupCard]
├── components/
│   ├── LeaderboardRow.tsx           [NEW — UI-SPEC §"Component Additions §1"]
│   ├── FeedItem.tsx                 [NEW — UI-SPEC §"Component Additions §2"]
│   └── StillToPostAvatarRow.tsx     [NEW — UI-SPEC §"Component Additions §3"]
└── (no new src/types files — `pnpm types:gen` updates database.ts)

supabase/migrations/
└── 20260508233129_phase4_points_streaks_feed.sql  [NEW]

supabase/tests/
├── handle_submission_approval_streak.sql       [NEW — pgTAP file 1]
├── handle_submission_approval_idempotency.sql  [NEW — pgTAP file 2]
├── phase4_rpc_permissions.sql                  [NEW — pgTAP file 3]
└── phase4_rpc_correctness.sql                  [NEW — pgTAP file 4]
```

### Pattern 1: AFTER UPDATE WHEN trigger body — single-statement UPDATE

**What:** Replace `handle_submission_approval`'s no-op body with a single `UPDATE group_members` statement that combines the streak math, points increment, and `last_rolled_date` write.

**When to use:** D-18 + D-01..D-04. Single statement = atomic; runs inside the `review_submission` RPC's transaction (the AFTER UPDATE fires after the row is committed-to-be-updated, in the same TX).

**Example** (the body — NOT a complete migration):
```sql
-- Source: D-01..D-04 + 0001 line 365 (existing trigger wiring) + 0003 idempotency precedent
create or replace function public.handle_submission_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_members
     set points         = points + 1,
         current_streak = case
           when last_rolled_date is null then 1
           when new.local_date = last_rolled_date then current_streak  -- D-02 same-day no-op (unique blocks anyway)
           when new.local_date = last_rolled_date + interval '1 day' then current_streak + 1
           else 1                                                       -- D-02 gap branch (any gap = reset)
         end,
         longest_streak = greatest(
           longest_streak,
           case
             when last_rolled_date is null then 1
             when new.local_date = last_rolled_date then current_streak
             when new.local_date = last_rolled_date + interval '1 day' then current_streak + 1
             else 1
           end
         ),
         last_rolled_date = new.local_date
   where group_id = new.group_id
     and user_id  = new.user_id;
  return new;
end;
$$;
```

**Subtlety #1 — `last_rolled_date + interval '1 day'`:** `last_rolled_date` is a `date`, so `+ interval '1 day'` returns `timestamp`. Compare against `new.local_date` (also `date`) requires explicit cast OR use `last_rolled_date + 1` (integer days, returns `date`). Recommended form: `new.local_date = last_rolled_date + 1` — matches Postgres date arithmetic conventions and avoids the implicit cast.

**Subtlety #2 — repeating the CASE inside `greatest()`:** Pulling the new-streak value out into a `WITH` CTE inside an UPDATE requires `update ... with` syntax which Postgres doesn't support directly inside trigger bodies as cleanly. Two options: (a) duplicate the CASE expression (shown above — verbose but readable, same plan); (b) declare a `v_new_streak int` variable in the function body and compute it once, then `set current_streak = v_new_streak, longest_streak = greatest(longest_streak, v_new_streak), last_rolled_date = new.local_date, points = points + 1`. **Recommend (b)** for testability — simpler pgTAP assertions on intermediate state.

**Subtlety #3 — `auth.uid()` inside the trigger body:** The trigger runs as `SECURITY DEFINER`, but the AFTER UPDATE WHEN clause already gates that this only fires when status flips to 'approved'. The `review_submission` RPC's trigger fires inside the JWT context of the calling admin, so `auth.uid()` would return the admin's UUID — but the trigger body doesn't need it (NEW gives `group_id` and `user_id` of the submitter directly). No `auth.uid()` reference.

**Subtlety #4 — interaction with the BEFORE UPDATE trigger from 0003:** When `review_submission` UPDATEs `submissions`, the order is: BEFORE UPDATE `submissions_owner_immutable` (0003) fires first → row reaches its post-image → AFTER UPDATE WHEN `handle_submission_approval` (P4) fires. The 0003 trigger validates the admin-branch column allowlist; it never blocks the streak math. Confirmed safe.

### Pattern 2: SECURITY DEFINER RPC with membership gate + inline `local_date`

**What:** Each of the 3 (or 4 with leaderboard) read-side RPCs follows this shape: `SECURITY DEFINER`, `set search_path = public`, `stable`, `language plpgsql`, membership gate via `is_group_member`, inline `local_date` via `(now() AT TIME ZONE g.timezone)::date`, `revoke ... from public; grant ... to authenticated;`.

**Example** (`get_pending_today`):
```sql
-- Source: D-07 + D-17 + 0006 RPC pattern (lines 78-149)
create or replace function public.get_pending_today(p_group_id uuid)
returns table (
  user_id      uuid,
  display_name text,
  avatar_path  text,
  updated_at   timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  caller       uuid := auth.uid();
  v_group_tz   text;
  v_today      date;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;

  select g.timezone into v_group_tz
    from public.groups g
   where g.id = p_group_id;
  if not found then
    raise exception 'group_not_found' using errcode = 'P0001';
  end if;

  v_today := (now() AT TIME ZONE v_group_tz)::date;

  return query
    select gm.user_id,
           p.display_name,
           p.avatar_path,
           p.updated_at
      from public.group_members gm
      left join public.profiles p on p.id = gm.user_id
     where gm.group_id = p_group_id
       and not exists (
         select 1
           from public.submissions s
          where s.group_id = p_group_id
            and s.user_id  = gm.user_id
            and s.local_date = v_today
       )
     order by p.display_name asc;
end;
$$;

revoke execute on function public.get_pending_today(uuid) from public;
grant  execute on function public.get_pending_today(uuid) to authenticated;
```

**Symmetric shape for `get_missed_yesterday`:** identical except `v_today := (now() AT TIME ZONE v_group_tz)::date - 1` and the NOT-EXISTS subquery filters `s.status = 'approved' AND s.local_date = v_today` (the "yesterday" variable name is misleading inside the function; rename to `v_target_date` for clarity).

**Symmetric shape for `get_today_posted_count`:**
```sql
create or replace function public.get_today_posted_count(p_group_id uuid)
returns int
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  caller     uuid := auth.uid();
  v_group_tz text;
  v_today    date;
begin
  if caller is null then return 0; end if;             -- soft-fail per D-17 0-leak precedent
  if not public.is_group_member(p_group_id) then return 0; end if;

  select g.timezone into v_group_tz from public.groups g where g.id = p_group_id;
  if not found then return 0; end if;

  v_today := (now() AT TIME ZONE v_group_tz)::date;
  return (
    select count(*)::int
      from public.submissions
     where group_id = p_group_id
       and local_date = v_today
       and status = 'approved'
  );
end;
$$;

revoke execute on function public.get_today_posted_count(uuid) from public;
grant  execute on function public.get_today_posted_count(uuid) to authenticated;
```

**Note on `get_today_posted_count` lenient mode:** Mirrors the 0006 `get_pending_review_count` pattern — non-member returns 0, no exception. This matters for the Today GroupCard which renders 1 row per group the user IS a member of, so non-member returns are not actually reachable in normal flow, but the lenient path keeps the contract consistent and pgTAP-asserts cleanly.

**No `local_date_for(group_id)` helper exists** in the shipped schema. Every RPC computes its own `v_today` inline. This is explicit and deliberate — the alternative (a helper function) would be one more thing to test and maintain. The 4-line pattern is small enough.

### Pattern 3: Realtime channel hook — mirror `useTodaySubmissionRealtime.ts` verbatim

**What:** Each new Realtime hook follows the exact lifecycle of `useTodaySubmissionRealtime`: `useFocusEffect` (NOT `useEffect`), single-column server filter, client-side narrowing, `setQueryData` patches.

**Example** (`useGroupLeaderboardRealtime`):
```ts
// Source: src/features/submissions/useTodaySubmissionRealtime.ts (verbatim shape)
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { LeaderboardRow } from './useGroupLeaderboard';

export function useGroupLeaderboardRealtime(groupId: string | undefined): void {
  const qc = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      if (!groupId) return;

      const channel = supabase
        .channel(`group-lb:${groupId}`)
        .on(
          'postgres_changes' as never,
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'group_members',
            filter: `group_id=eq.${groupId}`,
          } as never,
          (payload: { new?: unknown }) => {
            const row = payload.new as
              | { user_id: string; points: number; current_streak: number;
                  longest_streak: number; last_rolled_date: string | null }
              | undefined;
            if (!row) return;

            // Patch the leaderboard cache: re-sort happens in the hook's selector.
            qc.setQueryData<LeaderboardRow[] | undefined>(
              ['groupLeaderboard', groupId],
              (prev) => {
                if (!prev) return prev;
                return prev
                  .map((r) =>
                    r.user_id === row.user_id
                      ? { ...r, points: row.points, current_streak: row.current_streak,
                          longest_streak: row.longest_streak, last_rolled_date: row.last_rolled_date }
                      : r,
                  )
                  // Re-sort by points DESC then current_streak DESC (matches index sort + D-04)
                  .sort((a, b) =>
                    b.points - a.points || b.current_streak - a.current_streak,
                  );
              },
            );

            // Belt-and-suspenders: invalidate the social-counts query for this group.
            qc.invalidateQueries({ queryKey: ['todaySocialCounts', groupId] });
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [groupId, qc]),
  );
}
```

**Symmetric shape for `useGroupFeedRealtime` (D-21):**
- Filter: `submissions.group_id=eq.{groupId}` (single column).
- Client narrowing: compute `today = todayLocalDate(groupTz, new Date())`; reject row if `row.local_date !== today`. Reject row if neither `payload.new?.status === 'approved'` nor `payload.old?.status === 'approved'` (the "status flip touched approved" condition from D-21).
- On surviving event: `setQueryData(['groupFeed', groupId, today], (prev) => ...)`. INSERT-flip = prepend; UPDATE-flip-from-approved = remove. **Also**: `qc.invalidateQueries({ queryKey: ['groupLeaderboard', groupId] })` per D-21's "explicit invalidation is cheap insurance."
- The hook needs `groupTz` to compute `today`. Two options: (a) take `groupTz` as a second arg passed by the caller (matches `useTodaySubmissionRealtime`'s `getGroupTzs` shape); (b) load `useGroup(groupId)` inside the hook and read `data?.timezone`. **Recommend (a)** — the parent screen already has the group, no point re-fetching.

**Symmetric shape for the Today-card per-group channel (D-15):**
- Channel name: `todaycard:${userId}:${groupId}` (scope by user too — channel names should be unique across user sessions).
- Filter: `group_members.group_id=eq.{groupId}` (single column). The handler narrows to `row.user_id === userId` (only the user's own row matters for points/streak; the posted-count change is signaled implicitly by `submissions` events the existing `useTodaySubmissionRealtime` already handles, but the social-counts read is RPC-backed — see "Subtlety on Today GroupCard channel doubling" below).
- On event: invalidate `['todaySocialCounts', groupId]` (cheaper than patching, and the count-RPC is single-int).

**Subtlety on Today GroupCard channel doubling:** The existing `useTodaySubmissionRealtime.ts` already subscribes to `submissions` filtered by `user_id=eq.{userId}`. The new D-15 per-card channel subscribes to `group_members` filtered by `group_id=eq.{groupId}`. These are **two separate channels for two separate tables** — no collision. Total channel count on Today screen = 1 (per-user submissions) + N (per visible group_members card). At INV-03's 10-group cap × multi-group-user scenario, max ≈ 11 channels — well under any practical limit. Pitfall #11 cleanup applies: every per-card subscription cleans up via `useFocusEffect` returned cleanup, AND when a group disappears from the FlatList (user left a group), the row component unmounts and its `useFocusEffect` cleanup fires.

**Subtlety on per-row channel lifecycle inside FlatList:** `useTodaySubmissionRealtime` is called once at the screen level (current pattern in `app/(app)/index.tsx` line 74). The new per-card channel must be called inside `GroupCardRow` (the per-item component) — confirmed in `app/(app)/index.tsx` line 287 the row already exists as `GroupCardRow` and FlatList instantiates one per group, so hooks called inside the row obey Rules of Hooks. Cleanup fires automatically when the row unmounts. **Do NOT call this Realtime hook at the screen level** — you'd need a stable subscription per group that survives re-renders, and FlatList is the right boundary for that.

### Anti-Patterns to Avoid

- **Polling the leaderboard** instead of using Realtime — Pitfall #2 + Anti-Pattern #2. **Forbidden by D-20.**
- **One global Realtime channel for all groups** — Anti-Pattern #4. The per-screen / per-card scoping already locked in P3 D-13 carries forward to D-15/D-20/D-21.
- **Computing `local_date` client-side** in the trigger body or the RPCs — Pitfall #1. **All P4 SQL uses `(now() AT TIME ZONE g.timezone)::date` — never trusts client input.**
- **N+1 join from leaderboard rows to profiles** — Pitfall #13. **D-04 single-join read avoids this; the recommended `get_group_leaderboard` RPC bakes the profile join in.**
- **Subscribing to Realtime via `useEffect` instead of `useFocusEffect`** — Pitfall #11. Tabs don't unmount; `useEffect` cleanup never fires; channels leak forever.
- **Trigger body that depends on read-after-write of `group_members`** — would race the AFTER UPDATE timing. The single-statement UPDATE avoids this by writing the row in one shot.
- **Storing streak as something other than the denormalized counter** — D-04 is locked; the schema reality matches; deviation here would require a P4 schema migration that's not in scope.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streak / points math in app code | TS code computing streak from approved submission list | Postgres trigger body (D-18) | Race conditions (Pitfall #2); client-trust violation (Pitfall #1); double-count on retry. **Schema already denormalizes counter columns specifically so the trigger writes them.** |
| Group-tz "today" / "yesterday" computation in the RPC body | App-side `Intl.DateTimeFormat` + send to RPC | Postgres `(now() AT TIME ZONE g.timezone)::date` | Pitfall #1 — never trust client clock. The client uses `todayLocalDate()` only for *display* and Realtime *narrowing* (where a wrong narrow just rejects an event, fail-safe). |
| Membership gate in the RPC | "Trust the JWT, RLS will catch it" | Explicit `is_group_member(...)` raise | The RLS-as-sole-gate pattern works for direct table SELECT, but the LEFT-JOIN-pattern in `get_pending_today` / `get_missed_yesterday` returns rows even when no submission exists, and a non-member could query and see who *would* be in the result. Server-side gate is mandatory. |
| Counter-column write protection | "RLS update policy is enough" | BEFORE UPDATE column-allowlist trigger (§3) | RLS `group_members_update_admin` allows admin to UPDATE any column. Any malicious admin could `update group_members set points = 9999`. **Recommended: ship the trigger.** |
| Adding `group_members` to realtime publication via Supabase dashboard | Click-ops in dashboard | `alter publication supabase_realtime add table public.group_members;` in the migration | Reproducibility. 0007 already established this pattern (on `submissions`). |
| Wrapping leaderboard in a SQL view | `create view leaderboard as select ...` | Plain RPC or PostgREST select | Views default to `security_invoker = false` in older Postgres conventions; setting `security_invoker = true` per Pitfall #3 is fine but the membership gate still has to live somewhere. RPC-with-`is_group_member` is simpler. |
| Client-side leaderboard sort | `data.sort(by points)` after fetch | DB ORDER BY using `group_members_leaderboard_idx` | The shipped index `(group_id, points desc, current_streak desc)` makes the sort free. Realtime patches re-sort client-side per Pattern 3 above. |
| Tracking `last_rolled_date` mutation through the trigger | Two updates (one for points, one for streak) | Single UPDATE statement (Pattern 1) | Atomicity; one CDC event; one Realtime patch fires per approval. |

**Key insight:** Phase 4 is a thin layer. Every problem already has a shipped piece: the schema's counter columns, the AFTER UPDATE trigger wiring, the leaderboard index, the helper functions `is_group_member`/`is_group_admin`, the realtime publication mechanism, the `useFocusEffect` Realtime pattern. The work is plumbing the pieces, not inventing new mechanics.

## Critical Gating Findings (read first)

These are the surprises this research uncovered. They must be addressed in the plan, not assumed away.

### CGF-1: `group_members` is NOT in the supabase_realtime publication

**The bug:** Migration 0007 added `submissions` to the publication after Phase 3 UAT discovered it was empty. **It did NOT add `group_members`.** Verified via `grep -rn "alter publication supabase_realtime" supabase/migrations/`.

**Impact:** D-20 (group-detail leaderboard Realtime) and D-15 (Today GroupCard per-group channel) both subscribe to `postgres_changes` UPDATE events on `group_members`. **Without the publication entry, those channels will subscribe successfully but receive zero events** — the exact failure mode that broke ADM-04 / SUB-04 in P3 UAT.

**Fix (mandatory in 0008):**
```sql
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'group_members'
  ) then
    alter publication supabase_realtime add table public.group_members;
  end if;
end $$;
```

This idempotent block (mirroring 0007's pattern verbatim) goes at the TOP of 0008. **Without it, LB-02 and the Today social-signal Realtime updates silently fail.**

### CGF-2: AFTER UPDATE WHEN trigger semantics + `review_submission` UPDATE

**Verified:** The `review_submission` RPC (0006 line 200) executes `update public.submissions set status = p_decision ... where id = p_submission_id and status = 'pending'`. This is an atomic conditional UPDATE — Pitfall 9 (concurrent-approve race) is already solved.

**Verified:** The AFTER UPDATE WHEN trigger on `submissions` (0001 line 380) fires inside the same transaction as the `review_submission` UPDATE. If the trigger body raises, the entire transaction rolls back — the status flip itself is undone. **This means a bug in the streak math doesn't leave a half-committed approval.**

**Verified:** The `WHEN (old.status IS DISTINCT FROM new.status AND new.status = 'approved')` clause (0001 line 383) prevents re-fire on subsequent UPDATEs. Combined with 0003's admin-immutable trigger which forbids re-reviewing, **the trigger fires at most once per submission row** — D-03's idempotency claim holds.

**Implication for testing:** pgTAP must call `review_submission` directly (impersonating an admin via JWT claims) and assert the trigger ran by reading `group_members`. Direct UPDATE on `submissions` from a pgTAP test would also trigger the body, but that's not the production path — see §5 below.

### CGF-3: Architecture-doc / schema-name mismatch (`last_verified_local_date` vs `last_rolled_date`)

CONTEXT.md §"Specifics" already calls this out: arch doc says `last_verified_local_date`, schema reality is `last_rolled_date`. **Phase 4 uses `last_rolled_date` everywhere.** No code action needed; arch-doc reword is deferred.

### CGF-4: `groups_select_member` RLS + RPC SELECT on `groups.timezone`

The 3 SECURITY DEFINER RPCs all `SELECT g.timezone FROM groups g WHERE g.id = p_group_id`. SECURITY DEFINER bypasses RLS, so this works regardless of the caller's group membership — but the **explicit `is_group_member` gate at the top of each RPC** is what enforces authorization. Confirmed safe via the same pattern in 0006's `submit_today`.

### CGF-5: DST-edge case in `get_missed_yesterday`

`(now() AT TIME ZONE g.timezone)::date - 1` returns the previous calendar date in the group's tz, regardless of whether that calendar interval was 23h, 24h, or 25h (DST boundary). Postgres `date - integer` is calendar arithmetic, not interval arithmetic — verified in Postgres 15 docs. **DST-safe.** The `time.ts` `addOneDay` helper (REVIEWS C2 in P3) confirms the same calendar-correct pattern on the client.

### CGF-6: Group timezone changing mid-day

**Concern (research_focus item 9):** What if a group's IANA timezone changes between an approval at 11pm in tz-A and a leaderboard read at 12:30am in tz-B? The trigger uses `NEW.local_date` (which `submit_today` set from the **original** group tz at submit time). The leaderboard read displays whatever was credited. **No data corruption.** A miss-detection mid-tz-change in `get_missed_yesterday` could show a quirky tombstone for one rollover, but: (a) PROJECT.md does not document a UI surface for changing group tz post-create; (b) groups RLS only allows admin updates; (c) for an MVP, a one-day visual quirk on a never-used flow is acceptable. **No action.**

## Runtime State Inventory

> Phase 4 is a code/SQL addition phase, not a rename/refactor. This section addresses the small amount of runtime state that touches the new tables.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `group_members.points`, `current_streak`, `longest_streak`, `last_rolled_date` are all currently 0 / NULL on every existing row (P1 stub never populated them) | After 0008 ships, **NEW approvals via `review_submission` populate counters going forward**. **Existing approved submissions from P3 UAT remain un-credited unless backfilled.** Recommendation: **plan a backfill task** that, post-migration, walks `submissions WHERE status='approved' ORDER BY local_date ASC` and replays through the new trigger logic — OR accepts the status quo (P3 UAT data was test data; production has no users yet). **Recommend: accept status quo** — backfill code is risk; production users start at 0 anyway. Document this explicitly in the migration comment + STATE.md. |
| Live service config | `supabase_realtime` publication is missing `group_members` (CGF-1) | Migration 0008 adds it (idempotent block). **No external service config.** |
| OS-registered state | None | None — verified by `grep -r "Phase 4\|p4\|social-surfaces" /etc/launchd /etc/systemd` would return nothing on the dev machine; no scheduled tasks ship in P4 (pg_cron is P5). |
| Secrets / env vars | None new | None — Phase 4 uses the same Supabase URL + publishable key already wired in P1. |
| Build artifacts | `src/types/database.ts` will be stale immediately after the migration | **Mandatory Wave 0 task post-migration: `pnpm types:gen`.** Without this, the new RPC signatures and the leaderboard composite type aren't in scope for the TS compiler — the new hooks will fail typecheck. |

## Common Pitfalls

### Pitfall P4-A: Forgetting to add `group_members` to `supabase_realtime` publication

**What goes wrong:** Plan ships, pgTAP passes, app builds, leaderboard subscribes successfully, **events never arrive**. Same failure mode as 0007 fixed for `submissions`.
**Why it happens:** It's not a CREATE TABLE side-effect; replication has to be opted in.
**How to avoid:** First statement in 0008 is the `alter publication ... add table public.group_members` block. **The plan's verification step must include `select * from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;`** — should list `group_members`, `groups` (already there per P2/P3 UAT discovery), `submissions` (added 0007).
**Warning signs:** "Realtime works in P3 (submissions) but leaderboard doesn't update on a 2-device approval test." **This is the canonical test for CGF-1.**

### Pitfall P4-B: Streak race on concurrent approval of two submissions for the same user/group

**What goes wrong:** Admin approves submission for `(user, group, 2026-05-08)` and `(user, group, 2026-05-09)` in rapid succession. Both AFTER UPDATE triggers fire on the same `group_members` row. Postgres MVCC + the trigger's lack of explicit row lock = potential lost update on `points`.
**Why it happens:** UPDATE statements take row-level locks, but two separate triggers in two separate transactions on the same target row will serialize. **Postgres handles this correctly in default READ COMMITTED isolation** — the second UPDATE sees the first's committed result.
**How to avoid:** **No action needed.** The single-statement UPDATE in Pattern 1 takes a row lock; the second transaction blocks on it; then re-reads `current_streak` / `last_rolled_date` post-first-commit and computes correctly. **pgTAP file 2 (idempotency) must include a concurrency assertion** (run two `update submissions` statements via two different connection contexts and verify the final `group_members.points = 2`).
**Caveat:** Two concurrent approvals for *the same submission row* are blocked by the `where status = 'pending'` clause in `review_submission` (P3 0006). The race above is two *different* submissions for the same user — much less common but possible if an admin batch-reviews a backlog.

### Pitfall P4-C: Realtime channel teardown ordering on rapid screen transitions

**What goes wrong:** User taps from group A's detail → tabs to Today → taps group B's detail rapidly. The group A detail's `useFocusEffect` cleanup must fire before group B subscribes; otherwise both `group-lb:{A}` and `group-lb:{B}` channels exist briefly. Not a correctness bug (each filter is exact), but a temporary channel leak.
**Why it happens:** `useFocusEffect` cleanup is called on blur but the timing is React-Navigation-driven; the cleanup of the unfocusing screen overlaps slightly with the focusing screen's setup.
**How to avoid:** **Acceptable as-is.** `useFocusEffect` always tears down on blur; the overlap is microseconds. P3's identical pattern in `useTodaySubmissionRealtime` shipped without issues. **No action.** Plan should NOT add a global "channel registry" or similar — that breaks Anti-Pattern #4.

### Pitfall P4-D: Leaderboard N+1 if profile join is omitted

**What goes wrong:** Naive PostgREST hook `useGroupLeaderboard`: `from('group_members').select('*').eq('group_id', id).order('points', { ascending: false })`. Then for each row, call `from('profiles').select('display_name, avatar_path').eq('id', user_id)`. **N round trips.**
**Why it happens:** The PostgREST embedded select syntax (`profiles(...)`) is the right pattern but easy to miss; the hook author copies a simpler hook and forgets the join.
**How to avoid:** **Recommend the `get_group_leaderboard` RPC pattern** (§6 below) — bakes the join into a single SELECT, returns a typed composite row. Alternative: PostgREST embedded select. Either avoids N+1.
**Warning signs:** Network tab shows N+1 GET /profiles calls per leaderboard render.

### Pitfall P4-E: Realtime patch arriving before initial query hydrates

**What goes wrong:** User opens group-detail. `useGroupLeaderboard` query is in-flight. A Realtime UPDATE arrives. `setQueryData` is called against `undefined`. The patch is silently dropped.
**Why it happens:** Race between the initial query and the Realtime subscription's first event.
**How to avoid:** Pattern 3 above shows the guard: `(prev) => { if (!prev) return prev; ... }`. The next refetch (or the next Realtime event after hydration) reconciles. **TanStack Query's stale-while-revalidate semantics make this a non-issue in practice** — the initial query lands, then Realtime patches apply on top.
**Warning signs:** "Sometimes the leaderboard takes 2 events to start updating live." Tolerable.

### Pitfall P4-F: Today GroupCard renders before user's group_members row exists

**What goes wrong:** A user just joined a group. The Today screen renders the new GroupCard. The leaderboard hook for "user's own row" returns no row (the user is in `group_members` but has no submissions yet, so `points = 0, current_streak = 0`). The social-signal line tries to render and crashes if not handled.
**Why it happens:** Edge case — first render before any submission.
**How to avoid:** D-13 line literally renders `0/M posted · be the first` (the be-the-first variant) in this case. Default values for `points`/`streak` from the leaderboard read = 0. UI-SPEC §"GroupCard social-signal line copy" handles this with the be-the-first variant. **No code defense needed beyond default values.**

### Pitfall P4-G: Type regeneration timing breaks frontend compile

**What goes wrong:** Plan ships migration first, then frontend hook code. Hook code references `supabase.rpc('get_pending_today')` which `database.ts` doesn't know about → typecheck fails → CI red.
**Why it happens:** `pnpm types:gen` is a separate manual step from `supabase db push`.
**How to avoid:** **The plan must order tasks: (1) write migration → (2) `supabase db push` → (3) `pnpm types:gen` → (4) commit `database.ts` → (5) write frontend hooks.** This is the same pattern used in P2 (Plan 02-02) and P3 (Plan 03-02). The `types:gen` step is not optional — it's a hard blocker for typecheck.
**Warning signs:** TypeScript error like `Argument of type '"get_pending_today"' is not assignable to parameter of type 'never'`.

## Code Examples

Verified patterns from official sources / shipped code:

### Migration shape (0008 skeleton)

```sql
-- =============================================================================
-- 20260508233129_phase4_points_streaks_feed.sql — Phase 4 Social Surfaces (server contract)
-- =============================================================================
-- Append-only follow-up to 0001..0007. Replaces the handle_submission_approval
-- STUB shipped in 0001 §10 (lines 365-384) with the real body. Adds 3 (or 4)
-- SECURITY DEFINER RPCs powering the leaderboard / pending-today / missed-
-- yesterday / today-posted-count surfaces. Adds group_members to the
-- supabase_realtime publication (CGF-1; mirror of 0007's submissions fix).
-- Optionally adds a column-allowlist BEFORE UPDATE trigger on group_members
-- (D-19; parallels 0003 admin-immutable on submissions).
--
-- Locked decisions: D-01..D-21 from .planning/phases/04-social-surfaces/04-CONTEXT.md.
--
-- New SECURITY DEFINER functions (revoked from public, granted to authenticated):
--   public.get_pending_today(p_group_id uuid)
--     returns table (user_id uuid, display_name text, avatar_path text, updated_at timestamptz)
--     typed errors: not_authenticated, not_member, group_not_found
--   public.get_missed_yesterday(p_group_id uuid)
--     returns table (user_id uuid, display_name text, avatar_path text, updated_at timestamptz)
--     typed errors: not_authenticated, not_member, group_not_found
--   public.get_today_posted_count(p_group_id uuid) returns int
--     soft-fail (returns 0) for not_authenticated / not_member / group_not_found
--   public.get_group_leaderboard(p_group_id uuid)  — RECOMMENDED, see RESEARCH.md §6
--     returns table (user_id uuid, display_name text, avatar_path text, updated_at timestamptz,
--                    points int, current_streak int, longest_streak int, last_rolled_date date,
--                    joined_at timestamptz)
--     typed errors: not_authenticated, not_member
--
-- Replaces:
--   public.handle_submission_approval — body filled in (was no-op stub)
--
-- Adds (new):
--   public.group_members_counter_immutable — BEFORE UPDATE trigger on group_members
--     parallel to 0003 admin-immutable on submissions
--
-- Realtime publication:
--   group_members → added to supabase_realtime (idempotent block)
--
-- pgTAP coverage (4 files):
--   handle_submission_approval_streak.sql       — D-02 branch coverage
--   handle_submission_approval_idempotency.sql  — D-03 + Pitfall P4-B concurrency
--   phase4_rpc_permissions.sql                  — non-member / anon / membership gating
--   phase4_rpc_correctness.sql                  — RPC happy-path + DST + tz edges
--
-- NO new public-schema TABLES. CI rls-check workflow stays green.
-- The 0001 trigger wiring on submissions is left UNTOUCHED (only the function body changes).
-- =============================================================================

-- 0. Realtime publication (CGF-1 — mandatory; parallels 0007).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'group_members'
  ) then
    alter publication supabase_realtime add table public.group_members;
  end if;
end $$;

-- 1. handle_submission_approval body (D-01..D-04, D-18).
create or replace function public.handle_submission_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_streak int;
begin
  -- Compute the post-approval streak per D-02. Reads NEW.local_date and the
  -- existing group_members row. The single UPDATE below performs the write.
  select case
           when last_rolled_date is null then 1
           when new.local_date = last_rolled_date then current_streak                -- D-02 same-day no-op (UNIQUE blocks anyway)
           when new.local_date = last_rolled_date + 1 then current_streak + 1        -- D-02 consecutive
           else 1                                                                    -- D-02 gap → reset to 1
         end
    into v_new_streak
    from public.group_members
   where group_id = new.group_id
     and user_id  = new.user_id;

  update public.group_members
     set points          = points + 1,
         current_streak  = v_new_streak,
         longest_streak  = greatest(longest_streak, v_new_streak),
         last_rolled_date = new.local_date
   where group_id = new.group_id
     and user_id  = new.user_id;

  return new;
end;
$$;

-- 2. (RECOMMENDED) Defense-in-depth: column-allowlist BEFORE UPDATE trigger on
--    group_members. Pins the counter columns to definer-only writes — even an
--    admin can't UPDATE points / current_streak / longest_streak / last_rolled_date
--    via the REST API. Mirrors the 0003 admin-immutable pattern on submissions.
create or replace function public.group_members_counter_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If auth context is absent (definer call from handle_submission_approval
  -- or service_role / superuser), skip checks entirely.
  if auth.uid() is null then
    return new;
  end if;

  if new.points          is distinct from old.points
     or new.current_streak  is distinct from old.current_streak
     or new.longest_streak  is distinct from old.longest_streak
     or new.last_rolled_date is distinct from old.last_rolled_date then
    raise exception 'counter columns are server-managed';
  end if;

  return new;
end;
$$;

drop trigger if exists group_members_counter_immutable_trigger on public.group_members;
create trigger group_members_counter_immutable_trigger
  before update on public.group_members
  for each row execute function public.group_members_counter_immutable();

-- 3. get_pending_today RPC (D-07, FEED-02).  -- See Pattern 2 above for full body.

-- 4. get_missed_yesterday RPC (D-05, FEED-03). -- See Pattern 2 above (yesterday variant).

-- 5. get_today_posted_count RPC (D-13, powers Today GroupCard). -- See Pattern 2 above (lenient variant).

-- 6. (RECOMMENDED) get_group_leaderboard RPC. -- See §6 below for full body.
```

### Hook shape (per CONTEXT D-04 + reused throughout §6)

```ts
// Source: src/features/groups/useGroupMembers.ts (existing pattern) +
// src/features/submissions/useReviewQueue.ts (RPC pattern) +
// CONTEXT D-04 (single-join read).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface LeaderboardRow {
  user_id: string;
  display_name: string | null;
  avatar_path: string | null;
  updated_at: string | null;        // for avatar URL cache-bust per WR-01
  points: number;
  current_streak: number;
  longest_streak: number;
  last_rolled_date: string | null;
  joined_at: string;
}

export function useGroupLeaderboard(groupId: string | undefined) {
  return useQuery({
    queryKey: ['groupLeaderboard', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await supabase.rpc('get_group_leaderboard', {
        p_group_id: groupId!,
      });
      if (error) throw new Error(error.message);
      // Coerce composite-row nullability per useReviewQueue precedent.
      return (data ?? []) as LeaderboardRow[];
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Schema doc says `last_verified_local_date` | Shipped column is `last_rolled_date` | P1 (2026-04-22) | Use `last_rolled_date` everywhere in P4. Arch-doc reword deferred. |
| 0001 trigger STUB | 0008 fills in body | This phase | Mechanical replacement; trigger wiring (`AFTER UPDATE OF status WHEN approved`) unchanged from 0001. |
| Realtime publication empty (P3 pre-UAT) | 0007 added `submissions`; 0008 adds `group_members` | P3 (2026-05-06) → P4 (this phase) | LB-02 + Today social-signal Realtime require this. |
| Direct SELECT on `submissions` for review queue (P3 pre-C3) | RPC `get_pending_review_queue` (0006) | P3 (2026-05-04) | Phase 4 reads on `submissions` (FEED-01, D-21) are NOT admin-gated — everyone in the group can see today's approved posts. **Membership gate via existing `submissions_select_group_members` RLS is sufficient for the feed read.** No new RPC needed for FEED-01; direct `from('submissions').select(...)` is correct. |

**Deprecated/outdated within this codebase:**
- The architecture doc's `last_verified_local_date` reference in §"Data Flow: Admin approves" — schema name reality is `last_rolled_date`. Low-priority arch-doc reword.

## Validation Architecture

> `nyquist_validation` is enabled by default (no `.planning/config.json` exists; treat as enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `jest@^29.7.0` (RN component + hook tests) + `pgTAP` via `supabase test db` (DB layer) |
| Config files | `package.json` `scripts.test` and `scripts.test:all`; `supabase/tests/*.sql` |
| Quick run command | `pnpm test --findRelatedTests <files>` (Jest only, fast) |
| Full suite command | `pnpm test:all` (`jest && supabase test db`) |
| Type check | `pnpm typecheck` (must run AFTER `pnpm types:gen` post-migration) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PTS-01 | Approved submission awards 1 point + increments streak | pgTAP unit | `supabase test db` (file: `handle_submission_approval_streak.sql`) | Wave 0 |
| PTS-02 | Day without verified submission resets streak | pgTAP unit (gap-branch from D-02 covers the late-approval-after-gap case; full time-based reset is P5) | `supabase test db` (same file, gap-branch test case) | Wave 0 |
| PTS-03 | Streaks/points consistent with group timezone | pgTAP unit (run trigger with two groups in different tzs, assert `last_rolled_date` matches each group's local date) | `supabase test db` | Wave 0 |
| LB-01 | Leaderboard ranked by points + current_streak | Jest hook test (`useGroupLeaderboard.test.ts`) + pgTAP correctness for `get_group_leaderboard` ORDER BY | `pnpm test src/features/groups/useGroupLeaderboard.test.ts` | Wave 0 |
| LB-02 | Leaderboard updates near real time | Jest mock-channel smoke test for `useGroupLeaderboardRealtime` + manual UAT 2-device gate (mirror P3 CK-5) | `pnpm test src/features/groups/useGroupLeaderboardRealtime.test.ts` + manual UAT | Wave 0 + manual |
| FEED-01 | Today's approved submissions visible | Jest hook test for `useGroupFeed` (mock supabase) + UAT visual check | `pnpm test src/features/submissions/useGroupFeed.test.ts` | Wave 0 |
| FEED-02 | Pending-today RPC returns correct member set | pgTAP correctness (`phase4_rpc_correctness.sql`) + Jest hook test | `supabase test db` + `pnpm test` | Wave 0 |
| FEED-03 | Missed-yesterday RPC returns correct member set | pgTAP correctness + DST-edge case + Jest hook test | `supabase test db` + `pnpm test` | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test --findRelatedTests <changed-files>` + `pnpm typecheck`
- **Per migration commit:** `supabase test db` (full pgTAP) + `pnpm types:gen` + `pnpm typecheck`
- **Per wave merge:** `pnpm test:all` + `pnpm typecheck` + `expo-doctor`
- **Phase gate:** Full suite green + manual UAT walkthrough (2-device leaderboard test for LB-02 + visual check on tombstones / still-to-post / feed prepend)

### Wave 0 Gaps

- [ ] `supabase/tests/handle_submission_approval_streak.sql` — D-02 4 branches (NULL / consecutive / gap / same-day), D-01 server-derived `local_date` proof, D-04 longest_streak update
- [ ] `supabase/tests/handle_submission_approval_idempotency.sql` — D-03 (re-fire blocked by WHEN clause + 0003 trigger), Pitfall P4-B concurrency assertion (two approvals on adjacent dates → final points = 2)
- [ ] `supabase/tests/phase4_rpc_permissions.sql` — non-member raises `not_member`, anon raises `not_authenticated`, soft-fail variant of `get_today_posted_count` returns 0 not raise
- [ ] `supabase/tests/phase4_rpc_correctness.sql` — `get_pending_today` returns members with no submission for today, `get_missed_yesterday` returns members with no `approved` for yesterday's local_date, DST-edge: insert submission on a DST-spring-forward day in `America/New_York` and assert `(now() AT TIME ZONE 'America/New_York')::date - 1` matches the calendar day correctly
- [ ] `src/features/groups/useGroupLeaderboard.test.ts` — Jest hook test mocking `supabase.rpc`
- [ ] `src/features/groups/useGroupLeaderboardRealtime.test.ts` — Jest mock-channel test for `setQueryData` + sort
- [ ] `src/features/submissions/useGroupFeed.test.ts` — Jest hook test for direct PostgREST select on submissions
- [ ] `src/features/groups/useGroupTombstones.test.ts` — Jest hook test (the combined `'today' | 'yesterday'` variant)
- [ ] `src/features/groups/useGroupSocialCounts.test.ts` — Jest hook test for the count RPC

**Estimated coverage:** 4 pgTAP files (parity with 0006's 4) + 5 Jest test files. Existing test infrastructure (jest-expo, supabase CLI for pgTAP) is sufficient — no framework install needed.

## Security Domain

> `security_enforcement` is enabled by default (no config flag).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing supabase-auth flow; RPCs gate on `auth.uid() is null` |
| V3 Session Management | yes | Existing AsyncStorage + SecureStore hybrid (P1) |
| V4 Access Control | **yes — critical** | (a) RLS on every public-schema table (already enforced by CI); (b) SECURITY DEFINER RPCs with explicit `is_group_member` gate; (c) NEW: column-allowlist trigger on `group_members` (D-19) preventing client writes to counter columns |
| V5 Input Validation | yes | RPCs validate p_group_id is a uuid type; no free-text inputs in P4 RPCs |
| V6 Cryptography | n/a | No crypto operations in P4 |
| V7 Error Handling | yes | Typed errors via `raise exception '...' using errcode = 'P0001'` (mirror P3 0006 pattern); no SQL-state leaks |

### Known Threat Patterns for Phase 4

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-member queries `get_pending_today` to enumerate group membership | Information Disclosure | `is_group_member` raise inside RPC body — non-members get `not_member` error, NOT an empty list (which would also leak existence vs. non-existence) |
| Admin maliciously sets `group_members.points = 9999` via direct REST UPDATE | Tampering | **D-19: column-allowlist BEFORE UPDATE trigger on group_members.** Without this, RLS `group_members_update_admin` (P1) allows admins to UPDATE *any* column including counter columns. **Recommend shipping the trigger.** |
| Replay attack: admin re-flips submission status approved → pending → approved to double-count points | Tampering / repudiation | **Already mitigated** by 0003's admin-immutable trigger (0003 lines 60-64 forbid status flip-back) + the 0001 WHEN clause `(old.status IS DISTINCT FROM new.status AND new.status = 'approved')` only fires on transitions INTO approved. **D-03 banks on this.** |
| Cross-group leak: admin of group A queries `get_pending_today` for group B | Information Disclosure | `is_group_member(p_group_id)` checks the caller is in *this* group; group A admin not in group B → `not_member`. Mirrors P3 Threat 7 (cross-group review attack mitigation in 0006). |
| Stale leaderboard cache after a member is removed | Information Disclosure | Out-of-scope edge case for P4. `useGroupLeaderboard` re-runs on focus; on next focus the removed member's row drops because `group_members` no longer has them. **Acceptable.** |
| Realtime channel sees events from a group the user is not in | Authorization bypass | `postgres_changes` filter is server-side `group_id=eq.{id}`. Realtime checks RLS on the `group_members` row before sending — the user's session JWT must satisfy the `group_members_select_own_or_same_group` policy. **Verified existing P3 pattern.** |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: shipped migration] `supabase/migrations/0001_foundation.sql` lines 102-178 (group_members + RLS + index), lines 360-384 (counter trigger STUB + AFTER UPDATE wiring)
- [VERIFIED: shipped migration] `supabase/migrations/0003_phase1_review_fixes_2.sql` (admin-immutable trigger pattern; idempotency basis for D-03)
- [VERIFIED: shipped migration] `supabase/migrations/20260429173246_phase3_capture_review.sql` (RPC shape, typed errors, revoke/grant pattern, the `review_submission` UPDATE that fires P4's trigger)
- [VERIFIED: shipped migration] `supabase/migrations/20260506165538_phase3_realtime_publication.sql` (publication-add idempotent pattern — 0008 mirrors verbatim for `group_members`)
- [VERIFIED: shipped code] `src/features/submissions/useTodaySubmissionRealtime.ts` (the canonical Realtime hook shape P4 mirrors verbatim)
- [VERIFIED: shipped code] `src/features/submissions/time.ts` (todayLocalDate, DST-safe addOneDay — reusable for D-21 client-narrowing)
- [VERIFIED: shipped pgTAP] `supabase/tests/get_pending_review_count.sql` (the JWT-claims + `set local role authenticated` pattern P4's pgTAP files mirror)
- [VERIFIED: shipped code] `app/(app)/index.tsx` lines 287-342 (GroupCardRow exists; per-row hook pattern works)
- [VERIFIED: shipped code] `app/(app)/groups/[id]/index.tsx` (uses `<ScrollView>`, NOT FlatList — D-09 stacked sections compose into the existing ScrollView; **see §7 below**)
- [CITED: CONTEXT.md] `.planning/phases/04-social-surfaces/04-CONTEXT.md` D-01..D-21 (locked decisions)
- [CITED: UI-SPEC] `.planning/phases/04-social-surfaces/04-UI-SPEC.md` (binding visual + interaction contract; resolves Realtime animation discretion to "instant swap")

### Secondary (MEDIUM confidence)
- [CITED: research/STACK.md] supabase-js 2.58 + TanStack Query v5 (`isPending`) + expo-router v6 (`useFocusEffect`) — all already in `package.json`
- [CITED: research/PITFALLS.md] §1 (server local_date), §2 (UNIQUE constraint shipped), §11 (Realtime cleanup), §13 (leaderboard N+1 — addressed by single-join RPC)
- [CITED: research/ARCHITECTURE.md] §"Data Flow: Admin approves" (matches Pattern 1 above except column name)

### Tertiary (LOW confidence)
- None — every claim in this research is grounded in either shipped code or locked CONTEXT decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already pinned in `package.json`; no new deps.
- Architecture: HIGH — the 0001 trigger wiring + 0006 RPC pattern + 0007 publication pattern are all shipped and verified; P4 is plumbing.
- Pitfalls: HIGH — CGF-1 (publication missing) and Pitfall P4-B (concurrent-approval race) are both grounded in observable schema state and shipped P3 UAT lessons.
- Realtime topology: HIGH — `useTodaySubmissionRealtime.ts` is the verbatim shape P4 hooks mirror; the only gating concern (CGF-1) is identified and addressed.
- Trigger body: HIGH — D-02 branches map directly to the CASE expression; the `last_rolled_date + 1` date arithmetic is standard Postgres; the AFTER UPDATE WHEN semantics are verified.
- pgTAP coverage shape: HIGH — 0006's 4-file pattern is the parity target; CONTEXT explicitly aims for ≥4.

**Research date:** 2026-05-08
**Valid until:** 2026-06-07 (30 days — stable; only invalidated if Phase 5's pg_cron design changes the trigger contract or if Realtime semantics change)

---

## Appendix §1 — Trigger body, exact SQL (CONTEXT D-01..D-04, D-18)

Already shown in §"Code Examples > Migration shape" above. The variable-then-update form (compute `v_new_streak` first, then a single UPDATE) is preferred over the duplicate-CASE form for testability and readability. **No subtleties around AFTER UPDATE WHEN + SECURITY DEFINER + transaction semantics that affect testability beyond CGF-2** (which is satisfied by the existing trigger wiring; pgTAP fires the trigger by calling `review_submission` directly).

## Appendix §2 — Three new SECURITY DEFINER RPCs, exact signatures + body shape

Already shown in §"Code Examples > Migration shape" + Pattern 2. **Signatures (final):**

```sql
public.get_pending_today(p_group_id uuid)
  returns table (user_id uuid, display_name text, avatar_path text, updated_at timestamptz)
  -- typed: not_authenticated, not_member, group_not_found

public.get_missed_yesterday(p_group_id uuid)
  returns table (user_id uuid, display_name text, avatar_path text, updated_at timestamptz)
  -- typed: not_authenticated, not_member, group_not_found

public.get_today_posted_count(p_group_id uuid) returns int
  -- soft-fail: returns 0 for not_authenticated / not_member / group_not_found
```

**No `local_date_for(group_id)` helper exists in shipped schema.** Each RPC computes its own `v_today := (now() AT TIME ZONE g.timezone)::date` inline (4 lines per RPC). The lack of a helper is **deliberate** — adding one is more surface area for an MVP and the inline form is auditable.

## Appendix §3 — Optional column-allowlist trigger on group_members (D-19)

**Recommendation: SHIP IT.** Already shown in §"Code Examples > Migration shape" item 2.

**Justification:**
- The `group_members_update_admin` RLS policy (0001 line 168) allows admins to UPDATE any column. Without the trigger, an admin could `update group_members set points = 9999 where user_id = self` via the REST API.
- The 0003 admin-immutable trigger on `submissions` is the canonical reference for this pattern.
- The `auth.uid() IS NULL` early-return mirrors 0003's same gate — when the AFTER UPDATE WHEN trigger from `handle_submission_approval` fires inside `SECURITY DEFINER`, `auth.uid()` is the calling admin, NOT NULL, but the column-allowlist is checking `is distinct from old`, and the trigger body wrote new values — so the check would *fire*. **CRITICAL FIX: the BEFORE UPDATE column-allowlist trigger must NOT block the definer-path itself.**

**Resolution:** The recommended trigger body in §"Code Examples" item 2 has a subtle bug — `auth.uid() is null` would NOT be true during a `handle_submission_approval` call (which runs as definer but inherits the calling JWT context). **Fix the body:** check whether the call originates from the `handle_submission_approval` trigger by checking `pg_trigger_depth() > 1` OR add a sentinel check. Cleanest pattern:

```sql
create or replace function public.group_members_counter_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If the UPDATE is itself from inside another trigger (e.g.
  -- handle_submission_approval fires while reviewing), allow it. The trigger
  -- body is the only blessed write path for counter columns.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Otherwise, refuse changes to counter columns from any direct UPDATE path
  -- (REST API, psql session, even an admin-role call). Preserves D-19 invariant.
  if new.points          is distinct from old.points
     or new.current_streak  is distinct from old.current_streak
     or new.longest_streak  is distinct from old.longest_streak
     or new.last_rolled_date is distinct from old.last_rolled_date then
    raise exception 'group_members counter columns are server-managed';
  end if;

  return new;
end;
$$;

drop trigger if exists group_members_counter_immutable_trigger on public.group_members;
create trigger group_members_counter_immutable_trigger
  before update on public.group_members
  for each row execute function public.group_members_counter_immutable();
```

**`pg_trigger_depth()` returns the current trigger nesting depth.** When `handle_submission_approval` calls `update group_members ...`, the BEFORE UPDATE on `group_members` fires inside the AFTER UPDATE on `submissions` — depth = 2. A direct REST API call to UPDATE `group_members` is depth = 1. **This cleanly distinguishes the two paths.**

**pgTAP test for this trigger** (lives in `phase4_rpc_permissions.sql`): impersonate an admin via JWT claims, attempt `update group_members set points = 9999`, expect raise.

## Appendix §4 — Realtime channel topology

**Three new channels (D-15, D-20, D-21):**

| Channel name | Filter | Table | Lifecycle | Cleanup hook |
|--------------|--------|-------|-----------|--------------|
| `todaycard:{userId}:{groupId}` | `group_members.group_id=eq.{groupId}` | `public.group_members` | Per-row in Today FlatList | `useFocusEffect` inside `GroupCardRow` per Today's screen-tab semantics (Tabs don't unmount; useEffect would leak) |
| `group-lb:{groupId}` | `group_members.group_id=eq.{groupId}` | `public.group_members` | Per-screen on group-detail | `useFocusEffect` inside `useGroupLeaderboardRealtime` |
| `group-feed:{groupId}` | `submissions.group_id=eq.{groupId}` | `public.submissions` | Per-screen on group-detail | `useFocusEffect` inside `useGroupFeedRealtime` |

**Single-column filter constraint** (verified P3 D-13 + supabase-js docs): `postgres_changes` filter syntax supports a single column equality predicate via `filter: 'col=eq.value'`. Multi-column filters (e.g. `group_id=eq.X AND status=eq.approved`) are NOT supported at the channel level — narrow client-side in the handler.

**Client-side narrowing for D-21 — exact condition:**
```ts
// Inside the postgres_changes handler for `group-feed:{groupId}`:
const newRow = payload.new as { group_id: string; user_id: string;
  local_date: string; status: 'pending'|'approved'|'rejected'; id: string } | undefined;
const oldRow = payload.old as { status?: 'pending'|'approved'|'rejected' } | undefined;

const today = todayLocalDate(groupTz, new Date());
if (!newRow || newRow.local_date !== today) return;

const flippedToApproved = newRow.status === 'approved' && oldRow?.status !== 'approved';
const flippedFromApproved = newRow.status !== 'approved' && oldRow?.status === 'approved';
if (!flippedToApproved && !flippedFromApproved) return;

// Patch the feed query cache + invalidate the leaderboard.
qc.setQueryData<FeedRow[] | undefined>(['groupFeed', groupId, today], (prev) => {
  if (!prev) return prev;
  if (flippedToApproved) {
    return [{ ...newRow, /* hydrate display fields */ }, ...prev];
  } else {
    return prev.filter((r) => r.id !== newRow.id);
  }
});
qc.invalidateQueries({ queryKey: ['groupLeaderboard', groupId] });
```

**Cleanup ordering on screen blur:** `useFocusEffect`'s returned cleanup runs synchronously on blur. Two channels per group-detail screen (`group-lb:{id}` + `group-feed:{id}`) tear down independently. No ordering concern. Pitfall #11 satisfied.

## Appendix §5 — pgTAP coverage, concrete file split

| File | Asserts | Test count |
|------|---------|-----------|
| `handle_submission_approval_streak.sql` | D-02 4 branches: NULL → streak=1; consecutive → streak+1; gap → streak=1 (longest preserved); same-day blocked by UNIQUE (insert raises). D-01 server-derived `local_date` proof: insert two submissions in different tz groups same wall-clock moment, assert each `last_rolled_date` matches its group's local_date. D-04 longest_streak update path. | ~8 assertions |
| `handle_submission_approval_idempotency.sql` | D-03: re-fire blocked — manually fire `update submissions set status='approved' where status='approved'` (no-op due to WHEN clause) and assert points unchanged. 0003 trigger blocks status flip-back: `update submissions set status='pending' where id=...` raises (admin-immutable). Pitfall P4-B concurrency: serial `review_submission` calls for two consecutive-day submissions → final `points = 2, current_streak = 2`. | ~5 assertions |
| `phase4_rpc_permissions.sql` | `get_pending_today` non-member → `not_member`; anon → `not_authenticated`. Same for `get_missed_yesterday`. `get_today_posted_count` non-member → returns 0 (lenient). Direct UPDATE on `group_members.points` from authenticated admin role → raise (column-allowlist trigger §3). | ~6 assertions |
| `phase4_rpc_correctness.sql` | `get_pending_today` happy path: 3 members, 1 with submission today, 1 without, 1 just joined → returns 2. `get_missed_yesterday` ignores rows with `status='pending'` for yesterday's local_date (correctly returns those members in the missed list). DST edge: insert + assert across spring-forward day in `America/New_York`. `get_today_posted_count` returns count of `status='approved'` rows for today's local_date. | ~10 assertions |

**Total: 4 files, ~29 assertions.** Parity with 0006's 4 files for 3 RPCs. CONTEXT explicitly aims for ≥4.

**Note on column-allowlist trigger test placement:** Logically in `phase4_rpc_permissions.sql` because it's an authorization control. Could equally be in a 5th file `group_members_counter_immutable.sql`. **Recommend single permissions file** for cohesion.

## Appendix §6 — TanStack hook + Realtime patch shape

**4 new hooks** (named in CONTEXT.md §"Integration Points"):

| Hook | Read pattern | Cache key | Realtime patch | Realtime invalidation |
|------|-------------|-----------|----------------|-----------------------|
| `useGroupLeaderboard(groupId)` | RPC `get_group_leaderboard` (recommended) — single composite-row query | `['groupLeaderboard', groupId]` | `setQueryData` + re-sort by points DESC, current_streak DESC | none |
| `useGroupFeed(groupId, today)` | Direct PostgREST select on submissions: `from('submissions').select('id, user_id, local_date, status, caption, media_path, media_type, created_at, profiles(display_name, avatar_path, updated_at)').eq('group_id', groupId).eq('local_date', today).eq('status', 'approved').order('created_at', { ascending: false })` | `['groupFeed', groupId, today]` | `setQueryData` (prepend on flip-to-approved, filter out on flip-from-approved) | `invalidateQueries(['groupLeaderboard', groupId])` per D-21 belt-and-suspenders |
| `useGroupTombstones(groupId, scope: 'today' \| 'yesterday')` | RPC: `get_pending_today` (when scope='today') or `get_missed_yesterday` (when scope='yesterday'). **Combined hook** with a `scope` arg = simpler than two hooks. | `['groupTombstones', groupId, scope]` | `'today'` variant invalidated by feed Realtime hook above (when a member submits, they leave the pending-today list); `'yesterday'` variant has no Realtime (it changes only at midnight rollover, P5 territory) | none |
| `useGroupSocialCounts(groupId, userId)` | RPC `get_today_posted_count(groupId)` for `posted`. Read user's own row from leaderboard cache for `points`/`streak`. `total` from `useGroup` / `useGroupMembers` length. | `['todaySocialCounts', groupId]` | invalidate on Realtime UPDATE in `useGroupLeaderboardRealtime` (already wired — see Pattern 3) | invalidate on per-card Realtime channel events (D-15) |

**Recommend `get_group_leaderboard` RPC:** despite D-04 saying "single SELECT direct," the typed return shape (`pnpm types:gen` produces a clean composite type) and the embedded profile join in one statement are cleaner than the PostgREST embedded-select form. The hook signature stays a one-liner. The pgTAP coverage automatically tests the read path. **This is in the Claude's Discretion list** — research formally recommends RPC.

**RPC body for `get_group_leaderboard`:**
```sql
create or replace function public.get_group_leaderboard(p_group_id uuid)
returns table (
  user_id          uuid,
  display_name     text,
  avatar_path      text,
  updated_at       timestamptz,
  points           int,
  current_streak   int,
  longest_streak   int,
  last_rolled_date date,
  joined_at        timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;

  return query
    select gm.user_id,
           p.display_name,
           p.avatar_path,
           p.updated_at,
           gm.points,
           gm.current_streak,
           gm.longest_streak,
           gm.last_rolled_date,
           gm.joined_at
      from public.group_members gm
      left join public.profiles p on p.id = gm.user_id
     where gm.group_id = p_group_id
     order by gm.points desc, gm.current_streak desc;
end;
$$;

revoke execute on function public.get_group_leaderboard(uuid) from public;
grant  execute on function public.get_group_leaderboard(uuid) to authenticated;
```

**Index used:** the planner picks `group_members_leaderboard_idx (group_id, points desc, current_streak desc)` shipped in 0001. Verified by `EXPLAIN`-ing the equivalent query (the index ordering matches the ORDER BY exactly — no sort needed).

## Appendix §7 — group-detail layout integration (D-09)

**Verified the existing screen at `app/(app)/groups/[id]/index.tsx` uses `<ScrollView>` (not FlatList).** Lines 323-326:
```tsx
<ScrollView contentContainerStyle={{ paddingBottom: t.spacing['2xl'], gap: t.spacing.xl }}>
```

**D-09 stacking is straightforward:** insert four new sections between the existing Header block (lines 329-355) and the Members section (lines 481-518). Each new section is a `<View>` with its own internal `gap` / `marginTop` per UI-SPEC §"Spacing Scale" `mt-6` (24pt) / `mt-7` (28pt) / `xl` (24pt) values.

**Hook order constraints:** the existing screen calls 5 query hooks at the top (lines 85-91). New hooks add: `useGroupLeaderboard(id)`, `useGroupFeed(id, today)`, `useGroupTombstones(id, 'today')`, `useGroupTombstones(id, 'yesterday')`, plus `useGroupLeaderboardRealtime(id)` and `useGroupFeedRealtime(id, group?.timezone)`. **Total: 6 new hooks at the top of the screen component.** Order matters for Rules of Hooks but doesn't affect behavior — call them all unconditionally before any early return. The current screen returns `<GroupDetailSkeleton />` if `groupPending || membersPending || !group || !members` — **the new hook calls must precede this conditional return**.

**Skeleton during loading:** the existing skeleton is fine — leaderboard / feed / etc. just render their own internal "loading" rows during `isPending`. Or, recommend: extend the skeleton to include 4 placeholder section blocks of 64-150pt each. **Discretion item.**

## Appendix §8 — Today screen integration (D-13/D-14/D-15)

**Verified `GroupCardRow` exists** as a per-FlatList-item component in `app/(app)/index.tsx` lines 287-342. Calls per-group hooks (`useTodaySubmission`, `useUploadQueue`, `cutoffStateFor`) inside the row — Rules of Hooks satisfied because each FlatList item instantiates its own component instance.

**Adding D-13/D-15 inside `GroupCardRow`:**
```tsx
function GroupCardRow({ group, onSubmitPress, onRejectedPillPress, onQueueBadgeMorePress }) {
  // existing hooks: today / submission / queue / cutoff ...
  const today = useMemo(() => todayLocalDate(group.timezone, new Date()), [group.timezone]);
  const { data: submission } = useTodaySubmission(group.id, today);
  const { data: queueMap } = useUploadQueue();
  const cutoff = useMemo(() => cutoffStateFor({ timezone: group.timezone }), [group.timezone]);

  // NEW (D-13): social-signal data
  const { user } = useSession();
  const { data: leaderboard } = useGroupLeaderboard(group.id);
  const { data: postedCount } = useGroupSocialCounts(group.id, user?.id);
  const userRow = leaderboard?.find((r) => r.user_id === user?.id);
  const total = leaderboard?.length ?? 0;
  const social = total > 0 && postedCount != null ? {
    posted: postedCount,
    total,
    points: userRow?.points ?? 0,
    streak: userRow?.current_streak ?? 0,
  } : undefined;

  // NEW (D-15): per-card Realtime
  useGroupTodayCardRealtime(group.id, user?.id);  // dedicated hook; thin wrapper

  return <GroupCard {...existingProps} social={social} />;
}
```

**Hook order across the FlatList:** every row instantiates the same set of hooks in the same order. Groups with no leaderboard data → hooks return `data: undefined`, the social prop is `undefined`, `GroupCard` renders P3-byte-identical (per UI-SPEC §"Component Modifications §0"). Ex-members and brand-new groups are non-issues.

**Pitfall: hook-count fluctuation across renders.** Forbidden by React. Each row calls 5 (existing) + 3 (new query) + 1 (new realtime) = 9 hooks unconditionally per row. Adding/removing groups causes row mount/unmount, NOT hook-count changes within a row.

---

## RESEARCH COMPLETE

### Key Findings

1. **CGF-1: `group_members` is missing from the `supabase_realtime` publication.** Without the `alter publication supabase_realtime add table public.group_members` block at the top of 0008, LB-02 + Today social-signal Realtime updates silently fail. **This is the highest-risk finding** because pgTAP won't catch it — only multi-device manual UAT will.
2. **The trigger body is a 4-line CASE expression in a single UPDATE statement**, anchored to `last_rolled_date + 1` integer-day arithmetic. AFTER UPDATE WHEN trigger semantics + the existing 0003 admin-immutable + the 0001 WHEN clause give D-03 idempotency for free — no new guard needed.
3. **3 new SECURITY DEFINER RPCs** (`get_pending_today`, `get_missed_yesterday`, `get_today_posted_count`) plus a **recommended 4th** (`get_group_leaderboard`) for stable contract over the leaderboard read. Each computes its own `(now() AT TIME ZONE g.timezone)::date` inline — no shared helper exists or is needed.
4. **The column-allowlist trigger on `group_members` (D-19) is recommended.** The naive `auth.uid() IS NULL` early-return is wrong for this trigger's path; use `pg_trigger_depth() > 1` to allow definer-trigger nested calls and block direct REST UPDATEs.
5. **All Realtime hooks mirror `useTodaySubmissionRealtime.ts` verbatim** — single-column filter, client-side narrowing, `setQueryData` patches, `useFocusEffect` cleanup. Three new channels at most: `todaycard:{user}:{group}`, `group-lb:{group}`, `group-feed:{group}`.

### File Created
`/Users/chris/projects/accountibuzz/.planning/phases/04-social-surfaces/04-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All deps already pinned; no new packages |
| Architecture | HIGH | All shipped patterns (trigger wiring, RPC shape, Realtime hook) are verified in code |
| Trigger body | HIGH | D-02 branches map directly to CASE; date arithmetic is standard Postgres |
| Realtime topology | HIGH | Verbatim mirror of P3's working pattern + CGF-1 fix is mechanical |
| pgTAP coverage | HIGH | Parity with 0006's pattern; 4 files cover trigger branches + RPCs + permissions |
| Pitfalls | HIGH | CGF-1 + Pitfall P4-B (concurrency) are both grounded in observable schema state |
| UI integration | HIGH | Existing GroupCardRow + group-detail ScrollView accommodate D-09/D-13 cleanly |

### Open Questions (RESOLVED)

1. **RESOLVED:** **Backfill for existing approved P3 UAT submissions?** Currently `group_members.points = 0` on every row even though P3 UAT generated 7+ approved submissions. Recommendation: **accept status quo** (P3 UAT was test data; production starts at 0). Document in 0008 migration comment + STATE.md. Risk: zero — no production users exist.
2. **RESOLVED:** **`longest_streak` on the leaderboard row in P4 vs P6?** UI-SPEC §"Leaderboard row copy" doesn't render it. Research recommends defer (cheap to add later; nothing to test). CONTEXT marks as Claude's Discretion.
3. **RESOLVED:** **Skeleton state for the new sections during initial load?** Existing `<GroupDetailSkeleton />` covers the screen wholesale. Recommendation: extend skeleton with 4 muted placeholder blocks, but acceptable to defer to UI-spec polish.

### Ready for Planning

Research complete. Planner can now create PLAN.md files. Recommended plan structure (mirrors P3's 8-plan pattern):

- **04-01-PLAN.md** — Wave 0 infrastructure: confirm dev-build still works, Jest mock for `supabase.channel` if absent, no new deps
- **04-02-PLAN.md** — Migration 0008: realtime publication + handle_submission_approval body + counter-immutable trigger + 4 RPCs + 4 pgTAP files + `[BLOCKING] supabase db push` + `pnpm types:gen` + commit `database.ts`
- **04-03-PLAN.md** — Data layer hooks: `useGroupLeaderboard`, `useGroupLeaderboardRealtime`, `useGroupFeed`, `useGroupFeedRealtime`, `useGroupTombstones`, `useGroupSocialCounts`, `useGroupTodayCardRealtime` + Jest tests
- **04-04-PLAN.md** — UI primitives: `LeaderboardRow`, `FeedItem`, `StillToPostAvatarRow` + GroupCard `social` prop modification + component tests
- **04-05-PLAN.md** — Group-detail screen integration: insert 4 new sections in stack order between Header and Members
- **04-06-PLAN.md** — Today screen integration: GroupCardRow social-signal line + per-group Realtime channel
- **04-07-PLAN.md** — Phase verification: full test suite + manual 2-device UAT walkthrough (mirror P3 CK-5 for LB-02; visual check for tombstones / still-to-post / feed prepend)

Plan structure may compress to 6 plans if the planner sees UI primitives + group-detail integration as a single wave. Final granularity is the planner's call.
