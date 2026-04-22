# Architecture Research

**Domain:** Mobile social accountability app (Expo + Supabase)
**Researched:** 2026-04-21
**Confidence:** HIGH (stack-level patterns verified against official Supabase + Expo docs)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    CLIENT (Expo React Native)                     │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │
│  │ Screens  │ │ Camera   │ │ Deep     │ │ Notifications      │   │
│  │ (expo-   │ │ Capture  │ │ Linking  │ │ (expo-notifications│   │
│  │  router) │ │          │ │          │ │  + token registry) │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────────┬──────────┘   │
│       │            │            │                  │              │
│  ┌────┴────────────┴────────────┴──────────────────┴──────────┐   │
│  │          Data Layer: TanStack Query + Supabase JS           │   │
│  │     (auth session, REST/PostgREST, Storage, Realtime)       │   │
│  └──────────────────────────────┬──────────────────────────────┘   │
└─────────────────────────────────┼──────────────────────────────────┘
                                  │ HTTPS / WSS
┌─────────────────────────────────┴──────────────────────────────────┐
│                       SUPABASE (managed)                            │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ Auth     │  │ PostgREST│  │ Realtime │  │ Storage          │    │
│  │ (GoTrue) │  │ (auto    │  │ (Postgres│  │ (S3 + signed     │    │
│  │          │  │  REST)   │  │  CDC→WS) │  │  URLs, RLS)      │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────────┬────────┘    │
│       │             │             │                   │             │
│  ┌────┴─────────────┴─────────────┴───────────────────┴────────┐   │
│  │                   Postgres 15 (single DB)                    │   │
│  │   tables + RLS policies + triggers + pg_cron + pg_net        │   │
│  │   extensions: pgcrypto, pg_cron, pg_net                      │   │
│  └──────────────────────────────┬───────────────────────────────┘   │
│                                 │                                   │
│  ┌──────────────────────────────┴───────────────────────────────┐   │
│  │            Edge Functions (Deno) — stateless workers          │   │
│  │   push-dispatch · daily-rollover · invite-redeem · media-     │   │
│  │   moderation (future)                                         │   │
│  └──────────────────────────────┬───────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                         ┌────────┴────────┐
                         ▼                 ▼
                  ┌──────────────┐  ┌──────────────┐
                  │ Expo Push    │  │ Universal    │
                  │ Service      │  │ Links (AASA  │
                  │ → APNs/FCM   │  │  / assetlinks│
                  └──────────────┘  └──────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| expo-router screens | Navigation + UI | File-based routing under `app/` |
| Supabase client | Auth session, queries, RPC, realtime, storage | `@supabase/supabase-js` v2, session in SecureStore |
| TanStack Query | Server-state cache, retries, optimistic updates | `@tanstack/react-query` |
| Postgres (RLS) | Source of truth + authorization | Policies per table, `auth.uid()` |
| Storage buckets | Media for submissions + avatars | Private bucket `submissions`, public `avatars` |
| Realtime | Live leaderboard, pending queue, new submissions | Postgres changes subscription per group |
| Edge Functions | Things RLS cannot do: push fanout, invite join with side-effects, cron work | Deno runtime, `service_role` key |
| pg_cron + pg_net | Scheduled work (minute-level rollover sweep) | Calls edge function or SQL proc |
| Expo Push Service | Fan-out to APNs / FCM | Edge fn POSTs to `exp.host/--/api/v2/push/send` |
| Deep links | Invite redemption, notification taps | Universal Links (iOS AASA) + App Links (Android) |

## Recommended Project Structure

```
accountibuzz/
├── app/                          # expo-router (file-based routes)
│   ├── (auth)/
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # "Today" — submit or see status
│   │   ├── leaderboard.tsx
│   │   └── profile.tsx
│   ├── group/
│   │   ├── [id]/index.tsx        # group home
│   │   ├── [id]/review.tsx       # admin verification queue
│   │   └── new.tsx               # create group
│   ├── invite/
│   │   └── [code].tsx            # deep-link target
│   └── _layout.tsx               # Providers: QueryClient, Auth, Realtime
├── src/
│   ├── lib/
│   │   ├── supabase.ts           # singleton client + SecureStore adapter
│   │   ├── queryClient.ts
│   │   └── time.ts               # tz helpers (Luxon)
│   ├── features/
│   │   ├── auth/                 # hooks, session provider
│   │   ├── groups/               # useGroup, useMembers, mutations
│   │   ├── submissions/          # useToday, useSubmit, upload flow
│   │   ├── review/               # admin queue hooks
│   │   ├── leaderboard/          # live subscription hook
│   │   └── notifications/        # token registration, tap handling
│   ├── components/               # shared UI
│   └── types/
│       └── database.ts           # supabase-gen types
├── supabase/
│   ├── migrations/               # SQL, numbered
│   ├── functions/
│   │   ├── push-dispatch/
│   │   ├── daily-rollover/
│   │   ├── invite-redeem/
│   │   └── _shared/
│   ├── seed.sql
│   └── config.toml
├── app.config.ts                 # Expo config (scheme, associated domains)
└── eas.json
```

### Structure Rationale

- **`app/` vs `src/features/`:** expo-router owns routing only. Domain logic (hooks, queries, mutations) lives in `src/features/<domain>/` so it is reusable across screens and easy to test without navigation.
- **`supabase/` co-located:** Migrations and edge functions live in the repo; `supabase db push` and `supabase functions deploy` are the entire deploy pipeline.
- **Feature folders, not type folders:** Avoid `hooks/`, `services/`, `utils/` at the top level — they fragment a single feature across the tree.

## Data Model (Postgres)

All tables use `uuid` primary keys (`gen_random_uuid()`), `created_at timestamptz default now()`, and are protected by RLS.

```sql
-- Profiles mirror auth.users; created by trigger on signup.
profiles (
  id uuid PK references auth.users on delete cascade,
  display_name text not null,
  avatar_url text,
  expo_push_token text,           -- nullable; updated from client
  created_at timestamptz
)

groups (
  id uuid PK,
  name text not null,
  goal_description text not null,
  submission_type text not null check (submission_type in ('photo','video')),
  timezone text not null,         -- IANA, e.g. 'America/Los_Angeles'
  admin_id uuid not null references profiles(id),
  invite_code text unique not null,   -- short, url-safe (nanoid, 8 chars)
  created_at timestamptz
)
-- index: groups(invite_code), groups(admin_id)

group_members (
  group_id uuid references groups on delete cascade,
  user_id  uuid references profiles on delete cascade,
  joined_at timestamptz,
  role text not null default 'member' check (role in ('member','admin')),
  points int not null default 0,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_verified_local_date date,   -- group-local date of last verified submission
  PRIMARY KEY (group_id, user_id)
)
-- index: group_members(group_id, points desc) for leaderboard
-- index: group_members(user_id)

submissions (
  id uuid PK,
  group_id uuid references groups on delete cascade,
  user_id  uuid references profiles on delete cascade,
  local_date date not null,        -- group-local date the submission counts for
  media_path text not null,        -- storage path in `submissions` bucket
  media_type text not null check (media_type in ('photo','video')),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz,
  UNIQUE (group_id, user_id, local_date) -- one submission per member per day
)
-- index: submissions(group_id, status, created_at desc)  -- review queue
-- index: submissions(group_id, local_date)               -- daily rollover

notifications_outbox (
  id uuid PK,
  user_id uuid references profiles(id),
  kind text not null,             -- 'reminder' | 'new_submission' | 'reviewed' | 'missed'
  payload jsonb not null,
  created_at timestamptz,
  sent_at timestamptz
)
-- index: notifications_outbox(sent_at) where sent_at is null
```

### Why This Shape

- **`local_date` stored as `date`:** Computed once at submit time from `now() AT TIME ZONE groups.timezone`. Avoids tz math on every read and gives a natural unique key.
- **Denormalized counters on `group_members`:** `points`, `current_streak`, `last_verified_local_date` update via trigger on `submissions.status` transitions. Reads for the leaderboard are a single indexed query — no aggregation on the hot path.
- **`notifications_outbox`:** Decouples domain writes from push delivery. A database webhook on insert triggers the `push-dispatch` edge function. Retry/backoff and dedupe live in Postgres.
- **Invite code on `groups`:** No separate `invites` table for MVP — one code per group, rotatable via admin mutation. Revisit if per-invite expiry is needed.

## RLS Policies

RLS is the single authorization layer. The client uses the anon key and relies on `auth.uid()`.

Helper SQL function (avoids repeating sub-selects and prevents RLS recursion):

```sql
create function public.is_group_member(g uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from group_members
                 where group_id = g and user_id = auth.uid());
$$;

create function public.is_group_admin(g uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from groups
                 where id = g and admin_id = auth.uid());
$$;
```

| Table | Select | Insert | Update | Delete |
|-------|--------|--------|--------|--------|
| `profiles` | own row + rows of groups you share | trigger from auth.users | own row | — |
| `groups` | members only; `invite_code` lookup via RPC (not table select) | any authenticated (creator becomes admin_id) | admin only | admin only |
| `group_members` | members of same group | via `invite-redeem` edge fn (service_role) | admin (role), system (counters via trigger) | admin (remove) or self (leave) |
| `submissions` | members of same group | own row, only if `submission_type` matches and not past cutoff | admin of group (status only) | — |
| `notifications_outbox` | own row | service_role only | service_role only | — |

**Critical policy details:**

- **Invite code lookup cannot be a plain select** on `groups` (would require a policy that leaks group rows). Use a `security definer` RPC `redeem_invite(code text)` that validates and inserts into `group_members`.
- **`submissions.insert` policy** must enforce the cutoff in SQL: `current_date_in_tz(groups.timezone) = new.local_date`. Otherwise clients can backfill days.
- **Counter mutations** (`points`, `current_streak`) happen in triggers running as table owner; client update policy on `group_members` should NOT allow updating those columns.

## Supabase Storage

Two buckets:

| Bucket | Public | Contents | Path convention |
|--------|--------|----------|-----------------|
| `submissions` | **private** | daily photo/video proof | `{group_id}/{user_id}/{local_date}.{ext}` |
| `avatars` | public-read | profile pictures | `{user_id}.jpg` |

**`submissions` access rules (Storage RLS on `storage.objects`):**

- **Read:** allowed only if `is_group_member((storage.foldername(name))[1]::uuid)`. Client uses `createSignedUrl(path, 60)` — short-lived signed URLs. Never use public URLs.
- **Insert:** allowed if `auth.uid()::text = (storage.foldername(name))[2]` AND `is_group_member(...)`. Size/type limit set at bucket level (e.g. 30 MB, `image/*`, `video/mp4`).
- **Delete:** admin of the group only (for moderation) or owner-on-rejection.

**Upload flow:** client uploads directly to Storage (not through edge function) using the user's JWT; then inserts the `submissions` row referencing `media_path`. A trigger validates the path matches `group_id/user_id/local_date`.

## Realtime Subscriptions

Enable Realtime on `submissions` and `group_members`. Client subscribes per-group when a group screen mounts:

```ts
supabase.channel(`group:${groupId}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'submissions',
        filter: `group_id=eq.${groupId}` }, onSubmissionChange)
  .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'group_members',
        filter: `group_id=eq.${groupId}` }, onMemberChange)
  .subscribe();
```

- **Leaderboard:** lives off `group_members` UPDATE events (points/streak changes).
- **Admin review queue:** lives off `submissions` INSERT events where `status='pending'`.
- **Member feed ("Alex just posted"):** same `submissions` INSERT events.

Teardown on unmount — forgotten channels are the #1 realtime bug.

## Daily Rollover (Streak Reset)

**Problem:** At each group's local midnight, members who did not submit that day must have `current_streak` reset to 0. Groups span multiple timezones, so there is no single "midnight."

**Approach: minute-level sweep via pg_cron.**

```sql
-- Runs every 5 minutes; cheap because we index on (timezone, last_rolled_date).
select cron.schedule(
  'daily-rollover',
  '*/5 * * * *',
  $$ select public.rollover_groups(); $$
);
```

`rollover_groups()` is a plpgsql procedure that:

1. Computes `current_local_date` for each distinct `timezone` in `groups`.
2. For each group where `last_rolled_date < current_local_date - 1` (i.e. a new local day has started and we haven't rolled yet):
   - For each member: if no `approved` submission exists for yesterday's `local_date`, set `current_streak = 0` and insert a `notifications_outbox` row (`kind='missed'`).
   - Update `groups.last_rolled_date = current_local_date`.
3. Idempotent — safe to run repeatedly within a day.

Add `groups.last_rolled_date date` to support this.

**Why pg_cron, not edge-function-on-schedule:** the work is pure SQL against the same database; pg_cron avoids a network hop and has no cold start. Edge-function schedules are appropriate only when the job needs external network access (push dispatch is separate — see next).

**Pre-deadline reminder** (e.g., 3 hours before midnight): same pattern, different cron job, inserts `kind='reminder'` outbox rows for members with no submission yet.

## Push Notification Flow

```
  Domain event (e.g. submission inserted)
          │
          ▼
  Trigger inserts row into notifications_outbox
          │
          ▼
  Supabase Database Webhook (on INSERT, outbox)
          │
          ▼
  Edge Function: push-dispatch
    ├─ loads recipient profile.expo_push_token
    ├─ POST https://exp.host/--/api/v2/push/send
    │     with EXPO_ACCESS_TOKEN in header (enhanced security)
    │     batch up to 100 messages per call
    ├─ writes sent_at = now() on outbox row
    └─ on failure: leaves sent_at null; a retry cron picks it up
```

**Client side:**

1. On login, request permissions via `expo-notifications`, call `getExpoPushTokenAsync({ projectId })`.
2. Upsert `profiles.expo_push_token`. Re-check on every cold start (tokens rotate).
3. Register a `Notifications.addNotificationResponseReceivedListener` to deep-link into the relevant screen (review queue, group, etc.) based on `data` payload.
4. Do not ship raw FCM/APNs integration — Expo's push service abstracts both.

**Notification kinds (payload-driven routing):**
| Kind | Trigger | Target | Deep link |
|------|---------|--------|-----------|
| `reminder` | cron, N hours before local midnight | members with no submission today | `/(tabs)` |
| `new_submission` | trigger on submissions insert | all group members except submitter | `/group/[id]` |
| `reviewed` | trigger on submissions status change | submission owner | `/group/[id]` |
| `missed` | daily-rollover | member whose streak just reset | `/(tabs)` |

## Deep-Link Invite Flow

**Link shapes:**

- Universal Link (iOS) / App Link (Android): `https://accountibuzz.app/invite/{code}`
  - Requires `apple-app-site-association` at `/.well-known/` and `assetlinks.json` for Android.
  - Configure in `app.config.ts` via `ios.associatedDomains` and `android.intentFilters`.
- Fallback custom scheme for dev: `accountibuzz://invite/{code}`

**Redemption flow:**

```
User taps link
   │
   ▼
OS routes to app (installed) OR app store (not installed, iOS)
   │
   ▼
expo-router matches /invite/[code].tsx
   │
   ├─ not signed in → store code, send to sign-up, replay after auth
   └─ signed in → call RPC redeem_invite(code)
              │
              ▼
        security definer fn:
          - finds group by invite_code
          - inserts group_members row if not present
          - returns group_id
   │
   ▼
Navigate to /group/[id]
```

Store the pending invite code in `expo-secure-store` during the auth detour so a fresh install → sign-up → auto-join works.

## Client-Side State Management

Three-tier model, no Redux/Zustand for server data:

1. **Auth session:** React Context around `supabase.auth.onAuthStateChange`. Single source for "am I signed in."
2. **Server state:** TanStack Query. Every query key includes `groupId` / `userId` so cache invalidation is scoped. Mutations do optimistic updates for submission creation and admin approval (biggest UX wins).
3. **Realtime → query cache:** Realtime subscription handlers call `queryClient.setQueryData` / `invalidateQueries`. Do not build a parallel event-bus state layer.
4. **Local UI state:** plain `useState` / `useReducer`. Anything that survives unmount (draft submission, pending invite) → `expo-secure-store`.

## Data Flow: Key Scenarios

**Submit today's proof:**
```
Camera screen captures → upload to storage (bucket: submissions, path includes group_id/user_id/local_date)
  → insert submissions row (status=pending)
  → trigger enqueues notifications_outbox(new_submission) for all members
  → Realtime UPDATE fires on admin's device → badge on review tab
  → Database webhook fires push-dispatch edge function → Expo Push → devices
```

**Admin approves:**
```
Admin taps Approve → UPDATE submissions SET status='approved', reviewed_by, reviewed_at
  → trigger: UPDATE group_members
       SET points = points + 1,
           current_streak = CASE
             WHEN last_verified_local_date = submissions.local_date - 1
                  THEN current_streak + 1 ELSE 1 END,
           last_verified_local_date = submissions.local_date
  → Realtime UPDATE on group_members fires for all subscribed clients → leaderboard reorders
  → notifications_outbox(reviewed) → push to submitter
```

## Build Order

Ordered by dependency; each step is demoable.

1. **Auth + profile bootstrap.** Supabase project, `profiles` table + trigger on `auth.users`, Expo auth screens with SecureStore session persistence. Gate: can sign up, sign in, see own profile.
2. **Groups + membership (no submissions yet).** `groups`, `group_members`, RLS, create-group screen, members list. Gate: two devices can be in the same group via manual DB insert.
3. **Invite flow.** `invite_code` on groups, `redeem_invite` RPC, universal links, `/invite/[code].tsx` screen. Gate: share a link on device A, tap on device B, land in group.
4. **Submissions (happy path, no review).** `submissions` table, storage bucket + RLS, camera capture, upload, list-for-today. Defer cutoff enforcement to step 5. Gate: member can post once per day.
5. **Timezone + cutoff enforcement.** `local_date` computation, unique constraint, insert-time cutoff policy. Gate: cannot submit twice same local day, cannot backfill.
6. **Admin review + counters.** Review queue screen, status update mutation, trigger that updates `group_members.points` / `current_streak`. Gate: approve → leaderboard moves.
7. **Realtime.** Subscribe on group screen + review queue. Gate: device A posts, device B sees it without refresh.
8. **Leaderboard screen.** Read off `group_members`, ordered by points then streak. Gate: rank updates live.
9. **Push infrastructure.** Expo token registration, `notifications_outbox`, `push-dispatch` edge function, database webhook. Gate: approving a submission pushes a notification to the submitter.
10. **Daily rollover + reminders.** `pg_cron` job, `rollover_groups()` procedure, pre-deadline reminder job. Gate: skipping a day resets streak at group-local midnight; reminder arrives 3h before.
11. **Notification deep-link routing.** Tap-to-screen handlers. Gate: tap "Alex was approved" push → land on that group.
12. **Polish: media moderation, reject UX, group settings.**

Steps 1–4 form a usable internal alpha; 5–8 make the core mechanic work; 9–10 make it socially sticky.

## Anti-Patterns

### Anti-Pattern 1: Computing timezone on the client and sending `local_date`

**What people do:** The client calculates today's local date and sends it with the submission.
**Why wrong:** Clients can lie; a clock-skewed device opens a backdating hole. Also means the submission-cutoff policy can't be enforced in RLS.
**Instead:** `local_date` is derived server-side in a BEFORE INSERT trigger from `now() AT TIME ZONE groups.timezone`. Client sends only `group_id` and media path.

### Anti-Pattern 2: Polling for leaderboard updates

**What people do:** `setInterval` refetch of points every 10s.
**Why wrong:** Battery, data, and a laggy feel. You paid for Realtime; use it.
**Instead:** Subscribe to `group_members` UPDATE filtered by `group_id`; patch TanStack Query cache in the handler.

### Anti-Pattern 3: Doing business logic in edge functions that could be RLS + triggers

**What people do:** An edge function that "creates a submission" — accepts JWT, validates, inserts, updates counters.
**Why wrong:** Two auth layers (JWT parsing + your own checks), cold starts, a second failure domain. RLS + triggers already give you atomicity and authorization.
**Instead:** Edge functions only for things RLS genuinely cannot do: external HTTP (Expo push), cross-user side effects that need `service_role`, scheduled/cron work.

### Anti-Pattern 4: One giant Realtime channel for the whole app

**What people do:** Subscribe to all tables at app boot.
**Why wrong:** Every user pays the bandwidth of every group. Doesn't scale and leaks context across groups.
**Instead:** Channel per active group, subscribed on screen focus, torn down on blur.

### Anti-Pattern 5: Public `submissions` bucket with obscure paths

**What people do:** Private photos in a public bucket, "nobody will guess the UUID."
**Why wrong:** URLs leak via screenshots, analytics, error reporters. Security-through-obscurity is not security.
**Instead:** Private bucket + storage RLS + short-lived signed URLs generated per view.

### Anti-Pattern 6: Using Firebase/APNs directly from an edge function

**What people do:** Skip Expo's push service, call FCM/APNs themselves.
**Why wrong:** Doubles the native integration surface (credentials for both platforms, token rotation, payload shape divergence).
**Instead:** Expo Push Service — it is the whole reason to pick Expo. One endpoint, one token type, same API for both OSes.

## Scaling Considerations

| Scale | Adjustments |
|-------|-------------|
| 0–1k users, <100 groups | Default Supabase plan. No changes. |
| 1k–50k users | Add read replicas if leaderboard reads dominate; move media to CDN in front of Storage; push-dispatch edge function already batches 100/call. |
| 50k+ users | Consider sharding `submissions` by month (partitioning); split `push-dispatch` into queue-backed workers via Supabase Queues; move rollover from 5-min sweep to per-timezone scheduled function. |

**First bottleneck in practice:** the daily rollover procedure if it locks `group_members` broadly. Mitigation: iterate per group with short transactions; rely on the `(group_id, user_id)` PK.

**Second bottleneck:** storage egress for video submissions. Mitigation: enforce `submission_type='photo'` as the default and cap video length at 15s client-side.

## Integration Points

### External Services

| Service | Integration | Notes |
|---------|-------------|-------|
| Expo Push Service | Edge function POST to `exp.host/--/api/v2/push/send` with `EXPO_ACCESS_TOKEN` | Enable "Enhanced Security for Push Notifications" on the Expo token |
| APNs / FCM | via Expo, not direct | Still need `eas credentials` setup once |
| Universal Links / App Links | `app.config.ts` + `/.well-known/` files on `accountibuzz.app` | Needs a hosted domain before step 3 of build order |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Client ↔ Postgres | PostgREST over HTTPS with user JWT | RLS is the authorization contract |
| Client ↔ Realtime | WSS with user JWT | Channel scoped per group |
| Client ↔ Storage | HTTPS multipart upload with user JWT | Direct, not proxied |
| Trigger ↔ Outbox ↔ Edge fn | DB webhook | Replaces app-layer pub/sub |
| pg_cron ↔ Edge fn | `pg_net.http_post` (only when external call needed) | Prefer pure-SQL cron when possible |

## Sources

- [Scheduling Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Cron (pg_cron) | Supabase Docs](https://supabase.com/docs/guides/cron)
- [pg_cron extension | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Sending Push Notifications | Supabase Docs](https://supabase.com/docs/guides/functions/examples/push-notifications)
- [Expo Push Notifications example (Supabase repo)](https://github.com/supabase/supabase/blob/master/examples/user-management/expo-push-notifications/README.md)
- [Using Supabase | Expo Documentation](https://docs.expo.dev/guides/using-supabase/)
- [expo-push-notifications with APNs + Supabase Edge Functions (launchtodayhq)](https://github.com/launchtodayhq/expo-push-notifications)

---
*Architecture research for: Accountibuzz (mobile accountability app)*
*Researched: 2026-04-21*
