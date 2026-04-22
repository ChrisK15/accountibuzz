# Pitfalls Research

**Domain:** Accountability / social-goal mobile app (React Native + Expo + Supabase)
**Researched:** 2026-04-21
**Confidence:** HIGH for technical stack pitfalls (verified against official Expo/Supabase docs + community post-mortems); MEDIUM for social-dynamics pitfalls (inferred from retention research + competitor observation, not direct user studies)

## Critical Pitfalls

### Pitfall 1: Group-Timezone Midnight is Computed on the Device

**What goes wrong:**
Streak resets and cutoff enforcement are computed from `new Date()` on the client. A user who travels (phone timezone = Tokyo, group timezone = NYC) sees "submit by midnight" against the wrong clock. Worse: users set their phone clock back to "save" a streak. Or the client computes "today's date" to upsert a submission row, and two devices on opposite sides of midnight insert two rows for "the same" day.

**Why it happens:**
JavaScript `Date`, `toLocaleDateString`, and naive `startOfDay` operate in the device's local zone. Developers test in one timezone and never see the bug. The group-timezone decision (good!) is only half-done if the *calendar date* is derived anywhere outside the database.

**How to avoid:**
- Store group timezone as an IANA identifier (`America/New_York`), never an offset (`-05:00`) — offsets are wrong half the year due to DST.
- Compute "what calendar date is this submission for?" on the **server** (Postgres `timezone('America/New_York', now())::date`) or in an edge function — never trust the client.
- Store `submission_date date` (calendar date in group TZ) alongside `created_at timestamptz` on every submission. The `date` is the business key; the `timestamptz` is audit.
- Use Luxon (not date-fns-tz, not dayjs) on the client for *display only*. Luxon has the most correct DST/ambiguous-time handling.
- Write a test that sets `process.env.TZ=Asia/Tokyo` and asserts a group in `America/Los_Angeles` still computes the right cutoff.
- Do not let the client send `submission_date` — derive it on insert via a Postgres default or trigger.

**Warning signs:**
- Any date math in React Native components.
- `new Date().toISOString().slice(0,10)` anywhere in submission code.
- Streak-reset logic that runs on app open instead of on a scheduled job.
- A tester in a different timezone reports "it said I missed a day but I didn't."

**Phase to address:** Foundation — before any submission or streak feature ships. Cheap now, catastrophic later (a single wrong streak reset destroys the core product value for that user).

---

### Pitfall 2: Streak Accounting Race Conditions (Double Submission, Double Approval)

**What goes wrong:**
A user taps "submit" twice on a flaky connection. Two rows insert, admin approves both, streak increments twice for one day. Or admin taps approve on two devices. Or the retry layer resubmits and creates duplicates. Or the streak reset job races an approval crossing midnight.

**Why it happens:**
Application-level "check if exists, then insert" is never safe under concurrency. Retry logic without idempotency keys compounds the problem. Streak counters stored as mutable integers (`UPDATE ... SET streak = streak + 1`) are fine for a single writer but lose updates under contention.

**How to avoid:**
- **Unique constraint** on `(user_id, group_id, submission_date)` in `submissions` table — the database rejects duplicates regardless of client bugs.
- Use `INSERT ... ON CONFLICT DO NOTHING RETURNING id` so retries are safe and idempotent.
- **Do not store `streak` as a mutable counter.** Compute it on read from approved submissions (window function or materialized view refreshed by trigger). If you must denormalize for leaderboard performance, derive it in a single Postgres function (`SECURITY DEFINER`) inside a transaction, never from the client.
- Approval state machine: `pending → approved | rejected`, with a CHECK constraint that approval can only transition from `pending`. Don't let re-approval double-increment anything.
- Scheduled "missed-day streak reset" should be idempotent: running it twice for the same day produces the same result. Key on `(user_id, group_id, date)` processed markers.

**Warning signs:**
- Code pattern: `const existing = await select(...); if (!existing) await insert(...)`.
- `streak` column being written from multiple places.
- No unique index on the submissions table.
- Approval handler doesn't check current state before transitioning.

**Phase to address:** Foundation schema design. Cannot be retrofitted easily — getting the schema wrong means data cleanup later.

---

### Pitfall 3: Supabase RLS Disabled (or Enabled Without Policies)

**What goes wrong:**
A new table ships without RLS enabled. The anon key — shipped in the mobile app binary and extractable in 60 seconds — can read/write every row in the database. Or RLS is enabled but no policies exist, so legitimate queries silently return empty results (no error, just empty arrays) and the developer "fixes" it by temporarily using the service role key in the app.

**Why it happens:**
RLS is **off by default** on new tables in Supabase. In January 2025, 170+ Lovable-generated apps leaked entire databases for this reason. "Empty results with no error" leads developers to conclude the query is wrong, not the policy.

**How to avoid:**
- Enable RLS on **every** table in the public schema as soon as it's created. Treat a PR that adds a table without RLS as a bug.
- Add a CI check (or a pg query run in local dev) that fails if any public-schema table has `rowsecurity = false`.
- Never ship the `service_role` key in the mobile app. Ever. It bypasses RLS entirely. Use it only in edge functions / server code.
- Never base policies on `auth.jwt() -> 'user_metadata'` — end users can modify user_metadata. Use `app_metadata` (server-set) or join against a `profiles`/`group_members` table.
- For views, set `security_invoker = true` (Postgres 15+) or they silently bypass RLS of underlying tables.
- Test every policy with at least two user fixtures: a member of the group, and a non-member. Write these as pgTAP or integration tests.

**Warning signs:**
- A feature "worked" immediately after turning on RLS without writing any policies (it's reading with service_role somewhere).
- Queries returning `[]` with no explanation.
- Any reference to `process.env.SUPABASE_SERVICE_ROLE_KEY` in the React Native codebase.
- Policies that reference `auth.jwt()->>'email'` or `user_metadata`.

**Phase to address:** Foundation — before any real data touches the database. Add to definition-of-done for every table.

---

### Pitfall 4: Media Upload Fails Silently on Flaky Mobile Networks

**What goes wrong:**
User records a 30-second video on cellular, taps submit, app shows a spinner, network drops, upload dies. The UI either hangs forever or says "success" because the app crashed mid-request. Users think they submitted; streak resets the next day. Or the Supabase client chokes on blobs (a known React Native issue) and the upload silently fails with a misleading "Network Error."

**Why it happens:**
- Default `supabase.storage.upload()` with a `Blob` often fails on React Native — you must convert to `ArrayBuffer` or use a `FormData`-based path.
- No retry, no resumability, no background upload.
- The "success" toast fires on promise resolve, but the promise resolves because of optimistic client state, not server ACK.
- File size isn't validated client-side; a 200 MB video times out on 3G.

**How to avoid:**
- Use **TUS resumable uploads** (Supabase Storage supports TUS; there's a working `react-native-resumable-upload-supabase` reference implementation). Resumable = survives network drops.
- Convert image/video files via `arrayBuffer()` or use the documented `FormData` pattern from Supabase's Expo quickstart — do not pass raw blobs.
- Compress video aggressively before upload (expo-video-thumbnails + a compression pass, or limit to short clips ≤15s at modest resolution). Video is the worst offender; consider photo-only for MVP.
- Two-phase submission: (1) upload media to storage, get the object path, (2) **then** insert the `submissions` row pointing at it. Never have a submission row without a valid media object, and clean up orphaned objects with a scheduled job.
- Show explicit upload progress. Never auto-dismiss the upload UI until the server has confirmed both the storage object and the DB row.
- Offline queue: if upload fails, persist the intent (local file URI + submission metadata) and retry on reconnect. Tell the user clearly "not submitted yet."
- Validate file size client-side before starting. Reject or compress above a threshold.

**Warning signs:**
- Uploads work perfectly in the simulator on wifi and nowhere else.
- Submissions table has rows pointing at storage objects that don't exist, or vice versa.
- No upload progress UI.
- "Upload failed" is a toast the user can dismiss and forget.

**Phase to address:** Submission phase — this is the critical path for the core value mechanic. Invest upfront.

---

### Pitfall 5: Push Notifications Silently Don't Arrive (Especially Android)

**What goes wrong:**
Users miss the pre-deadline reminder because the notification never showed up. Android drops it silently for one of many reasons; user doesn't realize and misses the cutoff; streak resets; user quits the app. The admin doesn't get pinged about pending submissions, creating Pitfall 6.

**Why it happens:**
- **Expo Go no longer supports push on Android as of SDK 53** — many devs test in Expo Go and think it's working.
- Android 13+ requires explicit notification permission prompt, which only appears after a notification channel has been created.
- Android drops notifications with no channel silently — no error, just nothing.
- Android 12+ requires `SCHEDULE_EXACT_ALARM` permission for reliable scheduled notifications; without it, Doze mode delays or drops them.
- iOS APNs and Android FCM credentials are easy to misconfigure on EAS; the push token looks valid but delivery fails.
- Push tokens rotate and apps don't register a rotation listener, so old tokens go stale.

**How to avoid:**
- Use a **development build**, not Expo Go, from day one — set this expectation in the dev loop.
- Create notification channels on app start on Android, before requesting permission.
- Handle `Notifications.addPushTokenListener` to detect rotation and update the server.
- Don't rely on push for the streak-saving reminder alone. Use an in-app "you have N hours left" banner any time the app is opened. Push is best-effort; the app's own UI is reliable.
- Test push on a real Android 13+ device and a real iOS device — simulators lie.
- Store push tokens per-device, not per-user (a user may have multiple devices). Dedupe on (user, token).
- For the pre-deadline reminder, schedule it server-side (edge function + cron) keyed on group timezone, not client-side with `Notifications.scheduleNotificationAsync` — local scheduling breaks when the app is force-killed.

**Warning signs:**
- "Works on my iPhone" but friends on Android aren't getting pinged.
- Tokens stored but never refreshed.
- Scheduling logic that assumes the app will be running.
- No notification channels defined.

**Phase to address:** Notifications phase — but the *scheduling architecture* (server-side cron in edge functions) belongs in foundation. If you schedule client-side, retrofitting is painful.

---

### Pitfall 6: Admin-Bottleneck Kills the Core Loop

**What goes wrong:**
User submits at 8 PM. Admin doesn't review until next morning. Leaderboard is stale. "Pings when admin reviews" notification fires 14 hours later — user has moved on. Admin goes on vacation; submissions pile up; members see a static leaderboard and churn. A single non-responsive admin silently kills the group's engagement in week 2.

**Why it happens:**
"Pending-until-reviewed" is correct for trust but wrong for psychology. The dopamine hit of seeing your submission count and leaderboard move happens only when the admin acts. No admin = no feedback loop = dead group.

**How to avoid:**
- **Optimistic UI for the submitter:** show their submission immediately with a "pending review" badge. Don't hide it behind admin approval. Streak/points can be "provisional" until approved.
- Make admin review frictionless: a single screen with pending submissions as a swipeable stack (Tinder-style: approve/reject). No navigation needed, no individual detail screens to open.
- Admin gets a **daily digest push** ("5 submissions waiting") plus real-time pings for each, so they can review in 2-minute bursts rather than sit-down sessions.
- Show admin the "time since submission" prominently. Social pressure on the admin to not be the bottleneck.
- Show members an "awaiting review: 3" indicator on the leaderboard so they know the admin is the gate, not the system. This reframes the wait.
- Track admin response time as a metric. If median >6 hours in testing, the human-only model is broken — revisit the "no auto-approve" decision with real data.
- Onboarding for new admins: explicit "you are responsible for reviewing daily. Here's how."

**Warning signs:**
- Admin stops opening the app.
- Members have >24h median time-to-approval.
- Leaderboard doesn't change day-to-day despite submissions.
- A group's submission rate drops after the admin misses 2 days.

**Phase to address:** Admin review phase. But "optimistic pending UI" must be designed in from the first submission screen — it's not a retrofit.

---

### Pitfall 7: Week-2 Small-Group Death Spiral

**What goes wrong:**
Week 1: novelty carries the group, everyone submits. Week 2: one person misses a day. Streak resets. They feel shame and disengage. Without them, the group feels smaller; two more people miss the next day. By end of week 2, the group is dead. The "strict reset = social pressure" mechanic cuts both ways: it ejects stragglers, and groups of 5-10 can't afford to lose 2-3 people.

**Why it happens:**
Average mobile app Day-30 retention is 5.7%. Accountability apps rely on *group* retention, not individual retention — if 2 of 6 members churn, the remaining 4 churn from lack of group energy. Research shows groups of 5-12 are optimal, but that's on the assumption that members stay engaged; a shrinking group below 5 accelerates death.

**How to avoid:**
- **Invite-more-than-you-need:** onboarding should encourage 7-10 members even for a group of 5-6, because some will drop.
- **Visible re-engagement hooks** for broken-streak members: "you missed yesterday — X, Y, Z still posted, jump back in" rather than shaming silence.
- Celebrate group-level metrics ("4 of 6 submitted today") not just individual streaks, so one person's reset doesn't crater group feeling.
- First-week onboarding should *ensure* the first 3 days are friction-free: prominent reminders, easier camera flow, admin prompt to approve quickly. The habit must form before the strict mechanic tests it.
- Leave the "strict reset" constraint as is (it's correct) but balance with a visible "comeback" narrative — a member who restarts a streak after breaking it gets a small visual moment. Not a grace day; a re-entry ritual.
- Track group-level weekly active rate (percentage of members submitting >=5 days/week), not just individual DAU. This is the real health metric.
- Have a manual "is this group alive?" check at day 7 and day 14 during friend-group testing. Talk to group admins directly. Don't rely on metrics alone at MVP scale.

**Warning signs:**
- A single member's broken streak correlates with others' next-day misses (check this in analytics).
- Groups drop from 6 submissions/day to 3 submissions/day within 3 days.
- Admin asks "should I still approve?" — means they've disengaged from the purpose.
- No re-engagement after a miss; broken-streak users never submit again.

**Phase to address:** Not a single phase — this is product framing. But a "re-engagement notification" and "group health visible to admin" should land before first external testing, not after.

---

## Moderate Pitfalls

### Pitfall 8: Storage RLS Policies Don't Match Table RLS

**What goes wrong:** A user is removed from a group. Table RLS hides new submissions from them, but storage bucket policy still lets them fetch media by known URL. Or: anyone with a signed URL can share it publicly. Or: public bucket accidentally used, bypassing access controls entirely.

**How to avoid:** Use a **private** bucket. Generate short-lived signed URLs server-side (edge function) keyed on the same group-membership check as the table RLS. Never make the submissions bucket public. Write storage.objects RLS policies that join to group_members — don't just check ownership. Test that an ex-member can't download via signed URL after removal.

### Pitfall 9: Expo SDK Upgrade Catches You Off Guard

**What goes wrong:** SDK 55 requires the New Architecture (can't opt out). A native module in your stack (image picker, video, notifications) hasn't updated. You're stuck on an old SDK with mounting security warnings, or you face a multi-day upgrade with no user-facing value.

**How to avoid:** Run `npx expo-doctor` weekly — it flags incompatible dependencies. Stay within 1 SDK version of latest during MVP. Prefer Expo-maintained modules (`expo-image-picker`, `expo-av`, `expo-notifications`) over third-party equivalents — they get upgraded in lockstep. Upgrade *one SDK version at a time*, never skip. Keep your native folders prebuild-clean; don't eject unless forced.

### Pitfall 10: Testing Only on Wi-Fi and Simulators

**What goes wrong:** Everything works in dev. First real user on LTE with 2 bars has 40% of uploads fail. Push doesn't arrive on their carrier-locked Android.

**How to avoid:** Chrome DevTools network throttling (Slow 3G) for every upload test. Physical device testing mandatory before any external testing round. Airplane-mode-on-submit test for offline queue. Real iOS + real Android + at least one low-end Android before friend-group rollout.

---

## Minor Pitfalls

### Pitfall 11: Realtime Subscriptions Leaking
Supabase Realtime subscriptions left open when screens unmount. Connections stack up, battery drains, backend cost grows. Always clean up in `useEffect` returns.

### Pitfall 12: JWT Expiry Mid-Upload
Auth token expires during a long video upload; the resumable upload fails at the commit step. Refresh token proactively, or build refresh into the retry layer.

### Pitfall 13: Leaderboard N+1
Leaderboard query hits `profiles` per row instead of joining. Fine at 5 users, 2-second load at 50. Use a single view or materialized view.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Auth & groups schema | RLS not enabled on first tables | Add CI check for RLS-enabled-on-all-public-tables from day one |
| Group timezone cutoff | Client-computed dates leak in | Derive submission_date in Postgres; add TZ-shifted test fixture |
| Submission (media upload) | Silent failures on bad network | TUS resumable + two-phase commit + offline queue from first implementation |
| Admin approval | Bottleneck kills loop | Optimistic pending UI + swipe-review UX designed in, not bolted on |
| Streaks & leaderboard | Race-condition double-counts | Unique constraint `(user_id, group_id, submission_date)`; compute streak on read |
| Push notifications | Android silent drops | Dev build from start; server-side scheduling; real-device test matrix |
| Friend-group rollout | Week-2 death spiral | Invite-more-than-needed; re-engagement flow; group-health metric |

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store `streak` as mutable counter | Simpler leaderboard query | Race-condition wrong counts; hard to audit; can't reconstruct | Never. Derive from submissions. |
| Client-computed "today's date" | One less round trip | Timezone/travel/clock-tamper bugs; cross-midnight duplicates | Never for business logic. Display only. |
| Public storage bucket | Easier media URLs | Ex-members retain access; URLs leak publicly | Never for user-uploaded content. |
| Service role key in client | "Just make it work" during dev | Total data breach | Never. Use edge functions. |
| Schedule push notifs client-side | Works in SDK sample code | Breaks when app killed; wrong timezone | Only for in-app timers, never for deadline reminders. |
| Skip expo-doctor | Faster builds | Stuck on old SDK with broken deps | Only in a frozen release branch. |
| Synchronous upload + DB insert | Simpler code | Orphan rows / orphan objects on failure | Never. Use two-phase with cleanup. |
| Auto-approve after N hours | Solves admin bottleneck easily | Undermines the "human trust" core value | Only if measured admin-latency >12h in testing — revisit deliberately. |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Storage upload from RN | Pass a `Blob` directly | Convert to `ArrayBuffer` via `arrayBuffer()` or use `FormData` per Supabase Expo quickstart |
| Supabase Auth in RN | Use browser `localStorage` adapter | Use `@react-native-async-storage/async-storage` adapter explicitly |
| expo-notifications on Android | Skip channel creation | Create channels before requesting permission; permission prompt won't show otherwise |
| expo-image-picker video | Use default MP4/HEVC with no compression | Compress/transcode before upload; limit duration client-side |
| Supabase RLS with auth | Reference `user_metadata` in policy | Use `app_metadata` or join to server-controlled `group_members` |
| Supabase Realtime | Forget to unsubscribe | Always cleanup in `useEffect` return / on screen blur |
| EAS Build with native deps | Upgrade SDK without checking deps | Run `npx expo-doctor` + check React Native Directory for New Arch compat |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Missing index on RLS-policy columns | All queries slow, scales badly | Index every column referenced in RLS (`group_id`, `user_id`) | ~1k rows per table |
| Leaderboard N+1 to `profiles` | Load time grows with group size | Single JOIN query or view | ~20 members |
| Loading all submissions on leaderboard | Data transfer grows over time | Paginate; show only recent; aggregate totals in a view | ~30 days of data |
| Streak recomputation on every read | Leaderboard slow at scale | Denormalize via trigger-maintained column OR materialized view refreshed on approval | ~50 active users |
| Listing storage bucket objects | Slows as bucket grows | Always query the `submissions` table, never list storage directly | ~1000 objects |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| RLS disabled on any public-schema table | Total data exposure | CI check; RLS-on by default on every table |
| Service role key shipped in app | Admin access to everything | Never import it into the RN project; linter rule |
| Signed URL TTL too long (days) | URLs leak publicly, content stays accessible | Short TTLs (minutes), regenerate on view |
| Policies using `user_metadata` | User escalates by editing their own metadata | Use `app_metadata` (server-controlled) or DB-backed role |
| Public storage bucket for media | Anyone with URL can view/share | Private bucket + signed URLs gated by membership |
| No rate limit on submission insert | A malicious user spams rows | Per-user rate limit in edge function; unique constraint anyway blocks dupes |
| Invite links never expire | Old links admit ex-friends | Group-code rotation option; per-link expiry/use count |
| Admin can impersonate submissions | Admin approves their own content as another user | RLS: admin can read all in group, but insert only as self |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Pending review" hidden until approved | Submitter thinks nothing happened | Show submission immediately with pending badge; provisional streak |
| No upload progress on video | User kills app thinking it hung | Explicit progress bar; disable navigation during upload |
| Silent miss (no push, no in-app) | Streak resets without user knowing why | In-app banner on next open: "you missed yesterday — here's why" |
| Streak reset with no re-entry prompt | User feels shame, doesn't return | Gentle "jump back in, 4 others posted today" flow |
| Admin review requires N taps per submission | Admin burns out, bottleneck grows | Single-screen swipe queue; bulk-approve option for trusted groups |
| Leaderboard hides admin-review lag | Members blame system when it's admin | Show "3 awaiting review" next to leaderboard |
| Group feels empty at 3 members | Perception of dead group | Show recent activity across all members; encourage inviting more |

---

## "Looks Done But Isn't" Checklist

- [ ] **Submission flow:** works when phone's timezone ≠ group's timezone — verify with a manual phone-TZ change test
- [ ] **Submission flow:** survives network drop mid-upload — verify with airplane-mode-on-submit
- [ ] **Submission flow:** rejects duplicate for same day — verify by tapping submit twice quickly
- [ ] **Streak calculation:** correct across DST boundary — verify with March/November dates in a DST zone
- [ ] **Streak calculation:** doesn't double-count re-approved submissions — verify by approve → reject → approve
- [ ] **RLS:** non-member of group cannot read submissions — verify with a second-user fixture
- [ ] **RLS:** every public-schema table has `rowsecurity = true` — verify with `SELECT * FROM pg_tables WHERE schemaname='public'`
- [ ] **Storage:** ex-member cannot fetch media via signed URL after removal — verify manually
- [ ] **Push notifications:** deliver on real Android 13+ physical device, not just simulator
- [ ] **Push notifications:** deliver when app is fully killed — verify by swipe-killing then triggering
- [ ] **Admin review:** daily digest fires even when no individual pings — verify with admin offline for a day
- [ ] **Group cutoff:** enforced at group-TZ midnight even when admin is asleep / app is closed — server-side cron
- [ ] **Leaderboard:** correct under concurrent approvals — verify by two-device approval test
- [ ] **Onboarding:** group creator sets timezone once and it's correctly persisted — verify in DB directly

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong streaks from timezone bug | MEDIUM | Replay approvals from source-of-truth `submissions` table; requires streaks be derived, not stored |
| RLS-leaked data | HIGH | Rotate anon key; audit what was exposed; notify affected users; enable RLS; write tests |
| Orphaned storage objects / DB rows | LOW | Scheduled cleanup job matching `submissions.media_path` against `storage.objects` |
| Double-submit duplicates | LOW (with unique constraint) | Constraint prevents; if it already happened, dedupe script |
| Dead group (week-2 spiral) | HIGH | Rarely recoverable — focus on preventing; manual intervention by creator for friend-group tests |
| Stuck on old Expo SDK | MEDIUM-HIGH | Upgrade one version at a time; may require replacing incompatible deps |
| Admin bottleneck burning out admins | MEDIUM | Redesign review UX; add digest; ultimately may require revisiting auto-approve decision |
| Push token staleness | LOW | Add rotation listener; next app open refreshes |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Timezone/midnight bugs | Foundation (schema) | Test with TZ≠group TZ; DST date fixtures; `process.env.TZ` test |
| Streak race conditions | Foundation (schema) | Unique constraint exists; streak derived not stored; double-tap test |
| RLS disabled / misconfigured | Foundation (schema) | CI check for RLS on all tables; two-user access test per table |
| Media upload failures | Submission phase | Airplane-mode test; TUS resumable verified; two-phase commit |
| Push notification unreliability | Notifications phase | Real Android + iOS physical device test; server-side scheduling only |
| Admin bottleneck | Admin review phase | Optimistic pending UI; swipe-review implemented; daily digest |
| Week-2 death spiral | Pre-rollout / onboarding | Invite-more-than-needed flow; re-engagement notifications; group-health metric |
| Storage RLS holes | Submission / access phase | Private bucket + signed URL test after member removal |
| Expo SDK upgrade pain | Ongoing / every SDK release | `expo-doctor` in CI; one-version-at-a-time policy |

---

## Sources

- [Supabase RLS common pitfalls — ProsperaSoft](https://prosperasoft.com/blog/database/supabase/supabase-rls-issues/)
- [Fixing RLS misconfigurations — VibeAppScanner](https://vibeappscanner.com/supabase-row-level-security)
- [Supabase Token Security docs](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [Supabase Storage Access Control docs](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Expo React Native quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [React Native file upload with Supabase Storage](https://supabase.com/blog/react-native-storage)
- [Resumable upload reference implementation — saimon24](https://github.com/saimon24/react-native-resumable-upload-supabase)
- [Expo Notifications FAQ & troubleshooting](https://docs.expo.dev/push-notifications/faq/)
- [Expo Push Notifications critical setup mistakes — Sashido](https://www.sashido.io/en/blog/expo-push-notifications-setup-caveats-troubleshooting)
- [Making Expo Notifications Actually Work on Android 12+ & iOS](https://medium.com/@gligor99/making-expo-notifications-actually-work-even-on-android-12-and-ios-206ff632a845)
- [Expo SDK 55 Migration Guide 2026](https://reactnativerelay.com/article/expo-sdk-55-migration-guide-breaking-changes-sdk-53-to-55)
- [Expo upgrade troubleshooting](https://github.com/expo/fyi/blob/main/troubleshooting-sdk-upgrades.md)
- [Luxon timezone & DST docs](https://github.com/moment/luxon/blob/master/docs/zones.md)
- [Luxon vs date-fns-tz comparison](https://medium.com/@sungbinkim98/comparing-date-fns-tz-and-luxon-55aee1bab550)
- [Postgres race conditions with unique constraints](https://copyprogramming.com/howto/concurrent-transactions-result-in-race-condition-with-unique-constraint-on-insert)
- [Handling race conditions in idempotent operations](https://medium.com/@ankurnitp/handling-race-conditions-in-idempotent-operations-a-practical-guide-for-payment-systems-eb045b9ca7c4)
- [Small group accountability apps research — Cohorty](https://blog.cohorty.app/small-group-accountability-apps-complete-guide/)
- [2026 App Retention Guide — GetStream](https://getstream.io/blog/app-retention-guide/)

---
*Pitfalls research for: Accountibuzz (accountability / social-goal mobile app on Expo + Supabase)*
*Researched: 2026-04-21*
