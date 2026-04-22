-- pgTAP test: is_group_member / is_group_admin return correct booleans
-- for admin, member, and stranger personas.

begin;
select plan(4);

-- Three personas; the trigger creates their profiles rows.
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'member@x.com', 'authenticated', 'authenticated', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'stranger@x.com', 'authenticated', 'authenticated', now(), now());

-- One group, admin = user 1.
insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'g1', 'goal', 'photo', 'UTC',
   '11111111-1111-1111-1111-111111111111');

-- Memberships: admin + one regular member. Stranger is NOT a member.
insert into public.group_members (group_id, user_id, role) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'member');

-- ---- Impersonate admin ----
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(
  public.is_group_admin('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid),
  'admin detected by is_group_admin'
);
select ok(
  public.is_group_member('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid),
  'admin is also a member'
);

-- ---- Impersonate stranger ----
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(
  not public.is_group_admin('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid),
  'stranger is not admin'
);
select ok(
  not public.is_group_member('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid),
  'stranger is not a member'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
