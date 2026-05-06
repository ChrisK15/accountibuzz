-- =============================================================================
-- 0007_phase3_realtime_publication.sql — Add submissions to Realtime publication
-- =============================================================================
-- Discovered during Phase 3 manual UAT (#CK-5 cross-device hard gate):
-- supabase_realtime publication was empty → postgres_changes events never
-- fired → useTodaySubmissionRealtime channels subscribed successfully but
-- received zero events → cross-device status updates (ADM-04, SUB-04) silently
-- broken.
--
-- Append-only follow-up to 0006. Idempotent against re-runs (the
-- IF NOT EXISTS gate via pg_publication_tables).
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end $$;
