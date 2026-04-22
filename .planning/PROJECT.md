# Accountibuzz

## What This Is

Accountibuzz is a mobile app where small groups of 5–10 people pursue shared goals together. Every day each member submits a short photo or video as proof they completed their task; the group admin verifies submissions, which earn points, build streaks, and drive a group leaderboard. The social pressure of a tight-knit group plus gamification keeps everyone showing up. The target user is someone who struggles to keep commitments to themselves and knows they follow through when friends are watching.

## Core Value

A missed day is visible to your group within hours — the social cost of skipping is what keeps you accountable. If this mechanic fails, nothing else matters.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. Hypotheses until shipped. -->

- [ ] User can sign up and log into a mobile app (React Native / Expo)
- [ ] User can create a group, set its goal description, choose submission type (photo or video), and pick the group timezone
- [ ] User can invite people to a group via a shareable link/code
- [ ] User can join a group by opening a link or entering a code
- [ ] Group member can submit the required media type (photo OR video — set by admin) before the group's local-midnight cutoff
- [ ] Admin can review pending submissions and approve or reject each one
- [ ] Verified submission awards 1 point and increments the member's streak
- [ ] Missing a daily submission resets the member's streak to zero
- [ ] Group shows a leaderboard ranked by total points, with each member's current streak visible
- [ ] Push notifications: pre-deadline reminder, plus pings when group members post and when the admin reviews submissions

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Public group discovery — MVP is invite-only via link/code; discovery adds trust/safety complexity we don't need to test the core mechanic
- Grace days, streak recovery, or configurable strictness — strict "miss = reset" maximizes social pressure, which is the whole point
- Scaling point values with streak length or milestone bonuses — 1 point per verified day keeps the MVP simple; iterate after we see what groups actually want
- Rotating admins, peer/democratic verification, or AI-assisted review — single group-creator-as-admin is simplest; revisit only if it proves to be a bottleneck in testing
- Auto-approval fallback when admin is slow — pending-until-reviewed is explicit; if it becomes a real problem in friend-group testing we'll address it then
- Monetization, subscriptions, web app, Android-first nuances beyond what Expo gives for free
- Custom per-group daily cutoff times — group timezone + midnight is one less setting to get wrong

## Context

- **Solo builder, personal itch:** The creator struggles with self-set goals and knows social pressure is what makes them follow through. The product exists to solve their own accountability gap first, which gives a clear dogfooding loop.
- **MVP audience is the creator's friend groups:** First users are real small groups of people who know each other. No cold-start discovery problem to solve.
- **Mobile-first by nature:** Daily photo/video capture is a camera-in-the-pocket behavior. A mobile web PWA would compromise the capture UX, so native/Expo is the right shape.
- **Trust model is social, not algorithmic:** Verification is human (admin reviews). The group's shared context — friends, coworkers, accountability buddies — makes subjective "did they actually do it?" judgments workable without complex anti-fraud tooling.
- **Supabase is an explicit choice:** Postgres + Auth + Storage + Realtime + Edge Functions cover everything the MVP needs (accounts, media uploads, leaderboards, push) in a single managed platform with strong DX for a solo builder.

## Constraints

- **Tech stack**: React Native via Expo — Cross-platform iOS/Android from one codebase; fastest path to shipping for a solo MVP builder.
- **Backend**: Supabase — Postgres + auth + storage + realtime in one managed platform; minimizes infra work.
- **Team size**: Solo builder — Scope must stay tight; avoid anything that multiplies surface area (multi-admin models, discovery, complex gamification).
- **Launch target**: MVP for friend groups, not App Store at day one — Can run via Expo Go / TestFlight / internal distribution; real store submission is a later decision.
- **Goal categories**: Goal-agnostic — No vertical-specific UI (fitness tracking, study sessions, etc.). Positioning is on the accountability mechanic itself, not any one domain.
- **Verification latency**: Admin-gated — Submissions stay "pending" until the admin acts. Acceptable for friend-group MVP; will be revisited if it causes friction.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Native + Expo | Solo builder, cross-platform, fastest to ship | — Pending |
| Supabase as backend | All-in-one (auth, Postgres, storage, realtime, push); great DX | — Pending |
| Goal-agnostic, not vertical | Mechanic is the product; niching later if signal emerges | — Pending |
| Single creator-as-admin | Simplest trust model; revisit if it bottlenecks testing | — Pending |
| Invite-only via link/code (no discovery) | Leverages existing social trust; skips moderation/safety surface | — Pending |
| Group-timezone midnight cutoff | One setting per group; no per-user timezone math on the hot path | — Pending |
| Submission type fixed per group (admin picks photo OR video) | Consistent group norm; simpler capture UI than "user chooses" | — Pending |
| Strict streak reset on miss | Maximizes social pressure — the core value mechanic | — Pending |
| 1 point per verified day (flat) | Simplest leaderboard; iterate only after seeing real group behavior | — Pending |
| Pending-until-reviewed (no auto-approve) | Keeps admin-as-human-trust-anchor; revisit if slow | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-21 after initialization*
