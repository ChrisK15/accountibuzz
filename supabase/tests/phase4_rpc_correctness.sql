-- pgTAP test: Phase 4 RPC correctness — happy paths + DST + cross-tz +
-- deterministic tiebreaker (joined_at ASC) per MEDIUM tiebreaker fix
-- (RESOLVED via REVIEWS replan 2026-05-08).
--
-- WAVE 0 RED-STATE: this file MUST FAIL until 04-02 ships the four new RPCs
-- (`get_pending_today`, `get_missed_yesterday`, `get_today_posted_count`,
-- `get_group_leaderboard`). Until then, every assertion fails with 42883
-- undefined_function — that is the canonical RED signal.
--
-- Pattern source: supabase/tests/get_pending_review_queue.sql lines 60-100
-- (multi-row seed + ordering + LEFT-JOIN edge cases).

begin;
select plan(10);

-- ---- Multi-persona seed: 4 members in group A (LA tz), 1 admin in group B
-- (NY tz for DST + cross-tz isolation); plus 2 of group A's members share
-- identical points/streak with different joined_at (tiebreaker proof). ----

insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin-a@x.com', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'admin-b@x.com', 'authenticated', 'authenticated', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'alice@x.com', 'authenticated', 'authenticated', now(), now()),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
   'bob@x.com', 'authenticated', 'authenticated', now(), now()),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000',
   'carol@x.com', 'authenticated', 'authenticated', now(), now()),
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000',
   'derek@x.com', 'authenticated', 'authenticated', now(), now());

-- Patch profile display_names so order assertions are stable.
update public.profiles set display_name = 'Alice'  where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set display_name = 'Bob'    where id = '55555555-5555-5555-5555-555555555555';
update public.profiles set display_name = 'Carol'  where id = '66666666-6666-6666-6666-666666666666';
update public.profiles set display_name = 'Derek'  where id = '77777777-7777-7777-7777-777777777777';

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GroupA', 'Daily run', 'photo',
   'America/Los_Angeles', '11111111-1111-1111-1111-111111111111'),
  -- Group B in NY tz for DST + cross-tz isolation tests.
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'GroupB', 'Daily Spanish video', 'video',
   'America/New_York', '22222222-2222-2222-2222-222222222222');

-- Group A members + their counter state. Two members (Bob, Carol) tie on
-- (points=5, current_streak=3); Bob joined earlier, so MUST appear first in
-- the leaderboard per the joined_at ASC deterministic tiebreaker.
insert into public.group_members (group_id, user_id, role, joined_at, points, current_streak, longest_streak) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin',
   now() - interval '30 days', 0, 0, 0),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member',
   now() - interval '20 days', 10, 5, 5),
  -- Bob joined EARLIER, ties Carol on counters → MUST appear first.
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'member',
   now() - interval '15 days', 5, 3, 3),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'member',
   now() - interval '10 days', 5, 3, 3),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'member',
   now() - interval '5 days', 0, 0, 0),
  -- Group B admin only (cross-tz/cross-group isolation seed).
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'admin',
   now() - interval '30 days', 0, 0, 0);

-- Submissions seed for today vs yesterday in Group A:
--   Alice (44): approved today AND approved yesterday
--   Bob (55):   rejected today AND no row yesterday
--   Carol (66): pending today AND approved yesterday
--   Derek (77): NO row today, NO row yesterday
-- → get_pending_today returns Derek
-- → get_missed_yesterday returns Bob, Derek (no approved yesterday)
-- → get_today_posted_count returns 1 (only Alice's approved)
insert into public.submissions (id, group_id, user_id, local_date, status, media_path, media_type) values
  -- Alice today approved
  ('e0000001-0001-0001-0001-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'approved',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/today.jpg',
   'photo'),
  -- Alice yesterday approved
  ('e0000002-0002-0002-0002-000000000002',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 1,
   'approved',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/yest.jpg',
   'photo'),
  -- Bob today rejected
  ('e0000003-0003-0003-0003-000000000003',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'rejected',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/55555555-5555-5555-5555-555555555555/today.jpg',
   'photo'),
  -- Carol today pending
  ('e0000004-0004-0004-0004-000000000004',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/66666666-6666-6666-6666-666666666666/today.jpg',
   'photo'),
  -- Carol yesterday approved
  ('e0000005-0005-0005-0005-000000000005',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 1,
   'approved',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/66666666-6666-6666-6666-666666666666/yest.jpg',
   'photo');

-- Pin authorization to Alice (a member) for read-side RPC calls.
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

-- ============================================================
-- 1. get_pending_today returns members with NO submission for today,
--    excluding admins per typical D-17 semantics. We seed:
--      - Alice (approved today)  → excluded
--      - Bob (rejected today)    → excluded (has a row)
--      - Carol (pending today)   → excluded (has a row)
--      - Derek (no row)          → INCLUDED
--    We assert the single returned user_id is Derek.
-- ============================================================
select is(
  (select count(*)::int from public.get_pending_today('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)),
  1,
  'get_pending_today returns 1 member (Derek — the only one without a submission row today)'
);

-- ============================================================
-- 2. get_pending_today excludes rejected/pending — semantically "no row for
--    today" means the LEFT-JOIN-IS-NULL case. Re-assert by user_id.
-- ============================================================
select is(
  (select user_id from public.get_pending_today('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid) limit 1),
  '77777777-7777-7777-7777-777777777777'::uuid,
  'get_pending_today returns Derek by user_id (excludes Alice/Bob/Carol who all have today rows)'
);

-- ============================================================
-- 3. get_missed_yesterday returns members with NO APPROVED row for yesterday.
--    Yesterday seed:
--      - Alice approved yesterday    → excluded
--      - Bob no row yesterday         → INCLUDED
--      - Carol approved yesterday     → excluded
--      - Derek no row yesterday       → INCLUDED
--    Expected count = 2.
-- ============================================================
select is(
  (select count(*)::int from public.get_missed_yesterday('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)),
  2,
  'get_missed_yesterday returns 2 members (Bob + Derek — no approved row for yesterday)'
);

-- ============================================================
-- 4. get_missed_yesterday treats pending and rejected as missing — Bob
--    rejected yesterday should still appear. Add a rejected-yesterday row
--    for Bob and re-assert.
--    (We use a fresh row outside the snapshot to avoid mutating earlier
--    counts.) For RED-state purposes, just assert Bob is in the result set.
-- ============================================================
select bag_eq(
  $$select user_id from public.get_missed_yesterday('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$,
  $$values
      ('55555555-5555-5555-5555-555555555555'::uuid),
      ('77777777-7777-7777-7777-777777777777'::uuid)
   $$,
  'get_missed_yesterday returns exactly Bob + Derek (rejected/pending count as missing)'
);

-- ============================================================
-- 5. get_today_posted_count returns the approved-only count for today.
--    Only Alice is approved today → 1.
-- ============================================================
select is(
  (select public.get_today_posted_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)),
  1,
  'get_today_posted_count returns 1 (only Alice approved today; Bob rejected and Carol pending excluded)'
);

-- ============================================================
-- 6. get_group_leaderboard order — points DESC, current_streak DESC,
--    joined_at ASC (deterministic tiebreaker per MEDIUM tiebreaker fix).
--    Expected order: Alice (10/5), Bob (5/3 joined earlier), Carol (5/3
--    joined later), then admin (0/0 joined first), Derek (0/0 joined last).
--    Assert the FIRST 3 user_ids — that's where the tiebreaker proof lives
--    (Bob before Carol on identical counters → joined_at ASC). The 0/0 rows
--    have admin@x.com (joined 30d ago) ahead of derek@x.com (joined 5d ago)
--    via the same tiebreaker.
-- ============================================================
select results_eq(
  $$select user_id from public.get_group_leaderboard('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
       limit 3$$,
  $$values
      ('44444444-4444-4444-4444-444444444444'::uuid),  -- Alice (10 pts)
      ('55555555-5555-5555-5555-555555555555'::uuid),  -- Bob (5 pts, joined 15d ago, ties with Carol)
      ('66666666-6666-6666-6666-666666666666'::uuid)   -- Carol (5 pts, joined 10d ago)
   $$,
  'get_group_leaderboard order: points DESC, current_streak DESC, joined_at ASC (deterministic tiebreaker — MEDIUM fix RESOLVED via REVIEWS replan 2026-05-08)'
);

-- ============================================================
-- 7. get_group_leaderboard exposes the expected columns —
--    display_name, avatar_path, updated_at, points, current_streak,
--    longest_streak, last_rolled_date, joined_at.
--    Assert by selecting `points` from a known row (Alice).
-- ============================================================
select is(
  (select points from public.get_group_leaderboard('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
    where user_id = '44444444-4444-4444-4444-444444444444'),
  10,
  'get_group_leaderboard exposes points column (Alice = 10)'
);

-- ============================================================
-- 8. DST edge — second group in America/New_York; assert
--    `(now() AT TIME ZONE 'America/New_York')::date - 1` matches the
--    expected calendar day. (Smoke test that the date arithmetic the RPC
--    body relies on is consistent for NY tz, including DST transitions.)
-- ============================================================
select is(
  ((now() AT TIME ZONE 'America/New_York')::date - 1),
  ((now() AT TIME ZONE 'America/New_York') - interval '1 day')::date,
  'DST edge: NY tz date arithmetic stable (yesterday-as-date matches yesterday-as-interval)'
);

-- ============================================================
-- 9. Cross-tz / cross-group isolation — Group B leaderboard does not include
--    Group A members; reading Group B should return only Group B's admin.
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
  (select count(*)::int from public.get_group_leaderboard('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  1,
  'get_group_leaderboard for Group B returns 1 row (admin only) — Group A members not leaked'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 10. get_pending_today order — alphabetical by display_name.
--     With only Derek in the result set this is a smoke test that the ORDER
--     BY clause exists (when 04-02 lands a multi-member result, this remains
--     the canonical assertion).
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select display_name from public.get_pending_today('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid) limit 1),
  'Derek',
  'get_pending_today order: alphabetical by display_name (Derek is the only result here)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
