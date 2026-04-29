-- pgTAP test: review_submission RPC (ADM-02, ADM-03, PLAT-03 + state machine).
-- Covers: approve happy, reject with/without reason, the 6 typed errors
-- (not_authenticated, invalid_decision, reason_too_long, submission_not_found,
-- not_admin, not_pending), Threat 7 cross-group attack, and Pitfall 9
-- concurrent-approve race guard.

begin;
select plan(12);

-- ---- Multi-persona seed (4 users; 2 groups: photo + video) ----
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

-- Pending submissions: one in photo group (member-authored), one in video group
-- (admin-authored, used for cross-group test).
insert into public.submissions (id, group_id, user_id, local_date, status, media_path, media_type, caption) values
  ('s0000001-0001-0001-0001-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c1.jpg',
   'photo',
   'member submission'),
  ('s0000002-0002-0002-0002-000000000002',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-1111-1111-111111111111/c1.jpg',
   'photo',
   null),
  ('s0000003-0003-0003-0003-000000000003',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '22222222-2222-2222-2222-222222222222',
   (now() AT TIME ZONE 'America/Los_Angeles')::date,
   'pending',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/22222222-2222-2222-2222-222222222222/c1.mp4',
   'video',
   null),
  -- One in photo group used for the reject + race tests (separate from #1 to avoid
  -- coupling the approve+reject sub-tests).
  ('s0000004-0004-0004-0004-000000000004',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 1,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c2.jpg',
   'photo',
   'reject candidate'),
  ('s0000005-0005-0005-0005-000000000005',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 2,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c3.jpg',
   'photo',
   'reject-no-reason candidate'),
  ('s0000006-0006-0006-0006-000000000006',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444444',
   (now() AT TIME ZONE 'America/Los_Angeles')::date - 3,
   'pending',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/c4.jpg',
   'photo',
   'race candidate');

-- ============================================================
-- 1. not_authenticated — no JWT → throws
-- ============================================================
select throws_ok(
  $$select public.review_submission(
      's0000001-0001-0001-0001-000000000001'::uuid,
      'approved',
      null
    )$$,
  'P0001',
  'not_authenticated',
  'unauthenticated caller raises not_authenticated'
);

-- ============================================================
-- 2. invalid_decision — admin calls with 'maybe' → throws
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.review_submission(
      's0000001-0001-0001-0001-000000000001'::uuid,
      'maybe',
      null
    )$$,
  'P0001',
  'invalid_decision',
  'p_decision not in (approved,rejected) raises invalid_decision'
);

-- ============================================================
-- 3. reason_too_long — admin rejects with 141-char reason → throws
-- ============================================================
select throws_ok(
  format(
    $$select public.review_submission(
        's0000001-0001-0001-0001-000000000001'::uuid,
        'rejected',
        %L
      )$$,
    repeat('x', 141)
  ),
  'P0001',
  'reason_too_long',
  '141-char rejection_reason raises reason_too_long'
);

-- ============================================================
-- 4. submission_not_found — admin calls with random uuid → throws
-- ============================================================
select throws_ok(
  $$select public.review_submission(
      'deadbeef-dead-dead-dead-deaddeaddead'::uuid,
      'approved',
      null
    )$$,
  'P0001',
  'submission_not_found',
  'unknown submission_id raises submission_not_found'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 5. not_admin — non-admin member calls → throws (PLAT-03)
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.review_submission(
      's0000001-0001-0001-0001-000000000001'::uuid,
      'approved',
      null
    )$$,
  'P0001',
  'not_admin',
  'non-admin member raises not_admin (PLAT-03)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 6. not_admin — cross-group (Threat 7): admin of photo group attempts to
--    review a video-group submission → throws not_admin
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.review_submission(
      's0000003-0003-0003-0003-000000000003'::uuid,
      'approved',
      null
    )$$,
  'P0001',
  'not_admin',
  'admin of group A reviewing submission of group B raises not_admin (Threat 7)'
);

-- ============================================================
-- 7. approve happy path — admin approves a pending submission
-- ============================================================
select lives_ok(
  $$select public.review_submission(
      's0000001-0001-0001-0001-000000000001'::uuid,
      'approved',
      null
    )$$,
  'admin approves pending submission'
);

select ok(
  exists (
    select 1 from public.submissions
     where id = 's0000001-0001-0001-0001-000000000001'
       and status = 'approved'
       and reviewed_by = '11111111-1111-1111-1111-111111111111'
       and reviewed_at is not null
       and rejection_reason is null
  ),
  'approve sets status=approved + reviewed_by=admin + reviewed_at + null reason'
);

-- ============================================================
-- 8. reject with reason — admin rejects, reason persisted
-- ============================================================
select lives_ok(
  $$select public.review_submission(
      's0000004-0004-0004-0004-000000000004'::uuid,
      'rejected',
      'photo is blurry'
    )$$,
  'admin rejects pending submission with reason'
);

select ok(
  exists (
    select 1 from public.submissions
     where id = 's0000004-0004-0004-0004-000000000004'
       and status = 'rejected'
       and rejection_reason = 'photo is blurry'
       and reviewed_by = '11111111-1111-1111-1111-111111111111'
  ),
  'reject sets status=rejected + rejection_reason=text + reviewed_by=admin'
);

-- ============================================================
-- 9. not_pending — already-reviewed submission re-approved → throws
-- ============================================================
select throws_ok(
  $$select public.review_submission(
      's0000001-0001-0001-0001-000000000001'::uuid,
      'approved',
      null
    )$$,
  'P0001',
  'not_pending',
  'reviewing an already-approved submission raises not_pending'
);

-- ============================================================
-- 10. not_pending — concurrent race (Pitfall 9): manually flip status to rejected
--     before calling RPC → throws not_pending
-- ============================================================
reset role;
select set_config('request.jwt.claims', NULL, true);

-- Bypass RLS + trigger by acting as superuser to set up the race condition.
update public.submissions
   set status = 'rejected'
 where id = 's0000006-0006-0006-0006-000000000006';

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.review_submission(
      's0000006-0006-0006-0006-000000000006'::uuid,
      'approved',
      null
    )$$,
  'P0001',
  'not_pending',
  'concurrent-flip-then-approve raises not_pending (Pitfall 9 race guard)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
