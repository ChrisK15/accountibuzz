-- =============================================================================
-- 0003_phase1_review_fixes_2.sql
--
-- Second review-fix pass (deep review 2026-04-22). Addresses:
--   WR-02 — admin could move a submission between groups they administer
--           (post-image group_id not pinned in admin-review UPDATE path).
--   WR-03 — admin-review path did not constrain reviewed_by = auth.uid();
--           an admin could credit a review to another admin's uuid.
--
-- Both fixes are implemented as an admin-branch extension to the existing
-- BEFORE UPDATE trigger `submissions_owner_immutable` from 0002. Using the
-- trigger (not a second WITH CHECK predicate) is preferred because:
--   • Immutability of non-allowlisted columns can be asserted in one place.
--   • WITH CHECK cannot, by itself, pin reviewed_by to auth.uid() across the
--     WR-03 attack because it evaluates the post-image only.
--   • The owner-branch rule already lives in this function; we keep the whole
--     shape policy co-located, single source of truth.
--
-- This migration is append-only relative to 0001 + 0002 (`create or replace`
-- is idempotent against the already-applied function body).
-- =============================================================================

create or replace function public.submissions_owner_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  -- If auth context is absent (e.g. service_role/superuser via definer path),
  -- skip all checks entirely.
  if auth.uid() is null then
    return new;
  end if;

  is_admin := public.is_group_admin(old.group_id);

  if is_admin then
    -- Admin review branch. Admins legitimately change only:
    --   status, reviewed_by, reviewed_at, rejection_reason.
    -- Everything else is pinned — protects against:
    --   WR-02: moving the submission to another group the admin also admins
    --          (would also sidestep the (group_id,user_id,local_date) UNIQUE).
    --   identity/media swaps: admin cannot rewrite user_id, local_date,
    --          media_path, or media_type on a review path.
    if new.group_id   is distinct from old.group_id
       or new.user_id    is distinct from old.user_id
       or new.local_date is distinct from old.local_date
       or new.media_path is distinct from old.media_path
       or new.media_type is distinct from old.media_type then
      raise exception 'admin may not modify submission identity/group/media columns';
    end if;

    -- WR-03: when the admin transitions status into a reviewed state, the
    -- audit row must attribute the decision to the acting admin. Only
    -- allow NULL (no-op status change) or auth.uid() (self-attribution).
    -- Covers both 'approved' and 'rejected' status transitions.
    if new.status is distinct from old.status
       and new.status in ('approved', 'rejected') then
      if new.reviewed_by is null or new.reviewed_by <> auth.uid() then
        raise exception 'admin review must set reviewed_by = auth.uid()';
      end if;
    end if;

    return new;
  end if;

  -- Owner branch: pin immutable columns (unchanged from 0002).
  if auth.uid() = old.user_id then
    if new.status is distinct from old.status
       or new.user_id is distinct from old.user_id
       or new.group_id is distinct from old.group_id
       or new.local_date is distinct from old.local_date
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'owner may not modify key/status/review columns on submissions';
    end if;
  end if;

  return new;
end;
$$;

-- Re-attach the trigger (idempotent: drop-if-exists + create keeps 0002's
-- original shape intact in case this migration is the first touch on a
-- fresh clone applying 0002 then 0003 back-to-back).
drop trigger if exists submissions_owner_immutable_trigger on public.submissions;
create trigger submissions_owner_immutable_trigger
  before update on public.submissions
  for each row execute function public.submissions_owner_immutable();
