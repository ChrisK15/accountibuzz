-- =============================================================================
-- 0004_phase2_groups_invites.sql — Phase 2 Groups & Invites (server-side contract)
-- =============================================================================
-- Append-only follow-up to 0001/0002/0003. Ships the entire Phase 2 server
-- surface: 7 RPCs + generate_invite_code helper + invite_preview return type +
-- 2 CHECK constraints on groups + drops of the P1 placeholder invites policies.
--
-- RPCs shipped (all SECURITY DEFINER, `set search_path = public`, typed errors
-- via `raise exception 'typed_code' using errcode = 'P0001'`):
--   public.create_group(p_name, p_goal, p_submission_type, p_timezone)
--     → table(group_id uuid, invite_code text)          grants: authenticated
--   public.redeem_invite(code_input text) → uuid         grants: authenticated
--   public.get_invite_preview(code_input text)
--     → public.invite_preview                            grants: anon, authenticated
--   public.leave_group(p_group_id uuid) → void           grants: authenticated
--   public.transfer_admin(p_group_id, p_new_admin_user_id) → void
--                                                        grants: authenticated
--   public.delete_group(p_group_id uuid) → void          grants: authenticated
--   public.regenerate_invite(p_group_id uuid) → text     grants: authenticated
--
-- Internal helper (no external grant):
--   public.generate_invite_code() → text
--
-- Dedicated return type (fixes Pitfall 3 / T-02-PREVIEW-LEAK):
--   public.invite_preview = (group_name text, member_count int, admin_display_name text)
--
-- Dropped placeholder policies (T-02-RLS-OFF mitigation — redemption is RPC-only):
--   "invites_update_authenticated" on public.invites (from 0001)
--   "invites_mark_used_as_self"    on public.invites (from 0002)
--
-- CHECK constraints added to public.groups:
--   groups_name_length_check  (char_length(name) between 1 and 60)
--   groups_goal_length_check  (char_length(goal) between 5 and 140)
--
-- Invite alphabet (D-02 / Open Question #1):
--   31-char ambiguity-stripped alphabet '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
--   (digits 2-9 = 8, letters A-Z minus O/I/L = 23; total 31). 31^8 ≈ 8.5×10^11.
--
-- Pitfalls actively mitigated:
--   Pitfall 1  — uses the canonical `goal` + `admin_user_id` column names from 0001;
--                does NOT attempt to drop any nonexistent column on public.groups.
--   Pitfall 2  — leave_group rejects admin caller with `admin_cannot_leave`.
--   Pitfall 3  — get_invite_preview returns a dedicated 3-field type, not `returns groups`.
--   Pitfall 5  — redeem_invite locks the groups row with SELECT ... FOR UPDATE
--                before the member count (T-02-CAP-RACE).
--   Pitfall 7  — regenerate_invite closes prior active invite via used_at stamp.
--   Pitfall 8  — transfer_admin updates groups.admin_user_id and both
--                group_members.role rows inside one plpgsql transaction.
--   Pitfall 9  — delete_group relies on FK ON DELETE CASCADE (0001: group_members,
--                submissions, invites all cascade from groups).
--   Pitfall 10 — create_group defensively upserts the caller's profile row before
--                inserting the group (handle_new_user idempotency safeguard).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CHECK constraints on public.groups (D-17 validation mirrored server-side)
-- -----------------------------------------------------------------------------
alter table public.groups
  add constraint groups_name_length_check check (char_length(name) between 1 and 60),
  add constraint groups_goal_length_check check (char_length(goal) between 5 and 140);

-- -----------------------------------------------------------------------------
-- 2. Drop P1 placeholder policies on public.invites (T-02-RLS-OFF).
--    Redemption is RPC-only from P2 forward. No replacement policies.
-- -----------------------------------------------------------------------------
drop policy if exists "invites_update_authenticated" on public.invites;
drop policy if exists "invites_mark_used_as_self"   on public.invites;

-- -----------------------------------------------------------------------------
-- 3. Dedicated invite-preview return type (Pitfall 3 / T-02-PREVIEW-LEAK).
--    Exactly 3 fields. Any addition of a 4th field would break both Postgres
--    compile (functions reference this type) and the pgTAP shape assertion.
-- -----------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_type
    where typname = 'invite_preview'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.invite_preview as (
      group_name text,
      member_count int,
      admin_display_name text
    );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4. generate_invite_code() helper — 31-char ambiguity-stripped alphabet
--    per D-02 (no 0/O/1/I/L). See 02-RESEARCH.md §Open Question #1 / §A1.
-- -----------------------------------------------------------------------------
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  -- 31-char ambiguity-stripped alphabet per D-02 (no 0/O/1/I/L). See 02-RESEARCH.md §Open Question #1 / §A1.
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. create_group — single-RPC atomic (group + admin member row + first invite).
--    Returns (group_id, invite_code) so the client doesn't need a second round
--    trip to render the post-create banner + invite chip.
-- -----------------------------------------------------------------------------
create or replace function public.create_group(
  p_name text,
  p_goal text,
  p_submission_type text,
  p_timezone text
) returns table (group_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_group_id uuid;
  new_code text;
  attempts int := 0;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Defensive: ensure profile row exists (handle_new_user should cover this;
  -- idempotent safeguard per Pitfall 10).
  insert into public.profiles (id) values (caller) on conflict (id) do nothing;

  -- Input validation mirrors D-17 + UI-SPEC.
  if p_name is null or char_length(p_name) = 0 or char_length(p_name) > 60 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if p_goal is null or char_length(p_goal) < 5 or char_length(p_goal) > 140 then
    raise exception 'invalid_goal' using errcode = 'P0001';
  end if;
  if p_submission_type is null or p_submission_type not in ('photo','video') then
    raise exception 'invalid_submission_type' using errcode = 'P0001';
  end if;
  if p_timezone is null or char_length(p_timezone) = 0 then
    raise exception 'invalid_timezone' using errcode = 'P0001';
  end if;

  -- 1. Insert group row
  insert into public.groups (name, goal, submission_type, timezone, admin_user_id)
    values (p_name, p_goal, p_submission_type, p_timezone, caller)
    returning id into new_group_id;

  -- 2. Insert admin membership row
  insert into public.group_members (group_id, user_id, role)
    values (new_group_id, caller, 'admin');

  -- 3. Mint initial invite (Pattern 2 — retry on unique_violation)
  loop
    new_code := public.generate_invite_code();
    begin
      insert into public.invites (group_id, code, created_by, expires_at)
        values (new_group_id, new_code, caller, now() + interval '7 days');
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 5 then
        raise exception 'invite_code_collision' using errcode = 'P0001';
      end if;
    end;
  end loop;

  return query select new_group_id, new_code;
end;
$$;

revoke execute on function public.create_group(text, text, text, text) from public;
grant  execute on function public.create_group(text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. redeem_invite — canonical Pattern 1 body with TWO `for update` row locks
--    (invite row, then group row) to close T-02-CAP-RACE (Pitfall 5).
-- -----------------------------------------------------------------------------
create or replace function public.redeem_invite(code_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
  member_count int;
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- 1. Look up + row-lock the invite (serializes concurrent redeems of the same code).
  select * into inv
    from public.invites
    where code = code_input
    for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;
  if inv.used_at is not null then
    raise exception 'invite_already_used' using errcode = 'P0001';
  end if;
  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  -- 2. Already-member check (surfaces "already_member" without consuming a slot).
  if exists (
    select 1 from public.group_members
     where group_id = inv.group_id and user_id = caller
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  -- 3. Cap check under row-lock on the groups row — closes TOCTOU.
  perform 1 from public.groups where id = inv.group_id for update;

  select count(*) into member_count
    from public.group_members where group_id = inv.group_id;

  if member_count >= 10 then
    raise exception 'group_full' using errcode = 'P0001';
  end if;

  -- 4. Atomic: insert member + mark invite used.
  insert into public.group_members (group_id, user_id, role)
    values (inv.group_id, caller, 'member');

  update public.invites
     set used_at = now(), used_by = caller
   where id = inv.id;

  return inv.group_id;
end;
$$;

revoke execute on function public.redeem_invite(text) from public;
grant  execute on function public.redeem_invite(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. get_invite_preview — anon-callable preview (3-field locked return shape).
--    Uniform `invite_not_found` for any non-matching code (T-02-INV-ENUM).
--    Used/expired invites STILL return a preview (per Open Q #4); only
--    redeem_invite discriminates. This prevents enumeration of invite state.
-- -----------------------------------------------------------------------------
create or replace function public.get_invite_preview(code_input text)
returns public.invite_preview
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result public.invite_preview;
begin
  select g.name,
         (select count(*) from public.group_members gm where gm.group_id = g.id)::int,
         coalesce(p.display_name, 'A friend')
    into result
    from public.invites i
    join public.groups g on g.id = i.group_id
    left join public.profiles p on p.id = g.admin_user_id
    where i.code = code_input
    limit 1;

  if result.group_name is null then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;

  return result;
end;
$$;

revoke execute on function public.get_invite_preview(text) from public;
grant  execute on function public.get_invite_preview(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. leave_group — member self-removal. Admin caller rejected (Pitfall 2 /
--    T-02-ADMIN-LEAVE). Group FK on admin_user_id (ON DELETE RESTRICT) would
--    not catch admin_user_id leaving their own group_members row.
-- -----------------------------------------------------------------------------
create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  is_admin boolean;
  row_deleted int;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select (admin_user_id = caller) into is_admin
    from public.groups where id = p_group_id;

  if is_admin is null then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  if is_admin then
    raise exception 'admin_cannot_leave' using errcode = 'P0001';
  end if;

  delete from public.group_members
    where group_id = p_group_id and user_id = caller;
  get diagnostics row_deleted = row_count;
  if row_deleted = 0 then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.leave_group(uuid) from public;
grant  execute on function public.leave_group(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. transfer_admin — atomic 3-statement flip. No external observer sees
--    intermediate state (Pitfall 8 / T-02-TRANSFER-DOUBLE-ADMIN). Exactly-one-
--    admin invariant is preserved: the old admin becomes 'member', the new
--    admin's row flips to 'admin', and groups.admin_user_id is rewritten —
--    all inside this function's implicit transaction.
-- -----------------------------------------------------------------------------
create or replace function public.transfer_admin(
  p_group_id uuid,
  p_new_admin_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  current_admin uuid;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Row-lock the groups row to serialize concurrent transfers.
  select admin_user_id into current_admin
    from public.groups where id = p_group_id for update;
  if current_admin is null or current_admin <> caller then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_new_admin_user_id
  ) then
    raise exception 'target_not_member' using errcode = 'P0001';
  end if;

  -- Atomic within this function's transaction.
  update public.groups set admin_user_id = p_new_admin_user_id where id = p_group_id;
  update public.group_members set role = 'admin'
    where group_id = p_group_id and user_id = p_new_admin_user_id;
  update public.group_members set role = 'member'
    where group_id = p_group_id and user_id = caller;
end;
$$;

revoke execute on function public.transfer_admin(uuid, uuid) from public;
grant  execute on function public.transfer_admin(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 10. delete_group — admin-only. FK ON DELETE CASCADE on group_members.group_id
--     (0001 line 105), submissions.group_id (0001 line 234), invites.group_id
--     (0001 line 282) means a single DELETE on groups sweeps all children.
--     (Pitfall 9.)
-- -----------------------------------------------------------------------------
create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  current_admin uuid;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select admin_user_id into current_admin
    from public.groups where id = p_group_id;
  if current_admin is null or current_admin <> caller then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;

  delete from public.groups where id = p_group_id;
end;
$$;

revoke execute on function public.delete_group(uuid) from public;
grant  execute on function public.delete_group(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 11. regenerate_invite — admin-only. Closes any currently-active invite
--     (D-04: one active invite at a time) by stamping used_at = now(),
--     used_by = caller, then mints a new 8-char code via generate_invite_code()
--     with the standard collision-retry loop (Pattern 2 / Pitfall 7).
-- -----------------------------------------------------------------------------
create or replace function public.regenerate_invite(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  current_admin uuid;
  new_code text;
  attempts int := 0;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select admin_user_id into current_admin
    from public.groups where id = p_group_id;
  if current_admin is null or current_admin <> caller then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;

  -- Close prior active invite (D-04).
  update public.invites
     set used_at = now(), used_by = caller
   where group_id = p_group_id
     and used_at is null;

  -- Mint new code with collision retry (Pattern 2).
  loop
    new_code := public.generate_invite_code();
    begin
      insert into public.invites (group_id, code, created_by, expires_at)
        values (p_group_id, new_code, caller, now() + interval '7 days');
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 5 then
        raise exception 'invite_code_collision' using errcode = 'P0001';
      end if;
    end;
  end loop;

  return new_code;
end;
$$;

revoke execute on function public.regenerate_invite(uuid) from public;
grant  execute on function public.regenerate_invite(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- End-of-file invariants (comments only — NOT executable):
--   • No DROP COLUMN against a nonexistent column on public.groups — the
--     rotatable-code-on-groups sketch from CONTEXT was never shipped (Pitfall 1).
--   • No new tables added → RLS CI (.github/workflows/rls-check.yml) invariant
--     "every public table has RLS" remains green by construction.
-- =============================================================================
-- End of 0004_phase2_groups_invites.sql
-- =============================================================================
