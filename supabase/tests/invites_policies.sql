-- pgTAP test: P1 placeholder invites policies are dropped (T-02-RLS-OFF).
-- Both "invites_update_authenticated" (0001) and "invites_mark_used_as_self"
-- (0002) must be absent after 0004 is applied — redemption is RPC-only.

begin;
select plan(2);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename  = 'invites'
      and policyname = 'invites_mark_used_as_self'),
  0,
  'P1 placeholder policy invites_mark_used_as_self is dropped (T-02-RLS-OFF)'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename  = 'invites'
      and policyname = 'invites_update_authenticated'),
  0,
  'P1 placeholder policy invites_update_authenticated is dropped (T-02-RLS-OFF)'
);

select * from finish();
rollback;
