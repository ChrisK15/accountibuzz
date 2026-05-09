-- =============================================================================
-- 20260508233129_phase4_points_streaks_feed.sql — Phase 4 Social Surfaces (server contract)
-- =============================================================================
-- Append-only follow-up to 0001..0007. Replaces the handle_submission_approval
-- STUB shipped in 0001 §10 (lines 365-384) with the real body. Adds 4
-- SECURITY DEFINER RPCs powering the leaderboard / pending-today / missed-
-- yesterday / today-posted-count surfaces. Adds group_members to the
-- supabase_realtime publication (CGF-1; mirror of 0007's submissions fix).
-- Sets `replica identity full` on submissions so Realtime payload.old contains
-- pre-update column values (CGF-2 / HIGH #2 — required by 04-03's
-- useGroupFeedRealtime to inspect payload.old.status). Adds a column-allowlist
-- BEFORE UPDATE trigger on group_members (D-19; parallels 0003 admin-immutable
-- on submissions, with a pg_trigger_depth() bypass for the definer-trigger path).
--
-- Locked decisions: D-01..D-21 from .planning/phases/04-social-surfaces/04-CONTEXT.md.
--
-- REVIEWS replan 2026-05-08 (.planning/phases/04-social-surfaces/04-REVIEWS.md):
--   HIGH #1  — Streak race condition: trigger body is a single locked-row
--              UPDATE driven by a CASE expression (no SELECT-then-UPDATE window).
--   HIGH #2  — Realtime payload.old: `alter table submissions replica identity
--              full` so 04-03 useGroupFeedRealtime can read payload.old.status.
--   HIGH #6  — Strict-grant on get_today_posted_count: revoke from public,
--              grant only to authenticated; anon callers hit SQLSTATE 42501.
--   HIGH #12 — Same-day no-points: trigger body gates `points = points + 1`
--              on the recurrence-branch CASE; same-day is a no-op for both
--              streak and points (belt-and-suspenders on top of the UNIQUE
--              constraint uq_submissions_user_group_local_date in 0001).
--   MEDIUM   — Deterministic leaderboard ORDER BY: append `joined_at ASC` as
--              the third sort key for stable ordering on (points,
--              current_streak) ties.
--
-- New SECURITY DEFINER functions (revoked from public, granted to authenticated):
--   public.get_pending_today(p_group_id uuid)
--     returns table (user_id uuid, display_name text, avatar_path text, updated_at timestamptz)
--     typed errors: not_authenticated, not_member, group_not_found
--   public.get_missed_yesterday(p_group_id uuid)
--     returns table (user_id uuid, display_name text, avatar_path text, updated_at timestamptz)
--     typed errors: not_authenticated, not_member, group_not_found
--   public.get_today_posted_count(p_group_id uuid) returns int
--     soft-fail (returns 0) for not_member / group_not_found AFTER the
--     authenticated-grant gate (anon → SQLSTATE 42501 from missing privilege).
--   public.get_group_leaderboard(p_group_id uuid)
--     returns table (user_id uuid, display_name text, avatar_path text, updated_at timestamptz,
--                    points int, current_streak int, longest_streak int, last_rolled_date date,
--                    joined_at timestamptz)
--     typed errors: not_authenticated, not_member
--
-- Replaces:
--   public.handle_submission_approval — body filled in (was no-op stub).
--                                       Trigger wiring (AFTER UPDATE OF status
--                                       WHEN approved) is left untouched from 0001.
--
-- Adds (new):
--   public.group_members_counter_immutable — BEFORE UPDATE trigger on
--                                            group_members. Parallels the 0003
--                                            admin-immutable trigger on submissions.
--                                            Uses pg_trigger_depth() > 1 to bypass
--                                            the definer-trigger path (the
--                                            handle_submission_approval AFTER UPDATE
--                                            triggers a depth-2 BEFORE UPDATE that
--                                            we want to allow).
--
-- Realtime publication / replica identity:
--   group_members → added to supabase_realtime (idempotent block).
--   submissions   → replica identity FULL so payload.old contains every column.
--
-- NO new public-schema TABLES. CI rls-check workflow stays green incidentally.
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

-- 0.5. Realtime replica identity for submissions (CGF-2 — REVIEWS replan
-- 2026-05-08, HIGH #2 from 04-REVIEWS.md).
-- Without REPLICA IDENTITY FULL, postgres_changes payload.old contains only the
-- primary key, so 04-03's useGroupFeedRealtime cannot reliably inspect
-- payload.old.status to detect approve→reject flips. Setting it FULL guarantees
-- payload.old contains every column.
-- Storage cost: minor — replica identity is a logical-decoding detail, not row
-- duplication. Idempotent (alter ... replica identity is a no-op if already FULL).
alter table public.submissions replica identity full;

-- -----------------------------------------------------------------------------
-- 1. handle_submission_approval BODY (D-01..D-04, D-18).
--
-- HIGH #1 from 04-REVIEWS.md (RESOLVED via REVIEWS replan 2026-05-08): race-safe
-- via single-locked-row UPDATE. The CASE expression computes the new streak
-- from the row's CURRENT (locked) state during the UPDATE itself — there is NO
-- read-modify-write window. Postgres MVCC + the row lock taken by the UPDATE
-- guarantee both concurrent approvals see consistent state.
--
-- Recurrence branches (D-02):
--   - last_rolled_date IS NULL                       → current_streak := 1     (NULL branch — first approval ever)
--   - new.local_date = last_rolled_date + 1          → current_streak := current_streak + 1   (consecutive)
--   - new.local_date = last_rolled_date              → current_streak unchanged (same-day; structurally
--                                                      impossible due to UNIQUE constraint
--                                                      uq_submissions_user_group_local_date in 0001 §submissions,
--                                                      but gated here belt-and-suspenders per HIGH #12)
--   - new.local_date > last_rolled_date + 1          → current_streak := 1     (gap branch — strict reset per
--                                                      PROJECT.md "miss = reset"; complements P5 pg_cron rollover
--                                                      for the case where an approval lands across a gap before
--                                                      rollover ran)
--   - new.local_date < last_rolled_date              → current_streak unchanged (backdated approval — rare;
--                                                      the row's last_rolled_date already reflects a later day,
--                                                      so this approval doesn't advance it)
--
-- Points are incremented ONLY on branches that ADVANCE last_rolled_date (NULL,
-- consecutive, gap). Same-day and backdated branches do NOT increment points
-- (HIGH #12 belt-and-suspenders).
-- -----------------------------------------------------------------------------
create or replace function public.handle_submission_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_members
     set
       current_streak = case
         when last_rolled_date is null                      then 1
         when new.local_date = last_rolled_date + 1         then current_streak + 1
         when new.local_date = last_rolled_date             then current_streak
         when new.local_date > last_rolled_date + 1         then 1
         else current_streak                                                  -- backdated: no advance
       end,
       longest_streak = greatest(
         longest_streak,
         case
           when last_rolled_date is null                    then 1
           when new.local_date = last_rolled_date + 1       then current_streak + 1
           when new.local_date = last_rolled_date           then longest_streak  -- no change
           when new.local_date > last_rolled_date + 1       then 1
           else longest_streak                                                -- backdated: no change
         end
       ),
       last_rolled_date = case
         when last_rolled_date is null                      then new.local_date
         when new.local_date > last_rolled_date             then new.local_date
         else last_rolled_date                                                -- same-day or backdated: no change
       end,
       points = points + case
         when last_rolled_date is null                      then 1
         when new.local_date > last_rolled_date             then 1
         else 0                                                               -- same-day or backdated: no points
       end
   where group_id = new.group_id
     and user_id  = new.user_id;

  return new;
end;
$$;

-- The 0001 trigger wiring on public.submissions
--   (after update of status when (old.status is distinct from new.status
--                                 and new.status = 'approved'))
-- is left UNTOUCHED — only the function body is replaced.

-- -----------------------------------------------------------------------------
-- 2. group_members_counter_immutable BEFORE UPDATE trigger (D-19).
--
-- Defense-in-depth: the group_members_update_admin RLS policy (0001 §group_members)
-- allows admins to UPDATE columns on group_members. Without this trigger, an
-- admin could `update group_members set points = 9999 where user_id = self`
-- via the REST API. Mirrors the 0003 submissions_owner_immutable pattern.
--
-- BYPASS: pg_trigger_depth() > 1 lets the definer-trigger path through. When
-- handle_submission_approval (AFTER UPDATE on submissions) issues
-- `update public.group_members ...`, the BEFORE UPDATE on group_members fires
-- inside that trigger context — depth = 2. A direct REST API UPDATE on
-- group_members fires at depth = 1. This cleanly distinguishes the two paths
-- without depending on auth.uid() (which IS NULL only for service_role; the
-- definer-trigger path runs in the calling admin's JWT context where auth.uid()
-- is the admin, NOT NULL).
-- -----------------------------------------------------------------------------
create or replace function public.group_members_counter_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Definer-trigger bypass: handle_submission_approval's UPDATE fires this
  -- trigger at depth = 2. Direct REST API UPDATEs fire at depth = 1.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Refuse client-driven UPDATEs that mutate counter columns from any direct
  -- path (REST API, psql session, even an admin-role call).
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

-- -----------------------------------------------------------------------------
-- 3. get_pending_today RPC (D-07, D-17, FEED-02).
--
-- Returns members of p_group_id who have NO submission row for today's
-- local_date — covers pending, rejected, AND no-row cases. A member with ANY
-- submission today (any status) is excluded from "Still to post". Per
-- D-XX-rejected-policy: a rejected submission counts as engagement; the member
-- is not re-prompted. Re-submission flow after admin rejection is a P5+ concern.
--
-- Membership-gated: typed errors `not_authenticated`, `not_member`,
-- `group_not_found` via SQLSTATE 'P0001'.
-- -----------------------------------------------------------------------------
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
  caller     uuid := auth.uid();
  v_group_tz text;
  v_today    date;
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

-- -----------------------------------------------------------------------------
-- 4. get_missed_yesterday RPC (D-05, D-17, FEED-03).
--
-- Symmetric to get_pending_today, but targets yesterday's local_date and only
-- excludes members who have an APPROVED submission for that day. Pending and
-- rejected submissions for yesterday count as misses (the streak math from §1
-- already treated them as not-credited).
--
-- Membership-gated; same typed errors as get_pending_today.
-- -----------------------------------------------------------------------------
create or replace function public.get_missed_yesterday(p_group_id uuid)
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
  caller        uuid := auth.uid();
  v_group_tz    text;
  v_target_date date;
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

  v_target_date := (now() AT TIME ZONE v_group_tz)::date - 1;

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
            and s.local_date = v_target_date
            and s.status = 'approved'
       )
     order by p.display_name asc;
end;
$$;

revoke execute on function public.get_missed_yesterday(p_group_id uuid) from public;
grant  execute on function public.get_missed_yesterday(p_group_id uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. get_today_posted_count RPC (D-13, D-17 — powers Today GroupCard signal).
--
-- HIGH #6 (RESOLVED via REVIEWS replan 2026-05-08): strict-grant. Anon callers
-- hit SQLSTATE 42501 (permission denied) BEFORE the function body runs. Only
-- authenticated callers reach the body; authenticated non-members get the
-- lenient return-0 path (no leak about group existence).
--
-- pgTAP contract (04-01 phase4_rpc_permissions.sql Test 1):
--   anon       → throws_ok SQLSTATE '42501'
--   stranger   → is(get_today_posted_count(g), 0)   (lenient soft-fail)
--   member     → is(get_today_posted_count(g), N)   (correct count)
-- -----------------------------------------------------------------------------
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
  if caller is null then return 0; end if;             -- defensive (grant gate already blocks anon)
  if not public.is_group_member(p_group_id) then return 0; end if;

  select g.timezone into v_group_tz
    from public.groups g
   where g.id = p_group_id;
  if not found then return 0; end if;

  v_today := (now() AT TIME ZONE v_group_tz)::date;

  return (
    select count(*)::int
      from public.submissions
     where group_id  = p_group_id
       and local_date = v_today
       and status    = 'approved'
  );
end;
$$;

revoke execute on function public.get_today_posted_count(uuid) from public;
grant  execute on function public.get_today_posted_count(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. get_group_leaderboard RPC (D-04, D-17, LB-01 + LB-02 read path).
--
-- Single composite-row read for the group leaderboard. Returns one row per
-- group_member with the profile fields embedded (display_name, avatar_path,
-- profile updated_at for WR-01 cache-bust) so the hook is a one-liner and
-- types:gen produces a clean row shape.
--
-- ORDER BY (MEDIUM tiebreaker — RESOLVED via REVIEWS replan 2026-05-08):
--   points DESC, current_streak DESC, joined_at ASC
--
-- The first two keys are served by the group_members_leaderboard_idx
-- (group_id, points DESC, current_streak DESC) shipped in 0001. `joined_at ASC`
-- is the deterministic tiebreaker — older members rank higher when points and
-- streak are tied. Preferred over `display_name ASC` because display_name can
-- change (rename → ranking shuffle) but joined_at cannot.
--
-- Membership-gated; typed errors `not_authenticated`, `not_member` via SQLSTATE
-- 'P0001'. No `group_not_found` typed error — a non-existent group is also a
-- non-member case (is_group_member returns false), and surfacing the
-- distinction would be an existence leak.
-- -----------------------------------------------------------------------------
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
     order by gm.points desc, gm.current_streak desc, gm.joined_at asc;
end;
$$;

revoke execute on function public.get_group_leaderboard(uuid) from public;
grant  execute on function public.get_group_leaderboard(uuid) to authenticated;
