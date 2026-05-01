-- pgTAP test: get_pending_review_count RPC (ADM-01 + 0-leak per D-17).
-- Covers: admin returns true count, admin returns 0 when none pending,
-- non-admin member returns 0 (NOT the actual count — no leak), stranger
-- returns 0, anon returns 0.

begin;
select plan(5);

-- ---- Multi-persona seed (4 users; 2 groups: photo with 3 pending, video with 0 pending) ----
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'photoadmin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'videoadmin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'stranger@x.com', 'authenticated', 'authenticated', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'member@x.com', 'authenticated', 'authenticated', now(), now());

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PhotoG', 'Daily run photo', 'photo', 'America/Los_Angeles',
   '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'VideoG', 'Daily Spanish video', 'video', 'America/Los_Angeles',
   '22222222-2222-2222-2222-222222222222');

insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'admin');

-- 3 pending submissions in photo group; 0 in video group.
insert into public.submissions (id, group_id, user_id, local_date, status, media_path, media_type) values
  ('e0000001-0001-0001-0001-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c1.jpg',
   'photo'),
  ('e0000002-0002-0002-0002-000000000002',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-1111-1111-111111111111/c1.jpg',
   'photo'),
  ('e0000003-0003-0003-0003-000000000003',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 1,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c2.jpg',
   'photo');

-- ============================================================
-- 1. admin returns true count (3) for photo group
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select public.get_pending_review_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  3,
  'admin of group with 3 pending receives count=3'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 2. admin returns 0 when none pending (video group)
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select public.get_pending_review_count('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')),
  0,
  'admin of group with no pending receives count=0'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 3. non-admin member returns 0 — NOT 3 (no leak per D-17)
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select public.get_pending_review_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  0,
  'non-admin member of photo group receives 0, NOT 3 (no count leak — D-17)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 4. stranger returns 0 — non-member of photo group → 0
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select public.get_pending_review_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  0,
  'stranger (non-member) receives 0'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 5. anon returns 0 — no JWT, is_group_admin returns false → 0 (no
--    not_authenticated guard; this RPC is intentionally lenient)
-- ============================================================
select is(
  (select public.get_pending_review_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  0,
  'anon caller receives 0 (no auth gate — is_group_admin alone enforces)'
);

select * from finish();
rollback;
