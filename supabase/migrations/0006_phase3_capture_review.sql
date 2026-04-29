-- =============================================================================
-- 0006_phase3_capture_review.sql — Phase 3 Capture & Admin Review (server contract)
-- =============================================================================
-- Append-only follow-up to 0001/0002/0003/0004/0005. Ships the entire Phase 3
-- write-path AND admin-only read-path: 4 SECURITY DEFINER RPCs + 1 row type.
--
-- RPCs shipped (all SECURITY DEFINER, `set search_path = public`, typed errors
-- via `raise exception 'typed_code' using errcode = 'P0001'`):
--
--   public.submit_today(
--     p_group_id uuid, p_media_path text, p_media_type text, p_caption text
--   ) returns uuid
--     typed errors: not_authenticated, not_member, invalid_media_type,
--                   wrong_media_type, caption_too_long, already_submitted_today
--     grants: authenticated
--
--   public.review_submission(
--     p_submission_id uuid, p_decision text, p_rejection_reason text
--   ) returns void
--     typed errors: not_authenticated, invalid_decision, reason_too_long,
--                   submission_not_found, not_admin, not_pending
--     grants: authenticated
--
--   public.get_pending_review_count(p_group_id uuid) returns int
--     (no typed errors — non-admin returns 0 per D-17)
--     grants: authenticated
--
--   PER REVIEWS.md C3 (HIGH security — Mitigation A):
--   public.get_pending_review_queue(p_group_id uuid)
--     returns setof public.review_queue_row
--     typed errors: not_authenticated, not_admin
--     grants: authenticated
--     Replaces the previous `useReviewQueue` direct table SELECT (which relied
--     only on group-member-read RLS, allowing non-admin members to deep-link
--     /groups/[id]/review and see pending media + captions).
--
-- New composite type (NOT a table — does NOT trigger CI rls-check.yml):
--   public.review_queue_row = (
--     id uuid, user_id uuid, caption text, media_path text, media_type text,
--     created_at timestamptz, display_name text, avatar_path text,
--     profile_updated_at timestamptz
--   )
--
-- NO new public-schema TABLES are added. NO existing policies are dropped or
-- altered. The 0003 admin-immutable trigger is left UNTOUCHED — it remains the
-- last-line defense-in-depth layer that fires on every UPDATE regardless of
-- whether the caller is the new RPC or a direct REST request.
-- The `handle_submission_approval` STUB shipped in 0001 is also left UNTOUCHED
-- — its body lands in Phase 4.
--
-- Pitfalls actively mitigated:
--   PITFALLS §1  — submit_today derives `local_date` server-side via
--                  `(now() AT TIME ZONE groups.timezone)::date`. Client never
--                  sends this column.
--   PITFALLS §2  — submit_today's INSERT catches `unique_violation` on the
--                  EXISTING UNIQUE (group_id, user_id, local_date) constraint
--                  shipped in 0001 (line 245) and re-raises as
--                  `already_submitted_today`.
--   PITFALLS §6  — admin-bottleneck UX surface (client concern; server-side
--                  defense is the typed errors that let UX render the right
--                  copy without leaking schema detail).
--   PITFALLS §11 — Realtime cleanup (client concern; server-side surface is
--                  the SECURITY DEFINER RPCs that flip status atomically so
--                  Realtime subscribers see exactly one transition).
--   Pitfall  9  — review_submission UPDATE includes `where status = 'pending'`
--                  AND raises `not_pending` if 0 rows affected; second
--                  concurrent admin loses the race deterministically.
--   Threat   7  — review_submission looks up `submissions.group_id` from the
--                  DB (NOT from client-claimed input) before calling
--                  `is_group_admin(...)`; closes the cross-group attack where
--                  an admin of group A reviews a submission belonging to B.
--
-- Source: .planning/phases/03-capture-admin-review/03-RESEARCH.md §Code
--         Examples §5–§7; .planning/phases/03-capture-admin-review/03-PATTERNS.md
--         §`supabase/migrations/0006_phase3_capture_review.sql`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. submit_today RPC — SUB-01, SUB-02, SUB-05, SUB-06.
--    SECURITY DEFINER + set search_path = public per P2 D-11 invariant.
--    All input validated; local_date derived from groups.timezone (PITFALLS §1).
-- -----------------------------------------------------------------------------
create or replace function public.submit_today(
  p_group_id   uuid,
  p_media_path text,
  p_media_type text,
  p_caption    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  v_group_tz   text;
  v_group_type text;
  v_local_date date;
  v_submission_id uuid;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Membership lookup pulls group_id, submission_type, and timezone in one shot.
  -- Joining group_members here implicitly enforces "caller is a member" — if no
  -- row, we raise `not_member` (NOT `not_found`, which would leak existence).
  select g.submission_type, g.timezone
    into v_group_type, v_group_tz
    from public.groups g
    join public.group_members gm on gm.group_id = g.id and gm.user_id = caller
    where g.id = p_group_id;
  if not found then
    raise exception 'not_member' using errcode = 'P0001';
  end if;

  if p_media_type is null or p_media_type not in ('photo','video') then
    raise exception 'invalid_media_type' using errcode = 'P0001';
  end if;
  if p_media_type <> v_group_type then
    raise exception 'wrong_media_type' using errcode = 'P0001';
  end if;
  if p_caption is not null and char_length(p_caption) > 140 then
    raise exception 'caption_too_long' using errcode = 'P0001';
  end if;

  -- PITFALLS §1: server-derived local_date, never client-computed.
  v_local_date := (now() AT TIME ZONE v_group_tz)::date;

  begin
    insert into public.submissions
      (group_id, user_id, local_date, status, caption, media_path, media_type)
    values
      (p_group_id, caller, v_local_date, 'pending',
       nullif(p_caption, ''), p_media_path, p_media_type)
    returning id into v_submission_id;
  exception when unique_violation then
    -- PITFALLS §2: leverages the EXISTING UNIQUE (group_id, user_id, local_date)
    -- constraint from 0001 line 245. Re-raised as a typed error the client maps
    -- to UI copy without exposing the constraint name.
    raise exception 'already_submitted_today' using errcode = 'P0001';
  end;

  return v_submission_id;
end;
$$;

revoke execute on function public.submit_today(uuid, text, text, text) from public;
grant  execute on function public.submit_today(uuid, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. review_submission RPC — ADM-02, ADM-03, PLAT-03.
--    Pitfall 9 (concurrent-approve race) + Threat 7 (cross-group) mitigations.
--    UPDATEs satisfy 0003 admin-immutable trigger by only mutating
--    status / reviewed_by / reviewed_at / rejection_reason.
-- -----------------------------------------------------------------------------
create or replace function public.review_submission(
  p_submission_id    uuid,
  p_decision         text,
  p_rejection_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  v_group_id uuid;
  v_status   text;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_decision is null or p_decision not in ('approved','rejected') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  if p_rejection_reason is not null and char_length(p_rejection_reason) > 140 then
    raise exception 'reason_too_long' using errcode = 'P0001';
  end if;

  -- Threat 7: lookup group_id from DB (not from client). FOR UPDATE locks the
  -- row so the Pitfall 9 race-guard UPDATE-where-status-pending below is atomic
  -- with this read.
  select group_id, status into v_group_id, v_status
    from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found' using errcode = 'P0001';
  end if;

  if not public.is_group_admin(v_group_id) then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  if v_status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  -- 0003 admin-immutable trigger re-validates reviewed_by = auth.uid() and
  -- pins identity/media columns. Defense-in-depth Layer 3.
  update public.submissions
     set status           = p_decision,
         reviewed_by      = caller,
         reviewed_at      = now(),
         rejection_reason = case when p_decision = 'rejected'
                                 then nullif(p_rejection_reason, '')
                                 else null end
   where id = p_submission_id
     and status = 'pending';   -- Pitfall 9: atomic-and-conditional

  if not found then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.review_submission(uuid, text, text) from public;
grant  execute on function public.review_submission(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. get_pending_review_count RPC — ADM-01.
--    Server-side admin gate (NOT just RLS) to guarantee no count leak per
--    D-17 / RESEARCH §Code Examples §7. Non-admins receive 0.
-- -----------------------------------------------------------------------------
create or replace function public.get_pending_review_count(p_group_id uuid)
returns int
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_group_admin(p_group_id) then
    return 0;   -- no leak per D-17 (non-admin / stranger / anon all return 0)
  end if;
  return (
    select count(*)::int
      from public.submissions
     where group_id = p_group_id
       and status = 'pending'
  );
end;
$$;

revoke execute on function public.get_pending_review_count(uuid) from public;
grant  execute on function public.get_pending_review_count(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. PER REVIEWS.md C3 (HIGH security): get_pending_review_queue RPC.
--    Replaces the previous `useReviewQueue` direct SELECT-on-submissions which
--    relied only on group-member-read RLS — allowing any group member who
--    deep-linked /groups/[id]/review to see pending media + captions, which
--    is admin-only information.
--
--    Defense-in-depth layers AFTER this migration:
--      Layer 1 (RLS)     — submissions_select_group_members policy from 0001
--                          still applies (any member can read submissions).
--      Layer 2 (RPC)     — THIS function validates is_group_admin and raises
--                          `not_admin` for non-admins BEFORE returning rows.
--                          This is the new server-side gate.
--      Layer 3 (client)  — Plan 03-07's review screen ALSO checks
--                          useGroup(groupId).data?.is_admin and redirects to
--                          /groups/[id] if false (so admin-ness isn't even
--                          discoverable via the route).
-- -----------------------------------------------------------------------------

-- Composite return type. Embeds the profile join the previous client SELECT
-- needed (display_name / avatar_path / updated_at) so the RPC signature is
-- typed end-to-end after `pnpm types:gen`. Idempotent against re-runs.
do $$ begin
  if not exists (
    select 1 from pg_type
    where typname = 'review_queue_row'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.review_queue_row as (
      id uuid,
      user_id uuid,
      caption text,
      media_path text,
      media_type text,
      created_at timestamptz,
      display_name text,
      avatar_path text,
      profile_updated_at timestamptz
    );
  end if;
end $$;

create or replace function public.get_pending_review_queue(p_group_id uuid)
returns setof public.review_queue_row
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
  if not public.is_group_admin(p_group_id) then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;

  return query
    select
      s.id,
      s.user_id,
      s.caption,
      s.media_path,
      s.media_type,
      s.created_at,
      p.display_name,
      p.avatar_path,
      p.updated_at as profile_updated_at
    from public.submissions s
    left join public.profiles p on p.id = s.user_id
    where s.group_id = p_group_id
      and s.status  = 'pending'
    order by s.created_at asc
    limit 50;
end;
$$;

revoke execute on function public.get_pending_review_queue(uuid) from public;
grant  execute on function public.get_pending_review_queue(uuid) to authenticated;
