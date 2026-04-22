-- =============================================================================
-- 0001_foundation.sql — Phase 1 Foundation
-- =============================================================================
-- Creates the entire Postgres schema for Accountibuzz in one migration so the
-- "every public table has RLS" invariant can be enforced from commit #1.
--
-- Tables (all with RLS enabled + at least one policy in this same file):
--   public.profiles
--   public.groups
--   public.group_members
--   public.submissions
--   public.invites
--   public.notifications_outbox
--
-- Storage buckets created here:
--   avatars      (public-read; path-gated insert/update)
--   submissions  (private; member-gated select; self-gated insert)
--
-- Security-definer helpers:
--   public.is_group_member(uuid)
--   public.is_group_admin(uuid)
--   public.handle_new_user()           -- AFTER INSERT trigger on auth.users
--   public.handle_submission_approval() -- STUB; body lands in Phase 4
--   public.handle_daily_rollover()      -- STUB; body lands in Phase 5
--
-- Pitfalls actively mitigated:
--   - PITFALLS.md §3: RLS-off-by-default — each table has explicit enable + policy
--   - Pitfall 4: handle_new_user is SECURITY DEFINER with search_path pinned
--   - Pitfall 5: avatar path traversal — storage.foldername(name)[1] = uid gate
--   - PITFALLS.md §2: streak race — UNIQUE (group_id, user_id, local_date)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 2. profiles  (mirrors auth.users via handle_new_user trigger)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. groups
-- -----------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text not null,
  submission_type text not null check (submission_type in ('photo', 'video')),
  timezone text not null,                                     -- IANA tz, e.g. 'America/New_York'
  admin_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index groups_admin_user_id_idx on public.groups(admin_user_id);

alter table public.groups enable row level security;

-- Insert: any authenticated user can create a group (becomes admin)
create policy "groups_insert_authenticated"
  on public.groups
  for insert
  to authenticated
  with check (auth.uid() = admin_user_id);

-- Select: members of the group can read it. P1-safe correlated subquery
-- (helpers don't exist yet at this point in the file). Tightened in P2.
create policy "groups_select_member"
  on public.groups
  for select
  using (
    exists (
      select 1
      from public.group_members gm
      where gm.group_id = groups.id
        and gm.user_id = auth.uid()
    )
  );

-- Update / delete: admin only
create policy "groups_update_admin"
  on public.groups
  for update
  using (auth.uid() = admin_user_id)
  with check (auth.uid() = admin_user_id);

create policy "groups_delete_admin"
  on public.groups
  for delete
  using (auth.uid() = admin_user_id);

-- -----------------------------------------------------------------------------
-- 4. group_members  (D-02: counter columns shipped now, trigger bodies in P4/P5)
-- -----------------------------------------------------------------------------
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  points integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_rolled_date date,
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members(user_id);
create index group_members_leaderboard_idx
  on public.group_members(group_id, points desc, current_streak desc);

alter table public.group_members enable row level security;

-- P1-safe policies: helpers don't exist yet at this point in the file.
-- Tightened in P2 once is_group_member / is_group_admin are declared.

-- Select: own row OR rows in a group I belong to
create policy "group_members_select_own_or_same_group"
  on public.group_members
  for select
  using (
    auth.uid() = user_id
    OR exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
    )
  );

-- Insert: self-join OR group admin inserting (invite-flow constraints land in P2)
create policy "group_members_insert_self_or_admin"
  on public.group_members
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    OR exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

-- Delete: leave-self OR admin removing
create policy "group_members_delete_own_or_admin"
  on public.group_members
  for delete
  using (
    auth.uid() = user_id
    OR exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

-- Update: admin only (counters mutated by triggers running as definer in P4)
create policy "group_members_update_admin"
  on public.group_members
  for update
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Security-definer helpers  (declared AFTER groups + group_members exist,
--    BEFORE any later policy that references them.)
-- -----------------------------------------------------------------------------
create or replace function public.is_group_member(g uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = g
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(g uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.groups
    where id = g
      and admin_user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- 6. submissions  (uses helpers in policies)
-- -----------------------------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  caption text,
  media_path text not null,
  media_type text not null default 'photo' check (media_type in ('photo', 'video')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique (group_id, user_id, local_date)                      -- PITFALLS §2
);

create index submissions_review_queue_idx
  on public.submissions(group_id, status, created_at desc);
create index submissions_daily_rollover_idx
  on public.submissions(group_id, local_date);

alter table public.submissions enable row level security;

create policy "submissions_select_group_members"
  on public.submissions
  for select
  using (public.is_group_member(group_id));

create policy "submissions_insert_self_in_group"
  on public.submissions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_group_member(group_id)
  );

-- Update: admin reviewing OR own row while still pending (P1-safe; tightened in P3)
create policy "submissions_update_admin_or_owner_pending"
  on public.submissions
  for update
  using (
    public.is_group_admin(group_id)
    OR (user_id = auth.uid() AND status = 'pending')
  );

-- -----------------------------------------------------------------------------
-- 7. invites
-- -----------------------------------------------------------------------------
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index invites_group_id_idx on public.invites(group_id);

alter table public.invites enable row level security;

create policy "invites_select_admin"
  on public.invites
  for select
  using (public.is_group_admin(group_id));

create policy "invites_insert_admin"
  on public.invites
  for insert
  to authenticated
  with check (public.is_group_admin(group_id) and created_by = auth.uid());

-- Mark-as-used: any authenticated user can update (full constraint enforcement
-- ships in P2 with the redeem_invite RPC). P1-safe.
create policy "invites_update_authenticated"
  on public.invites
  for update
  to authenticated
  using (auth.uid() is not null);

-- -----------------------------------------------------------------------------
-- 8. notifications_outbox  (service-role driven; client gets read-own-only)
-- -----------------------------------------------------------------------------
create table public.notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index notifications_outbox_pending_idx
  on public.notifications_outbox(sent_at) where sent_at is null;

alter table public.notifications_outbox enable row level security;

-- Read-own-only. Inserts/updates happen via service_role (no policy = denied).
create policy "notifications_outbox_select_own"
  on public.notifications_outbox
  for select
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 9. handle_new_user trigger  (Pitfall 4 — must be SECURITY DEFINER + pinned search_path)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 10. Counter trigger STUBS (D-02). Bodies ship in Phase 4 (approval) and
--     Phase 5 (rollover). The shape is locked now so later phases don't rewrite.
-- -----------------------------------------------------------------------------

-- STUB: body ships in Phase 4 — increments points, advances current_streak,
-- updates last_rolled_date when submissions.status transitions to 'approved'.
create or replace function public.handle_submission_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- STUB: intentionally a no-op in P1. See plan 04 for the body.
  return new;
end;
$$;

drop trigger if exists on_submission_approved on public.submissions;
create trigger on_submission_approved
  after update of status on public.submissions
  for each row
  when (old.status is distinct from new.status and new.status = 'approved')
  execute function public.handle_submission_approval();

-- STUB: body ships in Phase 5 — runs from pg_cron sweep, resets streak to 0
-- for members who missed yesterday's local_date.
create or replace function public.handle_daily_rollover()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- STUB: intentionally a no-op in P1. See plan 05 for the body.
  return;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Storage buckets + RLS policies on storage.objects
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- avatars: public read, owner-write gated by path's first segment = auth.uid()
create policy "avatars_select_public"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- submissions: private. Path layout is {group_id}/{user_id}/{local_date}.{ext}.
-- Read gated to group members; insert gated to self in second segment AND group member.
create policy "submissions_select_group_members"
  on storage.objects
  for select
  using (
    bucket_id = 'submissions'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

create policy "submissions_insert_self_in_group"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

create policy "submissions_delete_admin_or_owner"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'submissions'
    and (
      public.is_group_admin(((storage.foldername(name))[1])::uuid)
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  );

-- =============================================================================
-- End of 0001_foundation.sql
-- =============================================================================
