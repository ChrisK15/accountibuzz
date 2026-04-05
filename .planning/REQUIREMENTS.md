# Requirements: AccountiBuzz

**Defined:** 2026-04-04
**Core Value:** The "you're the only one who didn't do it" moment — peer visibility drives action more than personal willpower.

## v1 Requirements

### Authentication & Profile

- [ ] **AUTH-01**: User can register with email and password
- [ ] **AUTH-02**: User can sign in with email and password
- [ ] **AUTH-03**: User can set a display name visible to group members
- [ ] **AUTH-04**: User timezone is auto-detected and can be manually overridden

### Group Management

- [ ] **GRP-01**: Group admin can create a group and choose Competitive or Collaborative mode
- [ ] **GRP-02**: Group admin can generate an invite link to share with friends
- [ ] **GRP-03**: Prospective member can join a group via invite link
- [ ] **GRP-04**: Group admin can configure daily challenge details (name, description, deadline)
- [ ] **GRP-05**: Group admin can promote a member to co-admin
- [ ] **GRP-06**: Group admin can change group mode between Competitive and Collaborative
- [ ] **GRP-07**: Group member can set their status to Sabbatical to preserve streak during planned break

### Proof Submission

- [ ] **PROOF-01**: Group member can record a video using the in-app camera
- [ ] **PROOF-02**: Group member can upload a video or screen recording from gallery
- [ ] **PROOF-03**: Group member can upload a photo as proof
- [ ] **PROOF-04**: Submission is timestamped at initiation (not upload completion)
- [ ] **PROOF-05**: Submission is queued offline and auto-retried on reconnection

### Admin Verification & Review

- [ ] **VRFY-01**: Group admin can view a pending review queue of all member submissions
- [ ] **VRFY-02**: Group admin can approve a submission (member receives streak credit)
- [ ] **VRFY-03**: Group admin can request resubmission with written feedback
- [ ] **VRFY-04**: Group admin can flag a submission for integrity violation
- [ ] **VRFY-05**: Submission auto-approves after 8 hours if admin hasn't reviewed
- [ ] **VRFY-06**: Admin inactivity triggers an escalation notification

### Streak & Grace System

- [ ] **STRK-01**: Group member can see their current streak count
- [ ] **STRK-02**: Group member automatically receives one grace day per week
- [ ] **STRK-03**: Group member can earn and apply one streak freeze per 30-day cycle
- [ ] **STRK-04**: Streak is finalized after review and backdated to the correct day
- [ ] **STRK-05**: 10-minute technical grace window applies at the deadline

### Leaderboard & Completion Board

- [ ] **LEAD-01**: Competitive mode shows a real-time ranked leaderboard
- [ ] **LEAD-02**: Collaborative mode shows a completion board (who has submitted)
- [ ] **LEAD-03**: Milestone broadcast sent when a member hits 7, 30, or 60-day streak

### Push Notifications

- [ ] **NOTF-01**: Member receives two daily submission reminders
- [ ] **NOTF-02**: Member receives push notification when submission is reviewed
- [ ] **NOTF-03**: Member can choose notification intensity: Gentle or Firm
- [ ] **NOTF-04**: Tapping any push notification deep-links to the relevant screen
- [ ] **NOTF-05**: Admin receives push reminders when submissions are awaiting review

## v2 Requirements

### Proof Types (Expanded)

- **PROOF-V2-01**: Honor system check-in (tap to confirm, no media)
- **PROOF-V2-02**: Screenshot proof (for leetcode-style challenges)
- **PROOF-V2-03**: External link as proof (e.g. LeetCode profile)

### Group Features (Expanded)

- **GRP-V2-01**: Multiple active challenges per group
- **GRP-V2-02**: Group discovery / public groups for strangers
- **GRP-V2-03**: Leaderboard customization by group admin

### Notifications (Expanded)

- **NOTF-V2-01**: Custom reminder message per group challenge
- **NOTF-V2-02**: Email notifications as fallback

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time chat | Not core to accountability loop, high complexity |
| OAuth / social login | Email/password sufficient for v1 |
| Web app | Mobile-first (Expo); web deferred |
| Video editing / trimming | Out of scope for v1 proof flow |
| Public groups / stranger discovery | Peer pressure requires trust; invite-only for v1 |
| Multiple challenges per group | One challenge keeps UX focused; deferred to v2 |

## Traceability

| Requirement | Phase | Jira | Status |
|-------------|-------|------|--------|
| AUTH-01 | Phase 1 | SCRUM-9 | Pending |
| AUTH-02 | Phase 1 | SCRUM-10 | Pending |
| AUTH-03 | Phase 1 | SCRUM-11 | Pending |
| AUTH-04 | Phase 1 | SCRUM-12 | Pending |
| GRP-01 | Phase 2 | SCRUM-13 | Pending |
| GRP-02 | Phase 2 | SCRUM-14 | Pending |
| GRP-03 | Phase 2 | SCRUM-15 | Pending |
| GRP-04 | Phase 2 | SCRUM-16 | Pending |
| GRP-05 | Phase 2 | SCRUM-17 | Pending |
| GRP-06 | Phase 2 | SCRUM-19 | Pending |
| GRP-07 | Phase 2 | SCRUM-18 | Pending |
| PROOF-01 | Phase 3 | SCRUM-20 | Pending |
| PROOF-02 | Phase 3 | SCRUM-21 | Pending |
| PROOF-03 | Phase 3 | SCRUM-22 | Pending |
| PROOF-04 | Phase 3 | SCRUM-23 | Pending |
| PROOF-05 | Phase 3 | SCRUM-24 | Pending |
| VRFY-01 | Phase 4 | SCRUM-25 | Pending |
| VRFY-02 | Phase 4 | SCRUM-26 | Pending |
| VRFY-03 | Phase 4 | SCRUM-27 | Pending |
| VRFY-04 | Phase 4 | SCRUM-28 | Pending |
| VRFY-05 | Phase 4 | SCRUM-29 | Pending |
| VRFY-06 | Phase 4 | SCRUM-30 | Pending |
| STRK-01 | Phase 5 | SCRUM-31 | Pending |
| STRK-02 | Phase 5 | SCRUM-32 | Pending |
| STRK-03 | Phase 5 | SCRUM-33 | Pending |
| STRK-04 | Phase 5 | SCRUM-34 | Pending |
| STRK-05 | Phase 5 | SCRUM-35 | Pending |
| LEAD-01 | Phase 6 | SCRUM-36 | Pending |
| LEAD-02 | Phase 6 | SCRUM-37 | Pending |
| LEAD-03 | Phase 6 | SCRUM-38 | Pending |
| NOTF-01 | Phase 7 | SCRUM-39 | Pending |
| NOTF-02 | Phase 7 | SCRUM-40 | Pending |
| NOTF-03 | Phase 7 | SCRUM-41 | Pending |
| NOTF-04 | Phase 7 | SCRUM-42 | Pending |
| NOTF-05 | Phase 7 | SCRUM-43 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after initial project questioning + Jira sync (SCRUM-9 to SCRUM-43)*
