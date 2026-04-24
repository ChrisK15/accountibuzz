-- pgTAP test: get_invite_preview RPC (T-02-PREVIEW-LEAK).
-- Covers: anon-role 3-tuple return, invite_not_found on missing code,
-- preview still returns on expired/used invites (per Open Q #4 — no state
-- enumeration), and structural check that return type is public.invite_preview.

begin;
select plan(6);

-- Seed one admin user + a group + 1 active + 1 expired + 1 used invite.
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin@x.com', 'authenticated', 'authenticated', now(), now());

-- Give the profile a display_name so we can assert admin_display_name passthrough.
update public.profiles set display_name = 'Alice Admin'
 where id = '11111111-1111-1111-1111-111111111111';

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   'Seeded Group', 'Daily habit logging', 'photo', 'UTC',
   '11111111-1111-1111-1111-111111111111');

insert into public.group_members (group_id, user_id, role) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'admin');

insert into public.invites (id, group_id, code, created_by, expires_at, used_at, used_by) values
  ('11100000-0000-0000-0000-000000000001',
   'cccccccc-cccc-cccc-cccc-cccccccccccc', 'CODE1234',
   '11111111-1111-1111-1111-111111111111',
   now() + interval '7 days', null, null),
  ('11100000-0000-0000-0000-000000000002',
   'cccccccc-cccc-cccc-cccc-cccccccccccc', 'EXPIRED2',
   '11111111-1111-1111-1111-111111111111',
   now() - interval '1 day', null, null),
  ('11100000-0000-0000-0000-000000000003',
   'cccccccc-cccc-cccc-cccc-cccccccccccc', 'USED0003',
   '11111111-1111-1111-1111-111111111111',
   now() + interval '7 days',
   now() - interval '1 hour',
   '11111111-1111-1111-1111-111111111111');

-- Structural: get_invite_preview's return type is public.invite_preview (NOT groups / json).
select is(
  (select pg_catalog.format_type(prorettype, null)
     from pg_proc
    where oid = 'public.get_invite_preview(text)'::regprocedure),
  'invite_preview',
  'get_invite_preview return type is public.invite_preview (dedicated 3-field type)'
);

-- Anon role: call preview with a valid code. Assertions against group_name + member_count.
reset role;
select set_config('request.jwt.claims', NULL, true);
set local role anon;

select is(
  (select (public.get_invite_preview('CODE1234')).group_name),
  'Seeded Group',
  'anon can read group_name from preview RPC'
);

select is(
  (select (public.get_invite_preview('CODE1234')).member_count)::int,
  1,
  'anon gets integer member_count'
);

-- Unknown code → invite_not_found (uniform error shape).
select throws_ok(
  $$select public.get_invite_preview('NOPENOPE')$$,
  'P0001',
  'invite_not_found',
  'anon call with non-existent code raises invite_not_found (no enum leak)'
);

-- Expired / used invites STILL return a preview (Open Q #4 — state is not leaked).
select lives_ok(
  $$select public.get_invite_preview('EXPIRED2')$$,
  'anon preview of expired invite lives (state not leaked at preview layer)'
);

select lives_ok(
  $$select public.get_invite_preview('USED0003')$$,
  'anon preview of used invite lives (state not leaked at preview layer)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
