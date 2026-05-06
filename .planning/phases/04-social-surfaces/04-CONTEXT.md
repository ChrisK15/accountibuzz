# Phase 4: Social Surfaces - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Verified submissions become *visible social pressure*. Phase 4 delivers:

- **Counter-trigger body:** `handle_submission_approval` (the no-op stub from migration 0001 §10) gets its real body — increments `group_members.points` and updates `current_streak` / `last_rolled_date` based on `submissions.local_date`. Server-side, derived from group timezone. (PTS-01, PTS-02 in part, PTS-03)
- **Per-group leaderboard:** ranked by points then current_streak, top-5-with-expand surface inside group-detail. Reads denormalized columns directly via the `group_members_leaderboard_idx` shipped in P1. (LB-01)
- **Realtime leaderboard updates:** Supabase Realtime `postgres_changes` channel filtered on `group_members.group_id=eq.{X}`, narrowed client-side, torn down via `useFocusEffect`. (LB-02)
- **Group feed (today's posts):** approved-only feed of today's submissions, rendered inside group-detail as a stacked section under the leaderboard. (FEED-01)
- **Still-to-post list:** symmetric SECURITY DEFINER RPC `get_pending_today(group_id)` returns members with no submission row for today's local_date. Rendered as an avatar row in group-detail. (FEED-02)
- **Yesterday tombstones:** SECURITY DEFINER RPC `get_missed_yesterday(group_id)` computes "no approved row for yesterday's local_date" at read time. Rendered quietly in group-detail. (FEED-03)
- **Today screen evolution:** each GroupCard gains a single social-signal line (`N/M posted today · X pts · 🔥streak`) backed by a per-group Realtime channel added alongside the existing per-user channel from P3 D-13.

Out of scope for Phase 4 (other phases own these):
- The actual streak-reset *writer* — Phase 5 (`pg_cron handle_daily_rollover` body). P4's trigger handles streak math when an approval crosses a gap, but the time-based reset on idle members is P5's job.
- Persisted `daily_misses` table for historical tombstones — deferred; P5 layers this on top of pg_cron without breaking the P4 read-side RPC contract.
- Push notifications for "member posted" / "you were approved" / "streak broken" — Phase 5 (NOTIF-02..04).
- Re-engagement / comeback narrative for broken-streak members — Phase 6 (Pitfall #7, RE-01..04).
- Multi-day tombstone history (last 7 days view) — deferred; daily-pressure UX prefers boring single-day tombstones.
- Reactions, comments, DMs on feed posts — explicitly out per PROJECT.md ("conflicts with the quiet, pressure-by-presence positioning").

</domain>

<decisions>
## Implementation Decisions

### Approval Trigger + Streak Math (D-01..D-04)
- **D-01: Streak math anchors to `submissions.local_date` (server-derived).** Late approval credits the day the submission was *for*, not when the admin acted. Required by PTS-03 ("streak logic consistent with group timezone"). The trigger reads `NEW.local_date` and `group_members.last_rolled_date`.
- **D-02: Streak recurrence:**
  - `last_rolled_date IS NULL` → `current_streak = 1`
  - `local_date = last_rolled_date + 1` (consecutive) → `current_streak = current_streak + 1`
  - `local_date > last_rolled_date + 1` (gap) → `current_streak = 1` (any gap = streak broken; matches PROJECT.md "strict miss = reset")
  - `local_date = last_rolled_date` → no-op (UNIQUE `(group_id, user_id, local_date)` from P1 prevents this anyway)
  - Always: `last_rolled_date = local_date`, `points = points + 1`, `longest_streak = greatest(longest_streak, current_streak)`. Even though P5 owns the `pg_cron` rollover that zeroes streaks on idle members, this branch handles the case where an approval lands across a gap before rollover has run.
- **D-03: Idempotency relies on the existing 0003 admin-immutable trigger plus the `WHEN (old.status IS DISTINCT FROM new.status AND new.status = 'approved')` clause.** 0003 already blocks any re-review or status flip-flop, so the AFTER UPDATE trigger fires at most once per row. No `points_credited_at` guard, no idempotency log table.
- **D-04: Leaderboard reads denormalized `group_members` columns directly** via a single indexed join with `profiles` (the `group_members_leaderboard_idx` shipped in P1: `group_id, points DESC, current_streak DESC`). No view, no RPC indirection. Honors Pitfall #2 caveat ("don't store streak as mutable counter") only at the *read* side — schema reality already locked the denormalized counter columns in P1; this phase fills them in correctly via the trigger.

### Tombstone Strategy (D-05..D-08)
- **D-05: New SECURITY DEFINER RPC `get_missed_yesterday(group_id uuid)` returns members with no `approved` submission for `(today's local_date - 1)`.** Computed at query time from `group_members LEFT JOIN submissions` filtered by `local_date = yesterday AND status = 'approved'`. Yesterday's local_date is computed inside the RPC from `now() AT TIME ZONE groups.timezone`. P4 ships FEED-03 standalone; P5 can later add a `daily_misses` table without breaking this contract.
- **D-06: Yesterday-only tombstones in P4.** Single tombstone row per missing member; day-before-yesterday becomes invisible. Multi-day history is deferred — daily-pressure UX prefers boring single-day tombstones.
- **D-07: Symmetric SECURITY DEFINER RPC `get_pending_today(group_id uuid)` for FEED-02.** Returns members with no submission row for today's local_date (any status). Two narrow RPCs (one for today's pending, one for yesterday's misses) — not one combined `get_group_today_status` surface. Decouples cache invalidation: today's-not-yet changes when a member submits; yesterday's-misses changes only at the next midnight rollover.
- **D-08: Streak break is rendered quietly.** A miss = tombstone row in feed + `current_streak = 0` on leaderboard. No "X just lost their N-day streak" badges, no re-engagement card. Comeback / re-entry ritual is explicitly Phase 6 scope (RE-01).

### Per-Group Surface Layout (D-09..D-12)
- **D-09: Single scrollable group-detail screen with stacked sections.** Order: Header (name / goal / submission_type / timezone) → Leaderboard → Today's posts (FEED-01) → Still to post (FEED-02 avatar row) → Missed yesterday (FEED-03 tombstones) → Members → (admin only) Pending review (N) → Leave / Transfer / Delete destructive zone. No new routes, no sub-tabs. Group-detail at `app/(app)/groups/[id]/index.tsx` is enriched in place.
- **D-10: Leaderboard density = top-5, tap-to-expand to full ranking.** Even at the 10-member cap (INV-03), the bottom half rarely matters above the fold; small-device rendering and multi-group scroll perf benefit from the partial view. The full ranking remains accessible.
- **D-11: Feed item structure: avatar + display_name + 80×80 media thumbnail + relative time ("Nm ago") + optional caption.** Tap thumbnail → existing fullscreen viewer (the same media path used in the admin queue per P3). No reactions, no comments — PROJECT.md constraint. Video posts autoplay muted+looping at thumbnail size — same default as the admin review queue per P3 Claude's-discretion item.
- **D-12: Approved-only visibility for other members' posts.** Pending and rejected stay private to the submitter (and admin via the review queue). Matches FEED-01 literally and keeps rejection a quiet event per D-12 from P3 (rejection terminal, no public shame). Existing `submissions` SELECT RLS already aligns; no policy changes needed.

### Today Screen Evolution (D-13..D-16)
- **D-13: Each Today GroupCard gains a single social-signal line: `N/M posted today · X pts · 🔥streak`.** N comes from the group's approved-today count (cheap aggregate), M from `group_members` count, points/streak from the leaderboard read (the user's own row). Rendered below the existing CTA + status row — does not change the existing GroupCard layout per P3 D-15.
- **D-14: Empty social-signal copy: `0/M posted · be the first`.** Encourages first-post per day; non-judgmental tone. Cutoff timer continues to live where P3 already places it (cutoffStateFor inside GroupCardRow).
- **D-15: Per-group Realtime channel added per visible Today card** (alongside the existing per-user channel from P3 D-13). Filtered on `group_members.group_id=eq.{id}` (single-column filter, the only thing `postgres_changes` supports per D-13 in P3). Cleanup via `useFocusEffect` on the Today screen — channel-per-active-card respects Pitfall #4 (per-group, not global) and Pitfall #11 (cleanup on blur). Multi-group users get one channel per visible card.
- **D-16: GroupCard tap continues to route to group-detail** (same as P3). No new gestures, no extra "View leaderboard" chip on the card. Drill-through is implicit; group-detail is the destination for all social context.

### RPCs (D-17..D-19)
- **D-17: New SECURITY DEFINER RPCs (Phase 4 migration `0008_phase4_points_streaks_feed.sql`):**
  - `get_pending_today(group_id uuid) returns table(user_id uuid, display_name text, avatar_url text)` — members with no submission for today's local_date. Membership-gated (caller must be in group).
  - `get_missed_yesterday(group_id uuid) returns table(user_id uuid, display_name text, avatar_url text)` — members with no approved submission for yesterday's local_date. Membership-gated.
  - `get_today_posted_count(group_id uuid) returns int` — approved count for today's local_date (powers the Today GroupCard social-signal line). Membership-gated.
- **D-18: Counter-trigger body lives inside `handle_submission_approval`,** replacing the no-op stub. The trigger fires `AFTER UPDATE OF status ON submissions WHEN (old.status IS DISTINCT FROM new.status AND new.status = 'approved')` — already wired in 0001 §10. Body runs as `SECURITY DEFINER` per the existing definition; updates `group_members` for `(group_id, user_id) = (NEW.group_id, NEW.user_id)`.
- **D-19: Direct UPDATE of `group_members.points / current_streak / last_rolled_date / longest_streak` from the client stays blocked.** The `group_members_update_admin` policy from P1 covers role mutations only — counter columns are written exclusively by the trigger (running as definer). Defense-in-depth: the Phase 4 migration may add a column-allowlist trigger on `group_members` UPDATE to refuse client-side counter mutations even from an admin (parallel to the 0003 admin-immutable trigger pattern on submissions). Decision deferred to planning — research/planner picks the cleanest approach.

### Realtime (D-20..D-21)
- **D-20: Group-detail leaderboard subscribes to `postgres_changes` UPDATE on `public.group_members` filtered on `group_id=eq.{X}`.** On surviving events, patch the TanStack cache via `setQueryData`. Channel scope is the group-detail screen; teardown via `useFocusEffect`.
- **D-21: Group-detail feed subscribes to `postgres_changes` UPDATE on `public.submissions` filtered on `group_id=eq.{X}`.** Client-side narrows to events where `local_date = today_local_date` and `(NEW.status = 'approved' OR OLD.status = 'approved')`. On approval, optimistically prepend to the feed cache and invalidate the leaderboard query (the trigger will produce the patch within a tick anyway, but explicit invalidation is cheap insurance).

### Claude's Discretion
- Exact copy for tombstone rows ("Sam — missed yesterday", "Riley — missed yesterday"; or batched "3 missed yesterday: Sam, Riley, Jordan") — write during planning/implementation; tone non-judgmental.
- Avatar-row treatment for "Still to post" (overlapping circles vs. separated row vs. count-only-if-many) — pick during planning.
- Empty-state copy for the leaderboard when no member has any points yet ("Nobody's on the board yet — submit today to start the streak").
- Whether "longest_streak" is exposed on the leaderboard row in P4 or held back as a P6 polish item — Claude's discretion; keep cheap.
- Whether the social-signal line on the Today GroupCard updates with a cross-fade animation (matching the StatusPill cross-fade from P3) or no animation — Claude's discretion; default to no animation, revisit if it feels janky.
- Exact RPC return shape for the leaderboard read (single SELECT with profile join in TanStack hook, or wrap in a small RPC for stable contract) — D-04 says read direct; planner picks the join shape.
- Which existing UI primitives the leaderboard row reuses (extending `GroupCard`? a new `LeaderboardRow`? reusing `Avatar` + `Text`?) — pick during planning.
- pgTAP coverage shape for the trigger body (per-branch tests of the streak recurrence, idempotency, ex-member edge cases) — research/planner picks; aim for parity with the P3 migration's pgTAP density (4 files for 0006).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/PROJECT.md` — vision, constraints, out-of-scope (no in-app comments / DMs / chat — bounds the feed surface; strict miss = reset; goal-agnostic UI)
- `.planning/REQUIREMENTS.md` — PTS-01..03, LB-01..02, FEED-01..03 are the P4 targets (8 requirements)
- `.planning/ROADMAP.md` §"Phase 4: Social Surfaces" — goal + success criteria 1–5 (binding)
- `.planning/STATE.md` — Phase 4 entry: ready to plan, leaderboard + feed need content from P3 submissions, Realtime path validated in CK-5/CK-10 is reusable

### Stack & Architecture
- `.planning/research/STACK.md` — Expo SDK 55, supabase-js 2.58, TanStack Query, Realtime patterns
- `.planning/research/ARCHITECTURE.md` §"Data Model (Postgres)" — `group_members` counter columns (`points`, `current_streak`, `longest_streak`, `last_rolled_date`) shipped in P1
- `.planning/research/ARCHITECTURE.md` §"Data Flow: Admin approves" — describes the trigger + Realtime UPDATE shape this phase implements (note: arch doc says `last_verified_local_date`, schema reality is `last_rolled_date` — schema wins)
- `.planning/research/ARCHITECTURE.md` §"Anti-Patterns" — esp. #2 (no polling for leaderboard) and #4 (per-group channels, not global)
- `.planning/research/PITFALLS.md` §1 — server-derived `local_date`, never client-computed (trigger uses `NEW.local_date` per D-01)
- `.planning/research/PITFALLS.md` §2 — Streak race conditions; UNIQUE constraint already shipped; trigger runs in transaction with the UPDATE
- `.planning/research/PITFALLS.md` §6 — admin-bottleneck: optimistic pending UI is already shipped in P3; leaderboard movement on approval is the dopamine hit referenced here
- `.planning/research/PITFALLS.md` §7 — week-2 death spiral; quiet streak-break treatment in D-08 lays the foundation for P6's re-entry ritual without prejudging it
- `.planning/research/PITFALLS.md` §11 — Realtime channel cleanup (D-15, D-20, D-21 all rely on `useFocusEffect` per the P3 D-13 precedent)
- `.planning/research/PITFALLS.md` §13 — Leaderboard N+1; the single-join read in D-04 explicitly avoids this

### Phase 1–3 Foundation Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-02 (counter trigger STUBS — bodies land in P4/P5; THIS PHASE fills the P4 stub), schema decisions for `group_members` counter columns
- `.planning/phases/02-groups-invites/02-CONTEXT.md` — D-11 (all writes via SECURITY DEFINER RPCs; counter trigger inherits this discipline), D-12 (Stack-only shell; no tabs; superseded by P3 D-14)
- `.planning/phases/03-capture-admin-review/03-CONTEXT.md` — D-13 (Realtime single-column filter constraint, channel-per-screen via `useFocusEffect`), D-14 (Today / Groups / Profile tabs), D-15 (Today screen GroupCard layout — the social-signal line in D-13 here extends but does not break it), D-18 (RPC-only writes), D-19 (storage path convention — unchanged in P4)

### Migrations (Schema Reality)
- `supabase/migrations/0001_foundation.sql` §`group_members` (lines 104–118) — counter columns + `group_members_leaderboard_idx`. Note: column is `last_rolled_date` (NOT `last_verified_local_date` from arch doc).
- `supabase/migrations/0001_foundation.sql` §`handle_submission_approval` STUB (lines 365–384) — **THIS PHASE replaces the stub body.** Trigger wiring is already in place; only the body changes.
- `supabase/migrations/0001_foundation.sql` §`group_members_update_admin` policy (lines 168–178) — write path RLS for counter columns; D-19 references this
- `supabase/migrations/0003_phase1_review_fixes_2.sql` — admin-immutable column allowlist on `submissions` (the WHEN clause + this trigger together provide D-03's idempotency)
- `supabase/migrations/0006_phase3_capture_review.sql` — `submit_today`, `review_submission`, `get_pending_review_count` RPCs; the `review_submission` RPC's `status='approved'` UPDATE is what fires the P4 trigger
- `supabase/migrations/0007_phase3_realtime_publication.sql` — adds tables to `supabase_realtime` publication; verify `group_members` and `submissions` are in the publication (they should be, but check during research)
- `supabase/migrations/0008_phase4_points_streaks_feed.sql` (new, this phase) — `handle_submission_approval` body, optional column-allowlist trigger on `group_members` (D-19), three new SECURITY DEFINER RPCs (D-17), pgTAP coverage for trigger branches + RPCs

### External Docs
- Supabase Realtime `postgres_changes` — single-column filter constraint already documented in P3 D-13; same constraint applies to D-15, D-20, D-21
- TanStack Query `setQueryData` / `invalidateQueries` — Realtime patch pattern already established in P3 hooks
- Postgres `AFTER UPDATE` trigger semantics — running inside the same transaction as the UPDATE, so the counter mutation is atomic with the status flip

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/Avatar.tsx` + `AvatarInitials.tsx` — leaderboard rows, "Still to post" avatar row, tombstone rows, feed item identity
- `src/components/GroupCard.tsx` — Today screen card; D-13 extends it with a social-signal line (do not rebuild)
- `src/components/StatusPill.tsx` — already used on Today; could provide visual language for streak chips on leaderboard rows
- `src/components/ScreenContainer.tsx` + `ScreenHeader.tsx` — group-detail layout shell (already in use)
- `src/components/Modal.tsx` — leaderboard expand-to-full might use a sheet variant; or push to inline expand
- `src/lib/supabase.ts` — singleton client; all RPC calls go through `supabase.rpc('get_pending_today' | 'get_missed_yesterday' | 'get_today_posted_count')`
- `src/features/groups/useGroup.ts`, `useGroupMembers.ts` — group-detail screen already loads group + members; leaderboard hook can join the leaderboard read with `group_members` data
- `src/features/submissions/useTodaySubmissionRealtime.ts` — established Realtime channel pattern (single-column filter + `useFocusEffect` cleanup); P4 hooks for leaderboard / feed Realtime mirror this shape
- `src/features/submissions/time.ts` — `todayLocalDate` and group-tz helpers already exist; reusable for client-side narrowing in D-21

### Established Patterns
- **All write paths via SECURITY DEFINER RPCs** (P2 D-11, P3 D-18). P4 adds three read-side RPCs (D-17). The trigger body (D-18) is the only "write path" introduced — it runs server-side via the existing AFTER UPDATE wiring; no new client write surface.
- **Migrations are SQL files in `supabase/migrations/`,** numbered sequentially; P4 adds `0008_phase4_points_streaks_feed.sql`. Never edit prior migrations.
- **RLS is the authorization layer**; CI fails the build on any public-schema table without RLS. No new tables in P4 (all RPCs read existing tables) — keep CI green incidentally.
- **Forms / mutations use TanStack Query**; Realtime handlers patch the cache via `setQueryData`, never via a parallel state layer (Anti-Pattern #2).
- **Theme tokens** in `src/theme/` — never hardcode colors / spacing.
- **Realtime channel scope is per-screen, torn down on blur** (P3 D-13 / Pitfall #11). D-15 (Today per-group counter channel) and D-20/D-21 (group-detail leaderboard + feed) inherit this.
- **Counter mutations happen in triggers running as definer** (planned for P1 D-02, locked here as D-18). Client never touches `points` / `current_streak` / `last_rolled_date` directly.
- **pgTAP density** — 0006 (P3) shipped 4 files for 3 RPCs. P4's migration touches a trigger body + 3 RPCs; aim for ≥4 pgTAP files (per-branch streak recurrence test, idempotency test, RPC permission tests, RPC correctness tests).

### Integration Points
- `app/(app)/index.tsx` (Today screen) — D-13/D-14/D-15 add a social-signal line per GroupCard. The existing FlatList of `GroupCardRow` instances stays; each row gains one Realtime subscription + one extra hook call (leaderboard read for the user's own row + posted-today count). **Hook order constraints from P3 still apply** (one row component per FlatList item).
- `app/(app)/groups/[id]/index.tsx` (group-detail) — gets four new sections in stack order (Leaderboard, Today's posts, Still to post, Missed yesterday). The existing Members + admin-only Pending review + destructive zone stay below.
- `supabase/migrations/0008_phase4_points_streaks_feed.sql` (new) — body for `handle_submission_approval`; three SECURITY DEFINER RPCs (`get_pending_today`, `get_missed_yesterday`, `get_today_posted_count`); optional column-allowlist trigger on `group_members` (D-19); pgTAP coverage. **Apply via `supabase db push` blocking checkpoint, parallel to P2/P3 migration plan structure.**
- `src/types/database.ts` — regenerate via `pnpm types:gen` after the migration lands.
- `src/features/submissions/useTodaySubmissionRealtime.ts` — extend or pair with new hooks: `useGroupLeaderboard`, `useGroupFeed`, `useGroupTombstones`, `useGroupSocialCounts` (Today card). Same `useFocusEffect` cleanup discipline.

</code_context>

<specifics>
## Specific Ideas

- The Today GroupCard's social-signal line (D-13) is the "the group is watching" surface at-a-glance — it should always be present once the user has at least one group with at least one member, even if the count is 0/M. This directly answers PROJECT.md "core value: a missed day is visible to your group within hours."
- The leaderboard's top-5-with-expand affordance (D-10) honors the 10-member cap (INV-03) without making every group-detail screen feel like a long roster. Tap-to-expand is cheaper than scroll-jacking.
- Tombstone rendering should feel like a *fact*, not a *judgment* (D-08). A muted gray row with "missed yesterday" reads differently than a red banner. Pitfall #7 says strict reset is correct; the visual language carries that.
- The trigger's gap branch (D-02) is defensive — Phase 5's `pg_cron` will normally zero a streak before the next approval lands across a gap, but if rollover ever fails (DST edge, infra hiccup), the trigger doesn't double-credit a streak that should have reset.
- Schema-vs-doc reality: the architecture doc references `last_verified_local_date`, but the shipped column is `last_rolled_date`. All P4 work uses the shipped name. Update the architecture doc at phase close if there's appetite (low priority).

</specifics>

<deferred>
## Deferred Ideas

- **Persisted `daily_misses` table** → Phase 5. P5 lands the pg_cron rollover that creates miss markers; the read-side RPC contract from D-05/D-07 keeps stable so swap-in is non-breaking.
- **Push notifications for "member posted" / "you were approved" / "streak broken"** → Phase 5 (NOTIF-02..04). P4's Realtime patches handle the in-app surface only.
- **Re-engagement / comeback narrative** for broken-streak members → Phase 6 (RE-01..04, addresses Pitfall #7). D-08 keeps the visual language muted to avoid prejudging the P6 design.
- **Multi-day tombstone history (last 7 days)** → not on the roadmap; revisit only if friend-group testing surfaces a need.
- **Reactions / comments on feed posts** → permanently out of scope (PROJECT.md "no in-app comments / DMs / chat").
- **Streak-broken badge / "last streak: N days" chip on leaderboard rows** → P6 polish if the re-engagement narrative needs it; or never if quiet works.
- **Longest_streak surface on leaderboard** → Claude's discretion in P4 (cheap to add); explicit P6 polish if held back.
- **Group-health view for admins** (late-approver signal, missed-day rate per group) → Phase 6 (RE-02). Phase 4's RPCs surface raw data that P6 can aggregate.
- **Feed pagination beyond today's posts** → not needed; FEED-01 is "today's submissions" — single-day window. Historical browse is not on the roadmap.
- **Bulk approve / reject from leaderboard surface** → already deferred in P3; not revisited.
- **Cross-fade animation on the Today social-signal line update** → Claude's discretion (default: no animation, revisit if it feels janky).
- **Architecture-doc reword** (`last_verified_local_date` → `last_rolled_date`) → low priority; update at phase close or ignore.

### Reviewed Todos (not folded)
None — `cross_reference_todos` step found no matching todos for Phase 4.

</deferred>

---

*Phase: 04-social-surfaces*
*Context gathered: 2026-05-06*
