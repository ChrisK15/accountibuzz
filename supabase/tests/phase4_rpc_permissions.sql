-- pgTAP test: Phase 4 RPC permission matrix —
--   4 RPCs (get_pending_today, get_missed_yesterday, get_today_posted_count,
--   get_group_leaderboard) × 4 personas (anon, stranger, member, admin)
--   + the column-allowlist trigger from D-19.
--
-- WAVE 0 RED-STATE: this file MUST FAIL until 04-02 ships the four new RPCs
-- and the column-allowlist trigger. Until then, every `throws_ok` and `is`
-- assertion below fails because the function does not exist (42883
-- undefined_function) — that is the canonical RED signal.
--
-- HIGH #6 LOCKED INTERPRETATION (RESOLVED via REVIEWS replan 2026-05-08):
-- 04-02 grants `get_today_posted_count` execute to `authenticated` ONLY and
-- revokes from `public`. Anon callers therefore receive SQLSTATE 42501
-- 'permission denied' BEFORE the function body runs. The anon assertion
-- below uses `throws_ok(... 'permission denied for function ...', '42501')`,
-- NOT `is(..., 0)`.
--
-- Pattern source: supabase/tests/get_pending_review_count.sql lines 55-139
-- (5-persona JWT-claim cycle).

begin;
select plan(17);

-- ---- Multi-persona seed: admin, member, stranger, ex-member ----

insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'admin@x.com', 'authenticated', 'authenticated', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'member@x.com', 'authenticated', 'authenticated', now(), now()),
  ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000',
   'stranger@x.com', 'authenticated', 'authenticated', now(), now()),
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
   'exmember@x.com', 'authenticated', 'authenticated', now(), now());

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PhotoG', 'Daily run photo', 'photo',
   'America/Los_Angeles', '11111111-1111-1111-1111-111111111111');

-- Admin + active member; ex-member is NOT in group_members (was kicked).
insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member');

-- Seed one approved submission for member today so get_today_posted_count
-- has a non-zero candidate value to assert against (when the body runs).
insert into public.submissions (id, group_id, user_id, local_date, status, media_path, media_type) values
  ('e0000001-0001-0001-0001-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'approved',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c1.jpg',
   'photo');

-- ============================================================
-- 1. ANON × get_pending_today → typed-error not_authenticated
-- ============================================================
select throws_ok(
  $$select * from public.get_pending_today('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'not_authenticated',
  'anon × get_pending_today raises not_authenticated'
);

-- ============================================================
-- 2. ANON × get_missed_yesterday → typed-error not_authenticated
-- ============================================================
select throws_ok(
  $$select * from public.get_missed_yesterday('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'not_authenticated',
  'anon × get_missed_yesterday raises not_authenticated'
);

-- ============================================================
-- 3. ANON × get_group_leaderboard → typed-error not_authenticated
-- ============================================================
select throws_ok(
  $$select * from public.get_group_leaderboard('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'not_authenticated',
  'anon × get_group_leaderboard raises not_authenticated'
);

-- ============================================================
-- 4. ANON × get_today_posted_count → permission denied (HIGH #6 strict-grant)
--    04-02 revokes execute from public; anon hits the SQL grant gate BEFORE
--    the function body runs. Expected SQLSTATE 42501.
-- ============================================================
select throws_ok(
  $$select public.get_today_posted_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$,
  '42501',
  NULL,
  'anon × get_today_posted_count raises 42501 permission denied (HIGH #6 strict-grant: public has no execute grant)'
);

-- ============================================================
-- STRANGER (authenticated, NOT in group)
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}',
  true
);
set local role authenticated;

-- 5. stranger × get_pending_today → typed-error not_member
select throws_ok(
  $$select * from public.get_pending_today('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'not_member',
  'stranger × get_pending_today raises not_member'
);

-- 6. stranger × get_missed_yesterday → typed-error not_member
select throws_ok(
  $$select * from public.get_missed_yesterday('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'not_member',
  'stranger × get_missed_yesterday raises not_member'
);

-- 7. stranger × get_group_leaderboard → typed-error not_member
select throws_ok(
  $$select * from public.get_group_leaderboard('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'not_member',
  'stranger × get_group_leaderboard raises not_member'
);

-- 8. stranger × get_today_posted_count → lenient: returns 0 (NO leak per
--    get_pending_review_count precedent in 0006).
select is(
  (select public.get_today_posted_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)),
  0,
  'stranger × get_today_posted_count returns 0 (lenient body soft-fails for authenticated non-member)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- EX-MEMBER (authenticated, was removed from group — same as stranger)
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}',
  true
);
set local role authenticated;

-- 9. ex-member × get_pending_today → typed-error not_member
select throws_ok(
  $$select * from public.get_pending_today('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001',
  'not_member',
  'ex-member × get_pending_today raises not_member (membership re-checked at call time)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- MEMBER (authenticated, in group)
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

-- 10. member × get_pending_today succeeds (lives_ok proves no exception)
select lives_ok(
  $$select * from public.get_pending_today('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'member × get_pending_today succeeds'
);

-- 11. member × get_missed_yesterday succeeds
select lives_ok(
  $$select * from public.get_missed_yesterday('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'member × get_missed_yesterday succeeds'
);

-- 12. member × get_group_leaderboard succeeds
select lives_ok(
  $$select * from public.get_group_leaderboard('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'member × get_group_leaderboard succeeds'
);

-- 13. member × get_today_posted_count returns 1 (the seeded approved row)
select is(
  (select public.get_today_posted_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)),
  1,
  'member × get_today_posted_count returns 1 (one approved submission today)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- ADMIN (authenticated, admin of group)
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- 14. admin × get_pending_today succeeds
select lives_ok(
  $$select * from public.get_pending_today('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'admin × get_pending_today succeeds'
);

-- 15. admin × get_group_leaderboard succeeds
select lives_ok(
  $$select * from public.get_group_leaderboard('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'admin × get_group_leaderboard succeeds'
);

-- ============================================================
-- 16. D-19 column-allowlist trigger — direct group_members counter UPDATE
--     from authenticated admin is rejected (counter columns are
--     server-managed; pg_trigger_depth() > 1 bypass lets the AFTER UPDATE
--     trigger from handle_submission_approval still write).
-- ============================================================
select throws_ok(
  $$update public.group_members
       set points = 9999
     where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and user_id  = '44444444-4444-4444-4444-444444444444'$$,
  NULL,
  'group_members counter columns are server-managed',
  'D-19 column-allowlist trigger blocks direct points UPDATE from admin (pg_trigger_depth bypass for definer)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 17. Cross-group admin — admin of group A querying nonexistent group B
--     raises not_member (membership-gated, NOT admin-gated, per D-17).
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select * from public.get_pending_today('cccccccc-cccc-cccc-cccc-cccccccccccc')$$,
  'P0001',
  'not_member',
  'admin querying group they are NOT a member of raises not_member (membership re-check, not admin-gating)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
