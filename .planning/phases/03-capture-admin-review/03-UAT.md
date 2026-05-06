# Phase 3 — Manual UAT Walkthrough

**Phase:** 03 — Capture & Admin Review
**Generated:** 2026-05-01 (Plan 03-08, Task 2)
**Target device:** iOS dev client (`npx expo run:ios`) — Android UAT deferred per Phase 1+2 precedent
**Time budget:** ~60–90 minutes for the full walkthrough
**Receipt format:** `PASS / FAIL / DEFERRED` + initials + date

---

## Pre-Flight (do once before starting)

1. **Rebuild the dev client.** Plan 03-07 added `react-native-gesture-handler` natively (additive native dep for the admin swipe queue). The dev-client binary on the device must be rebuilt to load the new native module before Checkpoint 7 will work:
   ```bash
   cd /Users/chris/projects/accountibuzz
   npx expo prebuild --clean
   npx expo run:ios
   ```
   If the device already runs a build that postdates 03-07, this is unnecessary, but when in doubt rebuild — Reanimated 4.x + worklets are picky about native parity.

2. **Confirm the app points at the live remote Supabase project, not localhost.** Check `.env`:
   ```bash
   grep EXPO_PUBLIC_SUPABASE_URL .env
   ```
   The URL should be `https://baatomkgtgkrnapisoej.supabase.co` (the production project ref). If it points at `127.0.0.1:54321`, swap it back before UAT.

3. **Have at least one iOS physical device** with the dev client installed. **Two devices preferable** for Checkpoint 5 (cross-device Realtime). If only one device is available, sign out / sign in with two test users to simulate the cross-device flow on the same hardware (set expectation: Realtime is more impressive across two devices, but the cross-fade behavior is identical).

4. **Have Network Link Conditioner ready** for Checkpoint 3 (iOS Settings → Developer → Network Link Conditioner → "Slow 3G" preset). If unavailable, mark Checkpoint 3 `DEFERRED — no NLC tooling`.

5. **Stopping conditions:**
   - 3 consecutive `FAIL`s → halt UAT, escalate to planner via `/gsd-plan-phase --gaps`.
   - Any `FAIL` on a hard-gate item — Checkpoint 2 (airplane-mode), Checkpoint 5 (cross-device Realtime), Checkpoint 6 (camera permission), Checkpoint 10 (terminal rejection) — halt and request a fix.
   - `DEFERRED` is acceptable for Checkpoint 3 (Slow-3G — tooling-dependent) and Checkpoint 4 (JWT refresh — clock manipulation may be inaccessible). **Per REVIEWS.md C9: Checkpoint 2 is non-deferrable.**

6. **Inline fixes:** If a UAT failure surfaces an obvious 1-line fix (e.g. wrong copy string, missing import), apply the fix immediately and document in the checkpoint receipt as `INLINE FIX: <description>`, then re-run the checkpoint.

---

## Checkpoint 1 — 10s video capture on physical device (SUB-02)

### Pre-conditions

- iOS dev client installed.
- User signed in, member of at least one **video** group (submission_type=video).
- Today screen open with the video group's GroupCard visible (status `none`).

### Steps

1. Tap `Submit video` on the GroupCard for the video group.
2. Capture screen opens; confirm camera viewfinder renders.
3. Tap-and-hold the shutter to start recording video.
4. Hold for 10 seconds; release.
5. Review panel appears with the captured video preview (mute-loop playback).
6. Add a short caption (`UAT video test`) and tap `Submit video`.

### Expected result

- App stays responsive during the full 10s record (no freeze, no dropped frames).
- Captured file size is **< ~25 MB** (visible in upload progress UI or Supabase Storage).
- Submit succeeds; capture screen dismisses; StatusPill cross-fades to `Pending review` on Today.

### Pass criteria

10s video records cleanly + uploads successfully + lands as `pending` on member's Today screen.

### Receipt

`PASS — CK / 2026-05-05`

### Notes
- During video recording, the red square with white square inside it was not inside the recording circle, it was over it. Screenshot in error_screenshots/red-square-not-inside-white-circle.png. **INLINE FIX** in commit `ad544ed`: shrunk recording-state inner square from 52pt to 44pt so the diagonal (62.2pt) stays inside the outer ring's inner diameter (64pt).
- Holding recording video does nothing — has to tap shutter to start, tap again to stop. Accepted by user as desired UX (tap-to-toggle is consistent with iOS Camera app).
- Video preview did not loop on the review screen — showed only the first frame as a still image. **INLINE FIX** in commit `ad544ed`: added `useEffect` that re-asserts `videoPlayer.loop = true` and calls `videoPlayer.play()` whenever `mediaUri` changes. The original `useVideoPlayer` setup callback only ran once with the empty initial source; expo-video doesn't replay it when the source updates.
- Pressing the X at the top left of the preview screen surfaced a React Navigation `POP` warning toast (`The action 'POP' with payload {"count":1} was not handled by any navigator`). Screenshot in error_screenshots/x-button-toast-error.png. **INLINE FIX** in commit `ad544ed`: replaced all 6 `router.dismiss()` call sites with a `dismissCapture()` helper that uses `router.canGoBack() ? router.back() : router.replace('/(app)/')`. Capture is a Tabs.Screen with no Stack history above it (modal-presentation deferred to Phase 3.1), so dismiss had no stack to pop.
- Tapping Submit Video showed a solid red box with no visible text, then nothing happened. Screenshot in error_screenshots/after-pressing-submit-video.png. Two compounding bugs:
  1. **INLINE FIX** in commit `ad544ed`: ReviewPanel error banner used `${t.colors.destructive}26` to derive a translucent background, but the destructive token is `hsl(4, 78%, 56%)` — the `26` alpha-suffix concat is invalid CSS for HSL. RN fell back to solid red, and because the text color was *also* `t.colors.destructive` (valid HSL), bold red text rendered on solid red bg → invisible. Fixed by switching to `hsla(4, 78%, 56%, 0.15)` literal bg + white text. This unmasked the actual error message.
  2. **INLINE FIX** in commit `3dab443`: real error was `uuid_unavailable`. `crypto.randomUUID` is not exposed on Hermes in this SDK 55 build even though `crypto.getRandomValues` is (`react-native-get-random-values` polyfills only the latter). Updated `newClientUuid` in `useSubmitToday.ts` to fall back to a `getRandomValues`-based RFC4122 v4 byte construction; both paths produce a true RFC4122 v4 UUID, REVIEWS.md C4 invariant preserved.
- After Submit Video succeeded, the GroupCard on Today did not auto-update — still showed "Submit video" CTA until app was reloaded via Metro `r`. **INLINE FIX** in commit `bc86ff2`: `useSubmitToday`'s `onSuccess` invalidated `['submission', groupId, 'today']` but the actual query key is `['submission', groupId, <isoDate>]` — the literal `'today'` string never matched a real key. Realtime subscription should have updated the cache via `setQueryData`, but it doesn't fire when the subscription unmounts during navigation to /capture/[groupId] and remounts after dismiss (events between unmount and remount are lost). Fixed by invalidating the 2-element prefix `['submission', groupId]` so prefix matching hits every date under the groupId.

```
File size: not observed in upload UI; check Supabase Storage dashboard for confirmation.
Total INLINE FIX commits: ad544ed (5 fixes bundled), 3dab443 (uuid fallback), bc86ff2 (invalidation key).
Phase 3.1 follow-ups identified: (1) restore modal-presentation for capture screen by moving it out of Tabs into root Stack; (2) Realtime subscription life-cycle hardening so events aren't lost between Today→Capture→Today navigation.
```

---

## Checkpoint 2 — Airplane-mode upload resilience (SUB-03) **HARD GATE**

> **Per REVIEWS.md C9 — non-deferrable.** SUB-03 is the headline product promise of P3 ("upload is resilient to flaky networks"). This receipt MUST be `PASS`. Other SUB-03 sub-tests can defer; this one cannot.

### Pre-conditions

- iOS dev client installed (post-rebuild — gesture handler native dep loaded).
- User signed in, member of at least one **photo** group.
- Today screen open with the photo group's GroupCard visible (status `none`).

### Steps

1. Toggle Airplane Mode **ON** in iOS Control Center.
2. Tap `Submit photo` on the photo-group GroupCard.
3. Capture screen opens; tap shutter to capture a photo.
4. Tap `Submit photo` in ReviewPanel.
5. Capture screen dismisses (back to Today).
6. Observe: GroupCard shows `Submit photo` CTA still (no Pending pill yet) AND a `QueueBadge` below the card showing `Upload pending — N MB queued`.
7. Toggle Airplane Mode **OFF**.
8. Wait up to 5 seconds.

### Expected result

- QueueBadge disappears.
- StatusPill cross-fades to `Pending review`.
- Cutoff hint changes to `Submitted just now`.

### Pass criteria

Queue auto-flushes within 5 seconds of network reconnect AND status updates to `Pending review` without manual refresh.

### Receipt

`PASS — CK / 2026-05-05` — **hard gate cleared**

### Notes

```
(record exact wall-clock time from airplane-OFF → StatusPill cross-fade)
```

---

## Checkpoint 3 — Slow-3G upload progress (SUB-03 / PITFALLS §10)

### Pre-conditions

- iOS Network Link Conditioner enabled, "Slow 3G" preset active.
- User signed in, member of a **photo** group.
- Today screen open.

### Steps

1. Tap `Submit photo` on the GroupCard.
2. Capture a photo (≥ ~5 MB if possible — turn on highest quality in capture settings if available, else accept whatever the camera produces).
3. Add caption `UAT slow-3G test` and tap `Submit photo`.
4. Observe upload progress UI in the capture screen (progress bar % climbing slowly).
5. Wait for completion (10–60s depending on file size).

### Expected result

- Progress bar advances visibly (no "silent success" — explicit progress is the SUB-03 anti-pattern guard).
- Upload completes without error.
- StatusPill becomes `Pending review` after capture screen dismisses.

### Pass criteria

Upload completes within 60s on Slow-3G AND progress UI is visible throughout.

### Receipt

`DEFERRED — CK / 2026-05-05` — soft gate, low product priority

### Notes

```
DEFERRED reason: User judgment — Slow-3G simulation requires Network Link
Conditioner setup and the failure mode it guards against (silent-success
upload UX) is already well-covered by CK-2's airplane-mode + queue flow.
The progress bar's *visibility* during upload is observable any time a
multi-MB photo is submitted in normal use; an explicit Slow-3G run does
not add coverage proportional to the setup cost. Roll into Phase 3.1 only
if a real-world bug report surfaces silent-progress on flaky cellular.
```

---

## Checkpoint 4 — JWT refresh during long upload (PITFALLS §12)

### Pre-conditions

- User signed in. The Supabase session JWT lifetime is 60 minutes by default.
- Network Link Conditioner at "Slow 3G" so the upload takes long enough that an expired JWT can intervene mid-flight.
- Optional: if device-clock manipulation is restricted by the iOS test profile, this checkpoint is **DEFERRABLE**.

### Steps

1. Note the current device time.
2. Manually advance the device clock by **65 minutes** (Settings → General → Date & Time, disable "Set Automatically", advance time forward).
3. Re-open the app; observe whether session is still considered valid.
4. Start a Slow-3G photo upload (per Checkpoint 3 steps).
5. Observe the upload completes OR the retry layer surfaces a brief retry blip in the network log before completing.

### Expected result

- Upload eventually completes (the supabase-js auto-refresh OR the upload-queue retry handler picks up the new token and finishes).
- No "session expired" hard-fail toast.

### Pass criteria

Upload survives JWT expiry mid-flight without user-visible failure.

### Receipt

`DEFERRED — CK / 2026-05-05` — soft gate, dependent on CK-3 setup

### Notes

```
DEFERRED reason: Compounds on CK-3's Network Link Conditioner (also
deferred) and adds device-clock manipulation. supabase-js auto-refresh
is the canonical path and has been validated by upstream extensively;
this checkpoint is the belt-and-suspenders safety net rather than a new
coverage area. Roll into Phase 3.1 only if a real-world session-expiry
bug surfaces in production.
```

**Cleanup:** Re-enable "Set Automatically" on Date & Time after the test.

---

## Checkpoint 5 — Cross-device Realtime cross-fade (SUB-04 / ADM-04) **HARD GATE**

### Pre-conditions

- **Two devices preferred**: device A signed in as `member`, device B signed in as `admin`. (Single-device fallback: sign out / sign in to alternate accounts on the same device — same logical flow, just less impressive demo.)
- Both users are members of the same photo group; user A is a regular member, user B is the group admin.
- On device A, Today screen is open and visible (so the StatusPill is in view).

### Steps

1. **Device A (member):** From Today, tap `Submit photo`, capture, submit. Wait for the StatusPill to show `Pending review`.
2. **Device B (admin):** Open the group detail screen. Tap the `Pending review (1)` row to open the admin queue.
3. **Device B:** Swipe right (or tap `Approve` fallback button) on the pending submission card.
4. **Device A:** Look at the GroupCard's StatusPill. **Do not refresh, do not tap, do not scroll** — just watch.
5. Within ~2 seconds, observe the StatusPill cross-fade from `Pending review` → `Approved`.

### Expected result

- StatusPill on device A updates to `Approved` within ~2 seconds of device B's approve action, with a fade transition (not a hard swap).
- No manual refresh required on device A.

### Pass criteria

Cross-fade happens automatically within ~2s on member device after admin's approve action on a separate device.

### Receipt

`PASS — CK / 2026-05-06` — **hard gate cleared**

### Notes
- INLINE FIX commit `215984b`: discovered the `supabase_realtime` publication was empty during this checkpoint. `useTodaySubmissionRealtime` channels were subscribing successfully but receiving zero events — ADM-04 + SUB-04 silently broken since 0001 foundation. Migration 0007 adds `public.submissions` to the publication. Idempotent guard so re-runs are safe.
- INLINE FIX commit `215984b` (same): SecureStore.getItemAsync threw on the first-review tooltip key `tooltip:admin_review:<user.id>` — colons aren't allowed in SecureStore keys (alphanumeric + `.` `-` `_` only). Replaced with `tooltip.admin_review.<user.id>` at both call sites.
- INLINE FIX commit `f0e125a`: opening the admin review screen also surfaced a separate Render Error — `GestureDetector must be used as a descendant of GestureHandlerRootView`. Plan 03-07 installed react-native-gesture-handler but never wrapped the root layout. Fixed by wrapping `RootLayout`'s provider tree in `<GestureHandlerRootView style={{ flex: 1 }}>`.

### Notes

```
(record observed latency in seconds; note if same-device fallback was used)
```

---

## Checkpoint 6 — Camera permission denial + Settings deep-link (SUB-01 / SUB-02) **HARD GATE**

### Pre-conditions

- iOS Settings → Privacy & Security → Camera → Accountibuzz: **denied** before starting (or freshly install / reset permissions so the OS prompt fires).
- User signed in.
- Today screen open with at least one photo or video GroupCard.

### Steps

1. Tap `Submit photo` (or Submit video).
2. iOS shows the permission prompt (only on first denial / fresh install). Tap `Don't Allow`.
3. Observe: app routes to the permission-denied screen.
4. Verify the screen renders the project-specific copy: **"Accountibuzz needs camera access to capture your daily proof."**
5. Tap `Open Settings`.
6. iOS Settings opens to the Accountibuzz permissions page.
7. Toggle Camera permission **ON**.
8. Return to the Accountibuzz app (swipe up to switch apps).
9. Observe: the permission-denied screen replays the permission probe via AppState — viewfinder appears within ~1s.

### Expected result

- Permission-denied copy matches verbatim (no Lorem-ipsum, no generic placeholder).
- Open Settings deep-link successfully opens iOS Settings → Accountibuzz.
- After granting in OS Settings and returning, viewfinder shows up without the user having to leave / re-enter the capture flow manually.

### Pass criteria

Full deny → grant → re-poll → viewfinder cycle works end-to-end with the verbatim project copy on the denied screen.

### Receipt

`_______________` (PASS / FAIL / DEFERRED — initials + date) — **must be PASS**

### Notes

```
(record the exact copy string seen; note any drift from the expected verbatim)
```

---

## Checkpoint 7 — Tinder-stack swipe gestures (ADM-02 / ADM-03)

### Pre-conditions

- User signed in as a group admin.
- Group has **≥ 3 pending submissions** (seed by having 3 members submit during pre-UAT, or use Plan 03-08 seed-data fixture if one exists).
- Admin device's dev client is the **post-03-07 rebuild** (gesture handler native module loaded — see Pre-Flight).

### Steps

1. From Today (admin's group), tap the group; on group detail tap `Pending review (3)` row.
2. Admin queue opens with 3 SwipeCards stacked.
3. **Swipe right** ~30% of screen width on the top card; release.
4. Observe: the under-threshold swipe rubber-bands back (300ms spring per UI-SPEC).
5. **Swipe right** ~70% of screen width; release.
6. Observe: the over-threshold swipe flies off-screen right (250ms ease-out), card 2 promotes to top, approve RPC fires.
7. **Swipe left** ~70% on the new top card.
8. Observe: card flies off-screen left, **reject-reason panel slides up from the bottom**, with `Optional reason for rejection` placeholder + `Submit rejection` button.
9. Type a short reason (`UAT reject test`) and tap `Submit rejection`.
10. Observe: panel dismisses, card 3 promotes to top.
11. Tap fallback `Approve` button on card 3 (a11y fallback path).
12. Observe: same approve flow as the swipe — card flies off, queue empties, empty state appears.

### Expected result

- Rubber-band animation on under-threshold (smooth spring, ~300ms).
- Fly-off animation on over-threshold (smooth ease-out, ~250ms).
- Reject-reason panel slides up only after a left-commit.
- `Approve` and `Reject` fallback buttons fire the same RPCs as the gestures.
- After 3 reviews, queue shows the empty state.

### Pass criteria

All 4 interactions (rubber-band / fly-off-right / fly-off-left + reject panel / fallback-button) work AND animations match UI-SPEC §Interaction Contracts.

### Receipt

`_______________` (PASS / FAIL / DEFERRED — initials + date)

### Notes

```
(record any animation jank, timing drift, or stuck states; note FPS if observable via Xcode)
```

---

## Checkpoint 8 — Discard-take modal during in-progress recording (SUB-02)

### Pre-conditions

- User signed in, member of a **video** group.
- Capture screen open via `Submit video` on the video GroupCard.

### Steps

1. Tap-and-hold the shutter to start recording video.
2. Continue recording for ~3 seconds.
3. While recording, tap the `×` close button in the top-left corner.
4. Observe: a modal appears with title `Discard this take?`.
5. Verify the modal's dismiss button label is **`Keep recording`** (NEVER `Cancel` — Modal component dev-warns on `Cancel` per Plan 02-03).
6. Tap `Keep recording`.
7. Observe: modal dismisses, capture screen returns to the review state with the recorded take preserved.
8. Tap `×` again.
9. Observe: same modal.
10. Tap `Discard`.
11. Observe: capture screen dismisses, returns to Today.
12. **Verify no leftover video file in the temp dir.** From the iOS Files app or via debug logs, the takeUri should be unlinked or the temp dir entry absent.

### Expected result

- Modal title `Discard this take?` exact-match.
- Dismiss label `Keep recording` exact-match (not `Cancel`).
- `Keep recording` returns to review state with take intact.
- `Discard` returns to Today AND temp file is cleaned up.

### Pass criteria

Modal copy matches exactly AND both branches (Keep / Discard) clean up temp resources correctly.

### Receipt

`_______________` (PASS / FAIL / DEFERRED — initials + date)

### Notes

```
(record exact copy strings observed; flag any leftover temp-dir entries)
```

---

## Checkpoint 9 — Reduced Motion disables gesture animations (UI-SPEC a11y)

### Pre-conditions

- iOS Settings → Accessibility → Motion → **Reduce Motion: ON**.
- User signed in as group admin with ≥ 1 pending submission.
- Admin queue open.

### Steps

1. Swipe right on the top card past the threshold.
2. Observe: card snaps off-screen instantly (no fly-off animation), queue advances.
3. Swipe left on next card past the threshold.
4. Observe: card snaps off-screen instantly, reject panel slides up (the panel itself can keep its slide animation since it's not a gesture-driven motion, OR can also be instant — confirm against UI-SPEC line 1070).
5. Tap fallback `Approve` button.
6. Observe: same instant card removal.
7. Watch the StatusPill on a member's Today screen (separate device).
8. Observe: StatusPill change is instant, not a cross-fade.

### Expected result

- Swipe gestures still work (input unchanged); only the visual fly-off / cross-fade animations are disabled or instant per UI-SPEC reduced-motion policy.
- Fallback approve / reject buttons still functional.

### Pass criteria

Gesture inputs work AND animations honor Reduce Motion (instant transitions instead of fly-off / cross-fade).

### Receipt

`_______________` (PASS / FAIL / DEFERRED — initials + date)

### Notes

```
(record which animations were instant vs. still animated; flag if any animation ignored Reduce Motion)
```

**Cleanup:** Disable Reduce Motion in iOS Settings after the test.

---

## Checkpoint 10 — Terminal rejection invariant (D-12) **HARD GATE**

> Per CONTEXT D-12: rejection is terminal. Submitter is BLOCKED from re-submitting until next group-local midnight. This is the rescoping that drove ADM-04 + ROADMAP SC#5 reword (also Plan 03-08 Task 4).

### Pre-conditions

- Two test accounts in the same group: admin A, member B.
- Member B has **not yet submitted today**.
- Admin A's review queue is empty.

### Steps

1. **Member B:** Submit a photo on Today. Wait for `Pending review` pill.
2. **Admin A:** Open admin queue, swipe left on B's submission, type reason `UAT terminal-reject test`, tap `Submit rejection`.
3. **Member B (Today screen):** Wait ~2 seconds.
4. Observe: Member B's GroupCard StatusPill cross-fades from `Pending review` to **`Today didn't count`** (rejected pill state).
5. Tap the `Today didn't count` pill.
6. Observe: rejection-reason modal opens showing `UAT terminal-reject test` text, the cutoff timestamp, and a `Got it` close button.
7. Dismiss modal.
8. **Member B:** Attempt to submit again. Tap `Submit photo` on the GroupCard.
9. Observe: typed error toast `You already submitted today. Streak's safe — see you tomorrow.` (or whichever variant is wired in 03-07 — note exact copy).

### Expected result

- StatusPill cross-fades to `Today didn't count` after admin reject (~2s, terminal state).
- Tapping the rejected pill shows the reason modal with verbatim reason text.
- Re-submit attempt is blocked with the `already_submitted_today` typed error.
- Streak reset / new-day unblock is owned by Phase 5 pg_cron — out of scope for this checkpoint, but confirm the resubmit BLOCK is in effect (the unlock side will be P5).

### Pass criteria

Reject lands as terminal `Today didn't count` AND submitter cannot resubmit same day.

### Receipt

`_______________` (PASS / FAIL / DEFERRED — initials + date) — **must be PASS**

### Notes

```
(record the exact typed-error copy seen on resubmit attempt; flag if the pill text doesn't match `Today didn't count` verbatim)
```

---

## Checkpoint 11 — Full E2E loop (all P3 requirements)

### Pre-conditions

- Two devices (A + B) OR same-device alternate accounts.
- Both fresh test accounts (or use existing test users — note which).

### Steps

1. **Device A:** Sign up new test user `uat-admin-1`.
2. **Device A:** Create a photo group (`UAT E2E group`, goal `daily test`, photo type, default tz).
3. **Device A:** Tap `Share code` → copy / share the invite code or link.
4. **Device B:** Sign up new test user `uat-member-1`.
5. **Device B:** Open the deep-link `accountibuzz://invite/{code}` OR enter the code via `Join with code`.
6. **Device B:** Tap `Join group` → confirm membership.
7. **Device B:** From Today, submit a photo to the new group.
8. **Device B:** Observe `Pending review` pill on Today.
9. **Device A:** Observe `Pending review (1)` row on group detail (admin-only PendingReviewRow visible — PLAT-03 UI gate).
10. **Device A:** Open admin queue, swipe right (approve) on B's submission.
11. **Device B:** Observe StatusPill cross-fade to `Approved` within 2s.
12. **Device A (admin is also a member):** Submit a photo from Today.
13. **Device A:** Observe `Pending review` pill on own GroupCard.
14. **Device A:** Open admin queue (admins can review their own submissions). Swipe right.
15. **Device A:** Observe own StatusPill cross-fade to `Approved`.
16. **Both devices:** Confirm both members have `Approved` StatusPill and the `Pending review (N)` row is hidden (count = 0) on group detail.

### Expected result

- All 16 steps complete without errors.
- PendingReviewRow visibility gate honors UI-only admin check + RPC zero-leak (member B never sees the row even with count > 0).
- Realtime cross-fade fires twice (once per approve) within 2s.
- Final state: 2 approved submissions, 0 pending, both members have `Approved` pill.

### Pass criteria

Full sign-up → join → submit → review → approval cycle works end-to-end on both devices.

### Receipt
INLINE FIX bundle (commits ad544ed, 3dab443, bc86ff2): ReviewPanel HSL alpha bug, Shutter geometry, video preview play(), X-button POP, uuid fallback for Hermes, invalidation key mismatch.

`_______________` (PASS / FAIL / DEFERRED — initials + date)

### Notes

```
(record any step-level FAILs separately; this checkpoint implicitly validates SUB-01, SUB-04, SUB-05, ADM-01, ADM-02, ADM-04, PLAT-03 + INV-01/INV-02 reuse + GRP-01/02 reuse)
```

---

## Walkthrough Summary

After completing all 11 checkpoints, fill in the totals:

| Metric | Value |
|--------|-------|
| Checkpoints PASS | __ / 11 |
| Checkpoints FAIL | __ / 11 |
| Checkpoints DEFERRED | __ / 11 |
| Hard-gate items PASS | __ / 4 (CK-2, CK-5, CK-6, CK-10) |
| Inline fixes applied | __ |
| Total walkthrough time | __ min |

**Hard-gate rule:** All 4 of CK-2, CK-5, CK-6, CK-10 must be `PASS`. Any FAIL on these halts UAT.

**Phase-close decision:**

- ☐ All hard gates PASS + no outstanding FAILs → Phase 3 PASS, advance to Phase 4 planning.
- ☐ Any hard gate FAIL → halt + escalate via `/gsd-plan-phase --gaps` for a Plan 03-09 fix-pass.
- ☐ Soft DEFERRED items only (CK-3, CK-4) → Phase 3 PARTIAL, document deferred reason, advance.

**Sign-off:**

- Walkthrough operator: `_______________` (initials)
- Date completed: `____-__-__`
- Final verdict: `PASS / PARTIAL / FAIL`
