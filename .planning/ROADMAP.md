# AccountiBuzz — Roadmap

**Project:** AccountiBuzz
**Core Value:** The "you're the only one who didn't do it" moment — peer visibility drives action more than personal willpower.
**Generated:** 2026-04-04
**Granularity:** Fine (12 phases)
**Coverage:** 34/34 v1 requirements mapped

---

## Phases

- [ ] **Phase 1: Firebase Auth + Registration/Login Screens** - Users can create accounts and sign in via email/password
- [ ] **Phase 2: Profile Setup + Timezone** - New users complete their profile with display name and timezone
- [ ] **Phase 3: Create Group + Invite Link** - Admins can create groups, configure mode, and generate invite links for friends to join
- [ ] **Phase 4: Admin Controls + Challenge Config** - Admins can configure challenges, manage members, and control group settings
- [ ] **Phase 5: Camera/Gallery Proof Capture** - Members can record video in-app or select photo/video from gallery
- [ ] **Phase 6: Upload Pipeline + Offline Queue** - Submissions are timestamped at initiation, uploaded to Firebase Storage, and queued when offline
- [ ] **Phase 7: Admin Review Queue UI** - Admins can view and act on a pending submission queue
- [ ] **Phase 8: Approval Logic + Auto-Approve** - Approval decisions finalize streak credit; submissions auto-approve after 8 hours; inactivity escalates
- [ ] **Phase 9: Streak Tracking** - Members see their live streak count, which is backdated correctly after review
- [ ] **Phase 10: Grace Day + Freeze + Edge Cases** - Streak-preservation mechanics (weekly grace day, 30-day freeze, 10-minute technical window, Sabbatical status)
- [ ] **Phase 11: Leaderboard + Completion Board** - Competitive mode shows ranked leaderboard; Collaborative mode shows who has submitted; milestones broadcast
- [ ] **Phase 12: Push Notifications + Deep Links** - FCM tokens registered; submission reminders, review alerts, admin nudges, and notification deep-linking wired up

---

## Phase Details

### Phase 1: Firebase Auth + Registration/Login Screens
**Goal:** Users can register and sign in to AccountiBuzz with email and password
**Depends on:** Nothing (first phase — scaffold exists with Firebase config)
**Requirements:** AUTH-01, AUTH-02
**Jira Stories:** SCRUM-9, SCRUM-10
**Success Criteria** (what must be TRUE):
  1. A new user can open the app, tap "Register", enter email + password, and land on the main app
  2. An existing user can open the app, tap "Sign In", enter credentials, and land on the main app
  3. An incorrect password shows an inline error message without crashing
  4. A signed-in user who force-quits and re-opens the app is still authenticated (session persists)
  5. Signing out returns the user to the auth screens
**Plans**: TBD
**UI hint**: yes

### Phase 2: Profile Setup + Timezone
**Goal:** After registration, users complete their profile with a display name and their timezone is auto-detected
**Depends on:** Phase 1
**Requirements:** AUTH-03, AUTH-04
**Jira Stories:** SCRUM-11, SCRUM-12
**Success Criteria** (what must be TRUE):
  1. After registering, the user is prompted to enter a display name before entering the main app
  2. The display name is visible to other group members on all group screens
  3. The user's timezone is auto-detected from the device on first launch
  4. The user can manually override the detected timezone from their profile settings
  5. Deadline calculations for the user's group reflect the correct local time based on their timezone
**Plans**: TBD
**UI hint**: yes

### Phase 3: Create Group + Invite Link
**Goal:** Group admins can create a group, choose its mode, and share an invite link that lets friends join
**Depends on:** Phase 2
**Requirements:** GRP-01, GRP-02, GRP-03
**Jira Stories:** SCRUM-13, SCRUM-14, SCRUM-15
**Success Criteria** (what must be TRUE):
  1. An authenticated user can create a new group and become its admin
  2. During group creation the admin selects either Competitive or Collaborative mode
  3. The admin can generate a shareable invite link from the group screen
  4. A new user who taps the invite link is deep-linked into the app and lands on a join confirmation screen
  5. After confirming, the new member appears in the group member list
  6. The invite link remains valid until the admin revokes it (no expiry in v1)
**Plans**: TBD
**UI hint**: yes

### Phase 4: Admin Controls + Challenge Config
**Goal:** Admins can configure the group's daily challenge, promote co-admins, and toggle the group mode
**Depends on:** Phase 3
**Requirements:** GRP-04, GRP-05, GRP-06, GRP-07
**Jira Stories:** SCRUM-16, SCRUM-17, SCRUM-18, SCRUM-19
**Success Criteria** (what must be TRUE):
  1. Admin can set challenge name, description, and daily deadline from a group settings screen
  2. Challenge details are visible to all group members on the home screen
  3. Admin can promote any member to co-admin; co-admin gains review queue access
  4. Admin can switch the group between Competitive and Collaborative mode; the leaderboard/completion board updates immediately
  5. A member can mark themselves as "Sabbatical"; their streak is preserved and they do not appear in the pending queue during that period
**Plans**: TBD
**UI hint**: yes

### Phase 5: Camera/Gallery Proof Capture
**Goal:** Members can record a video using the in-app camera or select a photo/video from their device gallery as proof
**Depends on:** Phase 4
**Requirements:** PROOF-01, PROOF-02, PROOF-03
**Jira Stories:** SCRUM-20, SCRUM-21, SCRUM-22
**Success Criteria** (what must be TRUE):
  1. Tapping "Submit Proof" opens a capture screen with options: Record Video, Upload Video, Upload Photo
  2. "Record Video" opens the in-app camera; recording stops and previews the clip before confirming
  3. "Upload Video" opens the device gallery filtered to video files
  4. "Upload Photo" opens the device gallery filtered to images
  5. The captured/selected media is displayed in a preview screen before the user confirms submission
  6. Camera and media library permissions are requested with explanation; if denied, a graceful message is shown
**Plans**: TBD
**UI hint**: yes

### Phase 6: Upload Pipeline + Offline Queue
**Goal:** Confirmed submissions are timestamped at initiation, uploaded to Firebase Storage, and reliably queued and retried when the device is offline
**Depends on:** Phase 5
**Requirements:** PROOF-04, PROOF-05
**Jira Stories:** SCRUM-23, SCRUM-24
**Success Criteria** (what must be TRUE):
  1. The submission timestamp recorded in Firestore reflects when the user tapped "Confirm", not when the upload finishes
  2. A submission confirmed while online uploads immediately and appears in the admin queue
  3. A submission confirmed while offline is persisted to AsyncStorage with a pending status
  4. When connectivity is restored, queued submissions upload automatically without user intervention
  5. An upload progress indicator is visible during active upload
  6. If a queued upload fails after retry, the user sees an error with a manual retry option
**Plans**: TBD
**UI hint**: yes

### Phase 7: Admin Review Queue UI
**Goal:** Admins can open a review queue, browse pending submissions, and play back the submitted media before making a decision
**Depends on:** Phase 6
**Requirements:** VRFY-01, VRFY-02, VRFY-03, VRFY-04
**Jira Stories:** SCRUM-25, SCRUM-26, SCRUM-27, SCRUM-28
**Success Criteria** (what must be TRUE):
  1. Admin sees a badge count on the Admin tab when unreviewed submissions are pending
  2. The review queue lists all pending submissions with submitter name, timestamp, and thumbnail
  3. Admin can tap a submission to open the detail view and play back the video or view the photo
  4. Admin can approve a submission with one tap; the submitter receives streak credit
  5. Admin can request resubmission with written feedback; the submitter is notified with the feedback text
  6. Admin can flag a submission for integrity violation; flagged submissions are stored and not credited
  7. Reviewed submissions disappear from the pending queue immediately
**Plans**: TBD
**UI hint**: yes

### Phase 8: Approval Logic + Auto-Approve
**Goal:** Approved submissions correctly credit streaks; submissions auto-approve after 8 hours of admin inactivity; escalation triggers when admin is persistently inactive
**Depends on:** Phase 7
**Requirements:** VRFY-05, VRFY-06
**Jira Stories:** SCRUM-29, SCRUM-30
**Success Criteria** (what must be TRUE):
  1. A submission that has been pending for 8 hours without admin action is automatically approved by a Cloud Function
  2. Auto-approved submissions receive the same streak credit as manually approved ones
  3. When auto-approval fires, the submitter receives a push notification confirming approval
  4. When the 8-hour window is approaching and no admin has acted, an escalation push notification is sent to all co-admins
  5. The review queue correctly reflects auto-approved submissions as resolved
**Plans**: TBD

### Phase 9: Streak Tracking
**Goal:** Members can see their current streak count, and streak values are finalized (backdated if necessary) after admin review
**Depends on:** Phase 8
**Requirements:** STRK-01, STRK-04
**Jira Stories:** SCRUM-31, SCRUM-34
**Success Criteria** (what must be TRUE):
  1. Each member's streak count is prominently displayed on the home screen and profile screen
  2. The streak count increments only after a submission for that day has been approved (manual or auto)
  3. When a submission is approved after midnight, the streak is backdated to the submission day (not the approval day)
  4. A member who submits every day for N days shows a streak of N
  5. Missing a day (without grace or freeze) resets the streak to 0
**Plans**: TBD
**UI hint**: yes

### Phase 10: Grace Day + Freeze + Edge Cases
**Goal:** Streak-preservation mechanics work correctly: weekly grace day, 30-day freeze, 10-minute technical grace window, and Sabbatical status protect streaks during legitimate interruptions
**Depends on:** Phase 9
**Requirements:** STRK-02, STRK-03, STRK-05, GRP-07
**Jira Stories:** SCRUM-32, SCRUM-33, SCRUM-35, SCRUM-18
**Success Criteria** (what must be TRUE):
  1. A member who misses one day per week has their streak automatically preserved by the grace day (no manual action needed)
  2. A grace day is consumed only once per week; missing two days in one week breaks the streak on the second miss
  3. A member can see their available streak freeze in the profile; applying it prevents streak loss for one missed day per 30-day cycle
  4. A submission initiated within 10 minutes after the daily deadline is counted as on-time
  5. A member on Sabbatical does not lose their streak for missed days during the Sabbatical period
  6. All grace/freeze/Sabbatical mechanics are visible to the member in their streak detail view
**Plans**: TBD
**UI hint**: yes

### Phase 11: Leaderboard + Completion Board
**Goal:** Competitive groups display a real-time ranked leaderboard; Collaborative groups display a completion board; milestone streaks broadcast to the group
**Depends on:** Phase 10
**Requirements:** LEAD-01, LEAD-02, LEAD-03
**Jira Stories:** SCRUM-36, SCRUM-37, SCRUM-38
**Success Criteria** (what must be TRUE):
  1. A Competitive group shows a ranked list of all members sorted by current streak (highest first), updating in real-time as submissions are approved
  2. A Collaborative group shows a grid/list of all members with a checkmark indicating who has submitted today
  3. The Collaborative board updates in real-time without requiring a manual refresh
  4. When a member reaches a 7, 30, or 60-day streak, an in-app milestone card is shown to all group members
  5. The leaderboard/completion board correctly reflects the group mode set by the admin
**Plans**: TBD
**UI hint**: yes

### Phase 12: Push Notifications + Deep Links
**Goal:** FCM tokens are registered per device; members receive daily reminders, review result notifications, and notification deep-links navigate to the correct screen; admins receive review queue nudges
**Depends on:** Phase 11
**Requirements:** NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05
**Jira Stories:** SCRUM-39, SCRUM-40, SCRUM-41, SCRUM-42, SCRUM-43
**Success Criteria** (what must be TRUE):
  1. On first launch (post-auth), the app requests notification permission and stores the FCM token in Firestore against the user's profile
  2. Each member receives two daily push reminders (at user-configurable or group-default times) when they have not yet submitted
  3. A member receives a push notification when their submission is approved, rejected, or flagged
  4. An admin receives a push notification when new submissions are awaiting review
  5. Members can choose Gentle (one nudge/day) or Firm (two nudges/day + escalation) notification intensity from profile settings
  6. Tapping any push notification opens the app and navigates directly to the relevant screen (submission screen, review queue, or streak detail)
  7. Notifications are not sent to members who are on Sabbatical
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Firebase Auth + Registration/Login Screens | 0/? | Not started | - |
| 2. Profile Setup + Timezone | 0/? | Not started | - |
| 3. Create Group + Invite Link | 0/? | Not started | - |
| 4. Admin Controls + Challenge Config | 0/? | Not started | - |
| 5. Camera/Gallery Proof Capture | 0/? | Not started | - |
| 6. Upload Pipeline + Offline Queue | 0/? | Not started | - |
| 7. Admin Review Queue UI | 0/? | Not started | - |
| 8. Approval Logic + Auto-Approve | 0/? | Not started | - |
| 9. Streak Tracking | 0/? | Not started | - |
| 10. Grace Day + Freeze + Edge Cases | 0/? | Not started | - |
| 11. Leaderboard + Completion Board | 0/? | Not started | - |
| 12. Push Notifications + Deep Links | 0/? | Not started | - |

---

## Coverage Map

| Requirement | Phase | Jira | Status |
|-------------|-------|------|--------|
| AUTH-01 | Phase 1 | SCRUM-9 | Pending |
| AUTH-02 | Phase 1 | SCRUM-10 | Pending |
| AUTH-03 | Phase 2 | SCRUM-11 | Pending |
| AUTH-04 | Phase 2 | SCRUM-12 | Pending |
| GRP-01 | Phase 3 | SCRUM-13 | Pending |
| GRP-02 | Phase 3 | SCRUM-14 | Pending |
| GRP-03 | Phase 3 | SCRUM-15 | Pending |
| GRP-04 | Phase 4 | SCRUM-16 | Pending |
| GRP-05 | Phase 4 | SCRUM-17 | Pending |
| GRP-06 | Phase 4 | SCRUM-19 | Pending |
| GRP-07 | Phase 4 + 10 | SCRUM-18 | Pending |
| PROOF-01 | Phase 5 | SCRUM-20 | Pending |
| PROOF-02 | Phase 5 | SCRUM-21 | Pending |
| PROOF-03 | Phase 5 | SCRUM-22 | Pending |
| PROOF-04 | Phase 6 | SCRUM-23 | Pending |
| PROOF-05 | Phase 6 | SCRUM-24 | Pending |
| VRFY-01 | Phase 7 | SCRUM-25 | Pending |
| VRFY-02 | Phase 7 | SCRUM-26 | Pending |
| VRFY-03 | Phase 7 | SCRUM-27 | Pending |
| VRFY-04 | Phase 7 | SCRUM-28 | Pending |
| VRFY-05 | Phase 8 | SCRUM-29 | Pending |
| VRFY-06 | Phase 8 | SCRUM-30 | Pending |
| STRK-01 | Phase 9 | SCRUM-31 | Pending |
| STRK-04 | Phase 9 | SCRUM-34 | Pending |
| STRK-02 | Phase 10 | SCRUM-32 | Pending |
| STRK-03 | Phase 10 | SCRUM-33 | Pending |
| STRK-05 | Phase 10 | SCRUM-35 | Pending |
| LEAD-01 | Phase 11 | SCRUM-36 | Pending |
| LEAD-02 | Phase 11 | SCRUM-37 | Pending |
| LEAD-03 | Phase 11 | SCRUM-38 | Pending |
| NOTF-01 | Phase 12 | SCRUM-39 | Pending |
| NOTF-02 | Phase 12 | SCRUM-40 | Pending |
| NOTF-03 | Phase 12 | SCRUM-41 | Pending |
| NOTF-04 | Phase 12 | SCRUM-42 | Pending |
| NOTF-05 | Phase 12 | SCRUM-43 | Pending |

**v1 requirements total:** 34
**Mapped:** 34
**Unmapped:** 0

---

## Dependency Chain

```
Phase 1: Firebase Auth
    ↓
Phase 2: Profile Setup
    ↓
Phase 3: Create Group + Invite
    ↓
Phase 4: Admin Controls + Challenge
    ↓
Phase 5: Capture (Camera/Gallery)
    ↓
Phase 6: Upload Pipeline + Offline Queue
    ↓
Phase 7: Review Queue UI
    ↓
Phase 8: Approval Logic + Auto-Approve
    ↓
Phase 9: Streak Tracking
    ↓
Phase 10: Grace/Freeze/Edge Cases
    ↓
Phase 11: Leaderboard + Completion Board
    ↓
Phase 12: Push Notifications + Deep Links
```

All phases are strictly sequential — each phase depends on the one before it. The accountability loop (submit → review → streak → leaderboard) cannot be short-circuited.

---

## Stack Notes

- **Firebase Cloud Functions** are required for Phase 8 (auto-approve at 8h), Phase 9/10 (streak finalization), and Phase 12 (FCM dispatch). These run server-side and are not part of the Expo client codebase.
- **Expo Managed Workflow** — no bare ejection needed. `expo-camera`, `expo-image-picker`, `expo-notifications` are all managed modules already in `package.json`.
- **Path alias `@/*`** resolves to `src/*` — all internal imports use this alias.
- **GRP-07 (Sabbatical)** spans two phases: the UI to set status is built in Phase 4; the streak behavior during Sabbatical is enforced in Phase 10.

---

*Roadmap created: 2026-04-04*
*Granularity: Fine — 12 phases, natural delivery boundaries derived from 7 Jira epics*
