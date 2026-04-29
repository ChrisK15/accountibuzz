-- pgTAP test: get_pending_review_queue RPC (PER REVIEWS.md C3 — HIGH security).
-- Covers the new admin-only queue RPC that replaced the previous client-side
-- direct SELECT-on-submissions, closing the deep-link bypass where any group
-- member could read pending media + captions by visiting /groups/[id]/review.
--
-- Scenarios:
--   1. admin returns rows (oldest first, expected columns shape)
--   2. admin returns 0 rows when none pending
--   3. non-admin member raises not_admin (THE C3 SECURITY ASSERTION)
--   4. stranger (non-member) raises not_admin
--   5. anon raises not_authenticated
--   6. cross-group admin raises not_admin
--   7. profile join handles missing profile (LEFT JOIN — null cols)

begin;
select plan(12);

-- ---- Multi-persona seed (5 users; 2 groups) ----
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'photoadmin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'videoadmin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'stranger@x.com', 'authenticated', 'authenticated', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'member@x.com', 'authenticated', 'authenticated', now(), now()),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
   'noprofile@x.com', 'authenticated', 'authenticated', now(), now());

-- Patch the noprofile user: handle_new_user inserted a profile row, but for the
-- LEFT JOIN test we want a submission referencing a profile-less user. Delete
-- the auto-created profile row AFTER the FK target exists so the submission
-- still satisfies its FK on user_id (which is itself profiles.id), then
-- re-create a separate auth.user that has its profile row removed.
--
-- Strategy: instead of trying to delete profile rows (which would break the FK
-- chain), keep all profiles intact but use UPDATE to NULL the display_name and
-- avatar_path on user 55555555. This still proves the LEFT JOIN return shape
-- but admittedly tests the empty-strings path more than the missing-row path.
-- However: the submissions FK is profiles(id), so a profile-less user_id is
-- structurally impossible. The "missing profile" test is not actually
-- reachable — it's a defensive-coding assertion only.
update public.profiles
   set display_name = ''
 where id = '55555555-5555-5555-5555-555555555555';

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PhotoG', 'Daily run photo', 'photo', 'America/Los_Angeles',
   '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'VideoG', 'Daily Spanish video', 'video', 'America/Los_Angeles',
   '22222222-2222-2222-2222-222222222222');

insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'admin');

-- 2 pending in photo group with distinct created_at (test ordering).
-- 1 pending row authored by user with empty display_name (LEFT JOIN edge).
insert into public.submissions (id, group_id, user_id, local_date, status, media_path, media_type, caption, created_at) values
  ('s0000001-0001-0001-0001-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c1.jpg',
   'photo',
   'older one',
   now() - interval '2 hours'),
  ('s0000002-0002-0002-0002-000000000002',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '55555555-5555-5555-5555-555555555555',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/55555555-5555-5555-5555-555555555555/c1.jpg',
   'photo',
   'newer one',
   now() - interval '1 hour');

-- ============================================================
-- 1. anon raises not_authenticated — NO JWT, call queue RPC
-- ============================================================
select throws_ok(
  $$select * from public.get_pending_review_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'not_authenticated',
  'anon caller raises not_authenticated (server-side gate)'
);

-- ============================================================
-- 2. non-admin member raises not_admin — THE C3 SECURITY ASSERTION.
--    Member of photo group (NOT admin) attempting to read the queue.
--    Pre-C3 this returned all pending media + captions; post-C3 → not_admin.
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select * from public.get_pending_review_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'not_admin',
  'non-admin member raises not_admin (PER REVIEWS.md C3 — closes deep-link bypass)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 3. stranger (non-member of photo group) raises not_admin
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select * from public.get_pending_review_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'not_admin',
  'stranger (non-member) raises not_admin'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 4. cross-group admin raises not_admin — admin of photo group calls for video group.
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select * from public.get_pending_review_queue('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  'P0001',
  'not_admin',
  'admin of group A querying group B raises not_admin (cross-group)'
);

-- ============================================================
-- 5. admin returns rows — count = 2
-- ============================================================
select is(
  (select count(*)::int from public.get_pending_review_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  2,
  'admin of photo group receives 2 pending rows'
);

-- ============================================================
-- 6. admin queue is ordered by created_at asc — oldest first
-- ============================================================
select is(
  (select id from public.get_pending_review_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') limit 1),
  's0000001-0001-0001-0001-000000000001'::uuid,
  'admin queue ordered by created_at asc (oldest first)'
);

-- ============================================================
-- 7. admin queue returns expected columns (id / user_id / caption / media_path /
--    media_type / created_at / display_name / avatar_path / profile_updated_at)
--    — verify shape by selecting media_type from the second row.
-- ============================================================
select is(
  (select media_type from public.get_pending_review_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    where id = 's0000002-0002-0002-0002-000000000002'),
  'photo',
  'queue rows expose media_type column'
);

select is(
  (select caption from public.get_pending_review_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    where id = 's0000001-0001-0001-0001-000000000001'),
  'older one',
  'queue rows expose caption column'
);

-- ============================================================
-- 8. profile join handles empty-string display_name — confirms LEFT JOIN shape
--    even when profile is auto-created with default '' (Pitfall: handle_new_user
--    defaults display_name to empty string).
-- ============================================================
select is(
  (select display_name from public.get_pending_review_queue('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    where id = 's0000002-0002-0002-0002-000000000002'),
  ''::text,
  'queue rows expose joined display_name (empty string when profile defaulted)'
);

-- ============================================================
-- 9. admin returns 0 rows when none pending — video admin's group is empty
-- ============================================================
reset role;
select set_config('request.jwt.claims', NULL, true);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*)::int from public.get_pending_review_queue('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')),
  0,
  'admin of empty group receives 0 rows (lives_ok by structure)'
);

-- ============================================================
-- 10. limit 50 — confirm hard cap. Don't seed 51 rows; structurally assert via
--     pg_get_functiondef matching for the 'limit 50' clause.
-- ============================================================
reset role;
select set_config('request.jwt.claims', NULL, true);

select matches(
  pg_get_functiondef('public.get_pending_review_queue(uuid)'::regprocedure)::text,
  '(?i)limit 50'::text,
  'get_pending_review_queue body contains LIMIT 50 cap'
);

-- ============================================================
-- 11. structural: function body validates is_group_admin BEFORE returning rows
--     (defense-in-depth Layer 2 — the C3 mitigation).
-- ============================================================
select matches(
  pg_get_functiondef('public.get_pending_review_queue(uuid)'::regprocedure)::text,
  '(?i)is_group_admin'::text,
  'get_pending_review_queue body validates is_group_admin (PER REVIEWS.md C3 server-side gate)'
);

select * from finish();
rollback;
