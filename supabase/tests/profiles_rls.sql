-- pgTAP test: profiles RLS isolates rows between users.
-- User A can read/update their own profile but cannot see or update user B's.

begin;
select plan(3);

-- Seed two auth users (trigger creates the matching profiles rows).
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000',
   'a@x.com', 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000',
   'b@x.com', 'authenticated', 'authenticated', now(), now());

-- Impersonate user A via JWT claims; switch to authenticated role so RLS applies.
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',
  true
);
set local role authenticated;

-- A can select their own row
select ok(
  (select count(*) from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 1,
  'user A can select their own profile'
);

-- A cannot see user B (RLS filters out the row)
select ok(
  (select count(*) from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0,
  'user A cannot select user B profile'
);

-- A's update against B's row affects 0 rows (RLS check filters it).
update public.profiles set display_name = 'hacked'
 where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- Drop role to inspect ground truth
reset role;
select set_config('request.jwt.claims', NULL, true);

select is(
  (select display_name from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ''::text,
  'user A update on user B was silently rejected by RLS'
);

select * from finish();
rollback;
