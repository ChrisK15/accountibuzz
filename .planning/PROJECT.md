# AccountiBuzz

## What This Is

AccountiBuzz is a social accountability app for small groups of friends who want to motivate each other through peer pressure. Members join a group with a shared challenge (e.g. daily pushups, workout, leetcode), submit photo/video proof of completion, and watch in real-time as friends check in — creating the social pressure to not be the last one out.

## Core Value

The "you're the only one who didn't do it" moment — peer visibility drives action more than personal willpower.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Users can register and sign in with email/password
- [ ] Users set a display name visible to their group
- [ ] Timezone auto-detection for accurate deadlines
- [ ] Group admins can create groups in Competitive or Collaborative mode
- [ ] Group admins generate invite links; members join via link
- [ ] Group admins configure daily challenge details
- [ ] Group admins can promote members to co-admin
- [ ] Members can set Sabbatical status to preserve streak during planned breaks
- [ ] Members submit proof via in-app video recording, gallery upload, or photo
- [ ] Submissions are timestamped at initiation (not upload completion)
- [ ] Submissions queue offline and auto-retry on reconnection
- [ ] Admins review a pending queue: approve, request resubmission, or flag for integrity
- [ ] Submissions auto-approve after 8 hours if admin hasn't reviewed
- [ ] Admin inactivity triggers escalation
- [ ] Members see their current streak count
- [ ] Members receive one grace day per week automatically
- [ ] Members earn one streak freeze per 30-day cycle
- [ ] Streak finalized after review, backdated to correct day
- [ ] 10-minute technical grace window at deadline
- [ ] Competitive mode: real-time ranked leaderboard
- [ ] Collaborative mode: completion board showing who submitted
- [ ] Milestone broadcasts at 7, 30, 60-day streaks
- [ ] Two daily submission reminders per member
- [ ] Push notification when submission is reviewed
- [ ] Notification intensity: Gentle or Firm
- [ ] Tapping a notification deep-links to the relevant screen
- [ ] Admins receive reminders when submissions await review

### Out of Scope

- Real-time chat — not core to accountability loop, adds complexity
- OAuth / social login — email/password sufficient for v1
- Web app — mobile-first (Expo)
- Video editing / trimming — out of scope for v1
- Public groups / stranger discovery — v1 is invite-only, friends only
- Multiple challenges per group — one challenge per group for v1

## Context

- **Stack**: React Native (Expo), Firebase (Auth, Firestore, Storage, Cloud Messaging)
- **Proof format**: Photo or video only for v1 (honor system / screenshot deferred)
- **Group size**: Small, tight-knit groups — the peer pressure mechanic breaks down at scale
- **Two modes**: Competitive (ranked leaderboard) and Collaborative (completion board)
- **Jira**: All user stories tracked in SCRUM project at comp586.atlassian.net (SCRUM-9 through SCRUM-43)
- **Codebase**: Expo + Firebase scaffold already initialized (see .planning/codebase/)

## Constraints

- **Tech Stack**: React Native (Expo) + Firebase — locked in, scaffold exists
- **Platform**: Mobile only (iOS + Android via Expo)
- **Proof v1**: Photo/video only — expand proof types post-launch
- **Group model**: One active challenge per group

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Expo + Firebase | Rapid mobile dev, real-time DB, push notifications built-in | — Pending |
| One challenge per group | Keeps UX simple, peer pressure works best in focused context | — Pending |
| Photo/video proof only (v1) | Tangible, harder to fake, doubles as progress tracking | — Pending |
| Invite-only groups | Preserves intimacy — peer pressure needs trust | — Pending |
| Auto-approve after 8h | Prevents admin inactivity from blocking member streaks | — Pending |

---
*Last updated: 2026-04-04 after initial project questioning + Jira sync*
