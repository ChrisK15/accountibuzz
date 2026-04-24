-- pgTAP test: redeem_invite RPC (INV-02 error surface + INV-03 cap + T-02-CAP-RACE structural).
-- Covers: success, invite_not_found, invite_already_used, invite_expired,
-- already_member, group_full, AND a structural assertion that the function
-- body contains FOR UPDATE (the row-lock mitigation for Pitfall 5).

begin;
select plan(9);

-- Seed 12 users (1 admin + 1 redeemer + 10 to fill the cap in one test).
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'admin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'redeemer@x.com', 'authenticated', 'authenticated', now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'already@x.com', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'cap1@x.com', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'cap2@x.com', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'cap3@x.com', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'cap4@x.com', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'cap5@x.com', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
   'cap6@x.com', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
   'cap7@x.com', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000',
   'cap8@x.com', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000',
   'cap9@x.com', 'authenticated', 'authenticated', now(), now()),
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'overflow@x.com', 'authenticated', 'authenticated', now(), now());

-- Seed a group directly (superuser — isolates the RPC under test).
insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   'Test Group', 'Daily pushups', 'photo', 'UTC',
   'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.group_members (group_id, user_id, role) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-0000-0000-0000-000000000001', 'admin'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-0000-0000-0000-000000000003', 'member');

-- Seed a valid invite + expired + already-used rows (each with unique codes).
insert into public.invites (id, group_id, code, created_by, expires_at, used_at, used_by) values
  ('e0000000-0000-0000-0000-000000000001',
   'dddddddd-dddd-dddd-dddd-dddddddddddd', 'VALID001',
   'aaaaaaaa-0000-0000-0000-000000000001',
   now() + interval '7 days', null, null),
  ('e0000000-0000-0000-0000-000000000002',
   'dddddddd-dddd-dddd-dddd-dddddddddddd', 'EXPIRED1',
   'aaaaaaaa-0000-0000-0000-000000000001',
   now() - interval '1 day', null, null),
  ('e0000000-0000-0000-0000-000000000003',
   'dddddddd-dddd-dddd-dddd-dddddddddddd', 'USEDONE1',
   'aaaaaaaa-0000-0000-0000-000000000001',
   now() + interval '7 days', now() - interval '1 hour',
   'aaaaaaaa-0000-0000-0000-000000000003');

-- ============================================================
-- 1. STRUCTURAL: redeem_invite body contains FOR UPDATE (T-02-CAP-RACE).
-- ============================================================
-- Use matches() with a regex (case-insensitive) rather than like() — pgTAP's
-- like() overload resolution can collide with the LIKE operator; matches() is
-- unambiguous because it takes (text, text, text) directly.
select matches(
  pg_get_functiondef('public.redeem_invite(text)'::regprocedure)::text,
  '(?i)for update'::text,
  'redeem_invite function body contains FOR UPDATE row-lock per T-02-CAP-RACE mitigation'::text
);

-- ============================================================
-- 2. Success path: user 2 redeems VALID001; member row appears, invite marked used.
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select public.redeem_invite('VALID001')),
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  'redeem_invite returns group_id on success'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- Inspect ground truth.
select ok(
  exists (
    select 1 from public.group_members
     where group_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
       and user_id  = 'aaaaaaaa-0000-0000-0000-000000000002'
  )
  and
  exists (
    select 1 from public.invites
     where code = 'VALID001'
       and used_at is not null
       and used_by = 'aaaaaaaa-0000-0000-0000-000000000002'
  ),
  'success path: member row inserted AND invite stamped used_at/used_by = caller'
);

-- ============================================================
-- 3. invite_not_found
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.redeem_invite('NOSUCH01')$$,
  'P0001',
  'invite_not_found',
  'unknown code raises invite_not_found'
);

-- ============================================================
-- 4. invite_already_used (USEDONE1 was pre-stamped)
-- ============================================================
select throws_ok(
  $$select public.redeem_invite('USEDONE1')$$,
  'P0001',
  'invite_already_used',
  'previously-used code raises invite_already_used'
);

-- ============================================================
-- 5. invite_expired (EXPIRED1 has expires_at in the past)
-- ============================================================
select throws_ok(
  $$select public.redeem_invite('EXPIRED1')$$,
  'P0001',
  'invite_expired',
  'expired code raises invite_expired'
);

-- ============================================================
-- 6. already_member — user 3 is already in the group; re-issue a valid code for them.
-- ============================================================
reset role;
select set_config('request.jwt.claims', NULL, true);

insert into public.invites (id, group_id, code, created_by, expires_at) values
  ('e0000000-0000-0000-0000-000000000004',
   'dddddddd-dddd-dddd-dddd-dddddddddddd', 'MEMBER01',
   'aaaaaaaa-0000-0000-0000-000000000001',
   now() + interval '7 days');

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.redeem_invite('MEMBER01')$$,
  'P0001',
  'already_member',
  'existing member redeeming raises already_member'
);

-- ============================================================
-- 7. group_full — fill the group to 10 members, then attempt with user 13 (overflow).
-- ============================================================
reset role;
select set_config('request.jwt.claims', NULL, true);

-- Add 8 more users (already have admin+user3+user2=3; bring to 10).
insert into public.group_members (group_id, user_id, role) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-0000-0000-0000-000000000001', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-0000-0000-0000-000000000002', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-0000-0000-0000-000000000003', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-0000-0000-0000-000000000004', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-0000-0000-0000-000000000005', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-0000-0000-0000-000000000006', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-0000-0000-0000-000000000007', 'member');

-- Sanity: group now has 10 members.
select is(
  (select count(*)::int from public.group_members
    where group_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  10,
  'group seeded to exactly 10 members for cap test'
);

insert into public.invites (id, group_id, code, created_by, expires_at) values
  ('e0000000-0000-0000-0000-000000000005',
   'dddddddd-dddd-dddd-dddd-dddddddddddd', 'OVERFLOW',
   'aaaaaaaa-0000-0000-0000-000000000001',
   now() + interval '7 days');

select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.redeem_invite('OVERFLOW')$$,
  'P0001',
  'group_full',
  '11th member attempting to redeem raises group_full (INV-03 cap enforcement)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
