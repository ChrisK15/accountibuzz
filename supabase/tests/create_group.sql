-- pgTAP test: create_group RPC (GRP-01 + GRP-02).
-- Asserts the atomic 3-row insert (group + admin member + first invite),
-- the return shape (group_id, invite_code), and the 4 validation error paths.

begin;
select plan(8);

-- Seed one auth user; handle_new_user creates the matching profiles row.
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin@x.com', 'authenticated', 'authenticated', now(), now());

-- Impersonate as authenticated user 1.
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- --- Success path: capture returned tuple into a temp table so we can assert
-- on both the return shape AND the downstream rows seeded by the RPC.
create temporary table _cg_result on commit drop as
  select * from public.create_group('Test Group', 'Show up every day', 'photo', 'UTC');

-- 1. Return shape: one row, with non-null group_id (uuid) and 8-char text code.
select is(
  (select count(*)::int from _cg_result), 1,
  'create_group returns exactly one (group_id, invite_code) row'
);

-- 2. groups row exists with admin_user_id = caller (switch to superuser to inspect).
reset role;
select set_config('request.jwt.claims', NULL, true);

select is(
  (select admin_user_id from public.groups
    where id = (select group_id from _cg_result)),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'groups row seeded with admin_user_id = caller'
);

-- 3. group_members admin row exists for caller.
select is(
  (select role from public.group_members
    where group_id = (select group_id from _cg_result)
      and user_id = '11111111-1111-1111-1111-111111111111'),
  'admin',
  'group_members admin row seeded for caller'
);

-- 4. Initial invite row: 8-char code matches return value, expires_at within 6d..8d, used_at null.
select ok(
  exists (
    select 1 from public.invites
     where group_id = (select group_id from _cg_result)
       and code = (select invite_code from _cg_result)
       and char_length(code) = 8
       and used_at is null
       and expires_at is not null
       and expires_at between now() + interval '6 days' and now() + interval '8 days'
  ),
  'initial invite row seeded with 8-char code, null used_at, expires_at ~7d out'
);

-- --- Validation error paths (5..8). Re-impersonate as user 1.
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- 5. invalid_name (empty)
select throws_ok(
  $$select public.create_group('', 'Valid goal here', 'photo', 'UTC')$$,
  'P0001',
  'invalid_name',
  'empty name raises invalid_name'
);

-- 6. invalid_goal (<5 chars)
select throws_ok(
  $$select public.create_group('OK', 'hi', 'photo', 'UTC')$$,
  'P0001',
  'invalid_goal',
  '4-char goal raises invalid_goal'
);

-- 7. invalid_submission_type ('audio')
select throws_ok(
  $$select public.create_group('OK', 'Valid goal here', 'audio', 'UTC')$$,
  'P0001',
  'invalid_submission_type',
  'unsupported submission_type raises invalid_submission_type'
);

-- 8. invalid_timezone (NULL)
select throws_ok(
  $$select public.create_group('OK', 'Valid goal here', 'photo', NULL)$$,
  'P0001',
  'invalid_timezone',
  'NULL timezone raises invalid_timezone'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
