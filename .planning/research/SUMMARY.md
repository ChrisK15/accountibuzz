# Project Research Summary

**Project:** Accountibuzz
**Domain:** Mobile social-accountability app (small-group daily habit with human verification)
**Researched:** 2026-04-21
**Confidence:** HIGH

## Executive Summary

Accountibuzz is a mobile-first, small-group (5–10 people) accountability app where members submit daily photo or video proof of a shared goal, a human admin verifies each submission, and a strict streak system (miss = reset, no grace) amplifies social pressure. Users are people who already know they follow through when friends are watching — the app is a minimum-viable replacement for "a friend who sees whether you showed up today."

The chosen stack — Expo SDK 55 + Supabase — covers every platform-level concern (auth, storage, realtime, push, scheduling) without a third vendor, which is the right shape for a solo builder shipping to friend groups. The architecture is Postgres-centric: RLS for authorization, database triggers for derived counters, `pg_cron` for timezone-aware midnight rollover, and Edge Functions only for external HTTP (push dispatch, invite redemption).

The highest-risk issues are not technical. The admin-bottleneck problem, the week-2 small-group death spiral, and media-upload reliability on mobile networks all require early design decisions — they cannot be safely retrofitted after the loop is built.

## Key Findings

### Recommended Stack

Expo-managed React Native on SDK 55 (RN 0.83.1, React 19.2, New Architecture only) paired with Supabase for the full backend. Expo Push Service (not direct APNs/FCM) handles notifications; media goes through `expo-camera` → base64 → ArrayBuffer → Supabase Storage (the `Blob`/`FormData` path is the #1 reported RN–Supabase bug). An EAS dev build is required from the moment `expo-notifications` lands — Android no longer supports push in Expo Go on SDK 55.

**Core technologies:**
- **Expo SDK 55 + Expo Router 6**: Cross-platform RN, file-based navigation, default for new `create-expo-app` projects.
- **Supabase (Postgres + Auth + Storage + Realtime + Edge Functions + Cron)**: Single-vendor backend that covers auth, data, media, realtime leaderboard, scheduled rollover, and push fanout.
- **supabase-js 2.58** with AsyncStorage (+ SecureStore for the encryption key): Persistent sessions on device.
- **TanStack Query v5 + Zustand**: Server state and UI state cleanly separated; realtime events patch the query cache directly.
- **expo-camera + `base64-arraybuffer`**: Capture + upload path; `expo-video` for playback (`expo-av` is removed in SDK 55).
- **expo-notifications + Expo Push Service**: Token lifecycle, notification routing. Requires a dev build.
- **Luxon**: Group-timezone math on the client; server-side `timezone(groups.timezone, now())` is the authoritative source.
- **React Hook Form + Zod**: Forms and validation.

See `.planning/research/STACK.md` for pinned versions, install recipe, anti-recommendations, and upgrade notes.

### Expected Features

The Active requirements in PROJECT.md are already the right MVP cut. Feature research mostly validates and reinforces the Out of Scope list — streak freezes, auto-verification, grace days, configurable strictness, financial stakes, and comments/DMs are features that *look* essential but conflict with the strict-social-pressure positioning.

**Must have (table stakes):**
- Mobile sign-up / login with session persistence
- Create group, invite by link/code, join group
- Daily capture (photo OR video as set by admin) + upload with offline-tolerant retry
- Admin review queue (approve/reject each submission)
- Points + streak accounting (1 pt / verified day; miss = reset)
- Group leaderboard with streak visible per member
- Push reminder before cutoff + activity pings
- **Group feed (today's submissions visible to all members)** — called out as implicitly missing from PROJECT.md Active list; without a feed, "social pressure" has no surface, leaderboard alone is not enough

**Should have (differentiators, MVP-safe):**
- "Members who have not submitted yet today" signal in the feed (cheap, kinetic)
- Missed-day tombstones in the feed (makes absence visible without violating strictness)
- Tight, opinionated capture UX (no camera roll by default — proof credibility)

**Defer (v2+):**
- Public group discovery, democratic/rotating admin, auto-approve fallbacks, AI-assisted verification, streak-scaling points, milestone bonuses, monetization, per-group custom cutoff times, web/desktop clients.

See `.planning/research/FEATURES.md` for competitor matrix and the full anti-feature list with cross-references to PROJECT.md Out of Scope.

### Architecture Approach

Authorization lives in Postgres RLS keyed off `auth.uid()` with two `security definer` helpers (`is_group_member`, `is_group_admin`). `local_date` is computed server-side via trigger (`now() AT TIME ZONE groups.timezone`) and is enforced by a `UNIQUE (group_id, user_id, local_date)` constraint — clients cannot backdate. Daily rollover runs in `pg_cron` every 5 minutes, iterates distinct group timezones, and is idempotent via `groups.last_rolled_date`. Push uses an outbox pattern: database triggers insert into `notifications_outbox`, a database webhook fires the `push-dispatch` edge function, which batches to Expo Push Service. Counters (`points`, `current_streak`) are denormalized on `group_members` and mutated only by triggers on `submissions.status` transitions, so the leaderboard is one indexed read.

**Major components:**
1. **Postgres schema + RLS** — profiles, groups, group_members, submissions, invites, notifications_outbox; policy matrix enforced via `security definer` helpers.
2. **Supabase Storage (`submissions` bucket)** — path-encoded auth (`group_id/user_id/date`) so RLS can validate on the path.
3. **Edge Functions** — `push-dispatch` (outbox → Expo Push), `redeem-invite` (invite code → group_member row).
4. **`pg_cron` rollover job** — streak accounting + "missed day" tombstone insertion per group timezone.
5. **Expo Router app** — Auth stack, Tabs (Home/feed, Submit, Leaderboard, Groups, Profile), Admin review queue route.
6. **Realtime per-group channel** — subscribed on screen focus; handlers patch TanStack Query cache directly.

See `.planning/research/ARCHITECTURE.md` for schema, RLS matrix, storage layout, push flow, deep-link invite flow, and build order.

### Critical Pitfalls

1. **Timezone correctness is a schema problem, not a client problem.** Any client-side "today" computation re-introduces travel/DST/clock-tamper bugs. `submission_date` must be a Postgres-derived `date` column alongside `timestamptz`.
2. **Streaks must be derived on read, not stored and mutated.** A unique constraint on `(user_id, group_id, submission_date)` plus read-time computation from approved submissions kills double-submit, double-approve, and mid-reset race conditions at the DB layer.
3. **RLS-off-by-default is the #1 Supabase catastrophe.** 170+ Lovable apps leaked in Jan 2025 from missing policies. Needs a CI check from the foundation phase, not a trust-me policy.
4. **Media upload requires TUS resumable + two-phase commit + offline queue.** The default upload path silently fails on flaky cellular and chokes on RN Blobs.
5. **Admin bottleneck + strict-reset creates the week-2 death spiral.** Optimistic pending UI for submitters and swipe-review UX for admin are product-critical, not polish. Must ship with the first approval flow.
6. **Expo Go no longer supports Android push on SDK 53+.** Dev builds required from day one once notifications land; Android 13+ silent-drops without notification channels.

See `.planning/research/PITFALLS.md` for all 13 pitfalls with warning signs, prevention, and phase mapping.

## Implications for Roadmap

Suggested phase structure: **6 phases**.

### Phase 1: Foundation — Identity, Data Model, Authorization
**Rationale:** Schema + RLS + server-side date derivation must be locked in before any other code. Retrofitting mutable streak counters or client-computed dates is where accountability apps die.
**Delivers:** Supabase project wired, full schema, RLS policies, session-persistent auth, profile creation, RLS CI check in repo.
**Addresses:** All auth + profile table-stakes features.
**Avoids:** Pitfall #1 (timezone), #2 (streak race conditions), #3 (RLS-off-by-default).

### Phase 2: Groups and Invite Flow
**Rationale:** Groups are the container for everything; invite deep-link flow has a hosting lead-time dependency (universal links need a live domain, else fall back to custom scheme).
**Delivers:** Create/edit group (name, goal, submission type, timezone), shareable invite link/code, join-by-link, member list.
**Uses:** Expo Router deep links, Supabase RPC for invite redemption.
**Implements:** `groups`, `group_members`, `invites` + associated RLS.

### Phase 3: Core Capture Loop — Submissions and Admin Review
**Rationale:** This is the core value mechanic. TUS resumable upload and optimistic pending UI must be first-implementation choices, not retrofits.
**Delivers:** Camera/video capture, base64→ArrayBuffer upload to Supabase Storage with offline queue, submission row creation, admin review queue (swipe approve/reject), optimistic pending UI.
**Uses:** `expo-camera`, `expo-video`, `base64-arraybuffer`, TUS endpoint.
**Avoids:** Pitfall #4 (upload reliability), #5 (admin bottleneck UX).

### Phase 4: Social Surfaces — Leaderboard and Group Feed
**Rationale:** Converts private submission into public social pressure. Feed is called out as implicitly missing from PROJECT.md's Active list and should be added as a requirement.
**Delivers:** Today's group feed (members' verified submissions + "not yet submitted" + missed-day tombstones), leaderboard screen ranked by points with streak per member.
**Uses:** Supabase Realtime per-group channel, TanStack Query cache patching.
**Implements:** Derived-streak read path; denormalized counter triggers.

### Phase 5: Push Notifications and Daily Rollover
**Rationale:** Retention infrastructure — the "missed day is visible within hours" value prop depends on both pieces. Server-side scheduling is the only correct approach (client-side `scheduleNotificationAsync` breaks when the app is killed).
**Delivers:** EAS dev build with push entitlements, Expo push token registration, `pg_cron` daily rollover per group timezone, `notifications_outbox` + `push-dispatch` edge function, pre-deadline reminder + submission/review activity pings, Android notification channels, DST-safe rollover.
**Uses:** `expo-notifications`, Supabase `pg_cron`, Edge Functions, database webhooks.
**Avoids:** Pitfall #6 (Expo Go Android push), DST-boundary rollover bugs.

### Phase 6: Polish, Re-engagement, and Pre-rollout Hardening
**Rationale:** Re-engagement flows and group-health metrics must ship before external friend-group testing, not after. Week-2 death spiral is the biggest retention risk and it is a design problem, not a polish pass.
**Delivers:** Re-entry ritual after broken streak (without violating strictness), admin group-health view (late-approver signal, missed-day rate), onboarding flow that encourages inviting *more* people than the target (buffer for no-shows), instrumentation for admin-response-time and week-1/week-2 retention, `expo-doctor` in CI, final RLS audit, app icon / splash / copy polish.
**Avoids:** Pitfall — week-2 death spiral in small groups; invite-too-few onboarding.

### Phase Ordering Rationale

- **Schema + RLS first** is non-negotiable: both top technical pitfalls (timezone, streak races) and the #1 security pitfall (RLS-off) are prevented only by getting the foundation right before any feature code.
- **Groups before capture** because submissions have no home without a group; this also unblocks the universal-link domain setup, which has external lead time.
- **Capture + admin review together** because admin UX is product-critical to the core loop, not a polish add-on.
- **Feed + leaderboard after core loop** so social surfaces land when there's real content to display.
- **Push + rollover together** because they're two halves of the same retention mechanism, and the EAS dev-build cutover is a single operational milestone.
- **Polish + re-engagement last** but explicitly *before* real-user testing, because week-2 retention is the hardest problem and must be designed into v1.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 3:** TUS resumable upload compatibility with Expo SDK 55 + supabase-js 2.58 — reference implementation exists but version validation needed.
- **Phase 5:** `pg_cron` rollover DST-boundary correctness; EAS credentials checklist for APNs + FCM; Supabase database webhook configuration for the outbox pattern.
- **Phase 6:** Small-group retention intervention patterns — what an acceptable "re-entry ritual" looks like without violating strict-reset.

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Official Supabase Auth + Expo session quickstarts cover this fully.
- **Phase 2:** Expo Router deep links + Supabase RPC pattern is well documented.
- **Phase 4:** Supabase Realtime + TanStack Query cache invalidation is a standard recipe.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against Expo SDK 55 changelog + Supabase official docs via Context7 |
| Features | HIGH | Competitor space well-documented; PROJECT.md Out of Scope tightly constrains MVP |
| Architecture | HIGH | Verified against Supabase Cron, Storage RLS, and Expo push official docs |
| Pitfalls (technical) | HIGH | Official docs + community post-mortems (incl. Jan 2025 RLS breach) |
| Pitfalls (social dynamics) | MEDIUM | Inferred from accountability-app retention research, not Accountibuzz-specific data |

**Overall confidence:** HIGH

### Gaps to Address

- **TUS resumable upload SDK 55 validation** — handle in Phase 3 research: run the reference RN TUS client against supabase-js 2.58 before locking the upload architecture.
- **Universal-link domain hosting** — need the domain (`accountibuzz.app` or similar) owned before Phase 2 deep-link work; otherwise fall back to custom scheme and defer universal links. Decide by start of Phase 2 planning.
- **Admin response-time threshold** — no preset value; instrument from Phase 3 and track during Phase 6 friend-group testing.
- **Week-1 / week-2 retention** — requires manual check-ins with real friend-group testers; no amount of research substitutes for watching the first three groups run for 14 days.
- **Photo-only vs photo-or-video at MVP** — video adds capture UX and egress cost; worth a decision at Phase 3 planning based on whether the first testing groups want video.

## Sources

### Primary (HIGH confidence)
- Context7: `/llmstxt/expo_dev_llms_txt` — Expo SDK 55, Expo Router, expo-camera, expo-notifications, expo-video
- Context7: `/supabase/supabase-js` — supabase-js 2.58 API surface
- Expo SDK 55 changelog (expo.dev/changelog/sdk-55)
- Supabase official: Cron, Scheduling Edge Functions, Storage RLS, Expo RN Storage upload, Expo RN Auth quickstart, Push Notifications example
- Supabase + Expo push notifications example repo (github.com/supabase/supabase)
- Software Mansion blog: expo-av → expo-video migration

### Secondary (MEDIUM confidence)
- Cohorty blog — accountability system failure modes, small-group habit app comparison
- Habi.app insights — 2026 accountability app landscape
- BeReal App Store listing — reference for the daily-photo cadence UX
- stickK zendesk — human-verified commitment pattern

### Tertiary (LOW confidence)
- Ad-hoc retention benchmarks for small-group social products — need validation from real Accountibuzz friend-group data

---
*Research completed: 2026-04-21*
*Ready for roadmap: yes*
