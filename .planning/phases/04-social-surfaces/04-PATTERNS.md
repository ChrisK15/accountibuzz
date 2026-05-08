# Phase 4: Social Surfaces — Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 19 (1 SQL migration + 4 pgTAP test files + 5 hook files + 4 component files + 3 screen modifications + 1 auto-regenerated types file + 1 GroupCard modification)
**Analogs found:** 18 / 19 (regenerated types file has no analog; hand-edited contract is unchanged)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0008_phase4_points_streaks_feed.sql` | DB migration | DDL + trigger body + RPC + publication-add | `supabase/migrations/0007_phase3_realtime_publication.sql` (idempotent publication-add) + `supabase/migrations/0006_phase3_capture_review.sql` (RPC pattern) + `supabase/migrations/0001_foundation.sql` lines 365-384 (the stub being replaced) + `0003_phase1_review_fixes_2.sql` (BEFORE UPDATE column-allowlist) | exact, multi-source |
| `supabase/tests/handle_submission_approval_streak.sql` | DB test | pgTAP raw-UPDATE + JWT claims | `supabase/tests/submissions_admin_immutable.sql` (raw-UPDATE trigger coverage) + `supabase/tests/get_pending_review_count.sql` (JWT claims) | exact |
| `supabase/tests/handle_submission_approval_idempotency.sql` | DB test | pgTAP raw-UPDATE | `supabase/tests/submissions_admin_immutable.sql` | exact |
| `supabase/tests/phase4_rpc_permissions.sql` | DB test | pgTAP RPC calls per persona | `supabase/tests/get_pending_review_count.sql` | exact |
| `supabase/tests/phase4_rpc_correctness.sql` | DB test | pgTAP RPC calls + result-shape assertions | `supabase/tests/get_pending_review_queue.sql` | exact |
| `src/features/groups/useGroupLeaderboard.ts` | TanStack read hook | request-response (DB read via RPC) | `src/features/submissions/useReviewQueue.ts` (RPC + composite-row mapping) | exact (RPC-shaped read) |
| `src/features/groups/useGroupLeaderboardRealtime.ts` | TanStack Realtime subscriber | event-driven (postgres_changes → setQueryData) | `src/features/submissions/useTodaySubmissionRealtime.ts` | exact |
| `src/features/submissions/useGroupFeed.ts` | TanStack read hook | request-response (PostgREST embed) | `src/features/groups/useGroupMembers.ts` (embedded profile join) | exact |
| `src/features/submissions/useGroupFeedRealtime.ts` | TanStack Realtime subscriber | event-driven | `src/features/submissions/useTodaySubmissionRealtime.ts` | exact |
| `src/features/groups/useGroupTombstones.ts` | TanStack read hook | request-response (RPC) | `src/features/submissions/usePendingReviewCount.ts` (single-arg RPC call) | exact |
| `src/features/groups/useGroupSocialCounts.ts` | TanStack read hook | request-response (RPC) | `src/features/submissions/usePendingReviewCount.ts` | exact |
| `src/components/leaderboard/LeaderboardRow.tsx` | RN component | render-only | `src/components/GroupCard.tsx` (composed row with Avatar + StatusPill + composite a11y label) | role-match |
| `src/components/feed/FeedItem.tsx` | RN component | render-only (with signed-URL fetch + video player) | `src/components/SwipeCard.tsx` (avatar + media + caption + signed URL) | exact |
| `src/components/feed/StillToPostAvatarRow.tsx` | RN component | render-only | `src/components/Avatar.tsx` + group-detail's `MemberRowItem` from `app/(app)/groups/[id]/index.tsx` | role-match |
| `src/components/feed/MissedYesterdayRow.tsx` | RN component | render-only | `src/components/Avatar.tsx` + StatusPill (muted/quiet pill aesthetic) | role-match |
| `app/(app)/groups/[id]/index.tsx` | Screen (modification) | composition | self (existing ScrollView with stacked sections — extend in place) | self |
| `src/components/GroupCard.tsx` | RN component (modification) | composition | self (add ROW 6 below existing ROW 5 InlineQueueBadge pattern) | self |
| `app/(app)/index.tsx` (Today screen) | Screen (modification) | composition | self (extend `GroupCardRow` inner component) | self |
| `src/types/database.ts` | Type definitions | regenerated artifact | n/a (auto-generated via `pnpm types:gen`) | n/a |

---

## Pattern Assignments — DB Layer

### `supabase/migrations/0008_phase4_points_streaks_feed.sql` (DB migration)

**Analogs:** four sources. The migration is multi-section.

#### (a) Realtime publication-add (idempotent) — verbatim from `0007`

**Source:** `supabase/migrations/0007_phase3_realtime_publication.sql` lines 14-24

```sql
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
```

**Adaptation:** swap `tablename = 'submissions'` → `tablename = 'group_members'`. Same idempotency idiom (D-20 needs `group_members` in the publication; 0007 only added `submissions`). RESEARCH §Critical Gating Findings flags this as a hard prerequisite — without it, the leaderboard Realtime channel subscribes successfully but receives zero events.

#### (b) Trigger body replacement — `create or replace function` over the 0001 stub

**Source (the stub being replaced):** `supabase/migrations/0001_foundation.sql` lines 365-384

```sql
create or replace function public.handle_submission_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- STUB: intentionally a no-op in P1. See plan 04 for the body.
  return new;
end;
$$;

drop trigger if exists on_submission_approved on public.submissions;
create trigger on_submission_approved
  after update of status on public.submissions
  for each row
  when (old.status is distinct from new.status and new.status = 'approved')
  execute function public.handle_submission_approval();
```

**Adaptation:** keep the `language plpgsql / security definer / set search_path = public` envelope and the trigger wiring (drop+create). Replace the body with the streak-math UPDATE per RESEARCH §Pattern 1 (D-01..D-04). Recommended form: declare `v_new_streak int`, compute it in a single CASE, then a single `update public.group_members set points = points + 1, current_streak = v_new_streak, longest_streak = greatest(longest_streak, v_new_streak), last_rolled_date = new.local_date where group_id = new.group_id and user_id = new.user_id;`. Use date arithmetic `new.local_date = last_rolled_date + 1` (NOT `+ interval '1 day'` — avoids implicit timestamp cast).

**Trigger DROP+CREATE is idempotent** — already proven in 0003 line 90-93 (`drop trigger if exists ... create trigger`).

#### (c) Optional column-allowlist BEFORE UPDATE trigger on `group_members` — pattern-match `0003`

**Source:** `supabase/migrations/0003_phase1_review_fixes_2.sql` lines 23-86 (the entire `submissions_owner_immutable` shape)

```sql
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
    if new.group_id is distinct from old.group_id
       or new.user_id is distinct from old.user_id
       ... then
      raise exception 'admin may not modify ...';
    end if;
    return new;
  end if;
  ...
end;
$$;

drop trigger if exists submissions_owner_immutable_trigger on public.submissions;
create trigger submissions_owner_immutable_trigger
  before update on public.submissions
  for each row execute function public.submissions_owner_immutable();
```

**Adaptation (D-19, recommended in RESEARCH §3):** Create `public.group_members_counter_immutable()` BEFORE UPDATE trigger on `public.group_members`. Body: if `auth.uid() is null` (definer path — the `handle_submission_approval` trigger goes through here) → `return new` and skip checks; otherwise refuse any client-driven UPDATE that mutates `points`, `current_streak`, `longest_streak`, or `last_rolled_date`. Mirrors 0003's auth.uid()-IS-NULL definer-bypass pattern verbatim — that pattern is what lets the AFTER UPDATE trigger from this same migration run as definer without tripping its own immutability check.

#### (d) Three (or four) SECURITY DEFINER RPCs — verbatim shape from `0006`

**Source:** `supabase/migrations/0006_phase3_capture_review.sql` lines 220-245 (`get_pending_review_count` — the lenient non-leak pattern) and lines 289-327 (`get_pending_review_queue` — the typed-error pattern with composite return)

Lenient (returns 0 on non-member) — mirrors `get_today_posted_count`:
```sql
create or replace function public.get_pending_review_count(p_group_id uuid)
returns int
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_group_admin(p_group_id) then
    return 0;   -- no leak per D-17 (non-admin / stranger / anon all return 0)
  end if;
  return ( select count(*)::int from public.submissions
            where group_id = p_group_id and status = 'pending' );
end;
$$;

revoke execute on function public.get_pending_review_count(uuid) from public;
grant  execute on function public.get_pending_review_count(uuid) to authenticated;
```

Typed-error (returns table) — mirrors `get_pending_today` / `get_missed_yesterday`:
```sql
create or replace function public.get_pending_review_queue(p_group_id uuid)
returns setof public.review_queue_row
language plpgsql security definer stable
set search_path = public
as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if not public.is_group_admin(p_group_id) then raise exception 'not_admin' using errcode = 'P0001'; end if;
  return query select s.id, s.user_id, s.caption, ... ;
end;
$$;

revoke execute on function public.get_pending_review_queue(uuid) from public;
grant  execute on function public.get_pending_review_queue(uuid) to authenticated;
```

**Adaptation (per RPC):**
- `get_pending_today(p_group_id uuid)` → `returns table(user_id, display_name, avatar_path, updated_at)`. Use `is_group_member` (NOT `is_group_admin`). Typed errors `not_authenticated`, `not_member`, `group_not_found`. Inline `v_today := (now() AT TIME ZONE g.timezone)::date` per RESEARCH §Pattern 2.
- `get_missed_yesterday(p_group_id uuid)` → identical shape to `get_pending_today` except `v_target_date := v_today - 1` and the NOT-EXISTS subquery filters `s.status = 'approved' AND s.local_date = v_target_date`.
- `get_today_posted_count(p_group_id uuid)` → lenient mode (return 0 on non-member, no exception) per `get_pending_review_count` precedent. Inline `v_today` per group's tz.
- `get_group_leaderboard(p_group_id uuid)` (RESEARCH §6 recommendation, Claude's-discretion call) → `returns setof <composite type>` like `get_pending_review_queue`. May need a new composite type `public.leaderboard_row(user_id, display_name, avatar_path, profile_updated_at, points, current_streak, longest_streak, joined_at, role)` — created via the same `do $$ ... if not exists(select 1 from pg_type where typname = ...) ... create type ... end $$;` idempotent block from 0006 lines 269-287.

**All four RPCs must end with the revoke + grant pair.** Public must be revoked, authenticated granted. Same idiom appears 4× in 0006.

#### (e) RPC error-code convention — typed errors via `errcode = 'P0001'`

**Source:** `0006` lines 102-141 (the entire `submit_today` typed-error spread)

```sql
if caller is null then
  raise exception 'not_authenticated' using errcode = 'P0001';
end if;
...
raise exception 'not_member' using errcode = 'P0001';
```

**Adaptation:** every Phase 4 RPC that raises (i.e. all but `get_today_posted_count`) uses `errcode = 'P0001'`. The error message is the typed code itself — clients pattern-match on the message string (see `useReviewSubmission` for the precedent).

---

### `supabase/tests/handle_submission_approval_streak.sql` (pgTAP)

**Analog:** `supabase/tests/submissions_admin_immutable.sql` (raw-UPDATE trigger coverage — independent of any RPC layer)

**Multi-persona seed pattern** (lines 17-95 of analog):
```sql
begin;
select plan(11);

-- ---- Multi-persona seed (3 users; 1 group) ----
insert into auth.users (id, instance_id, email, aud, role, created_at, updated_at) values
  ('11111111-...', '00000000-0000-0000-0000-000000000000', 'admin@x.com', ...);

insert into public.groups (id, name, goal, submission_type, timezone, admin_user_id) values
  ('aaaaaaaa-...', 'PhotoG', 'Daily run photo', 'photo', 'America/Los_Angeles', '11111111-...');

insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-...', '11111111-...', 'admin'),
  ('aaaaaaaa-...', '44444444-...', 'member');
```

**Adaptation:** seed an `admin` + a `member`, plus pre-existing pending submissions for distinct `local_date` values (today, today-1, today-2, today-7) so each test branch (NULL → 1, consecutive → +1, gap → 1, longest_streak preservation, points increment) can be triggered by a raw UPDATE flipping `status` to `'approved'`. After each UPDATE, `select is(...)` against `group_members.points` / `current_streak` / `longest_streak` / `last_rolled_date`. **Use raw UPDATEs (NOT `review_submission` RPC)** — the test asserts the trigger body in isolation, not the RPC chain.

**Branch coverage** (D-02): NULL last_rolled_date → 1; same-day no-op (UNIQUE prevents but assert points unchanged on re-run, n/a); consecutive (+1); gap-2 (reset to 1); gap-7 (reset to 1); longest_streak retains the high-water mark.

---

### `supabase/tests/handle_submission_approval_idempotency.sql` (pgTAP)

**Analog:** same as above (`submissions_admin_immutable.sql`)

**Adaptation:** prove D-03's idempotency claim via two assertions: (1) approving a submission whose status is already `'approved'` does NOT re-fire the trigger (the AFTER UPDATE WHEN clause `old.status is distinct from new.status` blocks it — verify via `points` unchanged after a re-UPDATE that doesn't actually change status); (2) the 0003 admin-immutable trigger blocks `'approved' → 'pending'` regression so the trigger physically cannot fire twice on the same row.

---

### `supabase/tests/phase4_rpc_permissions.sql` (pgTAP)

**Analog:** `supabase/tests/get_pending_review_count.sql` lines 55-139 (5-persona JWT-claim cycle)

**JWT claim + role-set + reset pattern** (lines 58-72):
```sql
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select public.get_pending_review_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  3,
  'admin of group with 3 pending receives count=3'
);

reset role;
select set_config('request.jwt.claims', NULL, true);
```

**Adaptation:** 5 personas (admin, member, stranger, anon, ex-member who got removed) × 3 RPCs (`get_pending_today`, `get_missed_yesterday`, `get_today_posted_count`) × 2 RPC modes (typed-error vs lenient). For typed-error RPCs, use `throws_ok($$select * from public.get_pending_today('...')$$, 'P0001', 'not_member', '...')` per `get_pending_review_queue.sql` lines 85-90. For the lenient `get_today_posted_count`, use `is(...)` returning 0.

---

### `supabase/tests/phase4_rpc_correctness.sql` (pgTAP)

**Analog:** `supabase/tests/get_pending_review_queue.sql` lines 60-100 (multi-row seed + ordering + LEFT-JOIN edge cases)

**Adaptation:** seed a group with 4 members; insert submissions for some-but-not-all-on-today, some-but-not-all-on-yesterday-approved. Assert `get_pending_today` returns exactly the members with no row-for-today (alphabetical by display_name); `get_missed_yesterday` returns exactly the members with no APPROVED row for yesterday (rejected/pending count as misses); `get_today_posted_count` returns the approved-only count for today's local_date. Test the `(now() AT TIME ZONE g.timezone)::date` group-tz inline-resolution on a non-UTC group (e.g. `America/Los_Angeles`).

---

## Pattern Assignments — Data Hooks

### `src/features/groups/useGroupLeaderboard.ts` (TanStack read hook)

**Analog:** `src/features/submissions/useReviewQueue.ts` (RPC + composite-row mapping)

**RPC call + nullable-narrowing pattern** (lines 53-84):
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface PendingSubmissionRow {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_path: string | null;
  updated_at: string | null;
  ...
}

type RpcQueueRow = {
  id: string | null;
  user_id: string | null;
  ...
};

export function useReviewQueue(groupId: string | undefined) {
  return useQuery({
    queryKey: ['reviewQueue', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<PendingSubmissionRow[]> => {
      const { data, error } = await supabase.rpc('get_pending_review_queue', {
        p_group_id: groupId!,
      });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as RpcQueueRow[];
      return rows.map((r) => ({
        id: r.id!,
        user_id: r.user_id!,
        ...
      }));
    },
  });
}
```

**Adaptation:** swap RPC name → `'get_group_leaderboard'`, swap query key → `['leaderboard', groupId]`, define `LeaderboardRow` with fields `{ user_id, display_name, avatar_path, updated_at, points, current_streak, longest_streak, joined_at, role }`. Use the same `RpcQueueRow`-style nullable-narrowing pattern (composite returns are typed nullable per supabase-js convention). Sort server-side via the `group_members_leaderboard_idx` (`group_id, points DESC, current_streak DESC`) — RPC returns rows already ordered, so no client sort.

**Note (RESEARCH §6):** if planner picks "direct PostgREST select" instead of an RPC for the leaderboard read, the analog flips to `useGroupMembers.ts` (PostgREST embedded `select=user_id,points,current_streak,profiles(display_name,avatar_path,updated_at)`). RESEARCH recommends the RPC; planner makes the final call.

---

### `src/features/groups/useGroupLeaderboardRealtime.ts` (Realtime patcher)

**Analog:** `src/features/submissions/useTodaySubmissionRealtime.ts` (canonical Realtime hook shape)

**Verbatim lifecycle pattern** (lines 35-92):
```ts
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { todayLocalDate } from './time';

export function useTodaySubmissionRealtime(
  userId: string | undefined,
  getGroupTzs: () => Map<string, string>,
): void {
  const qc = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      const channel = supabase
        .channel(`today-submissions:${userId}`)
        .on(
          'postgres_changes' as never,
          {
            event: '*',
            schema: 'public',
            table: 'submissions',
            filter: `user_id=eq.${userId}`,
          } as never,
          (payload: { new?: unknown; old?: unknown }) => {
            const row = (payload.new ?? payload.old) as
              | { group_id: string; local_date: string; status: string; id: string }
              | undefined;
            if (!row) return;
            // [client-side narrowing] ...
            qc.setQueryData(['submission', row.group_id, row.local_date], row);
          },
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }, [userId, qc, getGroupTzs]),
  );
}
```

**Adaptation:**
- Swap channel name → `` `group-lb:${groupId}` `` (per-group, NOT global).
- Swap `table: 'submissions'` → `table: 'group_members'`.
- Swap `filter: 'user_id=eq.${userId}'` → `filter: 'group_id=eq.${groupId}'`.
- Swap `event: '*'` → `event: 'UPDATE'` (counter mutations are AFTER UPDATE only — INSERT/DELETE for membership changes are out of scope for the LB Realtime patch).
- Drop the `getGroupTzs` / `todayLocalDate` narrowing (LB events have no date dimension; just a `group_id` row).
- Patch via `qc.setQueryData(['leaderboard', groupId], (prev: LeaderboardRow[] | undefined) => prev ? prev.map((r) => r.user_id === payload.new.user_id ? { ...r, points: payload.new.points, current_streak: payload.new.current_streak, longest_streak: payload.new.longest_streak } : r) : prev)` — single-row update.
- Keep the `useFocusEffect` cleanup discipline (Pitfall 11). Same `as never` casts on `'postgres_changes'` literal (the typed-channel-on enum requires it).

---

### `src/features/submissions/useGroupFeed.ts` (today's approved feed)

**Analog:** `src/features/groups/useGroupMembers.ts` (PostgREST embedded profile join + queryKey + nullable narrowing)

**Embedded join + map pattern** (lines 21-62):
```ts
export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group', groupId, 'members'],
    enabled: !!groupId,
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select(
          'user_id, role, joined_at, profiles(display_name, avatar_path, updated_at)',
        )
        .eq('group_id', groupId!)
        .order('role', { ascending: false })
        .order('joined_at', { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<{ ... }>;
      return rows.map((r) => ({
        user_id: r.user_id,
        role: r.role,
        ...
        display_name: r.profiles?.display_name ?? null,
        avatar_path: r.profiles?.avatar_path ?? null,
        updated_at: r.profiles?.updated_at ?? null,
      }));
    },
  });
}
```

**Adaptation:**
- Swap table → `submissions`.
- Swap select → `'id, user_id, caption, media_path, media_type, created_at, profiles(display_name, avatar_path, updated_at)'`.
- Filter → `.eq('group_id', groupId!).eq('local_date', todayLocalDate).eq('status', 'approved')`.
- Order → `.order('created_at', { ascending: false })` (newest-first feed per UI-SPEC).
- queryKey → `['groupFeed', groupId, todayLocalDate]` (date-aware key, same pattern as `useTodaySubmission` for midnight rollover safety).
- `enabled: !!groupId && !!todayLocalDate` (mirrors `useTodaySubmission` line 33).
- Caller (`app/(app)/groups/[id]/index.tsx`) computes `todayLocalDate(group.timezone, new Date())` via `time.ts` and passes as second arg.

---

### `src/features/submissions/useGroupFeedRealtime.ts` (Realtime patcher)

**Analog:** `src/features/submissions/useTodaySubmissionRealtime.ts`

**Adaptation (D-21):**
- Channel name → `` `group-feed:${groupId}` ``.
- `table: 'submissions'`, `filter: 'group_id=eq.${groupId}'` (NOT `user_id=eq.${userId}`), `event: '*'` (covers INSERT for own-group submits + UPDATE for status-flips).
- **Client-side narrowing required** (matches the C1 fix in the analog): inside the handler, compute `today = todayLocalDate(groupTz, new Date())` and reject events where `row.local_date !== today` or where neither `payload.new.status === 'approved'` NOR `payload.old.status === 'approved'`.
- Patch strategy on approval-transition: `qc.setQueryData(['groupFeed', groupId, today], (prev) => prev ? [enrichedNewRow, ...prev] : prev)` — optimistic prepend; the row needs profile-enrichment which isn't in the Realtime payload, so EITHER fetch the profile fields with `supabase.from('profiles').select(...)` inline OR `qc.invalidateQueries({ queryKey: ['groupFeed', groupId, today] })`. RESEARCH §architecture diagram suggests the latter for simplicity.
- Always also `qc.invalidateQueries({ queryKey: ['leaderboard', groupId] })` on approval (D-21 "explicit invalidation is cheap insurance" — the trigger will produce its own LB patch within a tick).

---

### `src/features/groups/useGroupTombstones.ts` (today-pending + yesterday-missed combined hook)

**Analog:** `src/features/submissions/usePendingReviewCount.ts` (single-arg RPC call)

**Single-RPC pattern** (lines 12-25):
```ts
export function usePendingReviewCount(groupId: string | undefined) {
  return useQuery({
    queryKey: ['pendingReviewCount', groupId],
    enabled: !!groupId,
    staleTime: 15_000,
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

**Adaptation:** This is a "combined hook" returning both today-pending and yesterday-missed. Recommended shape: **two separate `useQuery` calls inside one exported hook** so each cache key invalidates independently per CONTEXT D-07 ("Decouples cache invalidation: today's-not-yet changes when a member submits; yesterday's-misses changes only at the next midnight rollover"):
- queryKey `['groupTombstones', groupId, 'today']` → calls `get_pending_today(groupId)`. Returns array of `{ user_id, display_name, avatar_path, updated_at }`.
- queryKey `['groupTombstones', groupId, 'yesterday']` → calls `get_missed_yesterday(groupId)`. Same row shape.
- Hook returns `{ pendingToday, missedYesterday }`.

`as unknown as Array<...>` narrowing for the RPC `data` shape (composite return types are typed loosely by supabase-js); same as `useReviewQueue`.

---

### `src/features/groups/useGroupSocialCounts.ts` (Today GroupCard signal-line counts)

**Analog:** `src/features/submissions/usePendingReviewCount.ts`

**Adaptation:** identical shape, swap RPC to `'get_today_posted_count'`. queryKey → `['todaySocialCounts', groupId]`. `staleTime: 15_000` (mirrors analog). Returns `number`. **No realtime hook here directly** — caller (Today screen `GroupCardRow`) pairs this with a separate per-group Realtime channel that invalidates this query key.

D-13's "M from group_members count" + "points/streak from leaderboard read for user's own row" is composed by the caller from this hook + `useGroupMembers` + `useGroupLeaderboard` — NOT bundled into a single super-hook (per CONTEXT D-07 separation principle and Pitfall 13 N+1 avoidance via per-key TanStack caching).

---

## Pattern Assignments — Components

### `src/components/leaderboard/LeaderboardRow.tsx`

**Analog:** `src/components/GroupCard.tsx` (composed row with Avatar + composite a11y label)

**Composite a11y + theme-token + Pressable pattern** (lines 45-69, 145-159, 259-303):
```tsx
function compositeA11yLabel(args: {...}): string {
  // Builds a single descriptive sentence for screen readers — ~70 chars.
  return `${args.name} group, ${kindLabel}, ${statusLabel}${trailing}`;
}

export function GroupCard({ ... }: GroupCardProps) {
  const t = useTheme();
  ...
  const a11yLabel = compositeA11yLabel({ name, kind, status, ... });
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
      style={{
        backgroundColor: t.colors.surface,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        padding: t.spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.md }}>
        <Text style={[t.fonts.heading2, { color: t.colors.textStrong, flex: 1 }]} numberOfLines={1}>{name}</Text>
        ...
      </View>
    </View>
  );
}
```

**Adaptation:** No card-shaped surface — leaderboard rows live inside a section "card" that wraps all 5 rows. Each `LeaderboardRow` is a plain `<View>` with horizontal flexbox. Anatomy per UI-SPEC §"Component Additions §1":
- 24pt rank chip (rank 1: `--primary` bg + `--primary-fg`; ranks 2-3: `--surface-muted` bg + `--text`; rank 4+: `--surface-muted` bg + `--text-muted`). Caption-700 tabular-nums.
- 36pt `<Avatar name={display_name ?? '?'} imageUri={avatarUrlFor(avatar_path, updated_at)} size={36} />` (reuse from `Avatar.tsx` — `size` prop already supports 36).
- Name + "(you)" appendix in Body-700 / Body-500 muted (UI-SPEC Typography table line 148-149).
- Streak + "joined Apr 3" meta line in Caption-500 muted, with `🔥` emoji + tabular-nums streak count.
- Right-aligned points number in **20pt / 800-weight / tabular-nums** + "pts" Caption-500 muted directly below (the Locked Exception §1 in UI-SPEC §Typography for 800-on-non-Display).
- Composite a11y label: `"Rank ${rank}, ${display_name}${isYou ? ' (you)' : ''}, ${points} points, current streak ${current_streak}"`.
- Use theme tokens throughout — never hardcode color/spacing.

**Avatar URL builder pattern** — copy from `app/(app)/groups/[id]/index.tsx` lines 56-64:
```ts
function avatarUrlFor(path: string | null | undefined, updatedAt?: string | null): string | null {
  if (!path) return null;
  const base = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  return updatedAt ? `${base}?v=${encodeURIComponent(updatedAt)}` : base;
}
```
WR-01 cache-bust idiom — apply identically here.

---

### `src/components/feed/FeedItem.tsx`

**Analog:** `src/components/SwipeCard.tsx` (avatar + media + caption + signed URL + video player)

**Signed URL hook + video player pattern** (lines 44-108):
```tsx
function useSignedMediaUrl(path: string) {
  return useQuery({
    queryKey: ['signedUrl', path],
    staleTime: 50_000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from('submissions').createSignedUrl(path, 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function SwipeCard({ ... }: SwipeCardProps) {
  const { data: signedUrl } = useSignedMediaUrl(media_path);
  // Autoplay-muted-loop video. useVideoPlayer must be called unconditionally.
  const player = useVideoPlayer(
    media_type === 'video' && signedUrl ? signedUrl : '',
    (p) => { p.muted = true; p.loop = true; p.play(); },
  );
  ...
}
```

**Adaptation (D-11 + UI-SPEC §Component Additions §2):**
- Reuse `useSignedMediaUrl` verbatim (consider promoting to `src/features/submissions/useSignedMediaUrl.ts` if planner wants — currently inlined in SwipeCard).
- 48pt Avatar + name + relative time + 80×80 media thumbnail + optional 2-line caption.
- Video posts: use `useVideoPlayer` + `<VideoView />` muted+looping at 80×80 (same defaults as SwipeCard line 101-108). For photos: `<Image source={{uri: signedUrl}} />` with `expo-image`.
- Video play badge: 20pt circle absolute-positioned bottom-right of thumbnail, with 10pt `play` Feather glyph (UI-SPEC §Spacing line 97).
- Tap thumbnail → existing fullscreen viewer (per D-11; planner identifies the existing fullscreen route — likely the same media path used in `app/(app)/groups/[id]/review.tsx`).
- Caption: 2-line truncate with `numberOfLines={2}` + ellipsis (UI-SPEC line 159, NOT italic — italic+curly-quotes is reserved for SwipeCard captions per P3).
- Time label uses `submittedAgoLabel(created_at)` from `src/features/submissions/time.ts` lines 132-142.

---

### `src/components/feed/StillToPostAvatarRow.tsx`

**Analog:** `src/components/Avatar.tsx` + the `MemberRowItem` composition pattern visible in `app/(app)/groups/[id]/index.tsx`

**Avatar primitive (verbatim consumption)** (lines 13-37 of `Avatar.tsx`):
```tsx
export function Avatar({ name, imageUri, size = 64, accessibilityLabel }: Props) {
  const t = useTheme();
  if (imageUri) {
    return (
      <View accessibilityRole="image" accessibilityLabel={...}
        style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: t.colors.surfaceMuted }}>
        <Image source={{ uri: imageUri }} style={{ width: size, height: size }} contentFit="cover" />
      </View>
    );
  }
  return <AvatarInitials name={name} size={size} />;
}
```

**Adaptation (UI-SPEC §Spacing lines 98-101):**
- 32pt `<Avatar size={32} />` with overlapping arrangement: `marginLeft: -8` on every avatar after the first (`-space-x-2` Lovable utility).
- 2px `borderColor: t.colors.surface` ring around each overlapping avatar (`ring-2 ring-surface`) — set on the outer `<View>` wrapping each Avatar.
- Overflow chip at +N: 32pt circle with `t.colors.surfaceMuted` background, `+N` body in tabular-nums Caption-700 (UI-SPEC §Spacing line 101).
- Comma-list of first names below the avatar row in Body-500 muted with middot separators (UI-SPEC Typography line 161).
- Cutoff inline ("9:00 PM cutoff") via Feather `clock` 12pt + Caption-500 muted (UI-SPEC line 162).
- a11y: single composite label `"Still to post today: ${name1}, ${name2}, and ${count - 2} more"` — single screen-reader sentence, NOT a list.
- Receives data from `useGroupTombstones(groupId).pendingToday`.

---

### `src/components/feed/MissedYesterdayRow.tsx` (tombstone row)

**Analog:** same as StillToPostAvatarRow (`Avatar.tsx`) + `StatusPill.tsx` for the "muted/quiet pill" aesthetic precedent

**StatusPill muted-aesthetic reference** (lines 47-71 of `StatusPill.tsx` for `'pending'` variant):
```tsx
return (
  <View
    accessibilityRole="text"
    accessibilityLabel="Pending review"
    style={[
      baseStyle,
      {
        backgroundColor: t.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: t.colors.border,
      },
    ]}
  >
    <Feather name="clock" size={12} color={t.colors.text} />
    <Text style={[t.fonts.caption, { color: t.colors.text, fontWeight: '500' }]}>
      Pending review
    </Text>
  </View>
);
```

**Adaptation (UI-SPEC §Spacing lines 102-104, §Color "Destructive Reserved-For List" lines 187-194):**
- Container: `--surface-muted` at 40% alpha (`'66'` hex suffix per UI-SPEC token mapping table line 42), `borderRadius: t.radii.md`, `padding: t.spacing.md`.
- Wrap-row of "tombstone chips": 28pt Avatar (Locked Exception §1, off-grid by avatar convention) + first name in Body-500 muted.
- Trailing micro-copy "Streaks reset at 12:00 AM PT" in Caption-500 muted with `mt-2` (8pt) gap below the chip row (UI-SPEC line 163).
- **NEVER use `--destructive` color** — UI-SPEC §Color Destructive Reserved-For List explicitly forbids red tombstones. Tone: factual, not punitive.
- Receives data from `useGroupTombstones(groupId).missedYesterday`.

---

## Pattern Assignments — Screen Integrations (Modifications)

### `app/(app)/groups/[id]/index.tsx` (modified)

**Analog:** self — extend the existing `<ScrollView contentContainerStyle={{ paddingBottom: ..., gap: t.spacing.xl }}>` (lines 323-327) with four new sections.

**Insertion landmark — current section order** (around lines 325-518):
```tsx
<ScrollView contentContainerStyle={{ paddingBottom: t.spacing['2xl'], gap: t.spacing.xl }}>
  {/* Header block — name, goal, member count chip, type, tz */}    // lines 329-355
  {/* Transfer success / post-create / regen banners */}            // lines 358-390
  {/* PendingReviewRow — admin-only */}                              // lines 396-444
  {/* Admin invite panel */}                                         // lines 447-479
  {/* Members section */}                                            // lines 481-518
  {/* Bottom destructive zone */}                                    // lines 520-555
</ScrollView>
```

**Adaptation (D-09 — final section order):**
Insert four new sections AFTER the Header block (line 355) and BEFORE the existing PendingReviewRow + InvitePanel + Members + DestructiveZone (the new content goes inside the existing ScrollView's `gap: t.spacing.xl`):

```tsx
<ScrollView contentContainerStyle={{ paddingBottom: t.spacing['2xl'], gap: t.spacing.xl }}>
  {/* Header block — UNCHANGED */}

  {/* NEW: Leaderboard section — useGroupLeaderboard + useGroupLeaderboardRealtime,
      top-5 with tap-to-expand, render LeaderboardRow per row */}

  {/* NEW: Today's posts (FEED-01) — useGroupFeed + useGroupFeedRealtime, FeedItem per row,
      empty state with dashed border per UI-SPEC line 167 */}

  {/* NEW: Still to post (FEED-02) — useGroupTombstones.pendingToday → StillToPostAvatarRow */}

  {/* NEW: Missed yesterday (FEED-03) — useGroupTombstones.missedYesterday → MissedYesterdayRow */}

  {/* PendingReviewRow — UNCHANGED, admin-only */}
  {/* Admin invite panel — UNCHANGED */}
  {/* Members section — UNCHANGED */}
  {/* Bottom destructive zone — UNCHANGED */}
</ScrollView>
```

**Realtime channels at the screen scope** — added near top of component body (after existing `useGroup`, `useGroupMembers`, `useActiveInvite` hooks at lines 85-87):
```ts
useGroupLeaderboardRealtime(id);  // patches ['leaderboard', id]
useGroupFeedRealtime(id, today);  // patches ['groupFeed', id, today] + invalidates ['leaderboard', id]
```
Both hooks use `useFocusEffect` internally, so navigating away from the screen tears the channels down (Pitfall 11). Mirrors the `useTodaySubmissionRealtime(user?.id, getGroupTzs)` call at `app/(app)/index.tsx` line 74.

**Section header pattern** — reuse the existing Members header (lines 482-490):
```tsx
<View>
  <Text style={[t.fonts.caption, { color: t.colors.textMuted, marginBottom: t.spacing.md }]}>
    {`Members (${members.length})`}
  </Text>
  ...
</View>
```
Adapt for "Leaderboard", "Today's posts (N)", "STILL TO POST" (uppercase + letterSpacing per UI-SPEC line 147), "MISSED YESTERDAY".

---

### `src/components/GroupCard.tsx` (modified)

**Analog:** self — extend the existing 5-row stack with a new ROW 6 below the existing InlineQueueBadge (lines 92-143).

**InlineQueueBadge insertion pattern** (lines 92-143 of GroupCard.tsx) — the analog for "an additive bottom row separated by a 1px divider":
```tsx
function InlineQueueBadge({ queuedUploadSize, onMorePress }: InlineQueueBadgeProps) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Upload pending — ${queuedUploadSize} queued`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.sm,
        marginTop: t.spacing.md,
        paddingTop: t.spacing.md,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
      }}
    >
      <Feather name="upload-cloud" size={16} color={t.colors.textMuted} />
      <Text style={[t.fonts.caption, { color: t.colors.textMuted, fontWeight: '500', flex: 1 }]} numberOfLines={1}>
        {`Upload pending — ${queuedUploadSize} queued`}
      </Text>
      ...
    </View>
  );
}
```

**Adaptation (D-13/D-14 + UI-SPEC §Typography line 164):**
Add new props to `GroupCardProps` (lines 28-43):
```ts
postedToday?: number;          // N
membersCount?: number;          // M
userPoints?: number;            // X
userStreak?: number;            // streak count
```
Add new `InlineSocialSignal` private component matching the InlineQueueBadge top-divider pattern verbatim (`marginTop: t.spacing.md`, `paddingTop: t.spacing.md`, `borderTopWidth: 1`, `borderTopColor: t.colors.border`). Render either `${N}/${M} posted today · ${X} pts · 🔥${streak}` (Caption-500 muted with tabular-nums fragments per UI-SPEC line 164) or empty variant `0/${M} posted · be the first` (with "be the first" in Caption-700 `--text` per UI-SPEC line 164).

Insert after ROW 5 (the existing InlineQueueBadge at line 336-341). Composite a11y label (`compositeA11yLabel` at lines 45-69) needs an additional appendix for the social-signal counts.

**No animation by default** (CONTEXT Claude's Discretion + UI-SPEC §"Realtime status-change copy" — instant text swap, no fade) — explicitly do NOT extend the existing 125ms cross-fade `Animated.sequence` (lines 162-183) to wrap the new row.

---

### `app/(app)/index.tsx` Today screen (modified)

**Analog:** self — the existing `GroupCardRow` inner component at lines 287-342 already calls per-group hooks (`useTodaySubmission`, `useUploadQueue`) inside the FlatList row context. Extend the same pattern.

**GroupCardRow inner-component pattern** (lines 287-342):
```tsx
function GroupCardRow({
  group,
  onSubmitPress,
  onRejectedPillPress,
  onQueueBadgeMorePress,
}: { group: GroupsListRow; ... }) {
  const today = useMemo(() => todayLocalDate(group.timezone, new Date()), [group.timezone]);
  const { data: submission } = useTodaySubmission(group.id, today);
  const { data: queueMap } = useUploadQueue();
  const queueSummary = queueMap?.get(group.id);
  ...
  return (
    <GroupCard
      groupId={group.id}
      name={group.name}
      ...
    />
  );
}
```

**Adaptation (D-13/D-15):**
Inside `GroupCardRow`, add three additional hook calls (preserving fixed hook order — Rules of Hooks per the comment at line 17-20):
```ts
const { data: postedToday } = useGroupSocialCounts(group.id);   // RPC: get_today_posted_count
const { data: members } = useGroupMembers(group.id);            // for M
const { data: leaderboard } = useGroupLeaderboard(group.id);    // for user's own row → points + streak
useGroupLeaderboardRealtime(group.id);                          // per-card Realtime channel for the LB row
```
The `useGroupLeaderboardRealtime` call adds a per-group channel ALONGSIDE the existing per-user channel `useTodaySubmissionRealtime(user?.id, getGroupTzs)` at line 74 — verifying Pitfall 4 (per-group, not global) and Pitfall 11 (cleanup on blur via the hook's internal `useFocusEffect`).

Pass the four new props through to `<GroupCard postedToday={postedToday} membersCount={members?.length} userPoints={...} userStreak={...} />`.

**N+1 / hook-explosion guardrail:** each `GroupCardRow` instance is one FlatList row, so RN re-renders one row at a time on prop change. The four new hooks add 3 GET calls + 1 channel subscription per visible card; for a typical user with 1–3 groups this is 3–12 calls on mount, well within the budget. Pitfall 13 (leaderboard N+1) is avoided because each hook's queryKey is stable per groupId and TanStack dedupes across `GroupCardRow` instances.

---

## Pattern Assignments — Auto-Regenerated

### `src/types/database.ts` (regenerated)

**Not hand-edited.** Regenerate via `pnpm types:gen` after the 0008 migration is applied locally. The file picks up:
- `handle_submission_approval` body change → no signature change → no type diff (it's a trigger fn, not a callable RPC).
- New RPCs: `get_pending_today`, `get_missed_yesterday`, `get_today_posted_count`, optionally `get_group_leaderboard` → adds entries under `Database.public.Functions`.
- Optional new composite type `public.leaderboard_row` (if planner picks the RPC path) → adds entry under `Database.public.CompositeTypes`.

**No analog needed.** The regeneration is mechanical; just note the regen step in the plan as a blocking checkpoint between migration-apply and hook-implementation.

---

## Shared Patterns

### Authentication / Membership Gates (server-side)

**Source:** `supabase/migrations/0001_foundation.sql` lines 199-227 (`is_group_member`, `is_group_admin` helpers)
**Apply to:** every Phase 4 RPC

```sql
create or replace function public.is_group_member(g uuid)
returns boolean language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = g and user_id = auth.uid()
  );
$$;
```

All four P4 RPCs gate on `is_group_member(p_group_id)` (NOT `is_group_admin` — leaderboard/feed/tombstones are member-readable). The lenient `get_today_posted_count` returns 0 for non-members; the strict trio (`get_pending_today`, `get_missed_yesterday`, `get_group_leaderboard`) raises typed `not_member` errors.

### RPC Permission Boilerplate

**Source:** every RPC in `supabase/migrations/0006_phase3_capture_review.sql` (lines 148-149, 216-217, 244-245, 326-327)
**Apply to:** every new RPC in 0008

```sql
revoke execute on function public.<rpc_name>(<args>) from public;
grant  execute on function public.<rpc_name>(<args>) to authenticated;
```

Always paired, in this order, immediately after the `$$;` closing the function body. CI's RLS-check workflow expects this discipline.

### Typed Error Convention

**Source:** every typed-error RPC in `0006` (e.g. lines 102-103)
**Apply to:** all P4 RPCs that raise (`get_pending_today`, `get_missed_yesterday`, `get_group_leaderboard`)

```sql
raise exception '<typed_code>' using errcode = 'P0001';
```

The error message IS the typed code. Clients string-match on `error.message` to map to user-facing copy. Phase 4 typed codes per RESEARCH §Pattern 2: `not_authenticated`, `not_member`, `group_not_found`. (`get_today_posted_count` is lenient — no exceptions, returns 0.)

### Realtime Channel Lifecycle

**Source:** `src/features/submissions/useTodaySubmissionRealtime.ts` lines 35-92 (the canonical shape)
**Apply to:** `useGroupLeaderboardRealtime`, `useGroupFeedRealtime`, and the per-group channel added to Today's `GroupCardRow`

Invariants:
1. **`useFocusEffect`, NEVER `useEffect`** — tab navigation does not unmount the screen; `useEffect` cleanup leaks the channel forever.
2. **Single-column equality filter only** — `postgres_changes` doesn't support compound filters; narrow client-side in the handler.
3. **Channel name is per-screen-scoped** — `` `today-submissions:${userId}` ``, `` `group-lb:${groupId}` ``, `` `group-feed:${groupId}` `` — never global, never reused across screens.
4. **`as never` casts on the literal `'postgres_changes'` and the config object** — supabase-js's typed-channel-on enum doesn't accept the runtime literal; ESLint disallows `any`, so use `unknown` / `as never`.
5. **Cleanup returns `() => supabase.removeChannel(channel)`** inside the `useFocusEffect` callback.

### Theme Tokens

**Source:** every component under `src/components/`
**Apply to:** all four new components (`LeaderboardRow`, `FeedItem`, `StillToPostAvatarRow`, `MissedYesterdayRow`)

```ts
import { useTheme } from '../theme/useTheme';
const t = useTheme();
// then reference t.colors.* / t.fonts.* / t.spacing.* / t.radii.*
```

**Never hardcode** colors, spacing, radii, or font sizes. Two known exceptions on this codebase that DO hardcode:
- HSL alpha-suffix workaround for the destructive token: `'hsla(4, 78%, 56%, 0.15)'` (StatusPill line 102, ReviewPanel line 118). Phase 4 has **zero new destructive surfaces** per UI-SPEC §Color line 188-194 — do not introduce this idiom.
- 28pt tombstone avatar diameter (Locked Exception §1) — pass `<Avatar size={28} />` directly; the `Avatar` primitive already accepts arbitrary `size` props.

### Avatar URL Resolution + Cache Bust

**Source:** `app/(app)/groups/[id]/index.tsx` lines 56-64 (`avatarUrlFor`)
**Apply to:** `LeaderboardRow`, `FeedItem`, `StillToPostAvatarRow`, `MissedYesterdayRow` (every surface that renders user avatars)

```ts
function avatarUrlFor(path: string | null | undefined, updatedAt?: string | null): string | null {
  if (!path) return null;
  const base = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  return updatedAt ? `${base}?v=${encodeURIComponent(updatedAt)}` : base;
}
```

WR-01 cache-bust idiom — without it, the stable `{userId}/avatar.jpg` storage path serves a stale image after avatar update. All four new components consume `avatar_path` + `updated_at` from their respective hooks (the RPCs return both fields). Consider promoting `avatarUrlFor` to a shared helper in `src/lib/` (currently inlined in 2 places already; planner's call).

### TanStack Query Key Conventions

**Source:** `src/features/groups/useGroupMembers.ts` line 23, `src/features/submissions/useTodaySubmission.ts` line 32, `src/features/submissions/usePendingReviewCount.ts` line 14
**Apply to:** all four new hooks

Patterns observed:
- `['group', groupId, 'members']` — entity-noun + id + sub-noun
- `['submission', groupId, todayLocalDate]` — date-aware where midnight rotation matters
- `['pendingReviewCount', groupId]` — flat noun for simple scalars
- `['reviewQueue', groupId]` — flat noun for collections

Phase 4 query keys (proposed):
- `['leaderboard', groupId]` — collection
- `['groupFeed', groupId, todayLocalDate]` — date-aware (midnight rotation safety per `useTodaySubmission` precedent)
- `['groupTombstones', groupId, 'today']` and `['groupTombstones', groupId, 'yesterday']` — independent invalidation per CONTEXT D-07
- `['todaySocialCounts', groupId]` — flat scalar

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/types/database.ts` | Type artifact | n/a | Auto-regenerated via `pnpm types:gen`. Never hand-edited. |

All other Phase 4 files have at least one strong analog in the existing codebase. The `useGroupLeaderboardRealtime` and `useGroupFeedRealtime` hooks have a single canonical analog (`useTodaySubmissionRealtime`); the four pgTAP files share two analogs (`get_pending_review_count.sql` for permissions + `get_pending_review_queue.sql` / `submissions_admin_immutable.sql` for correctness). The planner can reference these analogs directly in plan action sections.

---

## Metadata

**Analog search scope:**
- `supabase/migrations/` — all 7 shipped migrations (0001–0007)
- `supabase/tests/` — all 17 shipped pgTAP files
- `src/features/groups/` — all 16 shipped hooks/utilities
- `src/features/submissions/` — all 11 shipped hooks/utilities
- `src/components/` — all 24 shipped primitives
- `app/(app)/` — Today screen, Groups list, Group-detail, Profile
- `src/lib/` — Supabase client singleton

**Files scanned:** ~85 across SQL, TS, TSX
**Pattern extraction date:** 2026-05-08

---

## PATTERN MAPPING COMPLETE
