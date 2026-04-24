# Roadmap: Accountibuzz

**Created:** 2026-04-21
**Granularity:** standard (5-8 phases)
**Core Value:** A missed day is visible to your group within hours — the social cost of skipping is what keeps you accountable.

## Phases

- [x] **Phase 1: Foundation** — Expo + Supabase scaffold, auth, profiles, schema, RLS, server-side timezone derivation
- [ ] **Phase 2: Groups & Invites** — Create groups, deep-link invite flow, membership
- [ ] **Phase 3: Capture & Admin Review** — Daily photo/video submissions with resilient upload + admin approval queue
- [ ] **Phase 4: Social Surfaces** — Live leaderboard, points/streaks, group feed with tombstones
- [ ] **Phase 5: Push & Daily Rollover** — EAS dev build, push notifications, pg_cron timezone-aware streak reset
- [ ] **Phase 6: Pre-Rollout Hardening** — Re-engagement flow, group-health view, onboarding polish, final RLS audit

## Phase Details

### Phase 1: Foundation
**Goal**: Identity, schema, and authorization are locked in — every subsequent phase builds on solid ground.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, PLAT-01, PLAT-02
**Success Criteria** (what must be TRUE):
  1. User can sign up with email/password and log into the Expo app on iOS and Android
  2. User session persists across app restarts (AsyncStorage + SecureStore hybrid)
  3. User can log out from the app
  4. User can create/edit a profile with display name and avatar
  5. Every public-schema table has RLS enabled, enforced by a CI check that fails builds otherwise
**Plans**: 6 plans
- [x] 01-01-PLAN.md — Expo scaffold + Supabase client singleton + encrypted session storage + Jest harness
- [x] 01-02-PLAN.md — Full Postgres schema migration + RLS + helpers + storage buckets + pgTAP + CI workflows + `supabase db push` [BLOCKING]
- [x] 01-03-PLAN.md — Theme tokens + ThemeProvider + 11 UI primitives (per 01-UI-SPEC.md)
- [x] 01-04-PLAN.md — Root layout + AuthProvider + four auth screens (login / signup / forgot / reset) with deep link
- [x] 01-05-PLAN.md — Profile screen (view / edit / onboarding) + avatar upload pipeline + logout
- [x] 01-06-PLAN.md — Types regen + README + manual iOS+Android walkthrough checkpoint
**UI hint**: yes

### Phase 2: Groups & Invites
**Goal**: Users can form the container for accountability — create a group and bring friends in via a shareable link.
**Depends on**: Phase 1
**Requirements**: GRP-01, GRP-02, GRP-03, GRP-04, GRP-05, INV-01, INV-02, INV-03
**Success Criteria** (what must be TRUE):
  1. User can create a group (name, goal, submission type photo|video, IANA timezone) and becomes its admin
  2. User can view the list of groups they belong to and drill into a group's details, members, and rules
  3. Admin can generate a shareable invite link/code; tapping it (or entering the code) joins the recipient to the group
  4. Group membership is capped at 10 members (soft cap enforced)
  5. User can leave a group they belong to
**Plans**: 7 plans
- [x] 02-01-PLAN.md — Wave 0: install expo-clipboard + expo-haptics, Jest mocks, Intl.supportedValuesOf probe
- [x] 02-02-PLAN.md — Migration 0004: 7 RPCs + helper + invite_preview type + policy drops + 8 pgTAP files + [BLOCKING] supabase db push + pnpm types:gen
- [x] 02-03-PLAN.md — Shared primitives: Zod schemas, formatInviteCode/timezones/shareInvite utils, 3 new RN components (SegmentedControl / InviteCodeChip / Modal), 5 read hooks + 6 RPC mutation hooks + usePendingInviteReplay
- [ ] 02-04-PLAN.md — Groups-list signed-in home + group-detail screen (invite panel + members + admin destructive zone + all 5 Modals)
- [ ] 02-05-PLAN.md — Create-group form + IanaTimezonePicker modal (Hermes iOS static fallback defense)
- [ ] 02-06-PLAN.md — Join-with-code screen + deep-link landing (/invite/[code].tsx) + root-layout usePendingInviteReplay wiring
- [ ] 02-07-PLAN.md — Phase verification: pnpm test:all + pnpm typecheck + expo-doctor + 11-checkpoint iOS UAT walkthrough
**UI hint**: yes

### Phase 3: Capture & Admin Review
**Goal**: The core accountability loop works — members submit daily proof, admin verifies, one submission per local day is enforced server-side.
**Depends on**: Phase 2
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04, SUB-05, SUB-06, ADM-01, ADM-02, ADM-03, ADM-04, PLAT-03
**Success Criteria** (what must be TRUE):
  1. Member can capture and upload the group's required media type (photo or video) before the group's local-midnight cutoff, with a short optional caption
  2. Upload survives flaky networks via resumable upload + offline queue, with explicit progress UI and no "silent success"
  3. Member sees their own submission status (pending / approved / rejected) and is blocked from submitting twice for the same local day
  4. Admin sees a swipe-style queue of pending submissions for groups they admin and can approve or reject (with optional reason) — RLS prevents non-admins from reviewing
  5. Rejected submitters are notified so they can resubmit before cutoff
**Plans**: 7 plans
- [x] 02-01-PLAN.md — Wave 0: install expo-clipboard + expo-haptics, Jest mocks, Intl.supportedValuesOf probe
- [x] 02-02-PLAN.md — Migration 0004: 7 RPCs + helper + invite_preview type + policy drops + 8 pgTAP files + [BLOCKING] supabase db push + pnpm types:gen
- [x] 02-03-PLAN.md — Shared primitives: Zod schemas, formatInviteCode/timezones/shareInvite utils, 3 new RN components (SegmentedControl / InviteCodeChip / Modal), 5 read hooks + 6 RPC mutation hooks + usePendingInviteReplay
- [ ] 02-04-PLAN.md — Groups-list signed-in home + group-detail screen (invite panel + members + admin destructive zone + all 5 Modals)
- [ ] 02-05-PLAN.md — Create-group form + IanaTimezonePicker modal (Hermes iOS static fallback defense)
- [ ] 02-06-PLAN.md — Join-with-code screen + deep-link landing (/invite/[code].tsx) + root-layout usePendingInviteReplay wiring
- [ ] 02-07-PLAN.md — Phase verification: pnpm test:all + pnpm typecheck + expo-doctor + 11-checkpoint iOS UAT walkthrough
**UI hint**: yes

### Phase 4: Social Surfaces
**Goal**: Verified submissions convert into visible social pressure — points, streaks, leaderboard, and today's group feed.
**Depends on**: Phase 3
**Requirements**: PTS-01, PTS-02, PTS-03, LB-01, LB-02, FEED-01, FEED-02, FEED-03
**Success Criteria** (what must be TRUE):
  1. Each approved submission awards 1 point and increments that member's streak in the group; points and streaks are derived server-side via triggers (never client-computed)
  2. Group leaderboard is ranked by total points, shows each member's current streak, and updates in near real time as submissions are approved (Supabase Realtime → TanStack Query cache patch)
  3. Group feed shows today's approved submissions for the group
  4. Feed surfaces which members have not submitted yet today, and shows missed-day tombstones for yesterday's misses
  5. Streak logic is consistent with the group's IANA timezone (server `local_date`, unique `(group_id, user_id, local_date)` constraint)
**Plans**: 7 plans
- [x] 02-01-PLAN.md — Wave 0: install expo-clipboard + expo-haptics, Jest mocks, Intl.supportedValuesOf probe
- [x] 02-02-PLAN.md — Migration 0004: 7 RPCs + helper + invite_preview type + policy drops + 8 pgTAP files + [BLOCKING] supabase db push + pnpm types:gen
- [x] 02-03-PLAN.md — Shared primitives: Zod schemas, formatInviteCode/timezones/shareInvite utils, 3 new RN components (SegmentedControl / InviteCodeChip / Modal), 5 read hooks + 6 RPC mutation hooks + usePendingInviteReplay
- [ ] 02-04-PLAN.md — Groups-list signed-in home + group-detail screen (invite panel + members + admin destructive zone + all 5 Modals)
- [ ] 02-05-PLAN.md — Create-group form + IanaTimezonePicker modal (Hermes iOS static fallback defense)
- [ ] 02-06-PLAN.md — Join-with-code screen + deep-link landing (/invite/[code].tsx) + root-layout usePendingInviteReplay wiring
- [ ] 02-07-PLAN.md — Phase verification: pnpm test:all + pnpm typecheck + expo-doctor + 11-checkpoint iOS UAT walkthrough
**UI hint**: yes

### Phase 5: Push & Daily Rollover
**Goal**: The "missed day is visible within hours" promise is infrastructurally real — timely pushes on both platforms and a DST-safe daily rollover.
**Depends on**: Phase 4
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, ROLL-01, ROLL-02
**Success Criteria** (what must be TRUE):
  1. App runs as an EAS development/production build with push entitlements on iOS and Android (Expo Go is no longer the target)
  2. Members receive a pre-deadline reminder push if they have not submitted, plus activity pings when other members post and when the admin reviews their submission
  3. Admin receives a push when a submission needs review
  4. At each group's local midnight, `pg_cron` rolls over the day — members without an approved submission have their streak reset and a tombstone is created; the job is idempotent and DST-safe
  5. Push delivery goes through the `notifications_outbox` → `push-dispatch` edge function → Expo Push Service flow (no direct APNs/FCM)
**Plans**: 7 plans
- [x] 02-01-PLAN.md — Wave 0: install expo-clipboard + expo-haptics, Jest mocks, Intl.supportedValuesOf probe
- [x] 02-02-PLAN.md — Migration 0004: 7 RPCs + helper + invite_preview type + policy drops + 8 pgTAP files + [BLOCKING] supabase db push + pnpm types:gen
- [x] 02-03-PLAN.md — Shared primitives: Zod schemas, formatInviteCode/timezones/shareInvite utils, 3 new RN components (SegmentedControl / InviteCodeChip / Modal), 5 read hooks + 6 RPC mutation hooks + usePendingInviteReplay
- [ ] 02-04-PLAN.md — Groups-list signed-in home + group-detail screen (invite panel + members + admin destructive zone + all 5 Modals)
- [ ] 02-05-PLAN.md — Create-group form + IanaTimezonePicker modal (Hermes iOS static fallback defense)
- [ ] 02-06-PLAN.md — Join-with-code screen + deep-link landing (/invite/[code].tsx) + root-layout usePendingInviteReplay wiring
- [ ] 02-07-PLAN.md — Phase verification: pnpm test:all + pnpm typecheck + expo-doctor + 11-checkpoint iOS UAT walkthrough

### Phase 6: Pre-Rollout Hardening
**Goal**: The app is ready for real friend-group testing — retention mechanics, admin health signals, and a final security pass are in place before anyone outside the builder touches it.
**Depends on**: Phase 5
**Requirements**: (none — hardening phase; reinforces PLAT-02, PLAT-03, and retention posture for all v1 requirements)
**Success Criteria** (what must be TRUE):
  1. A broken-streak member sees a gentle re-entry prompt on next app open ("X, Y, Z still posted — jump back in") without violating strict-reset
  2. Admin has a group-health view showing late-approver signal and missed-day rate per group
  3. Onboarding encourages inviting more than the target group size (7-10 for a target of 5-6) to buffer against no-shows
  4. Final RLS audit passes: every public-schema table has policies, `storage.objects` policies for `submissions` bucket match table policies, ex-members cannot fetch media via signed URL
  5. `expo-doctor` runs green in CI; app icon, splash, and core copy are reviewed and finalized
**Plans**: 7 plans
- [x] 02-01-PLAN.md — Wave 0: install expo-clipboard + expo-haptics, Jest mocks, Intl.supportedValuesOf probe
- [x] 02-02-PLAN.md — Migration 0004: 7 RPCs + helper + invite_preview type + policy drops + 8 pgTAP files + [BLOCKING] supabase db push + pnpm types:gen
- [x] 02-03-PLAN.md — Shared primitives: Zod schemas, formatInviteCode/timezones/shareInvite utils, 3 new RN components (SegmentedControl / InviteCodeChip / Modal), 5 read hooks + 6 RPC mutation hooks + usePendingInviteReplay
- [ ] 02-04-PLAN.md — Groups-list signed-in home + group-detail screen (invite panel + members + admin destructive zone + all 5 Modals)
- [ ] 02-05-PLAN.md — Create-group form + IanaTimezonePicker modal (Hermes iOS static fallback defense)
- [ ] 02-06-PLAN.md — Join-with-code screen + deep-link landing (/invite/[code].tsx) + root-layout usePendingInviteReplay wiring
- [ ] 02-07-PLAN.md — Phase verification: pnpm test:all + pnpm typecheck + expo-doctor + 11-checkpoint iOS UAT walkthrough
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 6/6 | Complete (iOS UAT PASS; Android UAT deferred) | 2026-04-22 |
| 2. Groups & Invites | 0/? | Not started | - |
| 3. Capture & Admin Review | 0/? | Not started | - |
| 4. Social Surfaces | 0/? | Not started | - |
| 5. Push & Daily Rollover | 0/? | Not started | - |
| 6. Pre-Rollout Hardening | 0/? | Not started | - |

## Coverage

- v1 requirements: 40 total (AUTH 4, GRP 5, INV 3, SUB 6, ADM 4, PTS 3, LB 2, FEED 3, NOTIF 5, ROLL 2, PLAT 3)
- Mapped to phases: 40
- Unmapped: 0
- Phases with no owned v1 requirements: Phase 6 (hardening/retention — intentional)

## Phase Ordering Rationale

- **Foundation first** is non-negotiable: timezone correctness (Pitfall #1), streak race conditions (Pitfall #2), and RLS-off-by-default (Pitfall #3) must all be prevented before any feature code ships.
- **Groups before capture** because submissions have no home without a group; this also unblocks the universal-link domain setup, which has external lead time.
- **Capture and admin review together** — admin UX (optimistic pending, swipe-review) is product-critical to the core loop, not polish (Pitfall #5).
- **Social surfaces after core loop** — leaderboard + feed land when there's real content to display; Realtime + denormalized counters have a home to attach to.
- **Push and rollover together** — two halves of the same retention mechanism; the EAS dev-build cutover is a single operational milestone (Pitfall #6).
- **Hardening last but before external testing** — week-2 death spiral (Pitfall #7) is the biggest retention risk and must be designed into v1, not discovered in the field.

---
*Roadmap created: 2026-04-21*
