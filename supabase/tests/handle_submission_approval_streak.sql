-- pgTAP test: handle_submission_approval trigger body — D-02 streak recurrence
-- (NULL / consecutive / gap / longest_streak preservation) + D-01 server-derived
-- local_date proof (cross-tz isolation between groups).
--
-- WAVE 0 RED-STATE: this file MUST FAIL until 04-02 replaces the no-op stub
-- in supabase/migrations/0001_foundation.sql lines 365-384 with the real
-- streak-math body. Until then, every assertion that expects points/current_streak
-- to change after a status flip will report points=0 / current_streak=0.
--
-- Pattern: raw UPDATE on public.submissions (NOT review_submission RPC) —
-- the trigger fires AFTER UPDATE OF status WHEN (status flips pending → approved).
-- This isolates the trigger body from the RPC layer per 04-PATTERNS.md §"DB
-- test" guidance.
--
-- Branch coverage:
--   1. NULL last_rolled_date → current_streak = 1
--   2. local_date = last_rolled_date + 1 (consecutive) → current_streak += 1
--   3. local_date > last_rolled_date + 1 (gap) → current_streak resets to 1
--   4. longest_streak preserved across the reset
--   5. D-01 cross-tz proof: trigger uses NEW.local_date, NOT now()::date
--   6. points monotonic increment
--   7. cross-group isolation
--   8. WHEN clause idempotency (re-issuing UPDATE with same status does not refire)

begin;
select plan(8);

-- ---- Multi-persona seed: 1 admin + 1 member per group, two groups in
--                          DIFFERENT timezones (D-01 proof). ----

insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin-a@x.com', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'admin-b@x.com', 'authenticated', 'authenticated', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'member-a@x.com', 'authenticated', 'authenticated', now(), now()),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
   'member-b@x.com', 'authenticated', 'authenticated', now(), now());

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GroupA', 'Daily run photo', 'photo',
   'America/Los_Angeles', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'GroupB', 'Daily Spanish video', 'video',
   'America/New_York', '22222222-2222-2222-2222-222222222222');

insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'member');

-- Member A pending submissions in Group A (LA tz) at distinct local_dates:
--   today-7, today-6 (consecutive), today-2 (gap of 4 days), today-1, today
-- All authored by member 4444 in Group A so the same group_members row
-- accumulates streak math.
insert into public.submissions (id, group_id, user_id, local_date, status, media_path, media_type) values
  ('e0000001-0001-0001-0001-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 7,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c1.jpg',
   'photo'),
  ('e0000002-0002-0002-0002-000000000002',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 6,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c2.jpg',
   'photo'),
  ('e0000003-0003-0003-0003-000000000003',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 2,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c3.jpg',
   'photo'),
  ('e0000004-0004-0004-0004-000000000004',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 1,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c4.jpg',
   'photo'),
  ('e0000005-0005-0005-0005-000000000005',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c5.jpg',
   'photo'),
  -- Member B pending in Group B (NY tz) for the cross-tz / cross-group proof:
  ('e0000010-0010-0010-0010-000000000010',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555',
   (now() AT TIME ZONE 'America/New_York')::date,
   'pending',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/55555555-5555-5555-5555-555555555555/c1.mp4',
   'video');

-- ============================================================
-- 1. NULL branch — first approval; last_rolled_date IS NULL → current_streak=1
-- ============================================================
-- Approve the today-7 submission (raw UPDATE, no RPC).
update public.submissions
   set status = 'approved'
 where id = 'e0000001-0001-0001-0001-000000000001';

select results_eq(
  $$select points, current_streak, longest_streak, last_rolled_date
      from public.group_members
     where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and user_id  = '44444444-4444-4444-4444-444444444444'$$,
  $$values (
      1::int,
      1::int,
      1::int,
      ((now() AT TIME ZONE 'America/Los_Angeles')::date - 7)::date
    )$$,
  'NULL branch: first approval sets points=1, current_streak=1, longest_streak=1, last_rolled_date=submission.local_date (D-01)'
);

-- ============================================================
-- 2. Consecutive branch — local_date = last_rolled_date + 1 → +1
-- ============================================================
update public.submissions
   set status = 'approved'
 where id = 'e0000002-0002-0002-0002-000000000002';

select results_eq(
  $$select points, current_streak, longest_streak
      from public.group_members
     where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and user_id  = '44444444-4444-4444-4444-444444444444'$$,
  $$values ( 2::int, 2::int, 2::int )$$,
  'Consecutive branch: local_date = last_rolled_date + 1 → current_streak=2, longest_streak=2'
);

-- ============================================================
-- 3. Gap branch — local_date > last_rolled_date + 1 → reset to 1, longest preserved
-- ============================================================
-- today-2 vs last_rolled today-6 → gap of 4 days → reset.
update public.submissions
   set status = 'approved'
 where id = 'e0000003-0003-0003-0003-000000000003';

select results_eq(
  $$select points, current_streak, longest_streak
      from public.group_members
     where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and user_id  = '44444444-4444-4444-4444-444444444444'$$,
  $$values ( 3::int, 1::int, 2::int )$$,
  'Gap branch: current_streak resets to 1; longest_streak=2 preserved (D-02 longest high-water mark)'
);

-- ============================================================
-- 4. longest_streak preserved across consecutive after reset
-- ============================================================
-- After today-2 approval, approve today-1 (consecutive) then today (consecutive).
update public.submissions
   set status = 'approved'
 where id = 'e0000004-0004-0004-0004-000000000004';

update public.submissions
   set status = 'approved'
 where id = 'e0000005-0005-0005-0005-000000000005';

select results_eq(
  $$select points, current_streak, longest_streak
      from public.group_members
     where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and user_id  = '44444444-4444-4444-4444-444444444444'$$,
  $$values ( 5::int, 3::int, 3::int )$$,
  'After 3 consecutive (today-2, today-1, today): current_streak=3, longest_streak rises to 3'
);

-- ============================================================
-- 5. Points monotonic increment — total = 5 after 5 approvals
-- ============================================================
select is(
  (select points
     from public.group_members
    where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id  = '44444444-4444-4444-4444-444444444444'),
  5,
  'Points monotonic: 5 approvals → 5 points (D-04 counter integrity)'
);

-- ============================================================
-- 6. D-01 cross-tz proof — Group B uses NY tz; trigger writes NY-local_date
-- ============================================================
update public.submissions
   set status = 'approved'
 where id = 'e0000010-0010-0010-0010-000000000010';

select is(
  (select last_rolled_date
     from public.group_members
    where group_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      and user_id  = '55555555-5555-5555-5555-555555555555'),
  (now() AT TIME ZONE 'America/New_York')::date,
  'D-01: Group B last_rolled_date matches submission local_date (NY tz), NOT server now()::date'
);

-- ============================================================
-- 7. Cross-group isolation — Group A counters unchanged by Group B approval
-- ============================================================
select is(
  (select points
     from public.group_members
    where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id  = '44444444-4444-4444-4444-444444444444'),
  5,
  'Cross-group isolation: Group A points still = 5 after Group B approval (no leakage)'
);

-- ============================================================
-- 8. AFTER UPDATE WHEN clause idempotency — re-issuing UPDATE with same
--    'approved' status does NOT re-fire the trigger
--    (D-03: relies on `WHEN (old.status IS DISTINCT FROM new.status)` — the
--    AFTER UPDATE phase still gates on a status TRANSITION).
-- ============================================================
-- Note: this also exercises the 0003 admin-immutable trigger which would
-- normally reject 'approved' → 'approved' for a non-admin caller, but raw
-- UPDATE without role still passes through (definer/superuser path).
-- The expectation is that the WHEN clause prevents the trigger body from
-- executing, so points stays at 5.
update public.submissions
   set status = 'approved'
 where id = 'e0000005-0005-0005-0005-000000000005';

select is(
  (select points
     from public.group_members
    where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id  = '44444444-4444-4444-4444-444444444444'),
  5,
  'WHEN clause idempotency: re-issuing UPDATE with same approved status does NOT increment points (D-03)'
);

select * from finish();
rollback;
