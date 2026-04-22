# Feature Research

**Domain:** Mobile social accountability / group habit app (small-group, daily media-proof, admin-verified, streak-based)
**Researched:** 2026-04-21
**Confidence:** HIGH — the competitor space (BeReal, StickK, Beeminder, Habitica, Strava clubs, Duolingo, Cohorty, Habitat, Done) is well-documented, and the PROJECT.md constraints sharply narrow what "must exist" looks like.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in a small-group daily-accountability mobile app. Missing any of these = app feels broken / incomplete / untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Auth / account (email or OAuth) | Can't have groups without identity | LOW | Supabase Auth handles it; keep to email + magic link or email+password for MVP. |
| Create group (name, goal description, timezone, submission type) | Already in Active requirements | LOW | One screen. Admin = creator. |
| Invite-link / shareable code to join | Core onboarding path; PROJECT.md explicitly picks this over discovery | LOW | Deep link + 6–8 char code. Supabase row + simple route. |
| Join group via link/code | Mirror of invite | LOW | Handle already-a-member and wrong-code cases. |
| Group member list / roster | Users need to see who else is in | LOW | Visible on leaderboard anyway. |
| Daily submission capture (photo OR video, per group-admin setting) | The core mechanic | MEDIUM | Expo Camera + upload to Supabase Storage. Video capped (e.g. 15s) to control size. Single-tap capture flow. |
| Submission upload + progress / retry on poor network | Mobile reality; failed uploads = lost streaks = rage-quit | MEDIUM | Resumable upload, background retry, clear "uploaded" vs "pending" vs "failed" state. Critical for trust. |
| "Today's status" for the current user (submitted? verified? rejected? not yet?) | User's #1 question every time they open the app | LOW | Home-screen hero component. |
| Admin review queue (approve / reject each submission) | In Active requirements; trust anchor | MEDIUM | List of pending items, tap-to-view media, approve/reject. Optional reject reason. |
| Group feed / daily view of today's submissions | Social pressure only works if members see each other's posts | MEDIUM | Chronological list of today's posts w/ status. Viewable by all group members. |
| Leaderboard (total points, current streak per member) | In Active requirements | LOW | Sorted list; recomputed on verify event. |
| Streak counter per member | Core gamification + social pressure | LOW | Derived from verified-day history; strict reset on miss per PROJECT.md. |
| Push notifications: pre-deadline reminder, new submissions, admin verdicts | In Active requirements; without them the feedback loop is broken | MEDIUM | Expo Notifications + Supabase Edge Functions for scheduled send. Timezone-aware. |
| Group-local-midnight cutoff enforcement | In Active requirements | MEDIUM | All "did they submit today?" logic keyed off the group's tz midnight; server-authoritative. |
| View a past submission (own and group members') | Proof history = social memory | LOW | Tap member → their history. Read-only. |
| Leave a group | Table stakes for any multi-user app | LOW | Remove from roster; keep historical records. |
| Admin: remove a member | Safety / group hygiene | LOW | Simple action; no appeals flow needed at MVP. |
| Delete account / sign out | App-store and basic trust requirement | LOW | Sign out is trivial; delete-account can be a support-ticket flow for MVP. |
| Offline-tolerant read | User will open app in spotty connection to check status | LOW-MEDIUM | Cache last feed + leaderboard. Submissions can queue. |
| Basic error / empty states | Not a feature per se, but missing = app feels broken | LOW | "No submissions yet today," "You're the first," "No network" etc. |

### Differentiators (Competitive Advantage)

Features that distinguish Accountibuzz from StickK / Beeminder / Habitica / BeReal / Strava / Duolingo within the stated positioning ("strict, simple, social-pressure-first, friend-group-sized").

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Small-group-only sizing (5–10) by design | Research shows 1:1 accountability ghosts 40% of the time; 5–15 cohorts are the sweet spot. Accountibuzz codifying the size is itself a differentiator vs unbounded groups (Habitica guilds, Strava clubs) | LOW | Soft cap (warn above 10), hard cap maybe 15. |
| Media-proof-required (not self-report) | StickK/Beeminder/Habitica all rely on honor-system check-ins. Photo/video proof is Accountibuzz's trust primitive — closer to BeReal's "show the moment" than habit-tracker check-boxes | MEDIUM | Already in Active; the whole capture UX is the moat. |
| Admin-verified (human trust anchor) | Contrasts with algorithmic/self-report apps. Subjective "did they actually do it?" works in friend groups and differentiates from generic habit trackers | MEDIUM | Already in Active. |
| Strict streak reset on miss | Most habit apps soften this (streak freezes, grace days, paid repair — Duolingo) and research warns it causes abandonment, but PROJECT.md explicitly picks strictness to maximize social pressure. Owning this stance IS the differentiation | LOW | Non-negotiable per PROJECT.md. Communicate it clearly at onboarding so expectations are set. |
| Fixed-type submission per group (admin picks photo OR video) | Consistent group norm; removes per-post decision fatigue; matches BeReal-style ritual over Habitica-style choice | LOW | Already in Active. |
| Group-timezone midnight (not per-user) | Makes "did anyone miss today?" a single shared question. Most habit apps use per-user local time which fragments the daily event | LOW | Already in Active. |
| "Last-to-post" / "at-risk" surfacing in feed | Makes the social pressure kinetic — you can see who hasn't posted yet and nudge them. Doesn't exist cleanly in competitors | LOW | Post-MVP candidate but cheap: filter roster by "not submitted today." |
| Reactions / emoji on submissions | Cheap social reinforcement loop; distinguishes a daily-proof app from a pure tracker. BeReal has RealMojis, Habitica has cheers | LOW-MEDIUM | Post-MVP. |
| Public "receipts" — missed-day visibility in feed | The whole product promise ("missed = visible within hours") is the differentiator. Needs to be a first-class UI element, not buried | LOW | Show a tombstone entry for absent members in today's feed. Post-MVP but powerful. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that a user, designer, or investor will suggest that actively fight the positioning. Each cross-referenced to PROJECT.md Out of Scope where applicable.

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Public / browsable group discovery | "How will people find groups?" | PROJECT.md Out of Scope. Introduces trust/safety, moderation, spam, cold-start problems that aren't the core mechanic. | Invite-only link/code. Friend-group seeding. |
| Grace days / streak freezes / streak repair (paid or free) | Duolingo-style "protect my streak"; feels generous | PROJECT.md Out of Scope. Directly contradicts "strict = social pressure." Research shows it is popular, but it is exactly the softening Accountibuzz is rejecting. | Clear onboarding copy: "Miss a day = streak resets. That is the point." |
| Configurable strictness per group | "Let admins decide" feels empowering | PROJECT.md Out of Scope. Multiplies settings surface; fractures product identity; every group becomes a different product | Accountibuzz has one opinion: strict. |
| Scaled points / milestone bonuses / XP / levels | Habitica-style gamification feels fun | PROJECT.md Out of Scope. 1 pt/day is simple and legible; scaling systems demand balancing work that isn't core-loop work | Flat 1 point. Revisit only with real group-behavior data. |
| Rotating admins, peer/democratic verification, voting | "What if the admin is absent?" | PROJECT.md Out of Scope. Multi-admin trust models balloon in complexity and are not needed at friend-group scale | Single admin. If they bottleneck, handle in v2. |
| AI-assisted auto-verification of photos/videos | "Why make the admin do manual work?" | PROJECT.md Out of Scope. Removes the human trust anchor, which IS the differentiation. Also expensive and error-prone | Human admin. The friction is a feature. |
| Auto-approve when admin is slow | "Fairness to members when admin is on vacation" | PROJECT.md Out of Scope. Breaks the "pending-until-reviewed" contract; a single weak weekend can undermine group trust | Pending-until-reviewed. Socially resolvable (nudge admin / reassign). |
| Custom per-group cutoff times | "My group works out in the evening so midnight is awkward" | PROJECT.md Out of Scope. One more config that most groups won't touch but some will misconfigure, creating "why didn't my submission count?" support load | Group timezone + midnight. |
| Financial stakes / commitment contracts / anti-charity | StickK/Beeminder are the mental model for "accountability app" | Payments, escrow, legal considerations, regulatory exposure. Accountibuzz's pressure is social, not financial — these are orthogonal philosophies. Out of Scope per PROJECT.md (monetization) | Social pressure from a 5–10 person group they know. |
| DMs / chat inside groups | "We need to talk about goals" | Scope balloon: moderation, notifications, read-receipts, threading. Members already have iMessage/WhatsApp with each other | Reactions on posts, maybe comments later. Otherwise: use your existing group chat. |
| Feed of public / cross-group activity | "Make it social like Strava" | Breaks invite-only privacy, drags in discovery/moderation | Each group is its own island. |
| Per-user timezone handling | "But I'm traveling!" | Re-introduces the fragmented "when is today over?" problem the group-timezone decision was made to avoid | Group timezone. Traveler uses the group's clock — arguably part of the commitment. |
| Multiple goals / multiple daily submissions per group | "My group wants to track workouts AND reading" | Scope balloon; fragments the single-proof ritual; turns the app into a generic habit tracker | One goal per group. Make a second group if needed. |
| Android-specific feature parity effort beyond Expo defaults | "Android users deserve equal UX" | PROJECT.md Constraints: Expo cross-platform is the delivery model; dedicated Android polish multiplies work | Ship what Expo gives for free; iterate only if real users demand it. |
| Web app / desktop client | "Accessibility, bigger screen" | PROJECT.md Out of Scope. Daily capture is phone-native. A web client also invites "upload from camera roll" fraud vectors | Mobile only. |
| Subscriptions / paid tiers at MVP | "How will this make money?" | PROJECT.md Out of Scope (monetization). Premature; distracts from validating the mechanic | Free MVP; monetize after product-market fit, possibly on group count / storage. |
| Upload from camera roll (as primary path) | "I already took the photo" | Destroys proof credibility. The whole premise is "you did the thing today," and an old gallery photo breaks that | Camera-first capture. Camera roll as fallback only if UX-tested; arguably disallow it entirely at MVP. |
| Rich profiles / bios / follower graph | "It's social, add profiles" | Pulls toward Instagram/BeReal patterns; introduces discovery, blocking, privacy surface | Minimal profile: name, avatar, groups they're in. |
| Public shaming / scoreboards outside the group | "Shame drives behavior" | Toxic, reputational risk, harassment surface. Social pressure inside a friend group is the bounded, safe version | Pressure is in-group only. |

#### Features that look essential but conflict with positioning (flagged)

- **Streak freezes / grace** — Every competitor has them; research literally says streak loss drives abandonment. Accountibuzz deliberately rejects this for social-pressure reasons. Expect user complaints; hold the line or the product has no thesis.
- **Auto-verification** — Will be asked for the moment an admin goes on vacation. Do not build; address socially (admin designates a backup by inviting a second trusted member — who at MVP simply messages the admin). Revisit only if it becomes a validated bottleneck.
- **Comments / chat** — Will feel like an obvious gap. Keep it to reactions at most; lean on the fact that these are friend groups who already have chat channels.
- **Late submissions (post-cutoff)** — BeReal shows "late" posts. Would be tempting as a middle ground. Conflicts with strict miss = reset. Do not build; a miss is a miss.

## Feature Dependencies

```
Auth (Supabase)
   └──> Create/Join Group
             ├──> Invite Link / Code
             ├──> Group Roster
             └──> Group Settings (goal, timezone, submission type)
                         │
                         ▼
                Daily Submission (photo or video)
                   ├──> Camera capture (Expo Camera)
                   ├──> Upload (Supabase Storage)
                   └──> Submission record (pending)
                              │
                              ▼
                     Admin Review Queue
                        ├──> Approve ─────> Points +1 ─> Streak++ ─> Leaderboard update
                        └──> Reject  ─────> No points (user can resubmit before cutoff)
                              │
                              ▼
                    Group Feed (today's view)
                         ├──> Member status per day
                         └──> "At-risk / not yet submitted" surfacing

Group Timezone ──drives──> Midnight Cutoff Job ──> Streak reset on miss
                                                 ──> Pre-deadline reminder push

Push Notifications ──enhances──> Submission, Review, Reminder events
                 ──requires──> Expo Push + per-device tokens + tz logic

Reactions / Emoji ──enhances──> Group Feed  (post-MVP)
"Missed-day tombstones" ──enhances──> Group Feed  (post-MVP, but cheap and high-signal)

Financial stakes  ──conflicts──> Social-pressure positioning (anti-feature)
Streak freezes    ──conflicts──> Strict-reset mechanic (anti-feature)
Discovery         ──conflicts──> Invite-only trust model (anti-feature)
Auto-verify       ──conflicts──> Human-admin trust anchor (anti-feature)
Camera-roll upload ──conflicts──> Proof credibility (anti-feature)
```

### Dependency Notes

- **Midnight cutoff requires server-side timezone math:** Clients must not be authoritative on "did you submit today?" — the server (Supabase Edge Function on a cron, or query-time computation keyed off the group's tz) decides. Otherwise clock-tampering or tz confusion breaks streaks.
- **Admin review must precede points/streak:** The point/streak pipeline only fires on the approve event, not on submission. This means a submission close to midnight that the admin reviews at 8am the next day still counts for yesterday — the verification decision is independent of real-time.
- **Reject-and-resubmit must be bounded by cutoff:** If admin rejects at 11:50pm, user has 10 minutes to resubmit. Design the UX to handle this explicitly (push notification on rejection is critical).
- **Push notifications depend on the schedule system:** Pre-deadline reminder needs a scheduled job per-group-per-day in the group's timezone. This is the single most timezone-sensitive piece of infrastructure.
- **Leaderboard is derived, not stored authoritatively:** Recompute from verified submissions to avoid drift; cache for read performance only.
- **Invite link/code requires either deep-linking config or a join-by-code fallback:** Expo deep links work but fail on some sharing surfaces; the 6–8 char code fallback is not optional.

## MVP Definition

### Launch With (v1) — matches PROJECT.md Active requirements

These ARE the Active requirements from PROJECT.md; restating them here as the feature-level MVP cut with nothing added:

- [ ] **Auth (email)** — Can't have groups without identity.
- [ ] **Create group** (name, goal text, timezone, submission type = photo or video) — Core setup; admin = creator.
- [ ] **Invite via shareable link/code** — Only onboarding path.
- [ ] **Join group via link/code** — Mirror of invite.
- [ ] **Daily submission capture** (camera-first; photo OR video per group config) — The core mechanic.
- [ ] **Admin review queue** with approve/reject — The trust anchor.
- [ ] **1 point per verified day; streak increment on verify** — Core gamification.
- [ ] **Miss-a-day streak reset** (group-tz midnight cutoff) — The strict social-pressure mechanic.
- [ ] **Leaderboard** (total points, current streak per member) — Social visibility.
- [ ] **Group feed / today's submissions visible to members** — Without this, "social pressure" has no surface. (Implicit in Active requirements but worth naming explicitly.)
- [ ] **Push notifications**: pre-deadline reminder, new submissions, admin verdicts — The daily prompt loop.
- [ ] **Leave group / remove member / sign out** — Table-stakes safety.

### Add After Validation (v1.x) — cheap wins once the core loop proves out

- [ ] **Reactions / emoji on submissions** — Trigger: members say the feed feels "cold" or "one-way." Low effort, high engagement signal.
- [ ] **"Not yet submitted today" / at-risk visibility in the feed** — Trigger: you see groups start to self-police via side-channel ("hey, you haven't posted"). Make the app surface it natively. Very cheap.
- [ ] **Missed-day tombstones in the feed** — Trigger: the "social cost" promise needs to be more visible than a leaderboard line. Converts absences into first-class feed events.
- [ ] **Backup admin / admin-designate on leave** — Trigger: first real "admin on vacation" complaint. Minimal addition (a second user with review rights); do not generalize to rotating/democratic models.
- [ ] **Submission history view per member** — Trigger: users ask to see "what has X posted this month." Low complexity.
- [ ] **Group archive / wrap-up view when a group ends** — Trigger: a group actually completes or winds down and wants their record.

### Future Consideration (v2+) — defer until validated PMF

- [ ] **Multiple groups in the nav / cross-group home screen polish** — Deferred until users are in 3+ groups at once.
- [ ] **Android-specific UX fit-and-finish** beyond Expo defaults — Deferred per PROJECT.md.
- [ ] **Comments on submissions** — Deferred; risks pulling product toward Instagram and away from ritual.
- [ ] **Monetization (subscriptions, group storage tiers)** — Deferred per PROJECT.md.
- [ ] **Web / desktop companion** — Deferred per PROJECT.md.
- [ ] **Public profile / cross-app identity** — Deferred; would invite discovery/harassment surface.
- [ ] **Vertical templates** (fitness, study, sobriety) — Deferred per PROJECT.md goal-agnostic stance.

### Explicitly NOT on any roadmap (anti-features — do not add)

- Public discovery; grace days / streak repair; configurable strictness; point scaling / XP; rotating or democratic admins; AI auto-verification; auto-approve on admin timeout; custom per-group cutoffs; financial stakes; DMs; camera-roll-as-primary submission; late-submission credit; per-user timezones within a group.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Auth | HIGH (gating) | LOW | P1 |
| Create group (w/ tz + submission type) | HIGH | LOW | P1 |
| Invite link/code + join | HIGH | LOW | P1 |
| Camera-first daily submission (photo OR video) | HIGH | MEDIUM | P1 |
| Resumable / retrying upload | HIGH (trust) | MEDIUM | P1 |
| Admin review queue (approve/reject) | HIGH | MEDIUM | P1 |
| Points + streak + strict reset | HIGH (core loop) | LOW-MEDIUM | P1 |
| Group-tz midnight cutoff (server-authoritative) | HIGH | MEDIUM | P1 |
| Leaderboard | HIGH | LOW | P1 |
| Group feed (today's submissions) | HIGH | MEDIUM | P1 |
| Push: reminder, new submission, verdict | HIGH | MEDIUM | P1 |
| Leave / remove / sign out | MEDIUM (safety) | LOW | P1 |
| Error / offline states | MEDIUM (polish) | LOW | P1 |
| "At-risk / not yet submitted today" | HIGH | LOW | P2 |
| Missed-day tombstones | HIGH | LOW | P2 |
| Reactions | MEDIUM | LOW-MEDIUM | P2 |
| Submission history per member | MEDIUM | LOW | P2 |
| Backup admin | MEDIUM | LOW | P2 |
| Group archive view | LOW | LOW | P3 |
| Comments | LOW | MEDIUM | P3 (risk: scope creep) |
| Vertical templates | LOW | MEDIUM | P3 |
| Monetization | — | HIGH | P3+ |
| Web client | LOW | HIGH | P3+ |

## Competitor Feature Analysis

| Feature | BeReal | StickK / Beeminder | Habitica | Strava clubs | Duolingo | Cohorty / Habitat | **Accountibuzz** |
|---|---|---|---|---|---|---|---|
| Daily proof format | Photo (dual cam, 2-min window) | Self-report / numeric data | Check boxes | Activity upload (auto) | Lesson completion | Check-ins | **Photo OR video, camera-first, group-admin-chosen** |
| Verification model | None (honor) | Optional referee; money enforces | None (honor) | Device / strava-auto | None (honor) | None / peer | **Single admin reviews each submission** |
| Group size / shape | Friend graph; private groups added 2023 | 1:1 contracts or open communities | Parties (up to ~30) / guilds | Clubs (can be huge) | Leagues (≈30 random) | Cohorts 5–15 | **Small groups 5–10 (designed)** |
| Streak model | Posting streaks | Numeric goal trajectory | Per-habit streaks w/ perfect-day bonus | Distance streaks | Strict streak w/ paid freezes | Per-habit | **Strict reset on miss. No freeze. No repair.** |
| Stakes | Social | Financial (real money / anti-charity) | In-game (HP loss, pet damage) | Social | Gems / social | Social | **Social only (friend group)** |
| Discovery | Friend-of-friend, no public browse | Public communities | Public party search, guilds | Public clubs | None (leagues auto) | Invite / link | **Invite-only (link/code), no discovery** |
| Deadline model | Daily prompt notif (random time, global) | Per-goal deadlines | User-local midnight | Rolling 7-day windows | User-local midnight | Cohort timezone | **Group timezone + midnight** |
| Leaderboard | No (feed only) | No | Party progress | Club-wide | League | Yes | **Yes (points + streak)** |
| Gamification complexity | Minimal | Financial | High (RPG) | Moderate (badges) | High (XP, gems, leagues) | Low | **Deliberately low (1 pt/day flat)** |

## Sources

- [BeReal: Photos & Friends Daily — App Store](https://apps.apple.com/us/app/bereal-photos-friends-daily/id1459645446)
- [BeReal — Wikipedia](https://en.wikipedia.org/wiki/BeReal)
- [BeReal adds private groups and Live Photo-like features — TechCrunch](https://techcrunch.com/2023/12/12/bereal-adds-private-groups-and-live-photo-like-features-pew-estimates-13-of-us-teens-use-app/)
- [BeReal Guide for 2026 — SimplyMac](https://www.simplymac.com/apps/bereal-guide-for-2026-how-it-works-features-and-tips)
- [stickK homepage](https://www.stickk.com/)
- [stickK — How it Works](https://stickk.zendesk.com/hc/en-us/articles/206833157-How-it-Works)
- [stickK — Commitment Contracts FAQ](https://www.stickk.com/faq/commitment/Commitment+Contracts)
- [10 Best Accountability Partner Apps (2026) — Boss as a Service](https://bossasaservice.com/blog/accountability-partner-app/)
- [6 Best Accountability Apps in 2026 — Habi](https://habi.app/insights/accountability-apps/)
- [Why Accountability Systems Fail (And How to Fix Them) — Cohorty Blog](https://www.cohorty.app/blog/why-accountability-systems-fail-and-how-to-fix-them)
- [7 Best Habit Tracking Apps with Friends Features in 2026 — Cohorty Blog](https://blog.cohorty.app/best-habit-tracking-apps-with-friends/)
- [The Ultimate Guide to the Best Habit Tracker Apps for 2026 — Mindful Suite](https://www.mindfulsuite.com/reviews/best-habit-tracker-apps)
- [7 Best Streak Tracker Apps in 2026 — Habi](https://habi.app/insights/best-streak-tracker-apps/)
- [Habitat — Group Accountability (App Store)](https://apps.apple.com/us/app/habitat-group-accountability/id1506466019)
- [I Tried Every Accountability App — Accountable AI](https://www.accountableai.xyz/blog/best-accountability-app-2026)
- Accountibuzz PROJECT.md (internal) — Active / Out of Scope / Key Decisions

---
*Feature research for: mobile social-accountability app (small friend-group, admin-verified daily media proof, strict streaks)*
*Researched: 2026-04-21*
