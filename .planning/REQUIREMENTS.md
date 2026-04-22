# Requirements: Accountibuzz

**Defined:** 2026-04-21
**Core Value:** A missed day is visible to your group within hours — the social cost of skipping is what keeps you accountable.

## v1 Requirements

Requirements for initial MVP release to friend groups.

### Authentication

- [ ] **AUTH-01**: User can sign up for an account on a mobile device (email + password)
- [ ] **AUTH-02**: User can log in and their session persists across app restarts
- [ ] **AUTH-03**: User can log out from the app
- [ ] **AUTH-04**: User can create a profile with a display name and avatar

### Groups

- [ ] **GRP-01**: User can create a group with a name, a shared goal description, a group timezone, and a submission type (photo OR video)
- [ ] **GRP-02**: Group creator is the admin of that group
- [ ] **GRP-03**: User can view the list of groups they belong to
- [ ] **GRP-04**: User can view a group's details, members, and rules
- [ ] **GRP-05**: User can leave a group

### Invites

- [ ] **INV-01**: Admin can generate a shareable invite link/code for their group
- [ ] **INV-02**: User can join a group by opening an invite link or entering an invite code
- [ ] **INV-03**: Group size is capped at 10 members (soft cap for MVP)

### Submissions

- [ ] **SUB-01**: Member can capture and submit a photo (if group is photo-type) before the group's local midnight cutoff
- [ ] **SUB-02**: Member can capture and submit a short video (if group is video-type) before the group's local midnight cutoff
- [ ] **SUB-03**: Upload is resilient to flaky networks (resumable + offline queue + retry)
- [ ] **SUB-04**: Member can see the status of their submission (pending / approved / rejected)
- [ ] **SUB-05**: Member is blocked from submitting twice on the same local day
- [ ] **SUB-06**: Member can optionally add a short caption to their submission

### Admin Review

- [ ] **ADM-01**: Admin sees a queue of pending submissions for groups they admin
- [ ] **ADM-02**: Admin can approve a submission
- [ ] **ADM-03**: Admin can reject a submission with an optional short reason
- [ ] **ADM-04**: Rejected submissions notify the submitter so they can resubmit before cutoff

### Points, Streaks, Leaderboard

- [ ] **PTS-01**: Each verified submission awards 1 point and increments the member's streak in that group
- [ ] **PTS-02**: A day without a verified submission resets that member's streak to zero
- [ ] **PTS-03**: Streaks and points are derived server-side and consistent with the group timezone
- [ ] **LB-01**: Group has a leaderboard ranked by total points, showing each member's current streak
- [ ] **LB-02**: Leaderboard updates in near real time as submissions are approved

### Group Feed

- [ ] **FEED-01**: Group members can see today's submissions (approved items) for their group
- [ ] **FEED-02**: Feed shows which members have not submitted yet today
- [ ] **FEED-03**: Feed shows missed-day tombstones for yesterday's misses

### Notifications

- [ ] **NOTIF-01**: Member receives a push reminder before the group's daily cutoff if they haven't submitted
- [ ] **NOTIF-02**: Member receives a push when another group member posts a submission
- [ ] **NOTIF-03**: Admin receives a push when a submission needs review
- [ ] **NOTIF-04**: Member receives a push when the admin approves or rejects their submission
- [ ] **NOTIF-05**: App handles push on both iOS and Android via an EAS dev/production build

### Daily Rollover (Infrastructure)

- [ ] **ROLL-01**: At each group's local midnight, the system finalizes the day — members without approved submissions have their streak reset and a tombstone created
- [ ] **ROLL-02**: Rollover is idempotent and DST-safe

### Platform / Security

- [ ] **PLAT-01**: App runs on iOS and Android via Expo (SDK 55)
- [ ] **PLAT-02**: All data access is gated by Supabase Row-Level Security; a CI check fails builds if a table has RLS disabled
- [ ] **PLAT-03**: Group admin can only approve/reject submissions for groups they admin (enforced by RLS)

## v2 Requirements

Acknowledged but deferred.

### Retention & Re-engagement

- **RE-01**: Post-broken-streak re-entry ritual (without violating strict reset)
- **RE-02**: Admin "group health" view — late-approver signals, missed-day rates
- **RE-03**: Onboarding flow that encourages inviting more people than the target size
- **RE-04**: Instrumentation for admin response time and week-1/week-2 retention

### Differentiators

- **FEAT-01**: Public group discovery
- **FEAT-02**: Web/desktop clients
- **FEAT-03**: Monetization / premium groups

## Out of Scope

Explicitly excluded.

| Feature | Reason |
|---------|--------|
| Streak freezes / grace days / configurable strictness | Strict miss-resets streak is the core pressure mechanic |
| Scaling point values with streak length or milestone bonuses | 1 pt/day keeps MVP simple; iterate only after seeing group behavior |
| Rotating / democratic / AI-assisted verification | Single creator-as-admin is simplest; revisit only if bottlenecked |
| Auto-approve after N hours | Pending-until-reviewed keeps the human-trust anchor explicit |
| Financial stakes (stickK-style) | Off-thesis for friend-group social-pressure MVP |
| In-app comments, DMs, or chat | Conflicts with the quiet, pressure-by-presence positioning |
| Camera-roll uploads (default) | Credibility of proof depends on in-moment capture |
| Public group discovery | Invite-only leverages existing social trust; avoids moderation surface |
| Per-group custom cutoff times | One less setting to get wrong; group timezone + midnight is enough |
| Web/desktop client | Mobile is where the daily capture behavior happens |
| Real-time chat | High complexity, not core |
| OAuth / magic-link / phone OTP (for MVP) | Email/password via Supabase Auth is enough to start |

## Traceability

Filled in during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01…04 | TBD | Pending |
| GRP-01…05 | TBD | Pending |
| INV-01…03 | TBD | Pending |
| SUB-01…06 | TBD | Pending |
| ADM-01…04 | TBD | Pending |
| PTS-01…03 | TBD | Pending |
| LB-01…02 | TBD | Pending |
| FEED-01…03 | TBD | Pending |
| NOTIF-01…05 | TBD | Pending |
| ROLL-01…02 | TBD | Pending |
| PLAT-01…03 | TBD | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 35

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 after initial definition*
