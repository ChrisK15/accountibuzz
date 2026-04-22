-- =============================================================================
-- 0002_phase1_review_fixes.sql
--
-- Review-fix follow-up to 0001_foundation.sql. Addresses findings from the
-- deep-pass review (see .planning/phases/01-foundation/01-REVIEW.md).
--
-- This migration is append-only relative to 0001 — it drops/recreates policies
-- and uses `create or replace` for functions so it is idempotent against the
-- already-applied state (local + remote).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CR-01: submissions UPDATE policy lacked WITH CHECK — owner could self-flip
-- `status` from 'pending' → 'approved'. Split the single policy into an
-- owner-pending-content lane and an admin-review lane, both with explicit
-- WITH CHECK. Add a BEFORE UPDATE trigger that pins immutable columns on
-- owner edits (columns Postgres RLS cannot constrain directly).
-- -----------------------------------------------------------------------------

drop policy if exists "submissions_update_admin_or_owner_pending" on public.submissions;

-- Owners: may edit only their own still-pending row. USING gates the pre-image;
-- WITH CHECK gates the post-image (row must still be owned + pending).
-- Column-level immutability (status, user_id, group_id, local_date, review
-- metadata) is enforced by submissions_owner_immutable() below.
create policy "submissions_update_owner_pending_content"
  on public.submissions
  for update
  to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

-- Admins: full review lane. Both USING and WITH CHECK require admin on the
-- target group — admin cannot move a row into a group they do not admin.
create policy "submissions_update_admin_review"
  on public.submissions
  for update
  to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

-- Belt-and-suspenders: enforce column-level immutability on owner edits.
-- If the UPDATE is being issued by the owner (auth.uid() = old.user_id) AND
-- the caller is NOT also the group admin, then status / user_id / group_id /
-- local_date / reviewed_by / reviewed_at / rejection_reason may not change.
create or replace function public.submissions_owner_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  -- If auth context is absent (e.g. service_role/superuser via definer path),
  -- skip the check entirely.
  if auth.uid() is null then
    return new;
  end if;

  -- Admin branch bypasses immutability; admin-review policy already gates shape.
  is_admin := public.is_group_admin(old.group_id);
  if is_admin then
    return new;
  end if;

  -- Owner branch: pin immutable columns.
  if auth.uid() = old.user_id then
    if new.status is distinct from old.status
       or new.user_id is distinct from old.user_id
       or new.group_id is distinct from old.group_id
       or new.local_date is distinct from old.local_date
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'owner may not modify key/status/review columns on submissions';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists submissions_owner_immutable_trigger on public.submissions;
create trigger submissions_owner_immutable_trigger
  before update on public.submissions
  for each row execute function public.submissions_owner_immutable();

-- -----------------------------------------------------------------------------
-- WR-02: storage.objects RLS was never explicitly enabled by 0001 — the
-- policies worked only because the Supabase-hosted/local defaults ship it on.
-- Assert the invariant so a non-Supabase Postgres fork or a future CLI change
-- does not silently deactivate every storage policy.
--
-- Note: `storage.objects` is owned by `supabase_storage_admin`, and the
-- migration role (`postgres`) cannot `ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY` directly. Instead we (a) assert the invariant by reading
-- `pg_tables.rowsecurity` and raising if it is off, and (b) back it up with
-- a CI probe in `.github/workflows/rls-check.yml` (added in the same fix).
-- -----------------------------------------------------------------------------

do $$
declare
  rls_on boolean;
begin
  select rowsecurity
    into rls_on
    from pg_tables
   where schemaname = 'storage'
     and tablename  = 'objects';

  if rls_on is null then
    raise exception 'storage.objects not found — is the Supabase storage schema installed?';
  end if;

  if not rls_on then
    raise exception
      'storage.objects RLS is disabled. Re-enable as supabase_storage_admin: '
      'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;';
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- WR-03: invites_update_authenticated was `using (auth.uid() is not null)`,
-- which let any logged-in user flip `used_at` / `used_by` on any invite row
-- (including invites for groups they don't belong to) if they could guess the
-- row. Replace with a redeem-self stub: can only mark an unused invite used,
-- and only with `used_by = auth.uid()`. Full redeem semantics ship in P2 via
-- a SECURITY DEFINER RPC.
-- -----------------------------------------------------------------------------

drop policy if exists "invites_update_authenticated" on public.invites;

create policy "invites_mark_used_as_self"
  on public.invites
  for update
  to authenticated
  using (used_at is null)
  with check (used_by = auth.uid() and used_at is not null);

-- -----------------------------------------------------------------------------
-- WR-04: group_members SELECT / INSERT / DELETE / UPDATE policies each used
-- a subquery against public.group_members itself — flagged by the Supabase RLS
-- guide for reason-ability + query-plan reasons. Helpers `is_group_member`
-- (SECURITY DEFINER, reads group_members) and `is_group_admin` (SECURITY
-- DEFINER, reads groups.admin_user_id) exist in 0001; they bypass RLS and are
-- safe to call from the group_members policies.
--
-- Also folds in IN-04: group_members_update_admin gets an explicit WITH CHECK.
--
-- Note on semantic shift: the old "admin" branch matched via
-- group_members.role='admin'; the new branch matches via groups.admin_user_id.
-- The two agree today (the only admin is the group creator, who is the row
-- keyed by admin_user_id). P2's create-group flow is responsible for keeping
-- them in sync (see IN-01 for context).
-- -----------------------------------------------------------------------------

drop policy if exists "group_members_select_own_or_same_group" on public.group_members;
drop policy if exists "group_members_insert_self_or_admin" on public.group_members;
drop policy if exists "group_members_delete_own_or_admin" on public.group_members;
drop policy if exists "group_members_update_admin" on public.group_members;

create policy "group_members_select_own_or_same_group"
  on public.group_members
  for select
  using (
    user_id = auth.uid()
    OR public.is_group_member(group_id)
  );

create policy "group_members_insert_self_or_admin"
  on public.group_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    OR public.is_group_admin(group_id)
  );

create policy "group_members_delete_own_or_admin"
  on public.group_members
  for delete
  using (
    user_id = auth.uid()
    OR public.is_group_admin(group_id)
  );

create policy "group_members_update_admin"
  on public.group_members
  for update
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));
