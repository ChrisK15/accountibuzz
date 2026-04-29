-- pgTAP test: submit_today RPC (SUB-01, SUB-02, SUB-05, SUB-06).
-- Covers: photo+video happy paths, server-derived local_date, and the 6 typed
-- errors: not_authenticated, not_member, invalid_media_type, wrong_media_type,
-- caption_too_long, already_submitted_today.

begin;
select plan(11);

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

-- ============================================================
-- 1. not_authenticated — no JWT set → throws
-- ============================================================
-- (auth.uid() is null in the absence of jwt claims)
select throws_ok(
  $$select public.submit_today(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-1111-1111-111111111111/c1.jpg',
      'photo',
      'cap'
    )$$,
  'P0001',
  'not_authenticated',
  'unauthenticated caller raises not_authenticated'
);

-- ============================================================
-- 2. not_member — stranger (not in photo group) calls → throws
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.submit_today(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/33333333-3333-3333-3333-333333333333/c1.jpg',
      'photo',
      'cap'
    )$$,
  'P0001',
  'not_member',
  'non-member raises not_member (no existence leak)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 3. wrong_media_type — admin of photo group calls with video → throws
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.submit_today(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-1111-1111-111111111111/c1.mp4',
      'video',
      'cap'
    )$$,
  'P0001',
  'wrong_media_type',
  'photo group + video p_media_type raises wrong_media_type'
);

-- ============================================================
-- 4. invalid_media_type — admin calls with audio → throws
-- ============================================================
select throws_ok(
  $$select public.submit_today(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-1111-1111-111111111111/c1.m4a',
      'audio',
      'cap'
    )$$,
  'P0001',
  'invalid_media_type',
  'p_media_type not in (photo,video) raises invalid_media_type'
);

-- ============================================================
-- 5. caption_too_long — 141-char caption → throws
-- ============================================================
select throws_ok(
  format(
    $$select public.submit_today(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-1111-1111-111111111111/c1.jpg',
        'photo',
        %L
      )$$,
    repeat('x', 141)
  ),
  'P0001',
  'caption_too_long',
  '141-char caption raises caption_too_long'
);

-- ============================================================
-- 6. photo group success — admin submits → uuid returned, row pending
-- ============================================================
select lives_ok(
  $$select public.submit_today(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-1111-1111-111111111111/c1.jpg',
      'photo',
      'first run of the day'
    )$$,
  'photo group admin submit succeeds'
);

-- Inspect ground truth for the just-inserted row.
select is(
  (select count(*)::int from public.submissions
    where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id  = '11111111-1111-1111-1111-111111111111'
      and status   = 'pending'),
  1,
  'photo group admin row inserted with status=pending'
);

-- ============================================================
-- 7. server-derived local_date — assert local_date = (now() AT TIME ZONE 'America/Los_Angeles')::date
-- ============================================================
select is(
  (select local_date from public.submissions
    where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id  = '11111111-1111-1111-1111-111111111111'),
  ((now() AT TIME ZONE 'America/Los_Angeles')::date),
  'local_date derived server-side via groups.timezone (PITFALLS §1)'
);

-- ============================================================
-- 8. already_submitted_today — same admin submits again with different path → throws
-- ============================================================
select throws_ok(
  $$select public.submit_today(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-1111-1111-111111111111/c2.jpg',
      'photo',
      'second attempt same day'
    )$$,
  'P0001',
  'already_submitted_today',
  'second submit same day raises already_submitted_today (UNIQUE on group+user+local_date)'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

-- ============================================================
-- 9. video group success — video admin submits → succeeds
-- ============================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.submit_today(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/22222222-2222-2222-2222-222222222222/c1.mp4',
      'video',
      'spanish lesson 1'
    )$$,
  'video group admin submit succeeds with p_media_type=video'
);

select is(
  (select media_type from public.submissions
    where group_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      and user_id  = '22222222-2222-2222-2222-222222222222'),
  'video',
  'video group row stored with media_type=video'
);

reset role;
select set_config('request.jwt.claims', NULL, true);

select * from finish();
rollback;
