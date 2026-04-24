-- pgTAP test: delete_group RPC (Pitfall 9 — FK cascade to members/submissions/invites).
-- Covers: non-admin rejected with not_admin, admin success cascades to all
-- three child tables.

begin;
select plan(5);

-- Seed two users.
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'member@x.com', 'authenticated', 'authenticated', now(), now());

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'g1', 'goal body here', 'photo', 'UTC',
   '11111111-1111-1111-1111-111111111111');

insert into public.group_members (group_id, user_id, role) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'member');

-- Seed a submission + an invite so we can assert cascade sweeps them.
insert into public.submissions (id, group_id, user_id, local_date, media_path) values
  ('ddddeeee-0000-0000-0000-000000000001',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   '22222222-2222-2222-2222-222222222222',
   current_date,
   'cccccccc-cccc-cccc-cccc-cccccccccccc/22222222-2222-2222-2222-222222222222/daily.jpg');

insert into public.invites (id, group_id, code, created_by, expires_at) values
  ('e0e0e0e0-0000-0000-0000-000000000001',
   'cccccccc-cccc-cccc-cccc-cccccccccccc', 'DELCODE1',
   '11111111-1111-1111-1111-111111111111',
   now() + interval '7 days');

-- ---- not_admin: member tries to delete ----
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.delete_group('cccccccc-cccc-cccc-cccc-cccccccccccc')$$,
  'P0001',
  'not_admin',
  'non-admin caller rejected with not_admin'
);

-- ---- Success: admin deletes group ----
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.delete_group('cccccccc-cccc-cccc-cccc-cccccccccccc')$$,
  'admin delete_group succeeds'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- Cascade assertions: group row gone + children swept.
select is(
  (select count(*)::int from public.groups
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0,
  'groups row gone after delete_group'
);

select is(
  (select count(*)::int from public.group_members
    where group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')
  +
  (select count(*)::int from public.submissions
    where group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0,
  'group_members + submissions rows cascade-deleted (Pitfall 9)'
);

select is(
  (select count(*)::int from public.invites
    where group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0,
  'invites rows cascade-deleted (Pitfall 9)'
);

select * from finish();
rollback;
