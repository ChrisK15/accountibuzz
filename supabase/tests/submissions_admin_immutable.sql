-- pgTAP test: 0003 admin-immutable trigger coverage (BACKFILL).
--
-- Backfills the gap flagged in .planning/phases/01-foundation/deferred-items.md:
-- the BEFORE UPDATE trigger `submissions_owner_immutable_trigger` (defined in
-- 0003) had no direct pgTAP coverage. This file exercises BOTH branches via
-- raw UPDATEs (NOT through any RPC), so trigger behavior is asserted
-- independently of the review_submission RPC layer.
--
-- Source error messages (must match 0003 exactly):
--   owner branch:  'owner may not modify key/status/review columns on submissions'
--   admin branch:  'admin may not modify submission identity/group/media columns'
--   admin reviewed_by: 'admin review must set reviewed_by = auth.uid()'

begin;
select plan(11);

-- ---- Multi-persona seed (3 users; 1 group) ----
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'otheradmin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'owner@x.com', 'authenticated', 'authenticated', now(), now());

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PhotoG', 'Daily run photo', 'photo', 'America/Los_Angeles',
   '11111111-1111-1111-1111-111111111111'),
  -- A second group (admined by user 22222222) so we have a valid group_id
  -- target for the admin-cannot-mutate-group_id assertion.
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'OtherG', 'Daily other thing', 'photo', 'UTC',
   '22222222-2222-2222-2222-222222222222');

insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'admin');

-- Pending submissions: one per test case (so each test gets a fresh row, no
-- coupling). All authored by the owner (44444444) in the photo group.
insert into public.submissions (id, group_id, user_id, local_date, status, media_path, media_type, caption) values
  ('e0000001-0001-0001-0001-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c1.jpg',
   'photo', null),
  ('e0000002-0002-0002-0002-000000000002',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 1,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c2.jpg',
   'photo', null),
  ('e0000003-0003-0003-0003-000000000003',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 2,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c3.jpg',
   'photo', null),
  ('e0000004-0004-0004-0004-000000000004',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 3,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c4.jpg',
   'photo', null),
  ('e0000005-0005-0005-0005-000000000005',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 4,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c5.jpg',
   'photo', null),
  ('e0000006-0006-0006-0006-000000000006',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 5,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c6.jpg',
   'photo', null),
  ('e0000007-0007-0007-0007-000000000007',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 6,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c7.jpg',
   'photo', null),
  ('e0000008-0008-0008-0008-000000000008',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 7,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c8.jpg',
   'photo', null),
  ('e0000009-0009-0009-0009-000000000009',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 8,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c9.jpg',
   'photo', null);

-- ===========================================================================
-- OWNER BRANCH — auth.uid() = old.user_id (and not admin)
-- ===========================================================================

-- Pin authorization to the owner.
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

-- ============================================================
-- 1. owner cannot mutate status (raw UPDATE)
-- ============================================================
select throws_ok(
  $$update public.submissions
       set status = 'approved'
     where id = 'e0000001-0001-0001-0001-000000000001'$$,
  NULL,
  'owner may not modify key/status/review columns on submissions',
  'owner branch: status mutation rejected by trigger'
);

-- ============================================================
-- 2. owner cannot mutate user_id
-- ============================================================
select throws_ok(
  $$update public.submissions
       set user_id = '11111111-1111-1111-1111-111111111111'
     where id = 'e0000002-0002-0002-0002-000000000002'$$,
  NULL,
  'owner may not modify key/status/review columns on submissions',
  'owner branch: user_id mutation rejected by trigger'
);

-- ============================================================
-- 3. owner cannot mutate group_id
-- ============================================================
select throws_ok(
  $$update public.submissions
       set group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
     where id = 'e0000003-0003-0003-0003-000000000003'$$,
  NULL,
  'owner may not modify key/status/review columns on submissions',
  'owner branch: group_id mutation rejected by trigger'
);

-- ============================================================
-- 4. owner cannot mutate local_date
-- ============================================================
select throws_ok(
  $$update public.submissions
       set local_date = '2020-01-01'
     where id = 'e0000004-0004-0004-0004-000000000004'$$,
  NULL,
  'owner may not modify key/status/review columns on submissions',
  'owner branch: local_date mutation rejected by trigger'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ===========================================================================
-- ADMIN BRANCH — auth.uid() matches groups.admin_user_id (admin reviews)
-- ===========================================================================

-- Pin authorization to the admin.
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- ============================================================
-- 5. admin cannot mutate group_id (WR-02)
-- ============================================================
select throws_ok(
  $$update public.submissions
       set group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
     where id = 'e0000005-0005-0005-0005-000000000005'$$,
  NULL,
  'admin may not modify submission identity/group/media columns',
  'admin branch: group_id mutation rejected by trigger (WR-02)'
);

-- ============================================================
-- 6. admin cannot mutate user_id
-- ============================================================
select throws_ok(
  $$update public.submissions
       set user_id = '11111111-1111-1111-1111-111111111111'
     where id = 'e0000006-0006-0006-0006-000000000006'$$,
  NULL,
  'admin may not modify submission identity/group/media columns',
  'admin branch: user_id mutation rejected by trigger'
);

-- ============================================================
-- 7. admin cannot mutate local_date
-- ============================================================
select throws_ok(
  $$update public.submissions
       set local_date = '2020-01-01'
     where id = 'e0000007-0007-0007-0007-000000000007'$$,
  NULL,
  'admin may not modify submission identity/group/media columns',
  'admin branch: local_date mutation rejected by trigger'
);

-- ============================================================
-- 8. admin cannot mutate media_path
-- ============================================================
select throws_ok(
  $$update public.submissions
       set media_path = 'evil-path.jpg'
     where id = 'e0000008-0008-0008-0008-000000000008'$$,
  NULL,
  'admin may not modify submission identity/group/media columns',
  'admin branch: media_path mutation rejected by trigger'
);

-- ============================================================
-- 9. admin cannot mutate media_type
-- ============================================================
select throws_ok(
  $$update public.submissions
       set media_type = 'video'
     where id = 'e0000009-0009-0009-0009-000000000009'$$,
  NULL,
  'admin may not modify submission identity/group/media columns',
  'admin branch: media_type mutation rejected by trigger'
);

-- ============================================================
-- 10. admin reviewed_by ≠ auth.uid() rejected (WR-03)
-- ============================================================
select throws_ok(
  $$update public.submissions
       set status = 'approved',
           reviewed_by = '22222222-2222-2222-2222-222222222222',
           reviewed_at = now()
     where id = 'e0000007-0007-0007-0007-000000000007'$$,
  NULL,
  'admin review must set reviewed_by = auth.uid()',
  'admin branch: reviewed_by mismatch rejected by trigger (WR-03)'
);

-- ============================================================
-- 11. admin happy path — status+reviewed_by+reviewed_at, nothing else mutates
--     → lives_ok (proves trigger doesn't false-positive on legitimate review)
-- ============================================================
-- Use a fresh row that wasn't touched by any of the failed UPDATEs above.
-- Insert a dedicated row for this assertion.
reset role;
select set_config('request.jwt.claims', NULL, true);

insert into public.submissions (id, group_id, user_id, local_date, status, media_path, media_type, caption) values
  ('e0000099-0099-0099-0099-000000000099',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 99,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/happy.jpg',
   'photo', null);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$update public.submissions
       set status      = 'approved',
           reviewed_by = '11111111-1111-1111-1111-111111111111',
           reviewed_at = now()
     where id = 'e0000099-0099-0099-0099-000000000099'$$,
  'admin branch: legit review (status + reviewed_by=self + reviewed_at) accepted by trigger'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
