-- pgTAP test: transfer_admin RPC (Pitfall 8 / T-02-TRANSFER-DOUBLE-ADMIN).
-- Covers: success flips admin_user_id + both role rows atomically, exactly-one-
-- admin invariant holds after, target_not_member error, not_admin error.

begin;
select plan(5);

-- Seed three users.
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'target@x.com', 'authenticated', 'authenticated', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'outsider@x.com', 'authenticated', 'authenticated', now(), now());

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'g1', 'goal body here', 'photo', 'UTC',
   '11111111-1111-1111-1111-111111111111');

insert into public.group_members (group_id, user_id, role) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'member');

-- ---- not_admin: outsider tries to transfer ----
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.transfer_admin(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      '22222222-2222-2222-2222-222222222222'
    )$$,
  'P0001',
  'not_admin',
  'non-admin caller rejected with not_admin'
);

-- ---- target_not_member: admin tries to transfer to a non-member ----
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.transfer_admin(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'P0001',
  'target_not_member',
  'admin transferring to non-member rejected with target_not_member'
);

-- ---- Success: admin transfers to existing member ----
select lives_ok(
  $$select public.transfer_admin(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      '22222222-2222-2222-2222-222222222222'
    )$$,
  'admin transfer to existing member succeeds'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ---- Invariant 1: exactly one row has role='admin' ----
select is(
  (select count(*)::int from public.group_members
    where group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and role = 'admin'),
  1,
  'after transfer_admin, exactly one group_members row has role=admin (Pitfall 8)'
);

-- ---- Invariant 2: groups.admin_user_id points at the new admin ----
select is(
  (select admin_user_id from public.groups
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'groups.admin_user_id now matches the new admin'
);

select * from finish();
rollback;
