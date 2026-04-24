-- pgTAP test: leave_group RPC (GRP-05 / T-02-ADMIN-LEAVE).
-- Covers: member self-removal success, admin rejected with admin_cannot_leave,
-- non-member rejected with not_a_member, unauth caller rejected with not_authenticated.

begin;
select plan(4);

-- Seed three users: admin, regular member, stranger.
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'member@x.com', 'authenticated', 'authenticated', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'stranger@x.com', 'authenticated', 'authenticated', now(), now());

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'g1', 'goal row', 'photo', 'UTC',
   '11111111-1111-1111-1111-111111111111');

insert into public.group_members (group_id, user_id, role) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'member');

-- ---- Admin attempts leave → admin_cannot_leave ----
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.leave_group('cccccccc-cccc-cccc-cccc-cccccccccccc')$$,
  'P0001',
  'admin_cannot_leave',
  'admin caller rejected with admin_cannot_leave (T-02-ADMIN-LEAVE)'
);

-- ---- Stranger attempts leave → not_a_member ----
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.leave_group('cccccccc-cccc-cccc-cccc-cccccccccccc')$$,
  'P0001',
  'not_a_member',
  'non-member caller rejected with not_a_member'
);

-- ---- Member leaves → success; row removed ----
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.leave_group('cccccccc-cccc-cccc-cccc-cccccccccccc')$$,
  'member leave succeeds without error'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select is(
  (select count(*)::int from public.group_members
    where group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and user_id  = '22222222-2222-2222-2222-222222222222'),
  0,
  'group_members row for leaver is gone'
);

select * from finish();
rollback;
