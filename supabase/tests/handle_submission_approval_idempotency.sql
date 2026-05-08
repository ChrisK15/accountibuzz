-- pgTAP test: handle_submission_approval idempotency + concurrency proxies
-- (D-03 idempotency claim + Pitfall P4-B sequential proxy for concurrent
-- approvals + the optional column-allowlist trigger from D-19).
--
-- WAVE 0 RED-STATE: this file MUST FAIL until 04-02:
--   (a) replaces the no-op stub in handle_submission_approval (so points
--       actually increment),
--   (b) adds the column-allowlist BEFORE UPDATE trigger on group_members
--       that refuses client-side counter mutations from authenticated callers.
-- Until then, Test 1 fails (points never increments to 1), Test 4 fails
-- (sequential approvals don't accumulate), and Test 5 fails (the allowlist
-- trigger doesn't exist so the direct UPDATE succeeds).
--
-- Coverage:
--   1. WHEN clause blocks no-op (approve once, then re-issue same status)
--   2. 0003 admin-immutable blocks status flip-back (approved → pending)
--   3. AFTER UPDATE WHEN no-fire on non-status UPDATE (caption change)
--   4. Two-day serial coverage (sequential proxy for concurrent approvals)
--   5. Direct group_members.points UPDATE blocked by allowlist trigger (D-19)
--
-- NOTE: pgTAP is single-session; true concurrent-approval coverage requires
-- advisory locks or two psql sessions. The trigger body's race-safety relies
-- on the locked-row UPDATE pattern from 04-02 §Section 1 (HIGH #1 from
-- REVIEWS.md).

begin;
select plan(5);

-- ---- Multi-persona seed: 1 admin + 1 member, group in LA tz ----

insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'member@x.com', 'authenticated', 'authenticated', now(), now());

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PhotoG', 'Daily run photo', 'photo',
   'America/Los_Angeles', '11111111-1111-1111-1111-111111111111');

insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member');

insert into public.submissions (id, group_id, user_id, local_date, status, media_path, media_type, caption) values
  ('e0000001-0001-0001-0001-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 1,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c1.jpg',
   'photo', null),
  ('e0000002-0002-0002-0002-000000000002',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c2.jpg',
   'photo', null),
  ('e0000099-0099-0099-0099-000000000099',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 5,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c99.jpg',
   'photo', 'caption-test');

-- ============================================================
-- 1. WHEN clause idempotency — approve once, re-issue same status, points
--    stays at 1.
-- ============================================================
update public.submissions
   set status = 'approved'
 where id = 'e0000001-0001-0001-0001-000000000001';

select is(
  (select points
     from public.group_members
    where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id  = '44444444-4444-4444-4444-444444444444'),
  1,
  'Idempotency: first approve increments points to 1'
);

-- Re-issue UPDATE with same status — WHEN clause should block trigger body.
update public.submissions
   set status = 'approved'
 where id = 'e0000001-0001-0001-0001-000000000001';

-- Combine the original idempotency check into Test 1's narrative —
-- assertions 1 + 4 below cover the increment + idempotency + concurrency cases.

-- ============================================================
-- 2. 0003 admin-immutable blocks status flip-back (approved → pending)
--    Pin to admin claims so the admin branch fires (not the owner branch).
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$update public.submissions
       set status = 'pending'
     where id = 'e0000001-0001-0001-0001-000000000001'$$,
  NULL,
  'admin may not modify submission identity/group/media columns',
  'admin-immutable trigger blocks approved → pending flip-back (D-03 defense-in-depth)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 3. AFTER UPDATE WHEN no-fire on non-status UPDATE — caption change MUST
--    NOT re-fire the trigger.
--    The 0003 owner-immutable trigger forbids owner from mutating caption
--    on an approved row, so issue this as the row OWNER on a still-pending
--    submission (e0000099) and verify the trigger doesn't increment points.
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

-- Owner can still edit caption on pending submissions (no status change).
update public.submissions
   set caption = 'edited-by-owner-pending'
 where id = 'e0000099-0099-0099-0099-000000000099';

reset role;
select set_config('request.jwt.claims', NULL, true);

select is(
  (select points
     from public.group_members
    where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id  = '44444444-4444-4444-4444-444444444444'),
  1,
  'WHEN clause: caption-only UPDATE on pending row does NOT increment points (status unchanged)'
);

-- ============================================================
-- 4. Two-day serial coverage — sequential proxy for concurrent approvals.
--    Approve today-1's already-done; now approve today.
--    NOTE: pgTAP is single-session; true concurrent-approval coverage
--    requires advisory locks or two psql sessions. The trigger body's
--    race-safety relies on the locked-row UPDATE pattern from
--    04-02 §Section 1 (HIGH #1 from REVIEWS.md).
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
  'Two-day serial: today-1 then today → points=2, streak=2 (sequential proxy for concurrency, race-safety locked-row UPDATE per 04-02)'
);

-- ============================================================
-- 5. Direct group_members.points UPDATE blocked by column-allowlist trigger (D-19)
--    Pin to admin claims; admin should NOT be able to bypass the trigger
--    via direct counter UPDATE — the column-allowlist trigger raises.
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$update public.group_members
       set points = 9999
     where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and user_id  = '44444444-4444-4444-4444-444444444444'$$,
  NULL,
  NULL,
  'D-19 column-allowlist trigger raises on direct group_members.points UPDATE from authenticated admin'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
