# Phase 3: Capture & Admin Review — Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** ~55 new/modified files (3 RPCs + 4 pgTAP + 11 hooks + 6 components + 4 screens + 1 capture pipeline + 2 schemas + config + tests)
**Analogs found:** 50 / 55 (camera UX, gesture-driven swipe stack, AsyncStorage queue manager, Realtime channel hook, capture-screen-with-permission-gate are first-of-kind in this repo — research patterns referenced explicitly where no analog exists)

This phase is **non-greenfield**. P1 + P2 are shipped; nearly every P3 file has a direct analog to mirror in shape (hooks → P2 hooks; screens → P2 screens; pgTAP → P2 pgTAP; primitives → P1/P2 primitives; migration → P2 0004 migration). The five new-ground patterns (camera capture, swipe-stack gestures, two-phase commit upload pipeline, AsyncStorage offline queue, Realtime channel with `useFocusEffect` cleanup) all have **canonical specifications already pinned in `03-RESEARCH.md`** that the planner copies verbatim — see "No Analog Found" section below.

**Canonical rule:** copy the shape of the closest analog; change only what the new feature requires. Where the concept is fresh-ground (camera, swipe, queue, realtime), the planner copies from `03-RESEARCH.md` Pattern 1–5 and `03-UI-SPEC.md` Component Additions §1–6, NOT from a non-existent in-repo precedent.

---

## File Classification

### Database / Migrations

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0006_phase3_capture_review.sql` | migration (3 RPCs + grants) | DDL + plpgsql | `supabase/migrations/0004_phase2_groups_invites.sql` | **exact** (same idiom — `create or replace function`, SECURITY DEFINER, `set search_path = public`, typed errors via `raise exception 'X' using errcode = 'P0001'`, revoke-from-public + grant-to-authenticated) |

### pgTAP Tests

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/tests/submit_today.sql` | pgTAP (RPC happy + 3 typed errors) | — | `supabase/tests/redeem_invite.sql` | **exact** (multi-persona seed + JWT impersonation + `throws_ok` for typed errors + ground-truth row inspection) |
| `supabase/tests/review_submission.sql` | pgTAP (admin-only + state machine + cross-group) | — | `supabase/tests/transfer_admin.sql` + `supabase/tests/leave_group.sql` | **exact** (multi-persona; `lives_ok` for success; `throws_ok` for typed errors; post-condition invariants) |
| `supabase/tests/get_pending_review_count.sql` | pgTAP (admin-only count, 0-leak for non-admin) | — | `supabase/tests/get_invite_preview.sql` | **exact** (anon-vs-auth role-impersonation pattern + simple result assertion) |
| `supabase/tests/submissions_admin_immutable.sql` | pgTAP (backfills 0003 trigger coverage, deferred-items.md flag) | — | `supabase/tests/redeem_invite.sql` (structural assertion idiom — `pg_get_functiondef` + `matches()`) + `supabase/tests/transfer_admin.sql` (multi-persona) | **exact** (UPDATE-based assertions: admin attempts to mutate identity columns → `throws_ok`; admin attempts `reviewed_by ≠ auth.uid()` → `throws_ok`) |

### Client — App Shell & Routing

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/(app)/_layout.tsx` (REWRITE Stack → Tabs) | layout | — | self (current Stack layout); `app/_layout.tsx` Provider stack pattern | role-match (no Tabs precedent in repo; expo-router `<Tabs>` is the canonical replacement per `03-RESEARCH.md §Don't Hand-Roll`) |
| `app/(app)/index.tsx` (REWRITE — was groups list, now Today) | screen (list with Realtime) | CRUD (read) + event-driven | `app/(app)/index.tsx` (existing — for the FlatList + skeleton + empty-state pattern) + `app/(app)/profile.tsx` (state-branching pattern) | **exact** for shell shape; **no analog** for Realtime channel subscription (research §Pattern 3) |
| `app/(app)/groups/index.tsx` (NEW — moved from `app/(app)/index.tsx`) | screen (list) | CRUD (read) | `app/(app)/index.tsx` (current — copy the file content verbatim, retarget `router.push('/groups/new')` etc.) | **exact** — file move + minor route adjustments |
| `app/(app)/groups/[id]/index.tsx` (MODIFIED — add admin-only PendingReviewRow above InviteCodePanel) | screen (detail, modified) | CRUD (read) | self (existing P2 screen) | **exact self-extension** (insert one new component above existing layout) |
| `app/(app)/groups/[id]/review.tsx` (NEW — admin swipe queue) | screen (gesture-driven) | CRUD (read+update) + event-driven | — (no analog; gesture-stack pattern is fresh ground) | **no analog** — composition of `react-native-gesture-handler` + Reanimated 4 per `03-RESEARCH.md §Pattern 4` + `03-UI-SPEC.md §SwipeCard` |
| `app/(app)/capture/[groupId].tsx` (NEW — camera + review state machine) | screen (modal-presented, state machine) | event-driven + file-I/O + RPC | — (no analog; first camera surface in repo) | **no analog** — composes `expo-camera` `CameraView` + state machine per `03-RESEARCH.md §Pattern 5` + `03-UI-SPEC.md §Capture state matrix` |
| Codebase audit: `router.push('/')` and `router.replace('/')` retargeting | — | — | `app/(app)/groups/[id]/index.tsx` lines 161, 201 + `app/invite/[code].tsx` line 90 | **exact** (3 known call sites; retarget per `03-UI-SPEC.md §App shell — Stack → Tabs migration`) |

### Client — New Component Primitives

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/StatusPill.tsx` | component (primitive, decorative + tappable variant) | event-driven | `src/components/SegmentedControl.tsx` (Pressable + theme tokens + selected-state styling) | role-match (state-mapped visual primitive; no exact pill primitive exists) |
| `src/components/TypeChip.tsx` | component (primitive, decorative) | — | `src/components/InviteCodeChip.tsx` (chip styling: `surfaceMuted` bg + `border` + `pill` radius + Caption-500 label) | role-match (chip layout primitive) |
| `src/components/QueueBadge.tsx` (UI-SPEC §Lovable mock mapping says inline inside GroupCard, not extracted — planner decides) | component or inline subview | event-driven | `src/components/InviteCodeChip.tsx` (icon + text + trailing pressable composition) | role-match (UI-SPEC line 1106: "built inline inside `GroupCard` ROW 5 — not extracted") |
| `src/components/GroupCard.tsx` | component (composite, status-driven) | event-driven (Realtime cross-fade via parent prop) | `app/(app)/index.tsx` `GroupRow` (existing — same Pressable + theme-token + Title/Body/Caption stack) + `src/components/InviteCodeChip.tsx` (composed primitive) | role-match (composite that branches on `status` prop, RN `Animated.timing` for cross-fade per UI-SPEC line 536) |
| `src/components/SwipeCard.tsx` | component (gesture-receiving + media display) | event-driven | — (no gesture-driven primitive exists; first consumer of `react-native-gesture-handler` + Reanimated 4) | **no analog** — built per `03-RESEARCH.md §Pattern 4` + `03-UI-SPEC.md §SwipeCard` |
| `src/components/Shutter.tsx` | component (primitive, 3 variants) | event-driven | `src/components/PrimaryButton.tsx` (Pressable + theme tokens + tap-feedback transform) | role-match (Pressable with variant-driven inner fill; no camera-control precedent) |
| `src/components/CaptureTopBar.tsx` (or local to capture screen — UI-SPEC line 1110: "planner decides; keep local if single-use") | component (overlay) | event-driven | — (no camera overlay precedent) | **no analog** — built per `03-UI-SPEC.md §6a CaptureTopBar` |
| `src/components/ReviewPanel.tsx` (or local to capture screen — UI-SPEC line 1113: "planner decides") | component (composite form) | event-driven (caption typing) | `src/components/TextInput.tsx` (input styling) + `src/components/PrimaryButton.tsx` (submit) | role-match (composite form; new chrome over scrim styling) |
| `src/components/DestructiveButton.tsx` (NEW — declared in P1 inventory, never built; first consumers are P3 discard-take + reject-reason) | component (primitive) | event-driven | `src/components/PrimaryButton.tsx` | **exact** (copy PrimaryButton; swap `colors.primary` → `colors.destructive` + label color → white per UI-SPEC line 1130) |
| `src/components/index.ts` (MODIFIED — export new primitives) | barrel | — | self | **exact** (one-line additions per new component) |

### Client — Submissions Domain (NEW Feature)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/submissions/schemas.ts` | utility (Zod) | transform | `src/features/groups/schemas.ts` | **exact** (named-export Zod schemas + inferred types + UI-SPEC error copy) |
| `src/features/submissions/useTodaySubmission.ts` | hook (TanStack Query) | CRUD (read) | `src/features/profile/useProfile.ts` + `src/features/groups/useGroup.ts` | **exact** (per-key read hook with `enabled`) |
| `src/features/submissions/usePendingReviewCount.ts` | hook (TanStack Query, RPC) | request-response | `src/features/groups/useInvitePreview.ts` (RPC-call read hook, single-value return) | **exact** (RPC call + scalar return + no-leak-for-non-admin behavior is server-side) |
| `src/features/submissions/useReviewQueue.ts` | hook (TanStack Query) | CRUD (read) | `src/features/groups/useGroupMembers.ts` (list with optional join) | **exact** (list of submissions + joined profile data via PostgREST embed) |
| `src/features/submissions/useSubmitToday.ts` | hook (mutation, orchestrates two-phase commit) | CRUD (create) + file-I/O | `src/features/profile/useAvatarUpload.ts` (top-level pickAndUpload + useMutation wrapper) + `src/features/groups/useCreateGroup.ts` (RPC-mutation shape) | role-match (two-phase upload then RPC; queue fallback on network error per `03-RESEARCH.md §Pattern 1`) |
| `src/features/submissions/useReviewSubmission.ts` | hook (mutation, RPC) | CRUD (update) | `src/features/groups/useTransferAdmin.ts` (RPC mutation that returns void + invalidates by groupId) | **exact** (variant: `'approved'` or `'rejected'` payload; invalidate `['reviewQueue', groupId]` + `['submission', groupId, 'today']` for the submitter via realtime, NOT direct invalidation) |
| `src/features/submissions/submitMedia.ts` | utility (pure async fn — pipeline: compress → upload → RPC) | file-I/O + request-response | `src/features/profile/useAvatarUpload.ts` `pickAndUploadAvatar()` top-level fn (lines 16–54) | role-match (resize+compress, upload to bucket, then DB write — but RPC instead of `.from().update()`, and `upsert: false` per D-06 idempotency contract) |
| `src/features/submissions/uploadQueueManager.ts` | utility (singleton — AsyncStorage CRUD + flush triggers) | file-I/O + event-driven | — (no AsyncStorage queue precedent; closest is the in-test storage shim in `jest.setup.ts:21-46`) | **no analog** — built per `03-RESEARCH.md §Pattern 2` (single-key JSON-array atomic primitive + Zod-validated entries + AppState/NetInfo/manual triggers) |
| `src/features/submissions/useUploadQueue.ts` | hook (reads queue) | CRUD (read) | `src/features/groups/useGroupsList.ts` (TanStack Query + transform) | role-match (returns a `Map<groupId, queueEntry>` for GroupCard prop wiring) |
| `src/features/submissions/useTodaySubmissionRealtime.ts` (or `src/features/realtime/useTodaySubmissionRealtime.ts` — RESEARCH line 374 lists both) | hook (side-effect — Realtime subscription) | event-driven (WSS) | `src/features/groups/usePendingInviteReplay.ts` (side-effect hook with `useEffect` + cleanup) | role-match for hook shape; **no analog** for Realtime channel itself (built per `03-RESEARCH.md §Pattern 3` — single-column `user_id` filter + client-side narrowing + `useFocusEffect` cleanup) |
| `src/features/submissions/time.ts` (cutoff helpers — IANA-tz aware) | utility | transform | `src/features/groups/timezones.ts` (Intl-based timezone utilities + permanent fallback) | role-match (timezone-aware date math; uses `Intl.DateTimeFormat` for IANA computation, no `luxon` dep — keep boring per RESEARCH §Don't Hand-Roll) |

### Client — Generated Types & Config

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/types/database.ts` (REGENERATE) | generated types | — | self (re-run `pnpm types:gen` after 0006) | **exact** (regen pattern shipped in P2) |
| `app.config.ts` (MODIFIED — add `expo-camera` plugin + camera/mic permissions) | config | — | self (current `plugins` array on line 32) | **exact** self-extension (one block addition per `03-RESEARCH.md §Standard Stack §app.config.ts plugin block`) |
| `package.json` (MODIFIED — add `@react-native-community/netinfo`) | config | — | self | **exact** (`npx expo install @react-native-community/netinfo` per RESEARCH line 188) |
| `jest.setup.ts` (MODIFIED — add expo-camera, expo-video, NetInfo, react-native-gesture-handler, react-native-reanimated mocks) | test config | — | self (existing mocks lines 5–85) | **exact** (additions per `03-RESEARCH.md §What Should NOT Be Mocked` + lines 1556–1576) |

### Client — Tests (Jest)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/submissions/schemas.test.ts` | Jest unit | — | `tests/profile-schemas.test.ts` + `tests/groups/schemas.test.ts` | **exact** |
| `tests/submissions/submitMedia.test.ts` | Jest unit (supabase mock) | — | `tests/avatar-upload.test.ts` (lines 1–66) | **exact** (`jest.spyOn(supabase.storage, 'from')` + `jest.spyOn(supabase, 'rpc')` mock patterns) |
| `tests/submissions/uploadQueueManager.test.ts` | Jest integration (AsyncStorage queue lifecycle) | — | `tests/auth-recovery-cold-start.test.tsx` (storage-backed lifecycle assertions) | role-match |
| `tests/submissions/useTodaySubmission.test.ts` | Jest hook | — | `tests/groups/useGroupsList.test.tsx` | **exact** |
| `tests/submissions/useTodaySubmissionRealtime.test.ts` | Jest integration (mock `supabase.channel(...).on(...).subscribe()`) | — | — (no Realtime test in repo) | **no analog** — pattern per `03-RESEARCH.md §What Should NOT Be Mocked` "Realtime channels: mock the chain at the per-test level so we can drive synthetic payloads into the handler" |
| `tests/submissions/useReviewQueue.test.ts` | Jest hook | — | `tests/groups/useGroupsList.test.tsx` | **exact** |
| `tests/submissions/useSubmitToday.test.ts` | Jest hook (happy + typed errors) | — | `tests/avatar-upload.test.ts` | **exact** |
| `tests/submissions/useReviewSubmission.test.ts` | Jest hook (mutation) | — | `tests/avatar-upload.test.ts` (mutation pattern) | role-match |
| `tests/components/StatusPill.test.tsx` | Jest component (state matrix) | — | `tests/avatar-initials.test.ts` (pure-component render test) | role-match |
| `tests/components/GroupCard.test.tsx` | Jest component (composite + queue badge) | — | `tests/groups/segmentedControl.test.tsx` + `tests/groups/inviteCodeChip.test.tsx` | role-match |
| `tests/components/SwipeCard.test.tsx` | Jest component (gesture mock per Reanimated test guide) | — | — (no gesture test in repo) | **no analog** — pattern per `03-RESEARCH.md §What Should NOT Be Mocked` "use `react-native-reanimated/mock`; gesture handlers can be invoked directly" |
| `tests/app/capture-permission-denied.test.tsx` | Jest component (permission flow) | — | `tests/groups/inviteLanding.test.tsx` (branching screen by state) | role-match |
| `tests/app/capture-discard-modal.test.tsx` | Jest component | — | `tests/groups/modal.test.tsx` (Modal primitive interaction) | **exact** |
| `tests/app/tabs-migration.test.ts` | Jest unit (audit) | — | — | **no analog** — programmatic check that no `router.push('/')` references remain in unintended places per `03-UI-SPEC.md §App shell — Stack → Tabs migration` |

---

## Pattern Assignments

### `supabase/migrations/0006_phase3_capture_review.sql` — Migration

**Analog:** `supabase/migrations/0004_phase2_groups_invites.sql` — copy the migration idiom verbatim. Same header style, same `create or replace function`, same SECURITY DEFINER + `set search_path = public`, same `raise exception 'X' using errcode = 'P0001'` typed errors, same `revoke from public + grant to authenticated`.

**Header style** (0004 lines 1–53): a multi-line `-- =============` banner followed by an RPCs-shipped table, internal helpers, dropped policies, CHECK constraints added, and pitfalls actively mitigated. Mirror this structure for 0006 — list the 3 RPCs + grants, document P3-specific pitfalls (Realtime single-column filter, two-phase commit orphan tolerance, terminal-rejection state machine).

**Typed-error idiom** (0004 line 131):

```sql
if caller is null then
  raise exception 'not_authenticated' using errcode = 'P0001';
end if;
```

**`is_group_admin()` helper is already shipped in 0001** (lines 220–227):

```sql
create or replace function public.is_group_admin(g uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.groups
    where id = g
      and admin_user_id = auth.uid()
  );
$$;
```

P3 RPCs reuse this — no new helper needed.

**`is_group_member()` helper is also already shipped in 0001** (above `is_group_admin`):

```sql
create or replace function public.is_group_member(g uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = g
      and user_id = auth.uid()
  );
$$;
```

`submit_today` calls this for membership validation.

**Function signature pattern** (0004 lines 114–122 for `create_group`):

```sql
create or replace function public.create_group(
  p_name text,
  p_goal text,
  p_submission_type text,
  p_timezone text
) returns table (group_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  ...
begin
  ...
end;
$$;

revoke execute on function public.create_group(text, text, text, text) from public;
grant  execute on function public.create_group(text, text, text, text) to authenticated;
```

**P3 RPC signatures (per CONTEXT D-17 + RESEARCH lines 304–321):**

```sql
-- 1. submit_today: derives local_date server-side, validates membership +
--    media_type, inserts row. Typed errors: not_authenticated, not_member,
--    wrong_media_type, already_submitted_today.
create or replace function public.submit_today(
  p_group_id uuid,
  p_media_path text,
  p_media_type text,
  p_caption text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  caller uuid := auth.uid();
  group_tz text;
  group_submission_type text;
  computed_local_date date;
  new_id uuid;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Validate membership + read group's submission_type + tz in one shot.
  select g.submission_type, g.timezone
    into group_submission_type, group_tz
    from public.groups g
    join public.group_members gm
      on gm.group_id = g.id and gm.user_id = caller
    where g.id = p_group_id;
  if not found then
    raise exception 'not_member' using errcode = 'P0001';
  end if;

  if p_media_type is null or p_media_type not in ('photo','video') then
    raise exception 'invalid_media_type' using errcode = 'P0001';
  end if;
  if p_media_type <> group_submission_type then
    raise exception 'wrong_media_type' using errcode = 'P0001';
  end if;
  if p_caption is not null and char_length(p_caption) > 140 then
    raise exception 'caption_too_long' using errcode = 'P0001';
  end if;

  -- PITFALLS §1: server-derived local_date, never client-computed.
  computed_local_date := (now() AT TIME ZONE group_tz)::date;

  begin
    insert into public.submissions
      (group_id, user_id, local_date, status, caption, media_path, media_type)
    values
      (p_group_id, caller, computed_local_date, 'pending',
       nullif(p_caption, ''), p_media_path, p_media_type)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'already_submitted_today' using errcode = 'P0001';
  end;

  return new_id;
end;
$$;

-- 2. review_submission: admin-only state-machine UPDATE.
--    Typed errors: not_authenticated, not_admin, not_pending, invalid_decision.
--    The 0003 admin-immutable trigger re-validates reviewed_by = auth.uid().
create or replace function public.review_submission(
  p_submission_id uuid,
  p_decision text,
  p_rejection_reason text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  caller uuid := auth.uid();
  sub_group uuid;
  sub_status text;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_decision is null or p_decision not in ('approved','rejected') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  if p_rejection_reason is not null and char_length(p_rejection_reason) > 140 then
    raise exception 'reason_too_long' using errcode = 'P0001';
  end if;

  -- Lookup submission's group_id + current status (NOT what client claims).
  -- Anti-pattern (Threat 7): trusting client-provided group_id.
  select group_id, status into sub_group, sub_status
    from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found' using errcode = 'P0001';
  end if;

  if not public.is_group_admin(sub_group) then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  if sub_status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  update public.submissions
     set status           = p_decision,
         reviewed_by      = caller,             -- 0003 trigger re-validates this
         reviewed_at      = now(),
         rejection_reason = case when p_decision = 'rejected'
                                 then nullif(p_rejection_reason, '')
                                 else null end
   where id = p_submission_id;
end;
$$;

-- 3. get_pending_review_count: returns 0 for non-admins (no leak per
--    RESEARCH §Architectural Responsibility Map).
create or replace function public.get_pending_review_count(p_group_id uuid)
returns int
language plpgsql security definer stable set search_path = public
as $$
begin
  if not public.is_group_admin(p_group_id) then
    return 0;
  end if;
  return (
    select count(*)::int from public.submissions
     where group_id = p_group_id and status = 'pending'
  );
end;
$$;
```

**Grant pattern** (0004 line 180):

```sql
revoke execute on function public.submit_today(uuid, text, text, text) from public;
grant  execute on function public.submit_today(uuid, text, text, text) to authenticated;
-- (repeat for review_submission and get_pending_review_count)
```

**Schema invariants (Pitfall 1 — read 0001 directly, do NOT trust assumptions):**
- `public.submissions` columns (0001:232–246): `id`, `group_id`, `user_id`, `local_date`, `status` (CHECK in `('pending','approved','rejected')`), `caption`, `media_path`, `media_type` (CHECK in `('photo','video')`), `reviewed_by`, `reviewed_at`, `rejection_reason`, `created_at`. UNIQUE `(group_id, user_id, local_date)`.
- `public.groups` columns: `submission_type` (`'photo'|'video'`), `timezone` (IANA string), `admin_user_id`. (Not `goal_description`, not `admin_id`.)
- `submissions_insert_self_in_group` policy (0001:260–267) is preserved per CONTEXT D-18 (defense-in-depth) — but client never calls it directly; RPC owns the write path.
- `submissions_update_admin_or_owner_pending` policy (0001:269–276) gates the UPDATE that `review_submission` issues.
- `submissions_owner_immutable_trigger` (0003) fires on EVERY UPDATE — `review_submission` must produce UPDATEs that satisfy the admin branch (lines 40–67 of 0003): only mutate `status / reviewed_by / reviewed_at / rejection_reason`, and `reviewed_by = auth.uid()` when transitioning to a reviewed status.

**No new tables in P3** → CI's `rls-check.yml` continues to pass by construction (P2 PATTERNS Shared Pattern 10).

---

### `supabase/tests/submit_today.sql` — pgTAP

**Analog:** `supabase/tests/redeem_invite.sql` (multi-persona seed + JWT impersonation + `throws_ok` for typed errors + ground-truth row inspection).

**Boilerplate header** (redeem_invite.sql lines 1–7):

```sql
-- pgTAP test: submit_today RPC (SUB-01..06 happy path + typed errors).
-- Covers: success (photo + video), not_member, wrong_media_type,
-- already_submitted_today, caption_too_long, server-derived local_date.

begin;
select plan(N);
```

**Multi-persona auth seed** (redeem_invite.sql lines 9–36, simplified for P3):

```sql
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'member@x.com', 'authenticated', 'authenticated', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'stranger@x.com', 'authenticated', 'authenticated', now(), now());

-- Photo group + video group fixtures
insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Photo G', 'goal', 'photo', 'UTC',
   '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Video G', 'goal', 'video', 'UTC',
   '11111111-1111-1111-1111-111111111111');

insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'admin');
```

**JWT impersonation** (redeem_invite.sql lines 79–93):

```sql
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
```

**`throws_ok` for typed errors** (redeem_invite.sql lines 122–127):

```sql
select throws_ok(
  $$select public.submit_today(
      '11111111-1111-1111-1111-111111111111'::uuid,  -- group caller is NOT a member of
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/22222222.../uuid.jpg',
      'photo',
      null
    )$$,
  'P0001',
  'not_member',
  'non-member submission rejected with not_member'
);
```

**`lives_ok` for success** (leave_group.sql lines 66–69):

```sql
select lives_ok(
  $$select public.submit_today(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'aaaaaaaa-.../11111111-.../client-uuid.jpg',
      'photo',
      'caption text'
    )$$,
  'photo group member submits successfully'
);
```

**Ground-truth assertions** (transfer_admin.sql lines 76–82):

```sql
select is(
  (select count(*)::int from public.submissions
    where group_id = 'aaaaaaaa-...' and user_id = '11111111-...'),
  1,
  'exactly one submissions row exists for the (group, user, today) tuple'
);

select is(
  (select status from public.submissions
    where group_id = 'aaaaaaaa-...' and user_id = '11111111-...'),
  'pending',
  'newly-inserted submission has status=pending'
);
```

**Cleanup** (redeem_invite.sql lines 219–223):

```sql
reset role;
select set_config('request.jwt.claims', NULL, true);
select * from finish();
rollback;
```

**P3 test cases (per RESEARCH lines 1505–1517 + Threat Model lines 1629–1684):**
- SUB-01/02 success: photo and video groups each accept matching media_type
- SUB-05 already_submitted_today: insert two rows for same `(group_id, user_id, local_date)` → second raises typed error
- SUB-06 caption_too_long: 141-char caption raises typed error
- not_member: caller in no group_members row for the target group
- wrong_media_type: photo group receives `'video'` payload → typed error
- not_authenticated: clear JWT, call → raises typed error
- (Threat 2 acceptable orphan): pgTAP confirms forged `media_path` doesn't crash insert (D-09 acceptance)

---

### `supabase/tests/review_submission.sql` — pgTAP

**Analog:** `supabase/tests/transfer_admin.sql` (admin-only RPC + post-condition invariants) + `supabase/tests/leave_group.sql` (multi-persona).

**P3 test cases (per RESEARCH lines 1511–1518):**
- ADM-02 success approve: status → 'approved', reviewed_by = caller, reviewed_at non-null
- ADM-03 success reject with reason: rejection_reason set; success reject without reason: rejection_reason NULL
- not_admin: non-admin caller (member of group, not admin) → typed error
- PLAT-03 cross-group: admin of group A calls `review_submission(submission_id_in_group_B)` → `not_admin` (RPC fetches `group_id` from DB, NOT from client — Threat 7 mitigation)
- not_pending: already-reviewed submission → typed error
- invalid_decision: `'maybe'` → typed error
- not_authenticated: clear JWT → typed error
- 0003 trigger interplay: after a successful approve, attempt a direct UPDATE that swaps `reviewed_by` → trigger raises (defends WR-03)

---

### `supabase/tests/get_pending_review_count.sql` — pgTAP

**Analog:** `supabase/tests/get_invite_preview.sql` (anon-vs-auth role pattern).

**P3 test cases (per RESEARCH line 1510 + ADM-01):**
- Admin caller: returns the actual count
- Non-admin member of same group: returns `0` (no-leak; the RPC gates by `is_group_admin`)
- Stranger (not in group): returns `0`
- not_authenticated: returns `0` (or raises — planner's call; either is acceptable per the "no leak" contract)

---

### `supabase/tests/submissions_admin_immutable.sql` — pgTAP

**Analog:** `supabase/tests/redeem_invite.sql` lines 70–74 (structural assertion via `pg_get_functiondef`) + `supabase/tests/transfer_admin.sql` (multi-persona for admin-vs-non-admin).

**Why this test exists:** backfills the missing pgTAP for migration `0003_phase1_review_fixes_2.sql` flagged in `01-foundation/deferred-items.md`. P3 is the natural place — it's the first phase where review_submission produces UPDATEs that the trigger guards.

**Trigger contract to assert (0003 lines 23–86):**
- Owner branch (caller = `submissions.user_id` AND not admin): UPDATE that mutates `status / user_id / group_id / local_date / reviewed_by / reviewed_at / rejection_reason` raises `'owner may not modify ...'`
- Admin branch (caller = `is_group_admin(old.group_id)`): UPDATE that mutates `group_id / user_id / local_date / media_path / media_type` raises `'admin may not modify submission identity/group/media columns'`
- Admin branch transitioning `status` to `'approved'` or `'rejected'`: `reviewed_by` MUST equal `auth.uid()` else raises `'admin review must set reviewed_by = auth.uid()'`

**Pattern (raw UPDATEs to bypass `review_submission` and exercise the trigger directly):**

```sql
-- After admin insert + as admin:
select throws_ok(
  $$update public.submissions
       set group_id = 'OTHER_GROUP_THE_ADMIN_ALSO_ADMINS'::uuid
     where id = 'submission-id'::uuid$$,
  null, null,
  'admin may not modify submission identity/group/media columns'
);

select throws_ok(
  $$update public.submissions
       set status = 'approved', reviewed_by = 'OTHER_ADMIN_USER'::uuid, reviewed_at = now()
     where id = 'submission-id'::uuid$$,
  null, null,
  'admin review must set reviewed_by = auth.uid()'
);
```

(Use `throws_ok(query, NULL, NULL, expected_message)` form — pgTAP allows pattern-matching on the exception MESSAGE without errcode pinning.)

---

### `app/(app)/_layout.tsx` — Stack → Tabs (REWRITE)

**No analog in repo** for `<Tabs>`. The current file is the simplest possible Stack:

```tsx
// CURRENT app/(app)/_layout.tsx (8 lines):
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="groups/new" options={{ headerShown: false }} />
      <Stack.Screen name="groups/join" options={{ headerShown: false }} />
      <Stack.Screen name="groups/[id]/index" options={{ headerShown: false }} />
    </Stack>
  );
}
```

**P3 replacement (per UI-SPEC lines 703–732):** an expo-router `<Tabs>` component as the top-level layout, with the `groups/...` and `capture/...` routes nested as Stack children of the Tabs (since they're not themselves tabs). Concretely, `app/(app)/_layout.tsx` becomes a Tabs layout with three primary tab screens (index, groups, profile) plus configured non-tab routes for `groups/new`, `groups/join`, `groups/[id]/index`, `groups/[id]/review`, and the modal-presented `capture/[groupId]`.

**Tab visuals invariant** (UI-SPEC lines 721–728):
- Background `colors.surface`, 1px `colors.border` top hairline
- Active tab: icon + label `colors.text`/`colors.textStrong`, **2pt yellow `colors.primary` underline at top edge of cell, ~32pt wide**
- Inactive tab: icon + label `colors.textMuted`
- Press feedback: opacity → 0.7, no scale

**Non-tab routes hidden from tab bar** via `<Tabs.Screen name="groups/new" options={{ href: null }} />` (canonical expo-router pattern for stack screens that share a layout but shouldn't appear in the tab bar).

**Modal capture screen:** add `<Tabs.Screen name="capture/[groupId]" options={{ href: null, presentation: 'fullScreenModal' }} />` (UI-SPEC line 786).

---

### `app/(app)/index.tsx` — Today screen (REWRITE)

**Analog (shell shape):** existing `app/(app)/index.tsx` (the now-being-moved groups list) — copy the FlatList + skeleton + empty-state shape verbatim. **Analog (state branching):** `app/(app)/profile.tsx` (loading → empty → populated branching).

**Imports pattern** (current index.tsx lines 1–37 — all of it transfers; only data hooks change):

```tsx
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useGroupsList } from '../../src/features/groups/useGroupsList';
import { useTodaySubmission } from '../../src/features/submissions/useTodaySubmission';   // NEW
import { useUploadQueue } from '../../src/features/submissions/useUploadQueue';            // NEW
import { useTodaySubmissionRealtime } from '../../src/features/submissions/useTodaySubmissionRealtime'; // NEW
import { useSession } from '../../src/features/auth/AuthProvider';
import { useTheme } from '../../src/theme/useTheme';
import {
  ScreenContainer, ScreenHeader, PrimaryButton, GhostButton,
} from '../../src/components';
import { GroupCard } from '../../src/components/GroupCard';                                // NEW
```

**Loading-state skeleton pattern** (current index.tsx lines 382–399 — `GroupsListSkeleton`):

```tsx
function GroupsListSkeleton() {
  const t = useTheme();
  return (
    <View style={{ paddingTop: t.spacing.lg }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{
          height: 88,
          borderRadius: t.radii.md,
          backgroundColor: t.colors.surfaceMuted,
          marginBottom: t.spacing.md,
        }} />
      ))}
    </View>
  );
}
```

P3 Today screen mirrors this — 3 `GroupCard`-shaped skeleton blocks per UI-SPEC line 775.

**Empty-state pattern** (current index.tsx lines 96–134) — copy almost verbatim, adjust copy strings per UI-SPEC §"Screen-level copy" line 290 ("No groups yet" + "Create one with friends or join one with a code.").

**Populated FlatList pattern** (current index.tsx lines 171–188) — copy almost verbatim, swap `GroupRow` for `GroupCard`:

```tsx
<FlatList
  data={groups}
  keyExtractor={(g) => g.id}
  renderItem={({ item }) => (
    <GroupCard
      groupId={item.id}
      name={item.name}
      goal={item.goal}
      kind={item.submission_type}
      status={todaySubmissionFor(item.id)?.status ?? 'none'}
      cutoffTime={...}     // computed via src/features/submissions/time.ts
      minutesLeft={...}
      submittedAgo={...}
      rejectionReason={...}
      queuedUploadSize={uploadQueueByGroup.get(item.id)?.sizeLabel}
      onSubmitPress={() => router.push(`/capture/${item.id}`)}
      onRejectedPillPress={() => /* open reject-reason modal */}
      onQueueBadgeMorePress={() => /* open queue bottom sheet */}
    />
  )}
  contentContainerStyle={{ paddingBottom: t.spacing['2xl'] }}
  refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={t.colors.textMuted} />}
/>
```

**Realtime subscription invariant (Pitfall 11):** call `useTodaySubmissionRealtime(user?.id)` once at the screen level. The hook handles `useFocusEffect` subscribe/unsubscribe — no per-card subscription. Single channel filtered server-side on `user_id=eq.{auth.uid()}` per RESEARCH §Pattern 3.

---

### `app/(app)/groups/index.tsx` — Groups list (NEW, moved)

**Action:** copy the entire current `app/(app)/index.tsx` to this new path. Adjust:
- Update relative-path imports — `../../src/...` becomes `../../../src/...` (one extra `..` for the new nesting level)
- Audit `router.push('/groups/new')` etc. — paths from `app/(app)/groups/index.tsx` are still expressed against the route root (`'/groups/new'`), so no changes there
- Update the kebab `'Profile'` action to `router.push('/profile')` — this path is unchanged (Profile is a tab, accessible via the absolute path)

**No content rewrite.** This is a literal file move + path adjustment.

---

### `app/(app)/groups/[id]/index.tsx` — Group detail (MODIFIED — add PendingReviewRow)

**Analog:** self (existing P2 file, lines 1–700+). The change is a narrow insertion.

**Insertion point** (UI-SPEC line 840): Insert the new `PendingReviewRow` **after** the post-create banner (if rendered) and **before** the InviteCodePanel.

**New inline component (built inline per UI-SPEC line 1109 "not extracted — single-use"):**

```tsx
import { usePendingReviewCount } from '../../../../src/features/submissions/usePendingReviewCount';

// Inside the component body, after isAdmin computation:
const { data: pendingCount } = usePendingReviewCount(id);
const showPendingRow = isAdmin && (pendingCount ?? 0) > 0;
const countLabel = (pendingCount ?? 0) > 9 ? '9+' : String(pendingCount ?? 0);

// In the render tree (after post-create banner, before invite panel):
{showPendingRow && (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Pending review, ${countLabel} ${pendingCount === 1 ? 'submission' : 'submissions'}`}
    accessibilityHint="Opens the review queue for this group"
    onPress={() => router.push(`/groups/${id}/review`)}
    style={({ pressed }) => ({
      backgroundColor: pressed ? t.colors.surfaceMuted : t.colors.surface,
      borderRadius: t.radii.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: t.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      // e1 shadow per UI-SPEC line 845
      ...elevation1Shadow(t),
    })}
  >
    <View style={{ flex: 1 }}>
      <Text style={[t.fonts.heading2, { color: t.colors.textStrong }]}>
        Pending review ({countLabel})
      </Text>
      <Text style={[t.fonts.body, { color: t.colors.textMuted, marginTop: t.spacing.xs }]}>
        Tap to approve or reject submissions
      </Text>
    </View>
    <Feather name="chevron-right" size={22} color={t.colors.textMuted} />
  </Pressable>
)}
```

**No other changes** to this file. Existing layout (header, metadata, members, destructive zone) stays untouched per UI-SPEC line 860.

**Router.replace audit (UI-SPEC §App shell migration):** lines 161 and 201 of this file currently call `router.replace('/')`. Per UI-SPEC line 717, both should be retargeted to `'/groups'` (post-leave + post-delete should land on the groups tab, not the Today tab).

---

### `app/(app)/groups/[id]/review.tsx` — Admin swipe queue (NEW)

**No exact analog.** Build per:
- `03-RESEARCH.md §Pattern 4` (Reanimated 4 swipe stack) — full code skeleton lines 548–602
- `03-UI-SPEC.md §SwipeCard` (component anatomy) + §"Admin review queue" (screen layout lines 862–934)
- `03-UI-SPEC.md §Admin review queue state matrix` (line 1014) — every state to render

**Closest in-repo pattern for the screen shell** (loading + empty branches): `app/(app)/profile.tsx` mode-branching shape.

**Closest in-repo pattern for the dynamic-route param**: `app/(app)/groups/[id]/index.tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';
const { id } = useLocalSearchParams<{ id: string }>();
```

**Closest in-repo pattern for media display** (signed URL → `<Image>`): the avatar URL pattern in `app/(app)/index.tsx` lines 51–57 and `app/(app)/groups/[id]/index.tsx` lines 56–63. P3 requires `createSignedUrl(path, 60)` (private bucket) — wrap in TanStack Query with `staleTime: 50_000` per RESEARCH "Don't Hand-Roll".

**Reject-reason panel:** built inline per UI-SPEC §"Reject-reason panel" (lines 902–917). Composes existing `TextInput`, new inline `WarningCallout` View, existing `GhostButton` ("Never mind"), new `DestructiveButton` ("Reject").

**First-review tooltip:** Reuse the P2 `Modal` primitive (UI-SPEC line 1122). Pass `cancelLabel="Got it"` (the only exit) and `secondaryAction={undefined}` so the primary `Got it` button IS the dismiss. Gate via SecureStore key `tooltip:admin_review:{userId}` per UI-SPEC line 900.

**Fallback Approve / Reject buttons (a11y-critical per UI-SPEC line 923):** always rendered visible below the swipe stack — swipe-only is not accessible. Buttons fire the same RPC as the gesture path.

**Reduced-motion handling (UI-SPEC line 1070):** check `AccessibilityInfo.isReduceMotionEnabled()` once at mount; flatten card stack to a single card, swap rubber-band for instant transitions.

---

### `app/(app)/capture/[groupId].tsx` — Capture flow (NEW)

**No exact analog.** Build per:
- `03-RESEARCH.md §Pattern 5` (state machine — lines 614–636)
- `03-UI-SPEC.md §Capture state matrix` (line 995) — every state to render
- `03-UI-SPEC.md §"Capture flow"` (lines 784–834) — screen-level contract

**Imports skeleton** (per RESEARCH §Standard Stack lines 161–172):

```tsx
import { useState, useRef, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { useSubmitToday } from '../../../src/features/submissions/useSubmitToday';
import { useGroup } from '../../../src/features/groups/useGroup';
import { Modal, PrimaryButton, GhostButton } from '../../../src/components';
import { Shutter } from '../../../src/components/Shutter';
import { CaptureTopBar } from '../../../src/components/CaptureTopBar';
import { ReviewPanel } from '../../../src/components/ReviewPanel';
```

**State machine** (RESEARCH lines 614–636) — copy this state diagram verbatim:

```
mount → [permission gate]
  ├─ camera denied → permission-denied screen
  └─ camera granted → (if video) [microphone permission gate] → [capture state]
                                                                    ↓ (uri)
                                                                  [review state]
                                                                    ├─ Retake → [capture state]
                                                                    ├─ Submit → submitMedia() → router.dismiss()
                                                                    └─ × close
                                                                         ├─ no take → router.dismiss()
                                                                         └─ take captured → Discard-take Modal
```

**Single-screen permission gate** (per RESEARCH line 609 — "one screen avoids double-permission-grant and keeps the back-stack shallow"):

```tsx
const [camPerm, requestCamPerm] = useCameraPermissions();
const [micPerm, requestMicPerm] = useMicrophonePermissions();   // video groups only
useEffect(() => { if (camPerm && !camPerm.granted) requestCamPerm(); }, [camPerm]);
```

**Permission-denied branch:** full-bleed screen per UI-SPEC line 1000 — Heading-1 + Body + `Open Settings` PrimaryButton (`onPress={Linking.openSettings}`) + `Not now` GhostButton (`onPress={router.dismiss}`).

**Camera capture (RESEARCH §Code Examples §1):**

```tsx
const cameraRef = useRef<CameraView>(null);
const onShutter = async () => {
  const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
  if (photo?.uri) setMediaUri(photo.uri);   // → review state
};
```

**Video recording (RESEARCH §Code Examples §2):**

```tsx
const onShutter = async () => {
  if (recording) { cameraRef.current?.stopRecording(); return; }
  setRecording(true);
  const video = await cameraRef.current?.recordAsync({ maxDuration: 10, videoQuality: '720p' });
  setRecording(false);
  if (video?.uri) setMediaUri(video.uri);   // → review state
};
```

**Video playback in review state** (per RESEARCH §Don't Hand-Roll line 662):

```tsx
const player = useVideoPlayer(mediaUri, (p) => {
  p.muted = true;
  p.loop = true;
  p.play();
});
// <VideoView player={player} nativeControls={false} contentFit="cover" />
```

**Submit handler (uses the new `useSubmitToday` mutation):**

```tsx
const submitMutation = useSubmitToday();
const onSubmit = async () => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await submitMutation.mutateAsync({
      groupId, mediaLocalUri: mediaUri!, mediaType: group.submission_type, caption,
    });
    router.dismiss();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    // Map typed errors to UI-SPEC "Error state copy" table:
    // 'wrong_media_type' → "This group is for {photo|video} only..."
    // 'already_submitted_today' → "You already submitted today..."
    // 'not_member' → "You're not in this group anymore..."
    // network-failure path → mutation already pushed to queue → dismiss anyway,
    //   QueueBadge takes over on Today (UI-SPEC line 826)
    setErrorText(...);
  }
};
```

**Discard-take modal (UI-SPEC line 830):** reuse the P2 `Modal` primitive with `primaryAction.variant="destructive"` and `cancelLabel="Keep recording"` (NEVER `'Cancel'` — dev-warning enforces this per `src/components/Modal.tsx:51-57`).

**Stack.Screen options** (UI-SPEC line 786):

```tsx
// In _layout.tsx Tabs config:
<Tabs.Screen name="capture/[groupId]" options={{
  href: null,                              // hidden from tab bar
  presentation: 'fullScreenModal',         // iOS modal feel
  animation: 'slide_from_bottom',          // Android equivalent
  gestureEnabled: false,                   // UI-SPEC line 951: swipe-to-dismiss DISABLED
}} />
```

---

### `src/features/submissions/schemas.ts` — Zod schemas

**Analog:** `src/features/groups/schemas.ts` (lines 6–32). Copy the named-export Zod + inferred-types pattern.

**P3 schemas (per UI-SPEC §Submission flow + CONTEXT D-04 + D-11):**

```typescript
import { z } from 'zod';

// Caption: optional, single-line, ≤ 140 chars (D-04). Mirrors P2 goal-description pattern.
export const captionSchema = z
  .string()
  .max(140, 'Keep it short — 140 characters max.');

// Reject reason: optional, single-line, ≤ 140 chars (D-11).
export const rejectReasonSchema = z
  .string()
  .max(140, 'Keep it short — 140 characters max.');

// Submit payload (used by useSubmitToday client validation).
export const submitTodaySchema = z.object({
  groupId: z.string().uuid(),
  mediaLocalUri: z.string().min(1),
  mediaType: z.enum(['photo', 'video']),
  caption: captionSchema.nullable().or(z.literal('').transform(() => null)),
});
export type SubmitTodayInput = z.infer<typeof submitTodaySchema>;

// Review payload.
export const reviewSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  rejectionReason: rejectReasonSchema.nullable().or(z.literal('').transform(() => null)),
});
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;
```

Error messages must match the UI-SPEC §"Error state copy" table verbatim.

---

### `src/features/submissions/useTodaySubmission.ts` — TanStack read hook

**Analog:** `src/features/profile/useProfile.ts` (lines 1–26) + `src/features/groups/useGroup.ts` (per-id read hook).

**Imports** (useGroup.ts lines 1–4):

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
```

**Pattern (copy useGroup.ts shape — line 17):**

```typescript
export interface TodaySubmissionRow {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  caption: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  local_date: string;
  media_path: string;
  media_type: 'photo' | 'video';
}

export function useTodaySubmission(groupId: string | undefined, todayLocalDate: string | undefined) {
  return useQuery({
    queryKey: ['submission', groupId, 'today'],
    enabled: !!groupId && !!todayLocalDate,
    queryFn: async (): Promise<TodaySubmissionRow | null> => {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, status, caption, rejection_reason, reviewed_at, created_at, local_date, media_path, media_type')
        .eq('group_id', groupId!)
        .eq('local_date', todayLocalDate!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as TodaySubmissionRow) ?? null;
    },
  });
}
```

**Note:** uses `.maybeSingle()` not `.single()` — null is the expected "not yet submitted" state, NOT an error.

---

### `src/features/submissions/usePendingReviewCount.ts` — TanStack RPC read hook

**Analog:** `src/features/groups/useInvitePreview.ts` (RPC-call read hook with single-value return).

**Pattern (copy useInvitePreview.ts shape — lines 14–37):**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function usePendingReviewCount(groupId: string | undefined) {
  return useQuery({
    queryKey: ['pendingReviewCount', groupId],
    enabled: !!groupId,
    staleTime: 15_000,    // refresh on every detail-screen mount
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_pending_review_count', {
        p_group_id: groupId!,
      });
      if (error) throw new Error(error.message);
      return (data as number | null) ?? 0;
    },
  });
}
```

The RPC returns 0 for non-admins (CONTEXT D-17 + RESEARCH line 321 — "no leak"); the hook just trusts the server.

---

### `src/features/submissions/useReviewQueue.ts` — TanStack list hook

**Analog:** `src/features/groups/useGroupMembers.ts` (lines 1–62) — list with profile-join pattern.

**Pattern (copy useGroupMembers.ts shape):**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface PendingSubmissionRow {
  id: string;
  user_id: string;
  caption: string | null;
  media_path: string;
  media_type: 'photo' | 'video';
  created_at: string;
  display_name: string | null;
  avatar_path: string | null;
  updated_at: string | null;     // for avatar cache busting (WR-01 pattern)
}

export function useReviewQueue(groupId: string | undefined) {
  return useQuery({
    queryKey: ['reviewQueue', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<PendingSubmissionRow[]> => {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, user_id, caption, media_path, media_type, created_at, profiles(display_name, avatar_path, updated_at)')
        .eq('group_id', groupId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw new Error(error.message);
      // Flatten the profile join exactly like useGroupMembers.ts lines 40–60
      const rows = (data ?? []) as unknown as Array<{
        id: string;
        user_id: string;
        caption: string | null;
        media_path: string;
        media_type: 'photo' | 'video';
        created_at: string;
        profiles: { display_name: string | null; avatar_path: string | null; updated_at: string | null } | null;
      }>;
      return rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        caption: r.caption,
        media_path: r.media_path,
        media_type: r.media_type,
        created_at: r.created_at,
        display_name: r.profiles?.display_name ?? null,
        avatar_path: r.profiles?.avatar_path ?? null,
        updated_at: r.profiles?.updated_at ?? null,
      }));
    },
  });
}
```

**RLS note (CONTEXT line 101 + 0001:255):** the existing `submissions_select_group_members` policy permits any group member (including admin) to SELECT. Server-side enforcement is enough; the client doesn't need an `isAdmin` check on the read.

---

### `src/features/submissions/useSubmitToday.ts` — Two-phase commit mutation

**Analog (mutation shape):** `src/features/profile/useUpdateProfile.ts` (lines 4–24) + `src/features/groups/useCreateGroup.ts` (RPC mutation with returned uuid).
**Analog (file-I/O orchestration):** `src/features/profile/useAvatarUpload.ts` `pickAndUploadAvatar()` (lines 16–54) — pick → resize → buffer → upload → DB write. **Difference:** two-phase commit (D-06), `upsert: false`, RPC instead of `.from().update()`, queue fallback on network error.

**Pattern (mutation hook wrapping the pure pipeline):**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { submitMedia } from './submitMedia';
import { enqueue } from './uploadQueueManager';
import type { SubmitTodayInput } from './schemas';

export function useSubmitToday() {
  const qc = useQueryClient();
  return useMutation<string, Error, SubmitTodayInput>({
    mutationFn: async (input) => {
      try {
        return await submitMedia(input);   // returns submission_id
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        // Network/timeout/5xx → queue + re-throw a marker that the screen
        // handles by dismissing (per UI-SPEC line 826).
        if (isNetworkError(err)) {
          await enqueue({
            client_uuid: input.clientUuid ?? crypto.randomUUID(),
            group_id: input.groupId,
            media_local_uri: input.mediaLocalUri,
            media_type: input.mediaType,
            caption: input.caption ?? null,
            created_at_iso: new Date().toISOString(),
          });
          throw new Error('queued');   // screen branches on 'queued' to dismiss
        }
        // Typed errors propagate as-is (already_submitted_today, etc.).
        throw err;
      }
    },
    onSuccess: (_submissionId, input) => {
      // Patch the optimistic cache immediately; Realtime will confirm.
      qc.invalidateQueries({ queryKey: ['submission', input.groupId, 'today'] });
    },
  });
}
```

**`submitMedia.ts` (the pure pipeline — extract per RESEARCH §Pattern 1 + Code Examples §3):**

```typescript
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';   // SDK 55 modern API per RESEARCH finding 3
import { supabase } from '../../lib/supabase';

export async function submitMedia(input: {
  groupId: string;
  mediaLocalUri: string;
  mediaType: 'photo' | 'video';
  caption: string | null;
  clientUuid?: string;
}): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');

  // 1. Compress (photo only; video already capped to 720p/10s by capture).
  const sourceUri = input.mediaType === 'photo'
    ? (await ImageManipulator.manipulateAsync(
        input.mediaLocalUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      )).uri
    : input.mediaLocalUri;

  // 2. Read into ArrayBuffer via SDK 55 modern File API.
  const buf = await new File(sourceUri).arrayBuffer();

  // 3. Upload to storage. upsert:false so a successful re-upload of the same
  //    path returns 409 → caller treats as "object exists, proceed to step 4".
  const ext = input.mediaType === 'photo' ? 'jpg' : 'mp4';
  const contentType = input.mediaType === 'photo' ? 'image/jpeg' : 'video/mp4';
  const cuid = input.clientUuid ?? crypto.randomUUID();
  const path = `${input.groupId}/${user.id}/${cuid}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('submissions')
    .upload(path, buf, { contentType, upsert: false });
  if (upErr && !isAlreadyExists(upErr)) throw upErr;

  // 4. RPC for the row insert. Server derives local_date.
  const { data, error: rpcErr } = await supabase.rpc('submit_today', {
    p_group_id: input.groupId,
    p_media_path: path,
    p_media_type: input.mediaType,
    p_caption: input.caption,
  });
  if (rpcErr) throw new Error(rpcErr.message);   // typed: not_member / wrong_media_type / already_submitted_today
  return data as string;
}
```

---

### `src/features/submissions/useReviewSubmission.ts` — Review mutation

**Analog:** `src/features/groups/useTransferAdmin.ts` (RPC mutation that returns void + invalidates by groupId).

**Pattern:**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { ReviewSubmissionInput } from './schemas';

export function useReviewSubmission(groupId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<void, Error, ReviewSubmissionInput>({
    mutationFn: async (input) => {
      const { error } = await supabase.rpc('review_submission', {
        p_submission_id: input.submissionId,
        p_decision: input.decision,
        p_rejection_reason: input.rejectionReason,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      if (!groupId) return;
      qc.invalidateQueries({ queryKey: ['reviewQueue', groupId] });
      qc.invalidateQueries({ queryKey: ['pendingReviewCount', groupId] });
      // The submitter's Today screen updates via Realtime; do NOT invalidate
      // ['submission', groupId, 'today'] for the admin's session here.
    },
  });
}
```

---

### `src/features/submissions/uploadQueueManager.ts` — AsyncStorage queue

**No analog.** Build per `03-RESEARCH.md §Pattern 2` (lines 437–485) — the canonical single-key JSON-array atomic primitive.

**Source code (verbatim from RESEARCH §Pattern 2):**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

export const QUEUE_KEY = 'accountibuzz.uploadQueue';

export const queueEntrySchema = z.object({
  client_uuid: z.string().uuid(),
  group_id: z.string().uuid(),
  media_local_uri: z.string().min(1),
  media_type: z.enum(['photo', 'video']),
  caption: z.string().max(140).nullable(),
  created_at_iso: z.string().datetime(),
});
export type QueueEntry = z.infer<typeof queueEntrySchema>;

export async function readQueue(): Promise<QueueEntry[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return z.array(queueEntrySchema).parse(parsed);
  } catch {
    console.warn('[uploadQueue] corrupt — resetting');
    await AsyncStorage.removeItem(QUEUE_KEY);
    return [];
  }
}

export async function enqueue(entry: QueueEntry): Promise<void> { /* ... */ }
export async function dequeue(client_uuid: string): Promise<void> { /* ... */ }
```

**Flush manager (RESEARCH lines 422–435 — "When to flush" + "When to drop"):** subscribes to AppState 'active', NetInfo `isConnected`, and exposes a manual `flushOne(client_uuid)` for the QueueBadge bottom-sheet `Retry now` action. On `already_submitted_today` / `not_member` / `wrong_media_type`: drop entry. On network 5xx / timeout: retain + retry on next trigger.

**Namespace invariant (P2 Shared Pattern 9):** key prefix is `accountibuzz.` — mirrors `accountibuzz.recoveryPending` (AuthProvider.tsx:19) and `accountibuzz.pendingInviteCode` (usePendingInviteReplay.ts:18).

---

### `src/features/submissions/useTodaySubmissionRealtime.ts` — Realtime subscription

**No analog.** Build per `03-RESEARCH.md §Pattern 3` (lines 486–531) — single-column `user_id` filter + client-side narrowing + `useFocusEffect` cleanup.

**Source code (verbatim from RESEARCH §Pattern 3, adapted for export):**

```typescript
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useTodaySubmissionRealtime(userId: string | undefined): void {
  const qc = useQueryClient();
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`today-submissions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: `user_id=eq.${userId}`,    // ONLY single-column equality is supported
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | { group_id: string; local_date: string; status: string; id: string }
            | undefined;
          if (!row) return;
          // Client-side narrowing per Pitfall 1 (RESEARCH §Pattern 3).
          // The cache key for THIS group's TODAY's submission gets patched.
          // (The hook intentionally ignores rows for other dates — they belong
          // to a future today's-cache that doesn't exist yet.)
          qc.setQueryData(['submission', row.group_id, 'today'], row);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]));
}
```

**Why `useFocusEffect`, NOT `useEffect`** (RESEARCH lines 534–537 + Pitfall 11): tab navigation does NOT unmount the screen, so a `useEffect` cleanup would leak the channel. `useFocusEffect` fires on tab focus + blur.

---

### `src/components/StatusPill.tsx` — Status badge primitive

**Analog:** `src/components/SegmentedControl.tsx` (Pressable + theme tokens + state-driven styling) — but P3's StatusPill is simpler (state-driven render, only the `rejected` state is interactive).

**Imports + theme** (SegmentedControl.tsx lines 4–5):

```tsx
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
```

**State-mapped visual table (UI-SPEC §1 lines 470–477):**

| State | Background | Text | Weight | Icon | Border |
|-------|------------|------|--------|------|--------|
| `none` | none | `--text-muted` | 500 | none | none (renders bare em-dash) |
| `pending` | `--surface-muted` | `--text` | 500 | Feather `clock` 12pt | 1px `--border` |
| `approved` | `--primary` | `--primary-fg` | 700 | Feather `check` 12pt | none |
| `rejected` | `--destructive` + 15% alpha | `--destructive` | 500 | Feather `x-circle` 12pt | none |

**Tappable variant (rejected only):** wrap in `Pressable` with `onPress={onRejectedPillPress}`; non-rejected states render as `View` with `accessibilityRole="text"`. UI-SPEC §1 line 479.

**Alpha overlay** (UI-SPEC line 254 — "destructive at ~15% alpha"): `colors.destructive + '26'` (hex string concatenation; 0x26 ≈ 15%). NO new token.

---

### `src/components/TypeChip.tsx` — Photo/video chip

**Analog:** `src/components/InviteCodeChip.tsx` (lines 60–73 — chip styling: `surfaceMuted` bg, `border`, `pill` radius, `Caption-500` label).

**Pattern (simplified — no copy interaction):**

```tsx
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

export interface TypeChipProps { kind: 'photo' | 'video'; }

export function TypeChip({ kind }: TypeChipProps) {
  const t = useTheme();
  const label = kind === 'photo' ? 'Photo' : 'Video';
  const iconName = kind === 'photo' ? 'camera' : 'video';
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${label} group`}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs,
        backgroundColor: t.colors.surfaceMuted,
        borderWidth: 1, borderColor: t.colors.border,
        borderRadius: t.radii.pill,
        paddingHorizontal: t.spacing.sm,
        paddingVertical: t.spacing.xs,
      }}
    >
      <Feather name={iconName} size={13} color={t.colors.textMuted} />
      <Text style={[t.fonts.caption, { color: t.colors.textMuted, fontWeight: '500' }]}>{label}</Text>
    </View>
  );
}
```

---

### `src/components/GroupCard.tsx` — Today per-group composite

**Analog (shell):** the existing `GroupRow` in `app/(app)/index.tsx` (lines 330–380) — same Pressable + theme-token + Title/Body/Caption stack idiom. P3 GroupCard is denser (1-line goal truncate per UI-SPEC line 121) and has 5 rows (header / goal / status+cutoff / CTA / queue badge).
**Analog (composition):** `src/components/InviteCodeChip.tsx` (composed primitive with theme tokens).

**Imports skeleton:**

```tsx
import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { PrimaryButton, SecondaryButton, GhostButton } from '.';
import { StatusPill } from './StatusPill';
import { TypeChip } from './TypeChip';
import { Feather } from '@expo/vector-icons';
```

**Cross-fade on status change (UI-SPEC line 536):** RN `Animated.timing` 250ms (125ms out + 125ms in) on the StatusPill + CTA opacity when the `status` prop changes. `useEffect([status])` triggers the animation.

**Layout** (UI-SPEC lines 515–528): 5-row stack — header (name + TypeChip), goal (1-line truncate), status pill + cutoff hint, CTA, optional queue badge separated by 1px top border.

**Status-driven CTA branching (UI-SPEC lines 308–311):**
- `none` + photo → `PrimaryButton` label `Submit photo`
- `none` + video → `PrimaryButton` label `Submit video`
- `pending` / `approved` → `SecondaryButton` label `Submitted`, disabled
- `rejected` → `GhostButton` label `Today didn't count`, disabled, 4px `--destructive` left border (UI-SPEC line 179)

**No optimistic update** within GroupCard — parent owns the cache and passes `status` as a prop. Cross-fade is purely visual.

---

### `src/components/Shutter.tsx` — Camera shutter

**Analog:** `src/components/PrimaryButton.tsx` (Pressable + tap-feedback transform).

**Pattern (3 variants per UI-SPEC §6b lines 644–651):**

```tsx
import { useEffect, useRef } from 'react';
import { Pressable, View, Animated } from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface ShutterProps {
  variant: 'photo' | 'video-idle' | 'video-recording';
  onPress: () => void;
}

export function Shutter({ variant, onPress }: ShutterProps) {
  const t = useTheme();
  const a11yLabel = variant === 'photo' ? 'Take photo'
                  : variant === 'video-idle' ? 'Start recording'
                  : 'Stop recording';
  const innerColor = variant === 'video-recording' ? t.colors.destructive : t.colors.primary;
  const innerShape = variant === 'video-recording' ? 'square' : 'circle';
  // Pulse animation for video-recording — opacity 0.85 → 1 over 1.4s loop (UI-SPEC line 650)
  // ...
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 72, height: 72, borderRadius: 36,
        borderWidth: 4, borderColor: '#FFFFFF',
        alignItems: 'center', justifyContent: 'center',
        transform: [{ scale: pressed ? (variant === 'video-recording' ? 0.95 : 0.92) : 1 }],
      })}
    >
      <View style={{
        width: 52, height: 52, borderRadius: innerShape === 'circle' ? 26 : 0,
        backgroundColor: innerColor,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {variant === 'video-recording' && (
          <View style={{ width: 16, height: 16, backgroundColor: '#FFFFFF' }} />
        )}
      </View>
    </Pressable>
  );
}
```

**Off-grid intentional values** (UI-SPEC line 88–90): 72pt outer, 52pt inner, 16pt stop-square, 4pt outer ring — all documented as P3 capture-chrome exceptions.

---

### `src/components/SwipeCard.tsx` — Swipe queue card

**No analog.** Build per `03-UI-SPEC.md §SwipeCard` (lines 552–612) + media playback per `03-RESEARCH.md §Don't Hand-Roll` (line 662).

**Closest primitive parallels:**
- `src/components/Avatar.tsx` for the avatar render
- `src/components/InviteCodeChip.tsx` for composed-primitive layering
- The avatar URL pattern in `app/(app)/index.tsx` lines 51–57 for signed-URL composition

**Signed URL invariant (UI-SPEC line 602):** media is in PRIVATE bucket; resolve via `supabase.storage.from('submissions').createSignedUrl(path, 60)`. Wrap in TanStack Query `['signedUrl', path]` with `staleTime: 50_000` per RESEARCH §Don't Hand-Roll line 667.

**Reanimated Shared Values for gesture-driven props (RESEARCH §Pattern 4 lines 559–561):**

```tsx
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';

const translateX = useSharedValue(0);
const rotate = useSharedValue(0);
```

The screen owns the gesture handler (one PanGestureHandler per stack); SwipeCard receives the shared values as props and applies them via `useAnimatedStyle`.

---

### `src/components/DestructiveButton.tsx` — Filled red button

**Analog:** `src/components/PrimaryButton.tsx` (lines 1–58) — copy verbatim, swap colors:

```tsx
import { ActivityIndicator, Pressable, Text, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function DestructiveButton({
  label, onPress, loading, disabled, style, accessibilityLabel,
}: Props) {
  const t = useTheme();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          backgroundColor: t.colors.destructive,    // ← only color change vs PrimaryButton
          borderRadius: t.radii.md,
          minHeight: 48,
          paddingHorizontal: t.spacing.lg,
          alignItems: 'center', justifyContent: 'center',
          opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={[t.fonts.body, { color: '#FFFFFF', fontWeight: '700' }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
```

**P1 inventory promise** (UI-SPEC line 1130): "token-faithful build — no new design decisions, just executing the P1 inventory promise."

---

### `app.config.ts` — expo-camera plugin (MODIFIED)

**Analog:** self (lines 32 — current `plugins` array).

**Current** (line 32): `plugins: ['expo-router', 'expo-secure-store', 'expo-font'],`

**P3 modification (per RESEARCH lines 207–223):**

```typescript
plugins: [
  'expo-router',
  'expo-secure-store',
  'expo-font',
  [
    'expo-camera',
    {
      cameraPermission: 'Accountibuzz needs camera access to capture your daily proof.',
      microphonePermission: 'Accountibuzz needs microphone access to record audio with your video proof.',
      recordAudioAndroid: true,
    },
  ],
],
```

The `expo-camera` config plugin auto-generates `NSCameraUsageDescription` + `NSMicrophoneUsageDescription` (iOS) and `CAMERA` + `RECORD_AUDIO` permissions (Android). **No manual `infoPlist` or `android.permissions` arrays needed** (RESEARCH lines 224–228).

**Build invariant (RESEARCH lines 681–687):** the existing dev client does NOT have these permissions in its plists. **Rebuild required:** `npx expo prebuild --clean && npx expo run:ios` (and Android equivalent). Add as a Wave 0 task per the planner.

---

### `package.json` + `jest.setup.ts` — Dependencies + mocks (MODIFIED)

**Add to package.json** (RESEARCH line 188): `npx expo install @react-native-community/netinfo`

**Add to jest.setup.ts** (existing mocks at lines 5–85; RESEARCH lines 1556–1576):

```typescript
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true, status: 'granted' }, jest.fn()],
  useMicrophonePermissions: () => [{ granted: true, status: 'granted' }, jest.fn()],
}));

jest.mock('expo-video', () => ({
  useVideoPlayer: (uri: string, setup?: (p: unknown) => void) => {
    const player = { muted: false, loop: false, play: jest.fn(), pause: jest.fn(), release: jest.fn() };
    setup?.(player);
    return player;
  },
  VideoView: 'VideoView',
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: () => Promise.resolve({ isConnected: true, isInternetReachable: true }),
}));

jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));

jest.mock('expo-linking', () => ({
  openSettings: jest.fn(),
}));

// Reanimated mock per the official testing guide (RESEARCH line 1586)
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
```

**File class** (RESEARCH finding 3 line 19): the modern `expo-file-system` `File` class needs a Jest mock too:

```typescript
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
  })),
  readAsStringAsync: jest.fn(async () => 'base64data'),  // legacy mock, retain for avatar tests
}));
```

---

### `src/types/database.ts` (REGENERATE)

After `0006_*` migration applies locally, run:

```bash
pnpm types:gen   # alias for: supabase gen types typescript --local > src/types/database.ts
```

New types expected: `Database.public.Functions.submit_today.Args/Returns`, `review_submission`, `get_pending_review_count`. Commit the regenerated file.

---

### Jest tests — patterns

**Schema tests** (`tests/submissions/schemas.test.ts`): copy `tests/profile-schemas.test.ts` structure verbatim — `safeParse` assertions for boundary cases (caption=140 ok, caption=141 fails, etc.).

**Hook tests** (`tests/submissions/use*.test.ts`): copy `tests/avatar-upload.test.ts` structure — env-var setup at top, `jest.mock('react-native', ...)`, `jest.spyOn(supabase.storage, 'from')` and `jest.spyOn(supabase, 'rpc')` per-test.

**SwipeCard test** (`tests/components/SwipeCard.test.tsx`): per RESEARCH line 1586 — `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))` makes worklets JS-thread-callable; gesture handlers can be invoked directly without simulating native events.

**Realtime test** (`tests/submissions/useTodaySubmissionRealtime.test.ts`): per RESEARCH §What Should NOT Be Mocked — mock `supabase.channel(...).on(...).subscribe()` chain at per-test level so the test can drive a synthetic payload into the handler:

```typescript
const mockSubscribe = jest.fn();
const mockOn = jest.fn().mockReturnValue({ subscribe: mockSubscribe });
const mockChannel = jest.fn().mockReturnValue({ on: mockOn });
jest.spyOn(supabase, 'channel').mockImplementation(mockChannel);
// ... after render, capture the handler:
const handler = mockOn.mock.calls[0][2];
// Drive a synthetic event:
handler({ new: { group_id: 'g-1', local_date: '2026-04-28', status: 'approved', id: 's-1' } });
// Assert qc.setQueryData was called with ['submission', 'g-1', 'today']
```

---

## Shared Patterns (cross-cutting — apply to multiple P3 files)

### Shared Pattern 1: All write paths via SECURITY DEFINER RPCs (P2 D-11, P3 D-18 reaffirmed)

**Apply to:** every mutation hook in `src/features/submissions/`. **Invariant:** no `supabase.from('submissions').insert()` or `.update()` anywhere in the client. Three RPCs (`submit_today`, `review_submission`) own all writes; reads stay direct (`supabase.from('submissions').select()`) gated by RLS.

### Shared Pattern 2: Singleton supabase import (P1 + P2 Shared Pattern 1)

```typescript
import { supabase } from '../../lib/supabase';     // src/features/**
import { supabase } from '../../../src/lib/supabase'; // app/(app)/* (depth varies — count `..` per file)
```

### Shared Pattern 3: TanStack Query v5 — `isPending`, NOT `isLoading` (P1/P2 Shared Pattern 5)

**Apply to:** every consumer of the new submissions hooks.

### Shared Pattern 4: `{ data, error }` destructure invariant (P1/P2 Shared Pattern 4)

**Apply to:** every `supabase.rpc(...)`, `.from(...).select()`, `.storage.from().upload()` call.

```typescript
const { data, error } = await supabase.rpc('submit_today', { ... });
if (error) throw new Error(error.message);    // mutation: preserve typed code for screen branching
return data;
```

### Shared Pattern 5: Typed-error string branching (P2 Shared Pattern 5)

**Apply to:** `app/(app)/capture/[groupId].tsx` (Submit handler), `app/(app)/groups/[id]/review.tsx` (RPC error toast).

```typescript
try { await mutateAsync(args); }
catch (err: unknown) {
  const msg = err instanceof Error ? err.message : '';
  switch (msg) {
    case 'wrong_media_type': setError("This group is for ${kind} only..."); break;
    case 'already_submitted_today': setError("You already submitted today..."); break;
    case 'not_member': setError("You're not in this group anymore..."); break;
    case 'queued': /* network error → router.dismiss(); QueueBadge will appear on Today */ break;
    default: setError("Something went sideways. Check your connection and try again.");
  }
}
```

UI-SPEC §"Error state copy" (lines 388–397) is the full mapping.

### Shared Pattern 6: Theme tokens (P1/P2 Shared Pattern 6)

**Apply to:** every P3 component and screen. Use `useTheme().colors / spacing / radii / fonts`. Never hardcode. Alpha overlays computed at consumer site (e.g. `colors.destructive + '26'` for 15% per UI-SPEC line 254 — not a new token).

### Shared Pattern 7: Native module feature-degrade (P2 Shared Pattern 7)

**Apply to:** `expo-haptics` (capture submit + swipe-commit), `expo-blur` (top-bar scrim — fallback to flat scrim if blur fails per UI-SPEC line 631), camera permission prompt failures.

```typescript
try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
catch { /* silent */ }
```

### Shared Pattern 8: `cancelLabel` must be context-specific (P2 Shared Pattern 8)

**Apply to:** Discard-take Modal, Reject-reason commit Modal, First-review tooltip Modal.

| Modal | cancelLabel |
|-------|-------------|
| Discard-take (over viewfinder) | `"Keep recording"` |
| Reject-reason (under stack) | `"Never mind"` |
| First-review tooltip | `"Got it"` (becomes the only-exit primary CTA — `secondaryAction={undefined}`, dismiss happens via the primary `Got it` press) |

The dev-mode warning in `src/components/Modal.tsx:51-57` enforces that `'Cancel'` is rejected.

### Shared Pattern 9: SecureStore + AsyncStorage namespacing (P2 Shared Pattern 9)

**Apply to:** all new keys. Prefix `accountibuzz.` or `accountibuzz.scope:id`.

| Key | Storage | Use |
|-----|---------|-----|
| `accountibuzz.uploadQueue` | AsyncStorage | offline upload queue (RESEARCH §Pattern 2) |
| `tooltip:admin_review:${userId}` | SecureStore | first-review-tooltip one-shot (UI-SPEC line 900 — note: deviates slightly from the namespace prefix, but mirrors the P2 `seen_create_banner:{group_id}` precedent in `groups/[id]/index.tsx`) |

### Shared Pattern 10: RLS-by-default (P1 Shared Pattern 1, P2 Shared Pattern 10)

**P3 adds no new tables** → CI's `rls-check.yml` continues to pass. P3 also drops NO P1 placeholder policies — the `submissions_*` policies from 0001 are kept for defense-in-depth even though the client only writes via RPC (CONTEXT D-18 explicit).

### Shared Pattern 11 (NEW in P3): Realtime channel scoped to active screen, torn down on blur

**Apply to:** `useTodaySubmissionRealtime` (Today tab only). **Anti-pattern (Pitfall 11):** `useEffect`-based subscription leaks across tab navigation. Use `useFocusEffect` from `expo-router`. Single channel filtered server-side on `user_id`; narrow client-side by group_id + local_date.

### Shared Pattern 12 (NEW in P3): Two-phase commit + idempotent upload

**Apply to:** `submitMedia` (the only consumer in P3; future-proofed for resubmit-after-rejection if it ever ships).

- Step 1: storage upload with `upsert: false` so a retry of the same `client_uuid` path returns 409 → caller treats as "object exists, proceed to step 2"
- Step 2: RPC inserts the row; UNIQUE catches double-insert and re-raises as `already_submitted_today` → client drops queue entry

Idempotency contract documented in RESEARCH §Pattern 1 (lines 414–418).

### Shared Pattern 13 (NEW in P3): Modern `expo-file-system` `File` class for media reads

**Apply to:** `submitMedia` for new code; **strongly recommended migration:** `useAvatarUpload.ts` lines 1–4 + 36–39 (legacy `readAsStringAsync` + `decode`) → migrate to `new File(uri).arrayBuffer()` per RESEARCH finding 3.

The legacy `expo-file-system/legacy` import path is deprecated in SDK 55 (RESEARCH line 19, line 164). P3 is the natural place to land both consumers on the same canonical pattern.

### Shared Pattern 14 (NEW in P3): No optimistic remove from UI without RPC ACK contingency

**Apply to:** the swipe-stack approve/reject commit (`app/(app)/groups/[id]/review.tsx`). Per RESEARCH "Anti-Patterns" line 650: the swipe-fly-off animation runs in parallel with the RPC, but if the RPC fails, the card MUST re-appear. Don't assume the optimistic remove is the source of truth.

```typescript
const onApprove = async (id: string) => {
  // 1. Animate card off-screen (250ms ease-out)
  // 2. Optimistically remove from local stack
  try {
    await reviewMutation.mutateAsync({ submissionId: id, decision: 'approved', rejectionReason: null });
  } catch (err) {
    // 3. RPC failed → animate card back into stack + show inline error toast
    setStack(prev => [{ ...failedCard }, ...prev]);
    setErrorToast("Couldn't save that decision. Try again.");
  }
};
```

---

## No Analog Found

These five P3 surfaces have **no in-repo precedent**. The planner copies from `03-RESEARCH.md` and `03-UI-SPEC.md`, NOT from a non-existent file:

| File / Surface | Role | Reason no analog | Authoritative pattern source |
|----------------|------|------------------|------------------------------|
| `app/(app)/capture/[groupId].tsx` | screen (camera + state machine) | First camera surface in repo | `03-RESEARCH.md §Pattern 5` (state machine, lines 614–636) + `03-UI-SPEC.md §Capture state matrix` (line 995) + `03-RESEARCH.md §Code Examples §1+§2` (camera API) |
| `app/(app)/groups/[id]/review.tsx` + `src/components/SwipeCard.tsx` | screen + component (gesture-driven swipe stack) | First gesture-handler + Reanimated 4 consumer in repo | `03-RESEARCH.md §Pattern 4` (Reanimated swipe stack, lines 540–602) + `03-UI-SPEC.md §SwipeCard` (lines 552–612) + `03-UI-SPEC.md §"Admin review queue"` (lines 862–934) |
| `src/features/submissions/uploadQueueManager.ts` + `useUploadQueue.ts` | utility + hook (AsyncStorage queue + flush triggers) | First persistent client-side queue in repo | `03-RESEARCH.md §Pattern 2` (lines 437–485) + `03-RESEARCH.md §Architecture Diagram §Queue Manager` (lines 274–280) |
| `src/features/submissions/useTodaySubmissionRealtime.ts` | hook (Realtime subscription with `useFocusEffect` cleanup) | First Realtime subscription in repo | `03-RESEARCH.md §Pattern 3` (lines 486–531) — single-column filter + client-side narrowing + `useFocusEffect` cleanup |
| `app/(app)/_layout.tsx` (Stack → Tabs) | layout | First `<Tabs>` consumer in repo | `03-UI-SPEC.md §App shell — Stack → Tabs migration` (lines 703–732) + expo-router official docs (linked via RESEARCH §Sources line 1701) |
| `src/components/Shutter.tsx` + `src/components/CaptureTopBar.tsx` + `src/components/ReviewPanel.tsx` | components (camera UX cluster) | No camera-control precedent | `03-UI-SPEC.md §6a/6b/6c/6d` (lines 618–697) — full anatomy specs |

**These all share one trait:** the planner copies from a written spec, not from an existing file. If implementation diverges from the spec, the divergence MUST be flagged in the wave commit message (per the CLAUDE.md "Consult skills before implementing" memory note).

---

## Metadata

**Analog search scope:**
- `/Users/chris/projects/accountibuzz/src/components/` (16 files inspected)
- `/Users/chris/projects/accountibuzz/src/features/groups/` (17 files inspected)
- `/Users/chris/projects/accountibuzz/src/features/profile/` (4 files inspected)
- `/Users/chris/projects/accountibuzz/src/features/auth/` (3 files inspected)
- `/Users/chris/projects/accountibuzz/src/lib/` (3 files inspected)
- `/Users/chris/projects/accountibuzz/app/` (10 files inspected)
- `/Users/chris/projects/accountibuzz/supabase/migrations/` (5 files inspected; 0001, 0003, 0004 read in detail)
- `/Users/chris/projects/accountibuzz/supabase/tests/` (12 files inspected; redeem_invite, transfer_admin, leave_group, profiles_select_co_member read in detail)
- `/Users/chris/projects/accountibuzz/tests/` (11 root + 14 groups/* — avatar-upload, pendingInviteReplay read in detail)
- `/Users/chris/projects/accountibuzz/jest.setup.ts`
- `/Users/chris/projects/accountibuzz/app.config.ts`
- `/Users/chris/projects/accountibuzz/package.json`

**Primary analog sources (in repo):**
- `src/features/profile/useProfile.ts` — read-hook template
- `src/features/profile/useUpdateProfile.ts` — mutation-hook template
- `src/features/profile/useAvatarUpload.ts` — top-level pickAndUpload + storage.upload pipeline (closest to `submitMedia`)
- `src/features/groups/useGroup.ts`, `useGroupMembers.ts`, `useInvitePreview.ts` — TanStack Query read patterns (single, list, RPC)
- `src/features/groups/useCreateGroup.ts`, `useTransferAdmin.ts`, `useLeaveGroup.ts` — RPC mutation patterns
- `src/features/groups/usePendingInviteReplay.ts` — side-effect hook with cleanup
- `src/features/groups/schemas.ts` — Zod schema template
- `src/features/auth/AuthProvider.tsx` — persisted-flag side-effect template
- `src/components/PrimaryButton.tsx` — Pressable + theme token primitive (template for Shutter, DestructiveButton)
- `src/components/SegmentedControl.tsx` — state-mapped visual primitive
- `src/components/InviteCodeChip.tsx` — composed primitive with theme tokens
- `src/components/Modal.tsx` — modal primitive (reused for discard-take + first-review tooltip)
- `app/(app)/index.tsx` — FlatList + skeleton + empty-state shell (transferred to Today and to groups/index)
- `app/(app)/profile.tsx` — branching screen template
- `app/(app)/groups/[id]/index.tsx` — dynamic-route + composed-screen template
- `app/_layout.tsx` — Provider stack pattern (RootGate)
- `supabase/migrations/0001_foundation.sql` — submissions table + RLS source of truth
- `supabase/migrations/0003_phase1_review_fixes_2.sql` — admin-immutable trigger contract
- `supabase/migrations/0004_phase2_groups_invites.sql` — RPC migration idiom (header, function, grants)
- `supabase/tests/redeem_invite.sql` — pgTAP multi-persona + structural assertion template
- `supabase/tests/transfer_admin.sql` — pgTAP success + invariants template
- `supabase/tests/leave_group.sql` — pgTAP typed-error template
- `tests/profile-schemas.test.ts` — schema unit test template
- `tests/avatar-upload.test.ts` — hook + supabase mock template
- `tests/groups/pendingInviteReplay.test.tsx` — side-effect hook integration test template

**Secondary pattern sources (for files with no in-repo analog):**
- `.planning/phases/03-capture-admin-review/03-RESEARCH.md` §Pattern 1 (two-phase commit), §Pattern 2 (AsyncStorage queue), §Pattern 3 (Realtime + useFocusEffect), §Pattern 4 (Reanimated swipe stack), §Pattern 5 (capture state machine), §Code Examples, §Don't Hand-Roll, §Standard Stack, §What Should NOT Be Mocked
- `.planning/phases/03-capture-admin-review/03-UI-SPEC.md` §Component Additions (StatusPill, TypeChip, GroupCard, QueueBadge, SwipeCard, CaptureControls), §Screen-by-Screen Contract, §Capture state matrix, §Admin review queue state matrix, §Interaction Contracts, §Lovable Mockup → RN Primitive Mapping

**Pattern extraction date:** 2026-04-28

---

## PATTERN MAPPING COMPLETE
