# Phase 4: Social Surfaces - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `04-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 04-social-surfaces
**Areas discussed:** Approval trigger + streak math, Tombstone strategy (FEED-03), Per-group surface layout (LB-01 + FEED-01..03), Today-screen evolution

---

## Approval trigger + streak math

### Q1: What date does the streak math anchor to when an admin approves a submission?

| Option | Description | Selected |
|--------|-------------|----------|
| submissions.local_date | Server-derived day the submission was *for*. Late approval credits yesterday — matches PTS-03. | ✓ |
| now() AT TIME ZONE group.timezone | Anchor to when admin acted. Simpler but breaks PTS-03; risks double-counting/skipping a day. | |
| Both — reject approvals where local_date != today | Forces same-day admin SLA; cleaner math but hard SLA not otherwise scoped. | |

**User's choice:** submissions.local_date (Recommended)

### Q2: How does the trigger handle a streak when last_rolled_date is set, but local_date is more than 1 day after it (gap)?

| Option | Description | Selected |
|--------|-------------|----------|
| Reset streak to 1 | Any gap = streak broken; matches PROJECT.md "strict miss = reset". Defensive against rollover gaps. | ✓ |
| Trust last_rolled_date, only +1 when consecutive, otherwise no-op | Lets P5 rollover do the resetting; risks stale streaks on leaderboard. | |
| Compute on read (window function over submissions) | Keep streak column un-denormalized per Pitfall #2; harder Realtime story. | |

**User's choice:** Reset streak to 1 (Recommended)

### Q3: What happens if the trigger fires twice for the same submission (idempotency)?

| Option | Description | Selected |
|--------|-------------|----------|
| Trust the WHEN clause + 0003 immutable trigger | 0003 already blocks status flip-flops; trigger fires at most once. No extra guard. | ✓ |
| Add explicit guard: skip if already credited | `points_credited_at` column on submissions; trigger no-ops if set. Defense-in-depth. | |
| Use an idempotency log table | `submission_credits` table with PK=submission_id; full audit trail; heavier. | |

**User's choice:** Trust the WHEN clause + 0003 immutable trigger (Recommended)

### Q4: How should the leaderboard read?

| Option | Description | Selected |
|--------|-------------|----------|
| Read denormalized columns directly | Single indexed join with profiles; uses `group_members_leaderboard_idx` from P1. Realtime UPDATEs on group_members. | ✓ |
| Add a SECURITY DEFINER view/RPC `get_leaderboard(group_id)` | Stable contract; matches P2/P3 RPC discipline; one extra indirection. | |
| Compute streak on read (view), points denormalized | Hybrid honors Pitfall #2 strictly for streak; harder Realtime. | |

**User's choice:** Read denormalized columns directly (Recommended)

---

## Tombstone strategy (FEED-03)

### Q1: How does Phase 4 produce the list of yesterday's misses (FEED-03)?

| Option | Description | Selected |
|--------|-------------|----------|
| P4 read-side RPC | `get_missed_yesterday(group_id)` computed at query time; P5 can layer persisted tombstones later without breaking contract. | ✓ |
| Wait for P5 tombstones table | Defer FEED-03 to P5; smaller P4 surface but FEED-03 slips. | |
| Persist a `daily_misses` table now | Mid-path; P4 writes manually, P5 swaps writer to pg_cron. More migration churn. | |

**User's choice:** P4 read-side RPC (Recommended)

### Q2: What date range does the feed show — just yesterday's misses, or scrolling history?

| Option | Description | Selected |
|--------|-------------|----------|
| Yesterday only | Single tombstone per missing member; cheapest first cut; matches FEED-03 literally. | ✓ |
| Last 7 days, grouped by date | Scrollable history; risks feeling judgmental against strict-reset. | |
| Yesterday + today's not-yet-submitted | Blurs FEED-02 and FEED-03; potentially confusing. | |

**User's choice:** Yesterday only (Recommended)

### Q3: How is FEED-02 ('who hasn't submitted yet today') computed?

| Option | Description | Selected |
|--------|-------------|----------|
| Same read-side RPC, today's local_date | `get_pending_today(group_id)` symmetric with tombstone RPC; one round-trip per group. | ✓ |
| Compute client-side from existing hooks | Subtract approved-today from members on the client; harder consistency with server cutoff. | |
| Combined RPC `get_group_today_status(group_id)` | One RPC for whole feed; higher coupling, single cache key/invalidation. | |

**User's choice:** Same read-side RPC, today's local_date (Recommended)

### Q4: What surfaces a streak break visually in P4?

| Option | Description | Selected |
|--------|-------------|----------|
| Tombstone-only — quiet | Tombstone row + current_streak=0 on leaderboard. No badges. P6 owns re-entry ritual. | ✓ |
| Add a 'streak broken' badge on the leaderboard row | Faded "Last streak: N days" chip; ships in P4. | |
| Full re-engagement card now | "X missed — jump back in" card; pulls P6 work forward. | |

**User's choice:** Tombstone-only — quiet (Recommended)

---

## Per-group surface layout (LB-01 + FEED-01..03)

### Q1: How are leaderboard + feed laid out within the group?

| Option | Description | Selected |
|--------|-------------|----------|
| One scrollable group-detail screen, stacked sections | Header → Leaderboard → Today's posts → Still to post → Missed yesterday → Members → Admin actions. No new routes. | ✓ |
| Sub-tabs within group-detail (Overview / Feed / Members) | Three sub-tabs; more structure; adds tab-state edge cases. | |
| Dedicated /feed route reachable from group-detail | Clean separation; introduces a route the user has to bounce to. | |

**User's choice:** One scrollable group-detail screen, stacked sections (Recommended)
**Notes:** User confirmed via the ASCII preview showing leaderboard at top, feed in the middle, members + admin actions at the bottom.

### Q2: Is the leaderboard collapsible / partial in the group-detail surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Show top 5, tap-to-expand to full ranking | Even at 10-member cap (INV-03), bottom half rarely matters above the fold. | ✓ |
| Always show full ranking (all 10) | Honest but lengthens the screen. | |
| Only the user's own row + adjacent ranks | Loses the "whole group is watching" affordance. | |

**User's choice:** Show top 5, tap-to-expand to full ranking (Recommended)

### Q3: What's the structure of a Today's-posts feed item (FEED-01)?

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar + name + media thumbnail + 'Nm ago' + caption | Compact card with 80×80 thumbnail; tap → fullscreen. No reactions/comments per PROJECT.md. | ✓ |
| Full-width media + name + caption (Instagram-card style) | Heavier scroll; risks shifting positioning toward content app. | |
| Horizontal carousel of thumbnails + tap-to-detail | Compact but caption visibility is lossy. | |

**User's choice:** Avatar + name + media thumbnail + 'Nm ago' + caption (Recommended)

### Q4: What can a member see in the feed about other members' posts?

| Option | Description | Selected |
|--------|-------------|----------|
| Approved posts only | RLS already aligns; keeps rejection a quiet event per D-12 from P3. | ✓ |
| Approved + 'submitted, awaiting review' | More transparency; surfaces submission existence pre-approval; risks pre-approval comparison. | |
| Approved + rejected (both) | Maximizes pressure but conflicts with D-12 / ADM-04 / PROJECT.md positioning. | |

**User's choice:** Approved posts only (Recommended)

---

## Today-screen evolution

### Q1: Does the Today screen evolve in Phase 4, or stay scoped to own-status?

| Option | Description | Selected |
|--------|-------------|----------|
| Add 'N/M posted today' under each GroupCard | Single small line per card: 'N/M posted · X pts · 🔥streak'. Cheap to compute. | ✓ |
| Keep Today exactly as-is (own status only) | Smallest blast radius; loses pressure-at-a-glance on home. | |
| Embed mini-feed (avatars of who-posted-today) on each GroupCard | Higher visual signal; risks scroll perf regression. | |

**User's choice:** Add 'N/M posted today' under each GroupCard (Recommended)
**Notes:** User confirmed via the ASCII preview showing "4/6 posted · 11 pts · 🔥3" line on each Today GroupCard.

### Q2: What's the Today GroupCard's behavior when no one in the group has posted yet?

| Option | Description | Selected |
|--------|-------------|----------|
| Show '0/6 posted today · be the first' | Encourages first post; non-judgmental; cheap copy variant. | ✓ |
| Hide the social line until someone posts | Keep empty state minimal; only shows social signal once activity begins. | |
| Show '0/6 posted · cutoff in 4h 12m' | Lean into time pressure; duplicates existing cutoff display. | |

**User's choice:** Show '0/6 posted today · be the first' (Recommended)

### Q3: How does the Today GroupCard's social line stay live (Realtime)?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing per-user channel + add a per-group counter channel | One channel per visible card on `group_members.group_id=eq.{id}`. Cleanup via useFocusEffect. | ✓ |
| Refetch on focus + pull-to-refresh only | Cheaper but breaks LB-02 'updates in near real time' on the home surface. | |
| Single broadcast channel for all visible groups | Impossible — postgres_changes filters are single-column per P3 D-13. | |

**User's choice:** Reuse existing per-user channel + add a per-group counter channel (Recommended)

### Q4: What's the relationship between the Today screen and the group-detail leaderboard/feed?

| Option | Description | Selected |
|--------|-------------|----------|
| Today GroupCard tap continues to route to group-detail | Same as today; group-detail is now the social-context destination. | ✓ |
| Today card tap → capture flow; long-press → group detail | Optimizes for submit; mismatches existing P3 contract. | |
| Add a 'View leaderboard' chip on each Today card | Explicit drill-through; could combine with option 1. | |

**User's choice:** Today GroupCard tap continues to route to group-detail (Recommended)

---

## Claude's Discretion

The following items were explicitly left to Claude during planning/implementation (not deferred — they ship in P4, the user just declined to over-specify):

- Exact tombstone copy ("Sam — missed yesterday" vs. batched "3 missed yesterday: Sam, Riley, Jordan").
- Avatar-row treatment for "Still to post" (overlapping circles vs. separated row vs. count-only-if-many).
- Empty-state copy for the leaderboard when no member has any points yet.
- Whether `longest_streak` is exposed on the leaderboard row in P4 or held back as P6 polish.
- Cross-fade animation on the Today social-signal line update — default off, revisit if janky.
- Exact RPC return shape for the leaderboard read (TanStack join hook vs. small RPC).
- Which existing UI primitives the leaderboard row reuses (extending GroupCard? new LeaderboardRow? Avatar + Text composition?).
- pgTAP coverage shape for the trigger body — aim for parity with 0006's pgTAP density (≥4 files).
- Optional column-allowlist trigger on `group_members` UPDATE (D-19) — research/planner picks the cleanest approach.

---

## Deferred Ideas

Captured in `04-CONTEXT.md` `<deferred>` block; preserved here for audit:

- Persisted `daily_misses` table → Phase 5
- Push notifications for member-posted / approved / streak-broken → Phase 5 (NOTIF-02..04)
- Re-engagement / comeback narrative → Phase 6 (RE-01..04, Pitfall #7)
- Multi-day tombstone history (last 7 days) → not on roadmap
- Reactions / comments on feed posts → permanently out (PROJECT.md)
- Streak-broken badge / "last streak: N days" chip → P6 if needed
- Longest_streak surface on leaderboard → Claude's discretion in P4
- Group-health view for admins → Phase 6 (RE-02)
- Feed pagination beyond today → not needed; FEED-01 is single-day
- Bulk approve / reject from leaderboard surface → already deferred in P3
- Architecture-doc reword (`last_verified_local_date` → `last_rolled_date`) → low priority

---

*Discussion conducted 2026-05-06; CONTEXT.md and DISCUSSION-LOG.md committed in the same session.*
