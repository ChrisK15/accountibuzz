-- pgTAP test: regenerate_invite RPC (INV-01 / Pitfall 7).
-- Covers: prior active invite is closed (used_at stamped), new invite row
-- inserted with fresh 8-char code + null used_at + expires_at within 7d window,
-- non-admin rejected with not_admin.

begin;
select plan(4);

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

-- Seed an active invite that regenerate_invite must close.
insert into public.invites (id, group_id, code, created_by, expires_at) values
  ('e0e0e0e0-0000-0000-0000-000000000001',
   'cccccccc-cccc-cccc-cccc-cccccccccccc', 'OLDCODE1',
   '11111111-1111-1111-1111-111111111111',
   now() + interval '7 days');

-- ---- non-admin rejected ----
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.regenerate_invite('cccccccc-cccc-cccc-cccc-cccccccccccc')$$,
  'P0001',
  'not_admin',
  'non-admin caller rejected with not_admin'
);

-- ---- Admin regenerates ----
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- Capture the new code so we can assert NEW ≠ OLD and the new row shape.
create temporary table _new_code on commit drop as
  select public.regenerate_invite('cccccccc-cccc-cccc-cccc-cccccccccccc') as code;

reset role;
select set_config('request.jwt.claims', NULL, true);

-- 1. Old invite was closed (used_at now NOT NULL).
select isnt(
  (select used_at from public.invites where code = 'OLDCODE1'),
  null,
  'prior active invite has used_at stamped after regenerate (Pitfall 7)'
);

-- 2. New invite row exists with different code, null used_at, expires_at within 7d window.
select ok(
  exists (
    select 1 from public.invites
     where group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
       and code = (select code from _new_code)
       and code <> 'OLDCODE1'
       and used_at is null
       and char_length(code) = 8
       and expires_at between now() + interval '6 days' and now() + interval '8 days'
  ),
  'new invite row: fresh 8-char code, null used_at, expires_at within 7d window'
);

-- 3. Exactly one active invite for the group after regenerate (D-04 invariant).
select is(
  (select count(*)::int from public.invites
    where group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and used_at is null),
  1,
  'exactly one active invite for the group after regenerate (D-04)'
);

select * from finish();
rollback;
