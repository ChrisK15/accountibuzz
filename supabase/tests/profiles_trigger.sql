-- pgTAP test: handle_new_user creates a profiles row on auth.users insert.
-- Run via `supabase test db`.

begin;
select plan(2);

-- Insert an auth user; the AFTER INSERT trigger should create the profiles row.
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  't1@example.com',
  'authenticated',
  'authenticated',
  now(),
  now()
);

select ok(
  exists (
    select 1
    from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'
  ),
  'handle_new_user trigger created profiles row'
);

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  ''::text,
  'new profile defaults display_name to empty string'
);

select * from finish();
rollback;
