-- =============================================================================
-- seed.sql — Phase 1 demoable fixtures (D-08)
-- =============================================================================
-- Runs on `supabase db reset`. Creates one known test user, one demo group,
-- and one membership so the app is demoable on a fresh clone.
--
-- Test login: test@accountibuzz.app / TestPassword123
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Test user (direct insert into auth.users; trigger creates the profile row)
-- -----------------------------------------------------------------------------
insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'test@accountibuzz.app',
  crypt('TestPassword123', gen_salt('bf')),
  now(),
  'authenticated',
  'authenticated',
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
)
on conflict (id) do nothing;

-- The handle_new_user trigger inserted a profiles row above. Update display name.
update public.profiles
   set display_name = 'Test User'
 where id = '00000000-0000-0000-0000-000000000001';

-- -----------------------------------------------------------------------------
-- 2. Demo group (admin = test user)
-- -----------------------------------------------------------------------------
insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id)
values (
  '00000000-0000-0000-0000-000000000010',
  'Demo Crew',
  'Daily push-up photo',
  'photo',
  'America/New_York',
  '00000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Membership: test user is admin of the demo group
-- -----------------------------------------------------------------------------
insert into public.group_members (group_id, user_id, role)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'admin'
)
on conflict (group_id, user_id) do nothing;
