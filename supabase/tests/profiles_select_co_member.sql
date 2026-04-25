-- pgTAP: co-member profile visibility (migration 0005).
-- A viewer can SELECT a profile only if they share at least one group with
-- that profile's owner. Pairs with profiles_select_own (own row always
-- readable). Strangers (no shared group) get filtered out by RLS.

begin;
select plan(4);

-- Three personas; the trigger creates their profiles rows.
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'viewer@x.com', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'comember@x.com', 'authenticated', 'authenticated', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'stranger@x.com', 'authenticated', 'authenticated', now(), now());

-- Set non-empty display_names so the SELECT count is meaningful.
update public.profiles set display_name = 'Viewer'   where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set display_name = 'CoMember' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set display_name = 'Stranger' where id = '33333333-3333-3333-3333-333333333333';

-- One group; viewer + comember are members, stranger is not.
insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'g1', 'goal row', 'photo', 'UTC',
   '11111111-1111-1111-1111-111111111111');

insert into public.group_members (group_id, user_id, role) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'member');

-- Impersonate the viewer.
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- Viewer sees their own profile (covered by profiles_select_own).
select ok(
  (select count(*) from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 1,
  'viewer can SELECT their own profile'
);

-- Viewer sees the co-member's profile (this policy).
select ok(
  (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 1,
  'viewer can SELECT a co-member profile'
);

-- Viewer cannot see the stranger.
select ok(
  (select count(*) from public.profiles where id = '33333333-3333-3333-3333-333333333333') = 0,
  'viewer CANNOT SELECT a stranger profile'
);

-- Sanity: viewer reading the embedded join shape (group_members + profiles)
-- returns exactly two display_names — the row count proves both members'
-- profile rows are visible through PostgREST's effective RLS path.
select ok(
  (select count(*) from public.group_members gm
     join public.profiles p on p.id = gm.user_id
    where gm.group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') = 2,
  'embedded group_members→profiles join returns both rows for a member viewer'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
